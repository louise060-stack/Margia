/**
 * Session — the calendar connection, held in an encrypted, httpOnly cookie.
 *
 * We store Google's tokens ONLY in an AES-256-GCM encrypted cookie that the
 * browser cannot read (httpOnly) and that only travels to our server over HTTPS.
 * No database in V1 (Simone: minimal data footprint; nothing to leak at rest).
 * The key is derived from SESSION_SECRET, set as a Vercel environment variable.
 */
import crypto from 'crypto';

const KEY = crypto
  .createHash('sha256')
  .update(process.env.SESSION_SECRET || 'dev-insecure-key-set-SESSION_SECRET')
  .digest(); // 32 bytes

export const SESSION_COOKIE = 'mg_session';
export const STATE_COOKIE = 'mg_oauth_state';

export interface Session {
  access_token: string;
  refresh_token?: string;
  /** epoch ms when the access token expires */
  expiry: number;
}

export function encryptSession(s: Session): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.concat([c.update(JSON.stringify(s), 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return Buffer.concat([iv, tag, data]).toString('base64url');
}

export function decryptSession(value: string | undefined): Session | null {
  if (!value) return null;
  try {
    const b = Buffer.from(value, 'base64url');
    const iv = b.subarray(0, 12);
    const tag = b.subarray(12, 28);
    const data = b.subarray(28);
    const d = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    d.setAuthTag(tag);
    const out = Buffer.concat([d.update(data), d.final()]).toString('utf8');
    return JSON.parse(out) as Session;
  } catch {
    return null;
  }
}

/** Standard cookie options for the session. */
export const sessionCookieOptions = {
  httpOnly: true as const,
  secure: true as const,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 days (refresh token lifetime)
};
