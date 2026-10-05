// Local Supabase-compatible gateway for development and end-to-end tests (no Docker).
//
//   /rest/v1/*     -> PostgREST (real RLS against the real migrations)
//   /auth/v1/*     -> a small GoTrue-compatible auth server (password, magic link/PKCE, recovery)
//   /storage/v1/*  -> a small Storage-compatible server; object access goes through the real
//                     storage.objects RLS policies by running queries as the caller's role
//   /__mail        -> inbox of every e-mail the auth server "sent" (for tests)
//
// NOT for production: tokens live in memory, passwords use scrypt, e-mail is never delivered.
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import pg from 'pg';
import { sign as signJwt, stackKeys } from './keys.mjs';

const PORT = Number(process.env.GATEWAY_PORT || 54321);
const POSTGREST = process.env.POSTGREST_URL || 'http://127.0.0.1:54322';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long';
const DB_URL = process.env.STACK_DB_URL || 'postgresql://postgres@127.0.0.1:54329/clearentry_dev';
const PUBLIC_URL = process.env.GATEWAY_PUBLIC_URL || `http://127.0.0.1:${PORT}`;
const STORAGE_DIR = process.env.STORAGE_DIR || path.resolve('.stack/storage');
const AUTO_CONFIRM = process.env.AUTO_CONFIRM !== 'false';

const pool = new pg.Pool({ connectionString: DB_URL, max: 8 });
fs.mkdirSync(STORAGE_DIR, { recursive: true });

// ---------------------------------------------------------------- JWT helpers
const b64u = (b) => Buffer.from(b).toString('base64url');
const sign = (payload) => signJwt(payload, JWT_SECRET);
const verify = (token) => {
  const [h, b, s] = String(token || '').split('.');
  if (!h || !b || !s) return null;
  const expect = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64url');
  if (s.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expect))) return null;
  const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
  if (payload.exp && payload.exp < Date.now() / 1000) return null;
  return payload;
};
export const { anon: ANON_KEY, service: SERVICE_KEY } = stackKeys(JWT_SECRET);
fs.mkdirSync('.stack', { recursive: true });
fs.writeFileSync('.stack/keys.json', JSON.stringify({ url: PUBLIC_URL, anon: ANON_KEY, service: SERVICE_KEY }, null, 2));

// ---------------------------------------------------------------- auth state
const refreshTokens = new Map(); // token -> userId
const codes = new Map(); // pkce auth code -> { userId, challenge }
const otps = new Map(); // magic-link token -> { userId, challenge }
const mailbox = [];

const hashPw = (pw, salt = crypto.randomBytes(16).toString('hex')) => `${salt}:${crypto.scryptSync(pw, salt, 32).toString('hex')}`;
const checkPw = (pw, stored) => {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), crypto.scryptSync(pw, salt, 32));
};

async function ensureTables() {
  await pool.query(`create table if not exists auth.fake_credentials (user_id uuid primary key references auth.users(id) on delete cascade, password_hash text)`);
}

async function userByEmail(email) {
  const { rows } = await pool.query(`select u.id, u.email, u.raw_user_meta_data, u.email_confirmed_at, u.created_at, c.password_hash from auth.users u left join auth.fake_credentials c on c.user_id = u.id where lower(u.email) = lower($1)`, [email]);
  return rows[0] || null;
}
async function userById(id) {
  const { rows } = await pool.query(`select id, email, raw_user_meta_data, email_confirmed_at, created_at from auth.users where id = $1`, [id]);
  return rows[0] || null;
}
async function createUser(email, password, meta) {
  const { rows } = await pool.query(`insert into auth.users (email, raw_user_meta_data, email_confirmed_at) values ($1,$2,$3) returning id`, [email.toLowerCase(), JSON.stringify(meta || {}), AUTO_CONFIRM ? new Date() : null]);
  if (password) await pool.query(`insert into auth.fake_credentials (user_id, password_hash) values ($1,$2)`, [rows[0].id, hashPw(password)]);
  return userById(rows[0].id);
}
const userJson = (u) => ({
  id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: u.email_confirmed_at, phone: '',
  confirmed_at: u.email_confirmed_at, last_sign_in_at: new Date().toISOString(), app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: u.raw_user_meta_data || {}, identities: [], created_at: u.created_at, updated_at: new Date().toISOString(), is_anonymous: false,
});
function session(u) {
  const now = Math.floor(Date.now() / 1000);
  const access = sign({
    aud: 'authenticated', exp: now + 3600, iat: now, iss: `${PUBLIC_URL}/auth/v1`, sub: u.id, email: u.email, phone: '', role: 'authenticated',
    aal: 'aal1', amr: [{ method: 'password', timestamp: now }], session_id: crypto.randomUUID(), is_anonymous: false,
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: u.raw_user_meta_data || {},
  });
  const refresh = crypto.randomBytes(12).toString('hex');
  refreshTokens.set(refresh, u.id);
  return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: refresh, user: userJson(u) };
}
const challengeOk = (verifier, challenge, method) =>
  method === 'plain' ? verifier === challenge : crypto.createHash('sha256').update(verifier).digest('base64url') === challenge;

