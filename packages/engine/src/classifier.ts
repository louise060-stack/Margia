/**
 * The seed classifier (PRD 6A.2, "Seeding the attributes without asking her to
 * fill in a form").
 *
 * She will NEVER tag a task's attention cost by hand — that is exactly the
 * labour that kills these apps (Maya Rodriguez). Instead the engine seeds
 * attention_cost + resource_channels from a lookup over ~40 common domestic
 * task types, matched to her event labels by keyword. The per-user learning
 * loop (6A.4) later corrects these defaults from observed behaviour.
 *
 * A binary attention scale is deliberate for V1 (Tara Okonkwo). A 1–5 scale is
 * explicitly V2 — false precision the core rule does not need.
 */

import type {
  AttentionCost,
  ChoreographyRole,
  FlexibleEvent,
  Location,
  ResourceChannel,
} from './types.ts';

interface TaskDefault {
  attention_cost: AttentionCost;
  resource_channels: ResourceChannel[];
  location: Location;
  /** typical minutes of active setup before it can run unattended */
  setup_minutes: number;
  /** typical minutes it runs on its own after setup (0 = not a background job) */
  unattended_minutes: number;
}

/**
 * The seed table. Keys are keyword stems matched case-insensitively against the
 * task label. Order matters: more specific stems are listed first.
 *
 * BACKGROUND PROCESSES (LOW attention + unattended_minutes > 0) are the raw
 * material of choreography — the things that get slid underneath a foreground.
 */
