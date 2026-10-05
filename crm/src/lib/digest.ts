import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { APP_NAME, appUrl } from '@/lib/env';
import { escapeHtml, sendEmail } from '@/lib/email';

interface Row { id: string; user_id: string; title: string; body: string | null; case_id: string | null; created_at: string }

/**
 * Daily e-mail digest for people who opted in. Sends one message per user covering unread,
 * not-yet-emailed notifications from the last 36 hours, then marks them emailed.
 */
export async function sendDigests(admin: SupabaseClient): Promise<{ users: number; notifications: number }> {
  const since = new Date(Date.now() - 36 * 3600_000).toISOString();
  const { data: prefs } = await admin.from('profiles').select('id, email, full_name').eq('email_notifications', true);
  const byId = new Map(((prefs ?? []) as { id: string; email: string; full_name: string }[]).map((p) => [p.id, p]));
  if (byId.size === 0) return { users: 0, notifications: 0 };
  const { data } = await admin.from('notifications').select('id, user_id, title, body, case_id, created_at')
    .in('user_id', [...byId.keys()]).is('read_at', null).is('emailed_at', null).gt('created_at', since).order('created_at');
  const grouped = new Map<string, Row[]>();
  for (const n of (data ?? []) as Row[]) grouped.set(n.user_id, [...(grouped.get(n.user_id) ?? []), n]);

  let users = 0; let count = 0;
  for (const [uid, rows] of grouped) {
    const p = byId.get(uid)!;
    const lines = rows.map((r) => `• ${r.title}${r.body ? ` (${r.body})` : ''}${r.case_id ? `\n  ${appUrl()}/cases/${r.case_id}` : ''}`);
    const res = await sendEmail({
      to: p.email,
      subject: `${rows.length} update${rows.length === 1 ? '' : 's'} on your visa cases`,
      text: `Hello ${p.full_name.split(' ')[0]},\n\n${lines.join('\n')}\n\nOpen ${APP_NAME}: ${appUrl()}/overview\nChange these e-mails under Settings > My profile.`,
      html: `<p>Hello ${escapeHtml(p.full_name.split(' ')[0])},</p><ul>${rows.map((r) => `<li>${r.case_id ? `<a href="${appUrl()}/cases/${r.case_id}">${escapeHtml(r.title)}</a>` : escapeHtml(r.title)}${r.body ? ` <span style="color:#667">(${escapeHtml(r.body)})</span>` : ''}</li>`).join('')}</ul><p><a href="${appUrl()}/overview">Open ${escapeHtml(APP_NAME)}</a></p>`,
    });
    if (res.ok) {
      await admin.from('notifications').update({ emailed_at: new Date().toISOString() }).in('id', rows.map((r) => r.id));
      users++; count += rows.length;
    }
  }
  return { users, notifications: count };
}
