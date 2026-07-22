/**
 * The engine service boundary.
 *
 * This route IS the service the front end calls. Today it runs the engine
 * in-process on the seed week; when the engine moves to its own host (Railway),
 * only this file changes — it fetches instead of imports. The React components
 * never see the engine; they see this JSON. That is the whole separability
 * point (6A.0): a second surface (SMS, an agent) calls the same operation.
 */
import { NextResponse } from 'next/server';
import { generatePlan } from '@margia/engine';
import { sampleWeekWithClearedNudge, planFromOnboarding } from '@margia/engine/seed';
import type { OnboardingAnswers } from '@margia/engine/seed';

export const dynamic = 'force-dynamic';

// Sample week (used by the standalone plan view).
export async function GET() {
  const plan = generatePlan(sampleWeekWithClearedNudge);
  return NextResponse.json(plan);
}

// Her onboarding answers → her plan, through the real engine.
export async function POST(req: Request) {
  const answers = (await req.json()) as OnboardingAnswers;
  const plan = generatePlan(planFromOnboarding(answers));
  return NextResponse.json(plan);
}
