import 'server-only';
import { APP_NAME } from '@/lib/env';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Swap providers by implementing this interface and registering it in getEmailProvider(). */
export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ ok: boolean; error?: string }>;
}

class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';
  async send(m: EmailMessage) {
    console.info(`[email:console] to=${m.to} subject="${m.subject}"\n${m.text}`);
    return { ok: true };
  }
}

class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  async send(m: EmailMessage) {
    const key = process.env.RESEND_API_KEY;
    if (!key) return { ok: false, error: 'RESEND_API_KEY is not set' };
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || `${APP_NAME} <no-reply@localhost>`,
        to: [m.to], subject: m.subject, text: m.text, html: m.html,
      }),
    });
    if (!res.ok) return { ok: false, error: `Resend responded ${res.status}` };
    return { ok: true };
  }
}

export function getEmailProvider(): EmailProvider {
  switch ((process.env.EMAIL_PROVIDER || 'console').toLowerCase()) {
    case 'resend': return new ResendEmailProvider();
    default: return new ConsoleEmailProvider();
  }
}

export async function sendEmail(message: EmailMessage) {
  try {
    return await getEmailProvider().send(message);
  } catch (e) {
    console.error('[email] send failed:', (e as Error).message);
    return { ok: false, error: (e as Error).message };
  }
}

export function inviteEmail(opts: { orgName: string; inviter: string; role: string; link: string }): Omit<EmailMessage, 'to'> {
  const text = `${opts.inviter} invited you to join ${opts.orgName} on ${APP_NAME} as ${opts.role}.\n\nAccept the invitation: ${opts.link}\n\nThe link expires in 14 days. If you weren't expecting this, you can ignore this e-mail.`;
  return {
    subject: `${opts.inviter} invited you to ${opts.orgName}`,
    text,
    html: `<p><strong>${escapeHtml(opts.inviter)}</strong> invited you to join <strong>${escapeHtml(opts.orgName)}</strong> on ${escapeHtml(APP_NAME)} as <em>${escapeHtml(opts.role)}</em>.</p><p><a href="${opts.link}">Accept the invitation</a></p><p style="color:#667">The link expires in 14 days. If you weren't expecting this, you can ignore this e-mail.</p>`,
  };
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
