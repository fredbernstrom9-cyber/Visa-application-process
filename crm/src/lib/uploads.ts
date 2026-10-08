export const ALLOWED_MIME = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain',
];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Strip anything that is not safe in a storage object key. */
export function safeFileName(n: string): string {
  return n.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '').slice(-100) || 'file';
}
