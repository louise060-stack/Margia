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

fun
