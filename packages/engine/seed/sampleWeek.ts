/**
 * A realistic sample week for a working mother of two (ages 2 and 6).
 *
 * The week is DELIBERATELY dense: her days are booked solid from the 6am wake
 * to dinner, so the first gap a household chore can fall into is the evening
 * that should be hers. That is not a contrivance — it is the thesis made
 * concrete (logistics colonise her evening). It is exactly the condition the
 * choreography engine exists to break.
 *
 * Used to prove the engine and to render the first design for approval. When
 * Google Calendar sync is wired, this seed is replaced by her real events; the
 * engine code does not change.
 */

import type {
  AvailabilityWindow,
  FlexibleEvent,
  OnboardingProfile,
  PlanInput,
  ProtectedSlot,
  Weekday,
} from '../src/types.ts';
import type { ScreeningDefinition, ScreeningRecord } from '../src/health.ts';
import { DEFAULT_CHECKLIST } from '../src/health.ts';
import { classify } from '../src/classifier.ts';

const h = (hour: number, min = 0) => hour * 60 + min;
const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4]; // Mon..Fri

// --- helpers to build fixed anchors across weekdays -----------------------
// We let the classifier seed each anchor's attention_cost / channels / location
// from its label (exactly as it will for her real Google events) — so "Dinner
// prep" is correctly HOME + hands/eyes/focus and "School drop-off" is OUT.
function daily(
  idPrefix: string,
  label: string,
  start: number,
  end: number,
  extra: Partial<FlexibleEvent> = {},
  days: Weekday[] = WEEKDAYS,
): FlexibleEvent[] {
  return days.map((day) =>
    classify({
      id: `${idPrefix}-${day}`,
      label,
      kind: 'IMPORTED' as const,
      duration_minutes: end - start,
      movable: false,
      fixed: { day, start, end },
      ...extra,
    }),
  );
}

// ---------------------------------------------------------------------------
// Her four onboarding answers + availability
// ---------------------------------------------------------------------------

const availability: AvailabilityWindow[] = [
  // weekday evenings — the window she'd protect if anything were left in it
  ...WEEKDAYS.map((day) => ({ day, start: h(18), end: h(21) })),
  // Thursday lunch (therapy), Friday early morning (a check she can book)
  { day: 3, start: h(18), end: h(20) },
  { day: 4, start: h(9), end: h(10) },
  // Saturday morning — her one open weekend window
  { day: 5, start: h(8), end: h(12) },
];

// her protected slots (movement is the deferral — the thing she keeps moving)
const protectedSlots: ProtectedSlot[] = [
  {
    id: 'therapy',
    label: 'Therapy',
    type: 'THERAPY',
    durationMinutes: 60,
    eligibleWindows: [{ day: 3, start: h(18), end: h(20) }],
    weight: 95,
  },
  {
    id: 'solo',
    label: 'Solo time',
    type: 'SOLO',
    durationMinutes: 30,
    // Saturday morning — kept off weekday evenings so Monday after her run is
    // genuinely clear, and the manufactured margin reads unmistakably.
    eligibleWindows: [{ day: 5, start: h(8), end: h(12) }],
    weight: 70,
  },
];

const screeningRecords: ScreeningRecord[] = [
  { id: 'cervical', last_done: '2022-01-15' }, // ~4.5 years ago → overdue (36-mo interval)
  { id: 'well_woman', last_done: '2024-11-01' }, // ~20 months → overdue (12-mo interval)
  { id: 'dental', last_done: '2026-03-01' }, // recent → ok
  { id: 'blood_pressure', last_done: '2025-06-01' }, // ok
  { id: 'mammogram', last_done: null }, // n/a at age 38 (min_age 40) — age-gate demo
];

export const profile: OnboardingProfile = {
  name: 'Louise',
  availability,
  deferral: { label: 'Your run', type: 'MOVEMENT', durationMinutes: 45 },
  protectedSlots,
  age: 38,
  screeningRecords,
};

// ---------------------------------------------------------------------------
// Her flexible week — imported calendar events (fixed anchors) + household tasks
// ---------------------------------------------------------------------------

const GCAL_BLUE = '#4B7BEC';
const GCAL_SAGE = '#5EA47C';
const GCAL_GRAPE = '#8E5EA4';
const GCAL_TANGERINE = '#E8894A';

const fixedAnchors: FlexibleEvent[] = [
  ...daily('morning', 'Morning + school drop-off', h(6), h(8, 30), { originColor: GCAL_TANGERINE }),
  ...daily('work', 'Work', h(9), h(15), { originColor: GCAL_BLUE }, [0, 1, 2, 3]),
  ...daily('work-fri', 'Work', h(10), h(15), { originColor: GCAL_BLUE }, [4]), // Fri starts later
  ...daily('pickup', 'School pickup', h(15, 30), h(16, 15), { originColor: GCAL_TANGERINE }),
  ...daily('homework', 'Homework + snack with the kids', h(16, 15), h(17, 15), { originColor: GCAL_GRAPE }),
  ...daily('dinner', 'Dinner prep', h(17, 15), h(18), { originColor: GCAL_SAGE }),
  ...daily('bath', 'Bath + bedtime', h(20), h(21), { originColor: GCAL_GRAPE }),
];

// a mid-week kid activity that the engine may reposition (movable, flexible)
const soccer: FlexibleEvent = {
  id: 'soccer',
  label: 'Soccer practice (Ben)',
  kind: 'IMPORTED',
  attention_cost: 'HIGH',
  resource_channels: ['EYES', 'PRESENCE'],
  location: 'OUT',
  duration_minutes: 60,
  setup_minutes: 0,
  unattended_minutes: 0,
  is_background_process: false,
  role: 'FOREGROUND',
  movable: true,
  fixed: { day: 2, start: h(18), end: h(19) }, // Wed 6–7pm
  originColor: GCAL_SAGE,
  co_running_with: [],
  choreography_reason: null,
};

