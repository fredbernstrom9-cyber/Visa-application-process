import crypto from 'node:crypto';

export const DEFAULT_JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';
const b64u = (b) => Buffer.from(b).toString('base64url');

export function sign(payload, secret = DEFAULT_JWT_SECRET) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

/** Keys are deterministic for a given secret, so the app and the tests can derive them without a handshake. */
export function stackKeys(secret = DEFAULT_JWT_SECRET) {
  const exp = 4102444800; // 2100-01-01
  return {
    anon: sign({ role: 'anon', iss: 'local-stack', exp }, secret),
    service: sign({ role: 'service_role', iss: 'local-stack', exp }, secret),
  };
}
