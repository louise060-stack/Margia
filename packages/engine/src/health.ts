/**
 * The health intelligence layer (PRD Section 7 + 6A.3).
 *
 * This is an OWNED ASSET, not a feature. Its defensibility is not the screening
 * intervals — those are public (USPSTF, ACOG, NHS/NICE). It is the POSTURE: an
 * opinionated, evidence-cited health-advocacy stance with a documented autonomy
 * ceiling, held with clinical governance — exactly the posture the platform
 * giants structurally avoid.
 *
 * TWO disciplines are encoded here and must never be softened:
 *
 *  1. TEMPLATE-FIRST, EVIDENCE-CITED. Every recommendation carries a
 *     guideline_source. If we cannot cite it, we do not make it (Dr. Chen's
 *     veto). Nudge copy is a template filled with her context, never a free
 *     generative claim.
 *
 *  2. THE LIVING DOCUMENT. The checklist lives in DATA, not code, so a guideline
 *     change is a data edit — with a versioned audit trail and a re-score job —
 *     not an engineering ticket. A static checklist becomes a liability the day
 *     a guideline moves. See applyChecklistChange() and rescoreAllUsers().
 *
 * GATING: nudge_enabled defaults to false. A screening's nudge does not fire
 * until a NAMED CLINICAL ADVISOR has reviewed it and the flag is turned on.
 * That gate is a human action (Master Document Map) — the engine enforces it,
 * it does not grant it.
 */

export type ScreeningId =
  | 'cervical'
  | 'well_woman'
  | 'dental'
  | 'blood_pressure'
  | 'mammogram'
  | 'cholesterol'
  | 'eye_exam'
  | 'skin_check';

/**
 * One row of the SCREENING_CHECKLIST — the data-driven, code-free definition.
 * These five+ fields are editable through an admin surface with NO code deploy
 * (6A.3). guideline_source and the review dates are what make the voice
 * trustworthy and auditable.
 */
export interface ScreeningDefinition {
  id: ScreeningId;
  label: string; // her language, e.g. "Cervical screening (smear)"
  interval_months: number; // how often it's due
  min_age: number; // age-gated: below this it does not apply
  max_age: number;
  guideline_source: string; // MUST be citable — e.g. "USPSTF 2018"
  last_reviewed: string; // ISO date the reviewer last checked the source
  next_review: string; // ISO date the next review is due
  /** template with {name}/{last}/{slot} slots — NEVER a free generative claim */
  nudge_copy_template: string;
  /** GATE: false until a named clinical advisor signs off */
  nudge_enabled: boolean;
}

/** Her recorded last-done date for a screening (from onboarding or connected records). */
export interface ScreeningRecord {
  id: ScreeningId;
  last_done: string | null; // ISO date, or null if never / unknown
}

export type GapStatus = 'due_soon' | 'overdue' | 'never_done' | 'not_applicable' | 'ok';

export interface ScreeningGap {
  id: ScreeningId;
  label: string;
  status: GapStatus;
  months_overdue: number; // 0 if not overdue
  guideline_source: string;
  nudge_enabled: boolean;
}

// ---------------------------------------------------------------------------
// The default checklist. Intervals reflect public guidance for women ~32–44.
// Values are DATA and are meant to be edited via applyChecklistChange(), not by
// touching this file in production. Sources are illustrative and must be
// confirmed by the named clinical reviewer before any nudge is enabled.
// ---------------------------------------------------------------------------

