import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Client, Pool, type PoolClient } from 'pg';

const root = path.resolve(import.meta.dirname, '../..');

export const DB_URL = process.env.TEST_DATABASE_URL;

export type Q = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

export interface TestDb {
  pool: Pool;
  /** Superuser / service-role style access (bypasses RLS). */
  admin: Q;
  /** Run `fn` as an authenticated Supabase user (RLS applies). Commits unless `fn` throws. */
  as: <T>(userId: string, fn: (q: Q) => Promise<T>) => Promise<T>;
  /** Run as `anon`. */
  anon: <T>(fn: (q: Q) => Promise<T>) => Promise<T>;
  /** Run as `service_role`. */
  service: <T>(fn: (q: Q) => Promise<T>) => Promise<T>;
  /** Create an auth user and return its id. */
  user: (email: string, name?: string) => Promise<string>;
  /** Create an organisation owned by `ownerId` (via the real RPC); optionally upgrade to premium. */
  org: (ownerId: string, name: string, plan?: 'free' | 'premium') => Promise<string>;
  addMember: (orgId: string, userId: string, role: 'owner' | 'admin' | 'advisor' | 'viewer', canViewAll?: boolean) => Promise<void>;
  drop: () => Promise<void>;
}

function querier(client: PoolClient): Q {
  return async (sql, params) => (await client.query(sql, params as unknown[])).rows;
}

export async function createTestDb(): Promise<TestDb> {
  if (!DB_URL) throw new Error('TEST_DATABASE_URL is not set');
  const name = `crm_test_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const adminClient = new Client({ connectionString: DB_URL });
  await adminClient.connect();
  await adminClient.query(`create database ${name}`);
  await adminClient.end();

  const url = new URL(DB_URL);
  url.pathname = `/${name}`;
  const pool = new Pool({ connectionString: url.toString(), max: 4 });

  const run = async (sql: string) => {
    const c = await pool.connect();
    try { await c.query(sql); } finally { c.release(); }
  };
  await run(readFileSync(path.join(root, 'tests/db/supabase-shim.sql'), 'utf8'));
  const dir = path.join(root, 'supabase/migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    try { await run(readFileSync(path.join(dir, f), 'utf8')); }
    catch (e) { throw new Error(`migration ${f} failed: ${(e as Error).message}`); }
  }

  const withRole = async <T>(role: string, claims: Record<string, unknown> | null, fn: (q: Q) => Promise<T>): Promise<T> => {
    const c = await pool.connect();
    try {
      await c.query('begin');
      await c.query(`set local role ${role}`);
      if (claims) await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
      const out = await fn(querier(c));
      await c.query('commit');
      return out;
    } catch (e) {
      await c.query('rollback').catch(() => undefined);
      throw e;
    } finally {
      c.release();
    }
  };

  const admin: Q = async (sql, params) => (await pool.query(sql, params as unknown[])).rows;
  const db: TestDb = {
    pool,
    admin,
    as: (userId, fn) => withRole('authenticated', { sub: userId, role: 'authenticated' }, fn),
    anon: (fn) => withRole('anon', { role: 'anon' }, fn),
    service: (fn) => withRole('service_role', { role: 'service_role' }, fn),
    user: async (email, userName) => {
      const [r] = await admin<{ id: string }>(
        `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
        [email, JSON.stringify({ full_name: userName ?? email.split('@')[0] })],
      );
      return r.id;
    },
    org: async (ownerId, orgName, plan = 'premium') => {
      const [r] = await db.as(ownerId, (q) => q<{ id: string }>(`select public.create_organization($1) as id`, [orgName]));
      if (plan !== 'free') await admin(`update organizations set plan = $2 where id = $1`, [r.id, plan]);
      return r.id;
    },
    addMember: async (orgId, userId, role, canViewAll = false) => {
      await admin(`insert into memberships (org_id, user_id, role, can_view_all) values ($1,$2,$3,$4)`, [orgId, userId, role, canViewAll]);
    },
    drop: async () => {
      await pool.end();
      const c = new Client({ connectionString: DB_URL });
      await c.connect();
      await c.query(`drop database if exists ${name} with (force)`);
      await c.end();
    },
  };
  return db;
}

/** Expect a promise to reject with a message matching `re`. */
export async function rejects(p: Promise<unknown>, re: RegExp) {
  try { await p; } catch (e) {
    if (!re.test((e as Error).message)) throw new Error(`expected error matching ${re}, got: ${(e as Error).message}`);
    return;
  }
  throw new Error(`expected rejection matching ${re}, but it resolved`);
}
