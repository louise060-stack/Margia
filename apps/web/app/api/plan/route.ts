/**
 * The engine service boundary.
 *
 * This route IS the service the front end calls. The React components never see
 * the engine; they see this JSON (6A.0 separability). When she has connected her
 * Google Calendar, her REAL events become the week's fixed logistics; otherwise
 * we fall back to the sample week so the flow always works.
 */
import { NextRequest, NextResponse } from 'next/server';
import { generatePlan } from '@margia/engine';
import { sampleWeekWithClearedNudge, planFromOnboarding } from '@margia/engine/seed';
import type { OnboardingAnswers } from '@margia/engine/seed';
import { fetchWeekEvents, getAccessToken } from '@/lib/google';
import { SESSION_COOKIE, decryptSession, encryptSession, sessionCookieOptions } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Sample week (used by the standalone plan view / returning-user home).
export async function GET() {
  const plan = generatePlan(sampleWeekWithClearedNudge);
  return NextResponse.json(plan);
}

// Her onboarding answers → her plan, through the real engine.
export async function POST(req: NextRequest) {
  const answers = (await req.json()) as OnboardingAnswers;
  const session = decryptSession(req.cookies.get(SESSION_COOKIE)?.value);

  // Not connected → sample week (household chores + a modelled calendar).
  if (!session) {
    return NextResponse.json(generatePlan(planFromOnboarding(answers)));
  }

  // Connected → her real calendar events become the week's fixed logistics.
  try {
    const { token, session: next, refreshed } = await getAccessToken(session);
    const { flexible, weekStartISO } = await fetchWeekEvents(token);
    const input = planFromOnboarding(answers, { imported: flexible, weekStartISO });
    const res = NextResponse.json(generatePlan(input));
    if (refreshed) res.cookies.set(SESSION_COOKIE, encryptSession(next), sessionCookieOptions);
    return res;
  } catch {
    // token dead / API hiccup → still deliver a plan from the sample week
    const res = NextResponse.json(generatePlan(planFromOnboarding(answers)));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
}