const TASK_DEFAULTS: Array<[string, TaskDefault]> = [
  // --- compound labels that must beat a generic stem below them ---
  // "Fold laundry" must match FOLD (companionable), not "laundry" (background).
  ['fold laundry', { attention_cost: 'LOW', resource_channels: ['HANDS', 'EYES'], location: 'HOME', setup_minutes: 0, unattended_minutes: 0 }],
  ['fold', { attention_cost: 'LOW', resource_channels: ['HANDS', 'EYES'], location: 'HOME', setup_minutes: 0, unattended_minutes: 0 }],

  // --- background processes: low attention, run themselves after setup ---
  ['laundry', { attention_cost: 'LOW', resource_channels: ['HANDS'], location: 'HOME', setup_minutes: 4, unattended_minutes: 50 }],
  ['washing', { attention_cost: 'LOW', resource_channels: ['HANDS'], location: 'HOME', setup_minutes: 4, unattended_minutes: 50 }],
  ['dishwasher', { attention_cost: 'LOW', resource_channels: ['HANDS'], location: 'HOME', setup_minutes: 6, unattended_minutes: 90 }],
  ['dryer', { attention_cost: 'LOW', resource_channels: ['HANDS'], location: 'HOME', setup_minutes: 3, unattended_minutes: 60 }],
  ['slow cooker', { attention_cost: 'LOW', resource_channels: ['HANDS', 'FOCUS'], location: 'HOME', setup_minutes: 12, unattended_minutes: 240 }],
  ['crockpot', { attention_cost: 'LOW', resource_channels: ['HANDS', 'FOCUS'], location: 'HOME', setup_minutes: 12, unattended_minutes: 240 }],
  ['roast', { attention_cost: 'LOW', resource_channels: ['HANDS'], location: 'HOME', setup_minutes: 10, unattended_minutes: 75 }],
  ['oven', { attention_cost: 'LOW', resource_channels: ['HANDS'], location: 'HOME', setup_minutes: 8, unattended_minutes: 45 }],
  ['bread', { attention_cost: 'LOW', resource_channels: ['HANDS'], location: 'HOME', setup_minutes: 15, unattended_minutes: 90 }],
  ['robot vacuum', { attention_cost: 'LOW', resource_channels: [], location: 'HOME', setup_minutes: 1, unattended_minutes: 45 }],
  ['roomba', { attention_cost: 'LOW', resource_channels: [], location: 'HOME', setup_minutes: 1, unattended_minutes: 45 }],
  ['soak', { attention_cost: 'LOW', resource_channels: ['HANDS'], location: 'HOME', setup_minutes: 2, unattended_minutes: 60 }],
  ['charge', { attention_cost: 'LOW', resource_channels: [], location: 'HOME', setup_minutes: 1, unattended_minutes: 120 }],
  ['defrost', { attention_cost: 'LOW', resource_channels: [], location: 'HOME', setup_minutes: 2, unattended_minutes: 180 }],

  // --- companionable-low: low attention, needs hands/presence, not focus ---
  ['fold', { attention_cost: 'LOW', resource_channels: ['HANDS', 'EYES'], location: 'HOME', setup_minutes: 0, unattended_minutes: 0 }],
  ['tidy', { attention_cost: 'LOW', resource_channels: ['HANDS'], location: 'HOME', setup_minutes: 0, unattended_minutes: 0 }],
  ['tidy up', { attention_cost: 'LOW', resource_channels: ['HANDS'], location: 'HOME', setup_minutes: 0, unattended_minutes: 0 }],
  ['chop', { attention_cost: 'LOW', resource_channels: ['HANDS', 'EYES'], location: 'HOME', setup_minutes: 0, unattended_minutes: 0 }],
  ['meal prep', { attention_cost: 'LOW', resource_channels: ['HANDS', 'EYES'], location: 'HOME', setup_minutes: 0, unattended_minutes: 0 }],
  ['water plants', { attention_cost: 'LOW', resource_channels: ['HANDS'], location: 'HOME', setup_minutes: 0, unattended_minutes: 0 }],
  ['unload', { attention_cost: 'LOW', resource_channels: ['HANDS'], location: 'HOME', setup_minutes: 0, unattended_minutes: 0 }],
  ['groceries', { attention_cost: 'LOW', resource_channels: ['HANDS', 'PRESENCE'], location: 'OUT', setup_minutes: 0, unattended_minutes: 0 }],
  ['shopping', { attention_cost: 'LOW', resource_channels: ['HANDS', 'PRESENCE'], location: 'OUT', setup_minutes: 0, unattended_minutes: 0 }],

  // --- foreground high-attention: never stacked with each other ---
  ['homework', { attention_cost: 'HIGH', resource_channels: ['EYES', 'FOCUS', 'PRESENCE'], location: 'HOME', setup_minutes: 0, unattended_minutes: 0 }],
  ['reading with', { attention_cost: 'HIGH', resource_channels: ['EYES', 'FOCUS', 'PRESENCE'], location: 'HOME', setup_minutes: 0, unattended_minutes: 0 }],
  ['bath', { attention_cost: 'HIGH', resource_channels: ['HANDS', 'EYES', 'PRESENCE'], location: 'HOME', setup_minutes: 0, unattended_minutes: 0 }],
  ['bedtime', { attention_cost: 'HIGH', resource_channels: ['EYES', 'FOCUS', 'PRESENCE'], location: 'HOME', setup_minutes: 0, unattended_minutes: 0 }],
  ['dinner', { attention_cost: 'HIGH', resource_channels: ['HANDS', 'EYES', 'FOCUS'], location: 'HOME', setup_minutes: 0, unattended_minutes: 0 }],
  ['cook', { attention_cost: 'HIGH', resource_channels: ['HANDS', 'EYES', 'FOCUS'], location: 'HOME', setup_minutes: 0, unattended_minutes: 0 }],
  ['drive', { attention_cost: 'HIGH', resource_channels: ['HANDS', 'EYES', 'FOCUS'], location: 'OUT', setup_minutes: 0, unattended_minutes: 0 }],
  ['carpool', { attention_cost: 'HIGH', resource_channels: ['HANDS', 'EYES', 'FOCUS'], location: 'OUT', setup_minutes: 0, unattended_minutes: 0 }],
  ['pickup', { attention_cost: 'HIGH', resource_channels: ['EYES', 'PRESENCE'], location: 'OUT', setup_minutes: 0, unattended_minutes: 0 }],
  ['drop-off', { attention_cost: 'HIGH', resource_channels: ['EYES', 'PRESENCE'], location: 'OUT', setup_minutes: 0, unattended_minutes: 0 }],
  ['drop off', { attention_cost: 'HIGH', resource_channels: ['EYES', 'PRESENCE'], location: 'OUT', setup_minutes: 0, unattended_minutes: 0 }],
  ['school run', { attention_cost: 'HIGH', resource_channels: ['HANDS', 'EYES', 'PRESENCE'], location: 'OUT', setup_minutes: 0, unattended_minutes: 0 }],
  ['call', { attention_cost: 'HIGH', resource_channels: ['EARS', 'FOCUS'], location: 'EITHER', setup_minutes: 0, unattended_minutes: 0 }],
  ['meeting', { attention_cost: 'HIGH', resource_channels: ['EARS', 'EYES', 'FOCUS'], location: 'EITHER', setup_minutes: 0, unattended_minutes: 0 }],
  ['work', { attention_cost: 'HIGH', resource_channels: ['EYES', 'FOCUS'], location: 'EITHER', setup_minutes: 0, unattended_minutes: 0 }],
  ['deep work', { attention_cost: 'HIGH', resource_channels: ['EYES', 'FOCUS'], location: 'EITHER', setup_minutes: 0, unattended_minutes: 0 }],
  ['appointment', { attention_cost: 'HIGH', resource_channels: ['PRESENCE', 'FOCUS'], location: 'OUT', setup_minutes: 0, unattended_minutes: 0 }],
  ['soccer', { attention_cost: 'HIGH', resource_channels: ['EYES', 'PRESENCE'], location: 'OUT', setup_minutes: 0, unattended_minutes: 0 }],
  ['practice', { attention_cost: 'HIGH', resource_channels: ['EYES', 'PRESENCE'], location: 'OUT', setup_minutes: 0, unattended_minutes: 0 }],
  ['playdate', { attention_cost: 'HIGH', resource_channels: ['EYES', 'PRESENCE'], location: 'EITHER', setup_minutes: 0, unattended_minutes: 0 }],
];

