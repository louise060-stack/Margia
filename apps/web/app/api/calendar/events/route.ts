import { NextRequest, NextResponse } from 'next/server';
import { fetchWeekEvents, getAccessToken } from '@/lib/google';
import { SESSION_COOKIE, decryptSession, encryptSession, sessionCookieOptions } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * The "reading your week" data. Returns her REAL upcoming events (names + day)
 * so the reading screen shows her actual calendar, not a template. Returns
 * { connected:false } when she hasn't connected — the UI falls back to a sample.
 */
export async function GET(req: NextRequest) {
  const session = decryptSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ connected: false, events: [] });

  try {
    const { token, session: next, refreshed } = await getAccessToken(session);
    const { preview, weekStartISO } = await fetchWeekEvents(token);
    const res = NextResponse.json({ connected: true, weekStartISO, events: preview });
    if (refreshed) res.cookies.set(SESSION_COOKIE, encryptSession(next), sessionCookieOptions);
    return res;
  } catch {
    // token dead / revoked — clear it and let the UI fall back
    const res = NextResponse.json({ connected: false, events: [] });
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
}