// ---------------------------------------------------------------- http helpers
function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD');
  res.setHeader('Access-Control-Expose-Headers', '*');
  res.setHeader('Vary', 'Origin');
}
const json = (res, status, body, extra = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json', ...extra });
  res.end(JSON.stringify(body));
};
const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});
const readJson = async (req) => {
  const buf = await readBody(req);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString()); } catch { return {}; }
};
const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
const authErr = (res, status, code, msg) => json(res, status, { code: status, error_code: code, msg, message: msg });

// ---------------------------------------------------------------- /auth/v1
async function handleAuth(req, res, url) {
  const route = url.pathname.replace('/auth/v1', '');
  const q = url.searchParams;

  if (route === '/signup' && req.method === 'POST') {
    const b = await readJson(req);
    if (!b.email || !b.password || String(b.password).length < 6) return authErr(res, 422, 'weak_password', 'Password should be at least 6 characters.');
    if (await userByEmail(b.email)) return authErr(res, 422, 'user_already_exists', 'User already registered');
    const u = await createUser(b.email, b.password, b.data);
    if (!AUTO_CONFIRM) { mailbox.push({ to: u.email, kind: 'confirm', at: new Date().toISOString() }); return json(res, 200, userJson(u)); }
    return json(res, 200, session(u));
  }

  if (route === '/token' && req.method === 'POST') {
    const grant = q.get('grant_type');
    const b = await readJson(req);
    if (grant === 'password') {
      const u = await userByEmail(b.email || '');
      if (!u || !checkPw(b.password || '', u.password_hash)) return authErr(res, 400, 'invalid_credentials', 'Invalid login credentials');
      if (!u.email_confirmed_at) return authErr(res, 400, 'email_not_confirmed', 'Email not confirmed');
      return json(res, 200, session(u));
    }
    if (grant === 'refresh_token') {
      const uid = refreshTokens.get(b.refresh_token);
      if (!uid) return authErr(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found');
      refreshTokens.delete(b.refresh_token);
      const u = await userById(uid);
      return json(res, 200, session(u));
    }
    if (grant === 'pkce') {
      const c = codes.get(b.auth_code);
      if (!c || !challengeOk(b.code_verifier || '', c.challenge, c.method)) return authErr(res, 400, 'flow_state_not_found', 'invalid flow state, no valid flow state found');
      codes.delete(b.auth_code);
      return json(res, 200, session(await userById(c.userId)));
    }
    return authErr(res, 400, 'unsupported_grant_type', 'Unsupported grant type');
  }

  if (route === '/otp' && req.method === 'POST') {
    const b = await readJson(req);
    let u = await userByEmail(b.email || '');
    if (!u && b.create_user !== false) u = await createUser(b.email, null, b.data);
    if (u) {
      const token = crypto.randomBytes(16).toString('hex');
      otps.set(token, { userId: u.id, challenge: b.code_challenge, method: b.code_challenge_method });
      const redirect = q.get('redirect_to') || '';
      mailbox.push({ to: u.email, kind: 'magiclink', at: new Date().toISOString(), link: `${PUBLIC_URL}/auth/v1/verify?token=${token}&type=magiclink&redirect_to=${encodeURIComponent(redirect)}` });
    }
    return json(res, 200, {});
  }

  if (route === '/recover' && req.method === 'POST') {
    const b = await readJson(req);
    const u = await userByEmail(b.email || '');
    if (u) {
      const token = crypto.randomBytes(16).toString('hex');
      otps.set(token, { userId: u.id, challenge: b.code_challenge, method: b.code_challenge_method });
      mailbox.push({ to: u.email, kind: 'recovery', at: new Date().toISOString(), link: `${PUBLIC_URL}/auth/v1/verify?token=${token}&type=recovery&redirect_to=${encodeURIComponent(q.get('redirect_to') || '')}` });
    }
    return json(res, 200, {});
  }

  if (route === '/verify' && req.method === 'GET') {
    const o = otps.get(q.get('token'));
    const redirect = q.get('redirect_to') || PUBLIC_URL;
    if (!o) { res.writeHead(302, { Location: `${redirect}?error=access_denied&error_code=otp_expired` }); return res.end(); }
    otps.delete(q.get('token'));
    const code = crypto.randomBytes(16).toString('hex');
    codes.set(code, { userId: o.userId, challenge: o.challenge, method: o.method });
    res.writeHead(302, { Location: `${redirect}${redirect.includes('?') ? '&' : '?'}code=${code}` });
    return res.end();
  }

  if (route === '/user') {
    const claims = verify(bearer(req));
    if (!claims || claims.role !== 'authenticated') return authErr(res, 401, 'bad_jwt', 'invalid JWT');
    const u = await userById(claims.sub);
    if (!u) return authErr(res, 403, 'user_not_found', 'User from sub claim in JWT does not exist');
    if (req.method === 'GET') return json(res, 200, userJson(u));
    if (req.method === 'PUT') {
      const b = await readJson(req);
      if (b.password) {
        if (String(b.password).length < 6) return authErr(res, 422, 'weak_password', 'Password should be at least 6 characters.');
        await pool.query(`insert into auth.fake_credentials (user_id, password_hash) values ($1,$2) on conflict (user_id) do update set password_hash = excluded.password_hash`, [u.id, hashPw(b.password)]);
      }
      if (b.data) await pool.query(`update auth.users set raw_user_meta_data = raw_user_meta_data || $2::jsonb where id = $1`, [u.id, JSON.stringify(b.data)]);
      return json(res, 200, userJson(await userById(u.id)));
    }
  }

  if (route === '/logout') { res.writeHead(204); return res.end(); }
  if (route === '/.well-known/jwks.json') return json(res, 200, { keys: [] });
  if (route === '/settings') return json(res, 200, { external: { email: true }, disable_signup: false, mailer_autoconfirm: AUTO_CONFIRM });
  return authErr(res, 404, 'not_found', `No auth route ${route}`);
}

// ---------------------------------------------------------------- /storage/v1
// Object access runs through the real storage.objects policies by assuming the caller's role.
async function asCaller(req, fn) {
  const claims = verify(bearer(req)) || verify(req.headers.apikey);
  const role = claims?.role === 'service_role' ? 'service_role' : claims?.role === 'authenticated' ? 'authenticated' : 'anon';
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${role}`);
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims || { role: 'anon' })]);
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally { client.release(); }
}
const objPath = (bucket, name) => {
  const p = path.join(STORAGE_DIR, bucket, ...name.split('/'));
  if (!p.startsWith(path.join(STORAGE_DIR, bucket))) throw new Error('bad path');
  return p;
};
const storageErr = (res, status, msg) => json(res, status, { statusCode: String(status), error: status === 404 ? 'not_found' : 'Unauthorized', message: msg });
const signedTokens = new Map(); // token -> { bucket, name, kind }

async function handleStorage(req, res, url) {
  const route = decodeURIComponent(url.pathname.replace('/storage/v1', ''));
  let m;
  try {
    // upload: POST/PUT /object/{bucket}/{path...}
    if ((m = route.match(/^\/object\/([^/]+)\/(.+)$/)) && (req.method === 'POST' || req.method === 'PUT') && !route.startsWith('/object/sign/') && !route.startsWith('/object/upload/') && !route.startsWith('/object/list/')) {
      const [, bucket, name] = m;
      const buf = await readBody(req);
      const ct = req.headers['content-type'] || '';
      let data = buf;
      let mime = ct;
      if (ct.startsWith('multipart/form-data')) {
        const fd = await new Response(buf, { headers: { 'content-type': ct } }).formData();
        const file = [...fd.values()].find((v) => typeof v !== 'string');
        data = Buffer.from(await file.arrayBuffer());
        mime = file.type || 'application/octet-stream';
      }
      await asCaller(req, async (c) => {
        const { rows } = await c.query(`select allowed_mime_types, file_size_limit from storage.buckets where id = $1`, [bucket]);
        if (!rows[0]) throw Object.assign(new Error('Bucket not found'), { status: 404 });
        if (rows[0].allowed_mime_types && !rows[0].allowed_mime_types.includes(mime)) throw Object.assign(new Error('mime type not supported'), { status: 415 });
        if (rows[0].file_size_limit && data.length > Number(rows[0].file_size_limit)) throw Object.assign(new Error('The object exceeded the maximum allowed size'), { status: 413 });
        await c.query(`insert into storage.objects (bucket_id, name, metadata) values ($1,$2,$3)`, [bucket, name, JSON.stringify({ size: data.length, mimetype: mime })]);
      });
      fs.mkdirSync(path.dirname(objPath(bucket, name)), { recursive: true });
      fs.writeFileSync(objPath(bucket, name), data);
      return json(res, 200, { Id: crypto.randomUUID(), Key: `${bucket}/${name}` });
    }

    // sign for download
    if ((m = route.match(/^\/object\/sign\/([^/]+)\/(.+)$/)) && req.method === 'POST') {
      const [, bucket, name] = m;
      const ok = await asCaller(req, async (c) => (await c.query(`select 1 from storage.objects where bucket_id = $1 and name = $2`, [bucket, name])).rowCount > 0);
      if (!ok) return storageErr(res, 400, 'Object not found');
      const token = crypto.randomBytes(16).toString('hex');
      signedTokens.set(token, { bucket, name, kind: 'read', exp: Date.now() + 1000 * (Number((await readJson(req)).expiresIn) || 60) });
      return json(res, 200, { signedURL: `/object/sign/${bucket}/${name}?token=${token}` });
    }
    // fetch via signed url
    if ((m = route.match(/^\/object\/sign\/([^/]+)\/(.+)$/)) && req.method === 'GET') {
      const t = signedTokens.get(url.searchParams.get('token'));
      if (!t || t.kind !== 'read' || t.exp < Date.now() || t.bucket !== m[1] || t.name !== m[2]) return storageErr(res, 400, 'Invalid or expired token');
      const f = objPath(m[1], m[2]);
      if (!fs.existsSync(f)) return storageErr(res, 404, 'Object not found');
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'inline' });
      return res.end(fs.readFileSync(f));
    }
    // create signed upload url (service role in practice)
    if ((m = route.match(/^\/object\/upload\/sign\/([^/]+)\/(.+)$/)) && req.method === 'POST') {
      const [, bucket, name] = m;
      const ok = await asCaller(req, async (c) => {
        try { await c.query(`insert into storage.objects (bucket_id, name) values ($1,$2)`, [bucket, `__probe__/${crypto.randomUUID()}`]); } catch { return false; }
        return true;
      });
      if (!ok) return storageErr(res, 403, 'new row violates row-level security policy');
      const token = crypto.randomBytes(16).toString('hex');
      signedTokens.set(token, { bucket, name, kind: 'upload', exp: Date.now() + 2 * 3600 * 1000 });
      return json(res, 200, { url: `/object/upload/sign/${bucket}/${name}?token=${token}` });
    }
    // PUT to a signed upload url
    if ((m = route.match(/^\/object\/upload\/sign\/([^/]+)\/(.+)$/)) && req.method === 'PUT') {
      const t = signedTokens.get(url.searchParams.get('token'));
      if (!t || t.kind !== 'upload' || t.exp < Date.now() || t.bucket !== m[1] || t.name !== m[2]) return storageErr(res, 400, 'Invalid token');
      signedTokens.delete(url.searchParams.get('token'));
      const buf = await readBody(req);
      const ct = req.headers['content-type'] || '';
      let data = buf; let mime = ct;
      if (ct.startsWith('multipart/form-data')) {
        const fd = await new Response(buf, { headers: { 'content-type': ct } }).formData();
        const file = [...fd.values()].find((v) => typeof v !== 'string');
        data = Buffer.from(await file.arrayBuffer()); mime = file.type || 'application/octet-stream';
      }
      const { rows } = await pool.query(`select allowed_mime_types, file_size_limit from storage.buckets where id = $1`, [m[1]]);
      if (rows[0]?.allowed_mime_types && !rows[0].allowed_mime_types.includes(mime)) return storageErr(res, 415, 'mime type not supported');
      if (rows[0]?.file_size_limit && data.length > Number(rows[0].file_size_limit)) return storageErr(res, 413, 'The object exceeded the maximum allowed size');
      await pool.query(`insert into storage.objects (bucket_id, name, metadata) values ($1,$2,$3)`, [m[1], m[2], JSON.stringify({ size: data.length, mimetype: mime })]);
      fs.mkdirSync(path.dirname(objPath(m[1], m[2])), { recursive: true });
      fs.writeFileSync(objPath(m[1], m[2]), data);
      return json(res, 200, { Key: `${m[1]}/${m[2]}` });
    }
    // list
    if ((m = route.match(/^\/object\/list\/([^/]+)$/)) && req.method === 'POST') {
      const b = await readJson(req);
      const prefix = b.prefix ? `${String(b.prefix).replace(/\/$/, '')}/` : '';
      const rows = await asCaller(req, async (c) => (await c.query(`select name, metadata, created_at, id from storage.objects where bucket_id = $1 and name like $2 order by name limit 1000`, [m[1], `${prefix.replace(/[%_]/g, '\\$&')}%`])).rows);
      const seen = new Map();
      for (const r of rows) {
        const rest = r.name.slice(prefix.length);
        if (b.search && !rest.includes(b.search)) continue;
        const first = rest.split('/')[0];
        seen.set(first, rest.includes('/') ? { name: first, id: null, metadata: null } : { name: first, id: r.id, metadata: r.metadata, created_at: r.created_at });
      }
      return json(res, 200, [...seen.values()]);
    }
    // remove
    if ((m = route.match(/^\/object\/([^/]+)$/)) && req.method === 'DELETE') {
      const b = await readJson(req);
      const removed = [];
      await asCaller(req, async (c) => {
        for (const name of b.prefixes || []) {
          const r = await c.query(`delete from storage.objects where bucket_id = $1 and name = $2 returning name`, [m[1], name]);
          if (r.rowCount) { removed.push({ name, bucket_id: m[1] }); fs.rmSync(objPath(m[1], name), { force: true }); }
        }
      });
      return json(res, 200, removed);
    }
    // object info / existence
    if ((m = route.match(/^\/object\/info\/([^/]+)\/(.+)$/)) && req.method === 'GET') {
      const r = await asCaller(req, async (c) => (await c.query(`select name, metadata from storage.objects where bucket_id = $1 and name = $2`, [m[1], m[2]])).rows[0]);
      return r ? json(res, 200, r) : storageErr(res, 404, 'Object not found');
    }
  } catch (e) {
    const status = e.status || (/row-level security|permission denied/.test(e.message) ? 403 : /duplicate key/.test(e.message) ? 409 : 400);
    return storageErr(res, status, e.message);
  }
  return storageErr(res, 404, `No storage route ${route}`);
}

// ---------------------------------------------------------------- /rest/v1 -> PostgREST
async function proxyRest(req, res, url) {
  const target = new URL(POSTGREST);
  const headers = { ...req.headers, host: target.host };
  delete headers.origin; delete headers.referer; delete headers.connection;
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);
  const upstream = http.request({ hostname: target.hostname, port: target.port, path: url.pathname.replace('/rest/v1', '') + url.search, method: req.method, headers }, (up) => {
    cors(req, res);
    res.writeHead(up.statusCode, up.headers);
    up.pipe(res);
  });
  upstream.on('error', (e) => json(res, 502, { message: `PostgREST unavailable: ${e.message}` }));
  if (body) upstream.write(body);
  upstream.end();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, PUBLIC_URL);
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  try {
    if (url.pathname.startsWith('/rest/v1')) return await proxyRest(req, res, url);
    if (url.pathname.startsWith('/auth/v1')) return await handleAuth(req, res, url);
    if (url.pathname.startsWith('/storage/v1')) return await handleStorage(req, res, url);
    if (url.pathname === '/__mail') return json(res, 200, mailbox);
    if (url.pathname === '/__health') return json(res, 200, { ok: true });
    return json(res, 404, { message: 'not found' });
  } catch (e) {
    console.error('[gateway]', e);
    return json(res, 500, { message: e.message });
  }
});

await ensureTables();
server.listen(PORT, '127.0.0.1', () => console.log(`[gateway] listening on ${PUBLIC_URL} (PostgREST ${POSTGREST})`));
