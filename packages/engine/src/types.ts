/**
 * Margia engine — core types.
 *
 * These types encode the two non-negotiables from PRD Section 6A:
 *   1. Every event lives in one of two states — PROTECTED or FLEXIBLE (6A.1).
 *   2. Every task carries attention_cost and resource_channels as FIRST-CLASS
 *      fields, not tags bolted on later (6A.2a).
 *
 * The engine reasons in local time using a simple, surface-independent model:
 *   - day: 0..6, Monday = 0 (a week is Mon..Sun)
 *   - minute: minutes from local midnight (0..1439)
 * The front end is responsible for turning this into wall-clock strings; the
 * engine never formats time for display.
 */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Mon..Sun

/** A concrete placement on the week grid. */
export interface TimeBlock {
  day: Weekday;
  /** minutes from midnight, local */
  start: number;
  /** minutes from midnight, local (exclusive) */
  end: number;
}

/** A window of availability she indicated in onboarding (e.g. "weekday mornings"). */
export interface AvailabilityWindow {
  day: Weekday;
  start: number;
  end: number;
}

// ---------------------------------------------------------------------------
// PROTECTED — her time. Placed FIRST, in a dedicated pass. Held by default.
// ---------------------------------------------------------------------------

export type ProtectedType =
  | 'MOVEMENT' // workouts, any form
  | 'THERAPY' // mental-health appointments
  | 'CHECKUP' // her medical/dental checkups
  | 'SCREENING' // mammogram, smear, annual physical — health-layer weight
  | 'SOLO' // solo time, hers alone
  | 'SLEEP' // protected sleep window
  | 'DEFERRAL'; // the one thing she keeps rescheduling (onboarding Q)

export interface ProtectedSlot {
  id: string;
  /** her language, e.g. "Your run", "Physio", "Smear test" */
  label: string;
  type: ProtectedType;
  durationMinutes: number;
  /**
   * The windows within which this slot may be placed, derived from her stated
   * availability. Pass 1 places the slot inside one of these, avoiding hard
   * calendar conflicts only. If empty, any time in her waking window is legal.
   */
  eligibleWindows: AvailabilityWindow[];
  /** Higher = placed earlier when protected slots compete for the same window. */
  weight: number;
  /** Filled by placeProtected(). Immovable in Pass 2. */
  placement?: TimeBlock;
  /** True once Pass 2 confirms genuine empty space sits around the slot. */
  hasMargin?: boolean;
}

// ---------------------------------------------------------------------------
// FLEXIBLE — everyone else's logistics + household tasks. Fills in AROUND her.
// Carries the two first-class choreography attributes.
// ---------------------------------------------------------------------------

export type AttentionCost = 'HIGH' | 'LOW';

/** The human channels a task occupies while active (6A.2a). */
export type ResourceChannel =
  | 'HANDS'
  | 'EYES'
  | 'EARS'
  | 'FOCUS'
  | 'PRESENCE'; // she must physically be there / supervising

export type Location = 'HOME' | 'OUT' | 'EITHER';

export type ChoreographyRole =
  | 'BACKGROUND' // low attention, runs unattended after short setup (laundry)
  | 'COMPANIONABLE' // low attention, needs hands/presence but not focus (folding)
  | 'FOREGROUND'; // high attention — anchors the schedule (homework, a work call)

export interface FlexibleEvent {
  id: string;
  /** her language, e.g. "Laundry", "Homework with Mia", "Soccer pickup" */
  label: string;
  /** where it came from — an imported calendar event, or a household task */
  kind: 'IMPORTED' | 'HOUSEHOLD';

  // --- the two first-class attributes (6A.2a) ---
  attention_cost: AttentionCost;
  resource_channels: ResourceChannel[];

  location: Location;
  duration_minutes: number;
  /** active minutes before it can run unattended (0 if none). */
  setup_minutes: number;
  /** minutes it runs on its own after setup (0 if not a background process). */
  unattended_minutes: number;

  /**
   * Computed: attention_cost === 'LOW' && unattended_minutes > 0.
   * Populated by classify(); the raw material of choreography.
   */
  is_background_process: boolean;

  /** derived choreography role (6A.2c). */
  role: ChoreographyRole;

  /** Can the plan reposition it? (onboarding Q5). Fixed anchors are false. */
  movable: boolean;
  /** For immovable anchors (school pickup 15:30, the standing work call). */
  fixed?: TimeBlock;

  /** Google's original colour, kept only as a faint origin dot. */
  originColor?: string;

  // --- filled by the engine ---
  placement?: TimeBlock;
  /** task ids this event ends up co-running with (choreography output). */
  co_running_with: string[];
  /** human-readable, only on the ONE surfaced move. Never a canned template. */
  choreography_reason: string | null;
}

// ---------------------------------------------------------------------------
// The generated plan the engine hands back. The front end renders this and
// holds no logic of its own.
// ---------------------------------------------------------------------------

export interface ChoreographyMove {
  /** the background process that got slid underneath something */
  backgroundTaskId: string;
  /** the foreground anchor (or protected slot) it now runs under */
  anchorId: string;
  /** the block that was freed by not giving the background its own slot */
  freedBlock: TimeBlock;
  /** the protected slot that now sits in the freed margin */
  filledProtectedId: string;
  /** the one human-readable line, generated from the real attach decision */
  reason: string;
}

export interface PlanConflict {
  protectedId: string;
  flexibleId: string;
  /** which one the engine is asking her about — it never resolves silently */
  message: string;
}

export interface WeeklyPlan {
  weekStartISO: string;
  protected: ProtectedSlot[];
  flexible: FlexibleEvent[];
  /** exactly ONE surfaced choreography move in V1 (Bible scope) */
  surfacedMove: ChoreographyMove | null;
  /** conflicts the engine surfaces rather than silently resolving (6A.1) */
  conflicts: PlanConflict[];
  /** minutes of genuine cleared margin the plan manufactured */
  marginMinutes: number;
  /** the ONE cited health nudge (Planning state only), or null if none/gated */
  healthNudge: import('./health.ts').HealthNudge | null;
  /** her screening gaps, for the health panel (rendered with workout weight) */
  screeningGaps: import('./health.ts').ScreeningGap[];
  /** the plan's own account of what it did, in order — for transparency/tests */
  trace: string[];
}

/** Her four onboarding answers + availability — the whole input surface. */
export interface OnboardingProfile {
  name: string;
  /** free windows she indicated she can protect time in */
  availability: AvailabilityWindow[];
  /** the one thing she keeps rescheduling — becomes a DEFERRAL protected slot */
  deferral: { label: string; type: ProtectedType; durationMinutes: number };
  /** her protected slots (movement, therapy, sleep, checkups...) */
  protectedSlots: ProtectedSlot[];
  /** for the health layer's age gates (Section 7). Optional. */
  age?: number;
  /** her last-done dates for screenings, for gap detection. Optional. */
  screeningRecords?: import('./health.ts').ScreeningRecord[];
}

export interface PlanInput {
  weekStartISO: string;
  profile: OnboardingProfile;
  /** imported calendar events + household tasks for the week */
  flexible: FlexibleEvent[];
  /** optional checklist override (else DEFAULT_CHECKLIST). Supports the living-document flow. */
  checklist?: import('./health.ts').ScreeningDefinition[];
}