export const DEFAULT_CHECKLIST: ScreeningDefinition[] = [
  {
    id: 'cervical',
    label: 'Cervical screening (smear)',
    interval_months: 36,
    min_age: 21,
    max_age: 65,
    guideline_source: 'USPSTF (cervical cancer screening)',
    last_reviewed: '2026-07-01',
    next_review: '2026-10-01',
    nudge_copy_template:
      "Your smear isn't on the calendar and it's been over {years} — want {slot}?",
    nudge_enabled: false, // gated until clinical sign-off
  },
  {
    id: 'well_woman',
    label: 'Well-woman / annual check',
    interval_months: 12,
    min_age: 18,
    max_age: 100,
    guideline_source: 'ACOG (well-woman visit)',
    last_reviewed: '2026-07-01',
    next_review: '2026-10-01',
    nudge_copy_template:
      "It's been {duration} since your last check-up — want {slot}?",
    nudge_enabled: false,
  },
  {
    id: 'dental',
    label: 'Dental check-up',
    interval_months: 9,
    min_age: 18,
    max_age: 100,
    guideline_source: 'ADA (routine dental exam)',
    last_reviewed: '2026-07-01',
    next_review: '2027-07-01',
    nudge_copy_template: 'Your dental check-up is due — want {slot}?',
    nudge_enabled: false,
  },
  {
    id: 'blood_pressure',
    label: 'Blood pressure check',
    interval_months: 36,
    min_age: 18,
    max_age: 100,
    guideline_source: 'USPSTF (hypertension screening)',
    last_reviewed: '2026-07-01',
    next_review: '2026-10-01',
    nudge_copy_template: 'A quick blood-pressure check is due — want {slot}?',
    nudge_enabled: false,
  },
  {
    id: 'mammogram',
    // Age-gated on purpose — a clean example of the checklist NOT nudging when
    // it does not apply. USPSTF 2024 lowered routine start to 40.
    label: 'Mammogram',
    interval_months: 24,
    min_age: 40,
    max_age: 74,
    guideline_source: 'USPSTF 2024 (breast cancer screening)',
    last_reviewed: '2026-07-01',
    next_review: '2026-10-01',
    nudge_copy_template: 'Routine mammograms start around now — want to talk about booking one?',
    nudge_enabled: false,
  },
];

// ---------------------------------------------------------------------------
// Gap detection
// ---------------------------------------------------------------------------

function monthsBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO);
  const to = new Date(toISO);
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

/**
 * Compute her screening gaps against the checklist, respecting age gates and
 * the nudge_enabled flag. Returns overdue / due-soon / never-done items; the
 * plan surfaces AT MOST ONE, and only one whose nudge is enabled, and only in
 * the rested Sunday-Planning state.
 */
export function computeGaps(
  age: number,
  records: ScreeningRecord[],
  checklist: ScreeningDefinition[],
  todayISO: string,
): ScreeningGap[] {
  const byId = new Map(records.map((r) => [r.id, r] as const));
  const gaps: ScreeningGap[] = [];

  for (const def of checklist) {
    if (age < def.min_age || age > def.max_age) {
      gaps.push({
        id: def.id,
        label: def.label,
        status: 'not_applicable',
        months_overdue: 0,
        guideline_source: def.guideline_source,
        nudge_enabled: def.nudge_enabled,
      });
      continue;
    }

    const rec = byId.get(def.id);
    if (!rec || rec.last_done === null) {
      gaps.push({
        id: def.id,
        label: def.label,
        status: 'never_done',
        months_overdue: 0,
        guideline_source: def.guideline_source,
        nudge_enabled: def.nudge_enabled,
      });
      continue;
    }

    const elapsed = monthsBetween(rec.last_done, todayISO);
    const overdueBy = elapsed - def.interval_months;
    let status: GapStatus = 'ok';
    if (overdueBy > 0) status = 'overdue';
    else if (overdueBy > -2) status = 'due_soon';

    gaps.push({
      id: def.id,
      label: def.label,
      status,
      months_overdue: Math.max(0, overdueBy),
      guideline_source: def.guideline_source,
      nudge_enabled: def.nudge_enabled,
    });
  }

  return gaps;
}

export interface HealthNudge {
  screeningId: ScreeningId;
  label: string;
  /** filled template — sober, plain, cited. Serif voice, Planning state ONLY. */
  copy: string;
  guideline_source: string;
  /** the tentative slot the nudge offers ("want Thursday at 9?") */
  offeredSlotLabel: string;
}

/**
 * Build the ONE health nudge to surface, from the most-overdue gap whose nudge
 * is ENABLED. Returns null if nothing is both overdue and cleared for nudging —
 * which is the correct, safe default before clinical sign-off.
 *
 * The copy is a filled template. It never references or corrects a prior
 * recommendation, never alarms, always cites, and is only ever shown in the
 * rested Sunday-Planning state (the caller enforces the state).
 */
