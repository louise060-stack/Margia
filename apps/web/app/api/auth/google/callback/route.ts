import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, appUrl } from '@/lib/google';
import { SESSION_COOKIE, STATE_COOKIE, encryptSession, sessionCookieOptions } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const cookieState = req.cookies.get(STATE_COOKIE)?.value;

  // She declined, or something went wrong at Google — resume onboarding gracefully.
  if (error || !code) {
    return NextResponse.redirect(new URL('/onboarding?connect=denied', appUrl()));
  }
  // CSRF: the state we sent must match the state that came back.
  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL('/onboarding?connect=denied', appUrl()));
  }

  try {
    const session = await exchangeCode(code);
    const res = NextResponse.redirect(new URL('/onboarding?connected=1', appUrl()));
    res.cookies.set(SESSION_COOKIE, encryptSession(session), sessionCookieOptions);
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch {
    return NextResponse.redirect(new URL('/onboarding?connect=error', appUrl()));
  }
}
