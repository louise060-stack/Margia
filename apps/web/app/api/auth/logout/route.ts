import { NextResponse } from 'next/server';
import { appUrl } from '@/lib/google';
import { SESSION_COOKIE } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Disconnect — forget her calendar tokens. (She can also revoke access in her Google account.) */
export async function GET() {
  const res = NextResponse.redirect(new URL('/onboarding', appUrl()));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