// household tasks — the classifier will seed their attributes from the labels.
// Laundry is the background process; it is the raw material of the eureka move.
const household: Array<Partial<FlexibleEvent> & Pick<FlexibleEvent, 'id' | 'label' | 'kind' | 'duration_minutes' | 'movable'>> = [
  { id: 'laundry', label: 'Laundry', kind: 'HOUSEHOLD', duration_minutes: 45, movable: true },
  { id: 'dishwasher', label: 'Run + empty dishwasher', kind: 'HOUSEHOLD', duration_minutes: 30, movable: true },
  { id: 'fold', label: 'Fold laundry', kind: 'HOUSEHOLD', duration_minutes: 25, movable: true },
  { id: 'groceries', label: 'Groceries', kind: 'HOUSEHOLD', duration_minutes: 60, movable: true },
  { id: 'tidy', label: 'Tidy up the kitchen', kind: 'HOUSEHOLD', duration_minutes: 20, movable: true },
];

// household items are passed as partials; generatePlan's classify() completes them.
const householdEvents = household as unknown as FlexibleEvent[];

export const sampleWeek: PlanInput = {
  weekStartISO: '2026-07-20', // a Monday
  profile,
  flexible: [...fixedAnchors, soccer, ...householdEvents],
};

/** A checklist where the cervical nudge is CLEARED (represents a clinical sign-off),
 *  so the design review can see the actual nudge treatment. DEFAULT stays gated. */
export const demoChecklist: ScreeningDefinition[] = DEFAULT_CHECKLIST.map((d) =>
  d.id === 'cervical' ? { ...d, nudge_enabled: true } : d,
);

export const sampleWeekWithClearedNudge: PlanInput = {
  ...sampleWeek,
  checklist: demoChecklist,
};

// ---------------------------------------------------------------------------
// Onboarding → engine. Her four answers become a real PlanInput.
// Until Google Calendar sync is wired, we reuse the fixed anchors above as her
// "imported calendar." Everything else comes from what she actually answered.
// ---------------------------------------------------------------------------

export type AvailabilityChoice = 'MORNING' | 'MIDDAY' | 'EVENING' | 'UNSURE';

export interface OnboardingAnswers {
  /** verbatim — travels into the plan as a named slot (the word-of-mouth mechanic) */
  deferral: string;
  availability: AvailabilityChoice;
  household?: 'SHARED' | 'MOSTLY_ME' | 'JUST_ME';
  kidsAges?: string[];
  age: number;
}

function windowsFor(choice: AvailabilityChoice): AvailabilityWindow[] {
  switch (choice) {
    case 'MORNING':
      return WEEKDAYS.map((day) => ({ day, start: h(6), end: h(9) }));
    case 'MIDDAY':
      return WEEKDAYS.map((day) => ({ day, start: h(9), end: h(14) }));
    case 'EVENING':
      return WEEKDAYS.map((day) => ({ day, start: h(19), end: h(22) }));
    case 'UNSURE':
    default:
      // distribute across the week rather than cluster (James Okafor's note)
      return [
        ...WEEKDAYS.map((day) => ({ day, start: h(18), end: h(21) })),
        { day: 5, start: h(8), end: h(12) },
      ];
  }
}

/** Infer a protected TYPE from her own words, so the slot renders with meaning. */
function deferralType(text: string): import('../src/types.ts').ProtectedType {
  const t = text.toLowerCase();
  if (/(smear|mammogram|screen|pap)/.test(t)) return 'SCREENING';
  if (/(dentist|dental|doctor|gp|physical|check)/.test(t)) return 'CHECKUP';
  if (/(therap|counsel)/.test(t)) return 'THERAPY';
  if (/(run|walk|gym|exercise|yoga|swim|workout|movement|pilates)/.test(t)) return 'MOVEMENT';
  return 'DEFERRAL';
}

/** Optional real inputs: her actual calendar events + the real week they fall in. */
export interface OnboardingContext {
  /** her real imported calendar events (from Google), replacing the modelled anchors */
  imported?: FlexibleEvent[];
  /** the ISO Monday of her real current week */
  weekStartISO?: string;
}

export function planFromOnboarding(answers: OnboardingAnswers, ctx: OnboardingContext = {}): PlanInput {
  const availability = windowsFor(answers.availability);
  const label = answers.deferral.trim() || 'Your run';

  const profileFromAnswers: OnboardingProfile = {
    name: 'you',
    availability,
    deferral: { label, type: deferralType(label), durationMinutes: 45 },
    // one default protected slot so the reveal isn't sparse — her hour, hers alone
    protectedSlots: [
      {
        id: 'solo',
        label: 'Solo time',
        type: 'SOLO',
        durationMinutes: 30,
        eligibleWindows: availability,
        weight: 70,
      },
    ],
    age: answers.age,
    screeningRecords: [], // no dates collected in onboarding; age-appropriate gaps surface as never-done
  };

  // Her real calendar (when connected) replaces the modelled anchors as the
  // week's fixed logistics. The household chores stay — they're Margia's layer,
  // not Google's, and they're the raw material the choreography engine needs to
  // manufacture margin. So: her real events + Margia's household tasks.
  const importedLogistics = ctx.imported ?? [...fixedAnchors, soccer];

  return {
    weekStartISO: ctx.weekStartISO ?? '2026-07-20',
    profile: profileFromAnswers,
    flexible: [...importedLogistics, ...householdEvents],
    checklist: demoChecklist, // cervical nudge cleared, to demonstrate the health voice
  };
}