export function buildHealthNudge(
  gaps: ScreeningGap[],
  records: ScreeningRecord[],
  checklist: ScreeningDefinition[],
  offeredSlotLabel: string,
  todayISO: string,
): HealthNudge | null {
  const enabledOverdue = gaps
    .filter((g) => (g.status === 'overdue' || g.status === 'never_done') && g.nudge_enabled)
    .sort((a, b) => b.months_overdue - a.months_overdue);

  const top = enabledOverdue[0];
  if (!top) return null;

  const def = checklist.find((d) => d.id === top.id)!;
  const rec = records.find((r) => r.id === top.id);
  const years = top.months_overdue >= 12 ? `${Math.floor((top.months_overdue + def.interval_months) / 12)} years` : 'a year';
  const elapsedYears = rec?.last_done ? Math.floor(monthsBetween(rec.last_done, todayISO) / 12) : 0;
  const duration = rec?.last_done
    ? `${elapsedYears || 1} year${elapsedYears > 1 ? 's' : ''}`
    : 'a while';

  const copy = def.nudge_copy_template
    .replace('{name}', '')
    .replace('{years}', years)
    .replace('{duration}', duration)
    .replace('{slot}', offeredSlotLabel);

  return {
    screeningId: top.id,
    label: top.label,
    copy,
    guideline_source: top.guideline_source,
    offeredSlotLabel,
  };
}

// ---------------------------------------------------------------------------
// THE UPDATE MECHANISM — the living document (6A.3)
// ---------------------------------------------------------------------------

/** One append-only audit entry. This is the record that protects the founder. */
export interface ChecklistHistoryEntry {
  screeningId: ScreeningId;
  field: keyof ScreeningDefinition;
  previous_value: string | number | boolean;
  new_value: string | number | boolean;
  changed_at: string; // ISO timestamp — passed in, never generated internally
  reviewer: string; // named human
  reason: string;
  guideline_effective_date: string; // the guideline's date, NOT the app-update date
}

export interface ChecklistChange {
  screeningId: ScreeningId;
  field: keyof ScreeningDefinition;
  new_value: string | number | boolean;
  changed_at: string;
  reviewer: string;
  reason: string;
  guideline_effective_date: string;
}

/**
 * Apply a guideline change to the checklist AS DATA and append to the audit
 * trail. No code deploy, no engineering ticket. Returns a NEW checklist and a
 * NEW history array (pure — nothing mutated in place), mirroring the Supabase
 * table + append-only history-trigger design.
 */
export function applyChecklistChange(
  checklist: ScreeningDefinition[],
  history: ChecklistHistoryEntry[],
  change: ChecklistChange,
): { checklist: ScreeningDefinition[]; history: ChecklistHistoryEntry[] } {
  const nextChecklist = checklist.map((def) => {
    if (def.id !== change.screeningId) return def;
    return { ...def, [change.field]: change.new_value } as ScreeningDefinition;
  });

  const target = checklist.find((d) => d.id === change.screeningId);
  const entry: ChecklistHistoryEntry = {
    screeningId: change.screeningId,
    field: change.field,
    previous_value: (target ? (target[change.field] as string | number | boolean) : ''),
    new_value: change.new_value,
    changed_at: change.changed_at,
    reviewer: change.reviewer,
    reason: change.reason,
    guideline_effective_date: change.guideline_effective_date,
  };

  return { checklist: nextChecklist, history: [...history, entry] };
}

export interface UserForRescore {
  userId: string;
  age: number;
  records: ScreeningRecord[];
}

export interface RescoreResult {
  userId: string;
  gaps: ScreeningGap[];
  /** ids that became newly overdue as a result of the change */
  newlyInGap: ScreeningId[];
}

/**
 * Re-score every user against the (possibly updated) checklist. When an interval
 * changes, some users flip into or out of gap. This is the propagation job
 * (Section 7.7 rescore_all_users) — built from day one so a guideline change
 * actually reaches users' plans.
 */
export function rescoreAllUsers(
  users: UserForRescore[],
  previousChecklist: ScreeningDefinition[],
  nextChecklist: ScreeningDefinition[],
  todayISO: string,
): RescoreResult[] {
  return users.map((u) => {
    const before = computeGaps(u.age, u.records, previousChecklist, todayISO);
    const after = computeGaps(u.age, u.records, nextChecklist, todayISO);
    const wasGap = new Set(before.filter((g) => g.status === 'overdue').map((g) => g.id));
    const newlyInGap = after
      .filter((g) => g.status === 'overdue' && !wasGap.has(g.id))
      .map((g) => g.id);
    return { userId: u.userId, gaps: after, newlyInGap };
  });
}

/**
 * The forward-facing change notice (Section 7). Uses the guideline's effective
 * date, NEVER references or corrects a prior recommendation, no clinical
 * rationale, no alarm. Day-one information notice; the standard nudge follows on
 * day two (caller schedules that).
 */
export function buildChangeNotice(
  def: ScreeningDefinition,
  guidelineEffectiveMonthYear: string,
): string {
  return `${def.label} guidance was updated ${guidelineEffectiveMonthYear}. Based on your age, we've added a check to your plan.`;
}