/** A conservative default when nothing matches: treat as low-attention hands. */
const FALLBACK: TaskDefault = {
  attention_cost: 'LOW',
  resource_channels: ['HANDS'],
  location: 'EITHER',
  setup_minutes: 0,
  unattended_minutes: 0,
};

function lookup(label: string): TaskDefault {
  const l = label.toLowerCase();
  for (const [stem, def] of TASK_DEFAULTS) {
    if (l.includes(stem)) return def;
  }
  return FALLBACK;
}

function deriveRole(
  attention_cost: AttentionCost,
  isBackground: boolean,
  channels: ResourceChannel[],
): ChoreographyRole {
  if (attention_cost === 'HIGH') return 'FOREGROUND';
  if (isBackground) return 'BACKGROUND';
  // low attention, not a background process => needs hands/presence => companionable
  void channels;
  return 'COMPANIONABLE';
}

/**
 * Classify one raw event: fill attention_cost, resource_channels, timing
 * defaults, the computed is_background_process, and the derived role.
 *
 * Anything already present on the input event (an explicit override, or a
 * learned correction) is respected and never clobbered by the seed default.
 */
export function classify(
  raw: Partial<FlexibleEvent> & Pick<FlexibleEvent, 'id' | 'label' | 'kind' | 'duration_minutes' | 'movable'>,
): FlexibleEvent {
  const def = lookup(raw.label);

  const attention_cost = raw.attention_cost ?? def.attention_cost;
  const resource_channels = raw.resource_channels ?? def.resource_channels;
  const location = raw.location ?? def.location;
  const setup_minutes = raw.setup_minutes ?? def.setup_minutes;
  const unattended_minutes = raw.unattended_minutes ?? def.unattended_minutes;

  const is_background_process =
    raw.is_background_process ?? (attention_cost === 'LOW' && unattended_minutes > 0);

  const role = raw.role ?? deriveRole(attention_cost, is_background_process, resource_channels);

  return {
    id: raw.id,
    label: raw.label,
    kind: raw.kind,
    attention_cost,
    resource_channels,
    location,
    duration_minutes: raw.duration_minutes,
    setup_minutes,
    unattended_minutes,
    is_background_process,
    role,
    movable: raw.movable,
    fixed: raw.fixed,
    originColor: raw.originColor,
    placement: raw.placement,
    co_running_with: raw.co_running_with ?? [],
    choreography_reason: raw.choreography_reason ?? null,
  };
}

/** Two tasks may co-run only if their human-required channels do not collide. */
export function channelsCollide(a: ResourceChannel[], b: ResourceChannel[]): boolean {
  return a.some((c) => b.includes(c));
}
