/**
 * Who may open the read-only platform overview (/platform): the product owner(s), by Supabase user id.
 *   PLATFORM_ADMIN_USER_IDS  comma-separated user ids; falls back to OWNER_ACCESS_USER_ID so one setting covers both.
 * Customers can never reach it: the page 404s for everyone else and the data function is service-role only.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function platformAdminIds(env: Record<string, string | undefined> = process.env): string[] {
  const raw = env.PLATFORM_ADMIN_USER_IDS?.trim() || env.OWNER_ACCESS_USER_ID?.trim() || '';
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter((s) => UUID.test(s));
}

export function isPlatformAdmin(userId: string | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(userId) && platformAdminIds(env).includes(String(userId).toLowerCase());
}
