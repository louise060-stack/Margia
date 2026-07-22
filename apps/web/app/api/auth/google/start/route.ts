import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { authUrl, isConfigured } from '@/lib/google';
import { STATE_COOKIE } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isConfigured()) {
    // Google isn't wired yet — fall back to the sample onboarding instead of erroring.
    return NextResponse.redirect(new URL('/onboarding?connect=unconfigured', 'https://margia.vercel.app'));
  }
  const state = crypto.randomBytes(16).toString('hex');
  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600,
  });
  return res;
}
