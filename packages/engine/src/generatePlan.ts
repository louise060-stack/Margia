/**
 * generatePlan — the engine's single public operation.
 *
 * Strict order of operations, faithful to PRD 6A:
 *   1. Classify raw flexible events (seed attention_cost + resource_channels).
 *   2. PASS 1 placeProtected — her slots placed first, before any logistics.
 *   3. PASS 2 arrangeFlexible — logistics fill in AROUND her, never on top.
 *   4. Choreography — slide backgrounds under foregrounds to manufacture margin.
 *   5. Surface conflicts (never resolve silently) + exactly one eureka move.
 *
 * The front end calls this and renders the result. It contains none of this
 * logic itself (6A.0 separability).
 */

import { classify } from './classifier.ts';
import { choreograph } from './choreography.ts';
import {
  DEFAULT_CHECKLIST,
  buildHealthNudge,
  computeGaps,
} from './health.ts';
import { arrangeFlexible, dayName, fmt, overlaps, placeProtected } from './placement.ts';
import type {
  FlexibleEvent,
  PlanConflict,
  PlanInput,
  ProtectedSlot,
  TimeBlock,
  WeeklyPlan,
} from './types.ts';

export function generatePlan(input: PlanInput): WeeklyPlan {
  const trace: string[] = [];
  trace.push(`— Generating ${input.profile.name}'s week (protection first, then logistics, then margin) —`);

  // 1. classify raw flexible events (respects any explicit/learned overrides)
  const classified: FlexibleEvent[] = input.flexible.map((e) => classify(e));

  // The deferral answer becomes a protected slot in its own right.
  const deferralSlot: ProtectedSlot = {
    id: 'deferral',
    label: input.profile.deferral.label,
    type: input.profile.deferral.type,
    durationMinutes: input.profile.deferral.durationMinutes,
    eligibleWindows: input.profile.availability,
    weight: 90, // her deferred thing holds hard — it is why she is here
  };
  const protectedSlots: ProtectedSlot[] = [deferralSlot, ...input.profile.protectedSlots];

  // fixed anchors (immovable logistics) are hard constraints for Pass 1
  const fixedAnchors: TimeBlock[] = classified
    .filter((e) => e.fixed)
    .map((e) => e.fixed!) as TimeBlock[];

  // 2. PASS 1 — her time, placed first
  const pass1 = placeProtected(protectedSlots, fixedAnchors);
  trace.push(...pass1.trace);

  const protectedBlocks: TimeBlock[] = pass1.placed
    .map((s) => s.placement)
    .filter((b): b is TimeBlock => Boolean(b));

  // 3. PASS 2 — logistics around her (forbidden from overwriting protected)
  const pass2 = arrangeFlexible(classified, protectedBlocks);
  trace.push(...pass2.trace);

  // 4. Choreography — manufacture margin
  const choreo = choreograph(pass1.placed, pass2.placed);
  trace.push(...choreo.trace);

  // 5. Conflicts — surface, never silently resolve (6A.1 outcome test)
  const conflicts = detectConflicts(choreo.protected, choreo.flexible);
  for (const c of conflicts) trace.push(`Conflict surfaced · ${c.message}`);

  // unplaceable protected slots are surfaced honestly, not crammed
  for (const u of pass1.unplaceable) {
    trace.push(`Note · "${u.label}" did not fit her stated availability this week — Margia asks rather than forces`);
  }

  // 6. Health intelligence layer (Section 7 / 6A.3) — cited, gated, Planning-state.
  let screeningGaps: WeeklyPlan['screeningGaps'] = [];
  let healthNudge: WeeklyPlan['healthNudge'] = null;
  const checklist = input.checklist ?? DEFAULT_CHECKLIST;
  if (typeof input.profile.age === 'number') {
    const today = input.weekStartISO;
    screeningGaps = computeGaps(
      input.profile.age,
      input.profile.screeningRecords ?? [],
      checklist,
      today,
    );
    const offered = offeredSlotLabel(input.profile.availability);
    healthNudge = buildHealthNudge(
      screeningGaps,
      input.profile.screeningRecords ?? [],
      checklist,
      offered,
      today,
    );
    const overdue = screeningGaps.filter((g) => g.status === 'overdue' || g.status === 'never_done');
    for (const g of overdue) {
      trace.push(
        `Health · ${g.label} is ${g.status.replace('_', ' ')} (per ${g.guideline_source})${g.nudge_enabled ? '' : ' — nudge held until clinical sign-off'}`,
      );
    }
    if (healthNudge) {
      trace.push(`Health · surfaced ONE cited nudge for Sunday-Planning (never at 9pm): ${healthNudge.copy}`);
    }
  }

  return {
    weekStartISO: input.weekStartISO,
    protected: choreo.protected,
    flexible: choreo.flexible,
    surfacedMove: choreo.surfacedMove,
    conflicts,
    marginMinutes: choreo.marginMinutes,
    healthNudge,
    screeningGaps,
    trace,
  };
}

/** A friendly slot label for a health nudge to offer, drawn from her availability.
 *  Prefers a daytime window — a screening is a clinic appointment, not a 9pm slot. */
function offeredSlotLabel(availability: PlanInput['profile']['availability']): string {
  const daytime = availability.find((w) => w.start >= 8 * 60 && w.start < 12 * 60);
  const w = daytime ?? availability[0];
  if (!w) return 'a morning this week';
  return `${dayName(w.day)} at ${fmt(w.start)}`;
}

/**
 * A conflict exists when a FLEXIBLE placement overlaps a PROTECTED placement.
 * The engine never resolves this by moving her slot — it names both events and
 * asks. This is the reversed burden of proof: her thing holds by default.
 */
function detectConflicts(
  protectedSlots: ProtectedSlot[],
  flexible: FlexibleEvent[],
): PlanConflict[] {
  const conflicts: PlanConflict[] = [];
  for (const slot of protectedSlots) {
    if (!slot.placement) continue;
    for (const ev of flexible) {
      if (!ev.placement) continue;
      // A background running unattended, or a chore choreographed under an
      // anchor, is not a claim on her time — it never conflicts with her slot.
      if (ev.is_background_process || ev.co_running_with.length > 0) continue;
      if (overlaps(slot.placement, ev.placement)) {
        conflicts.push({
          protectedId: slot.id,
          flexibleId: ev.id,
          message: `"${ev.label}" wants ${dayName(slot.placement.day)} ${fmt(slot.placement.start)}, which is held for ${slot.label}. Which should move?`,
        });
      }
    }
  }
  return conflicts;
}
