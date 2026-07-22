/**
 * The two-pass placement engine (PRD 6A.1 — the inverted default).
 *
 * The market's default: obligations placed first, personal time is the residue
 * that survives when the week is full. Margia inverts it. HER slots are placed
 * first, in a dedicated Pass 1. Flexible events fill in around them in Pass 2,
 * which is ARCHITECTURALLY FORBIDDEN from moving or overwriting a Pass-1
 * placement.
 *
 * This is deliberately NOT a single weighted priority queue. A queue that
 * merely ranks protected events highly reproduces the Reclaim failure mode: a
 * tall enough stack of "Critical" external events buries her slot. Separate
 * passes, with the invariant enforced in code, is the whole point.
 */

import type {
  AvailabilityWindow,
  FlexibleEvent,
  ProtectedSlot,
  TimeBlock,
  Weekday,
} from './types.ts';

const DAY = 24 * 60;

export function overlaps(a: TimeBlock, b: TimeBlock): boolean {
  return a.day === b.day && a.start < b.end && b.start < a.end;
}

function withinWindow(block: TimeBlock, w: AvailabilityWindow): boolean {
  return block.day === w.day && block.start >= w.start && block.end <= w.end;
}

/** Does `candidate` collide with any block already committed on that day? */
function collidesAny(candidate: TimeBlock, committed: TimeBlock[]): boolean {
  return committed.some((c) => overlaps(candidate, c));
}

/**
 * Try to fit a slot of `duration` inside window `w`, avoiding `committed`
 * blocks. Returns the earliest legal placement, or null. Steps in 15-min grid.
 */
function firstFit(
  duration: number,
  w: AvailabilityWindow,
  committed: TimeBlock[],
): TimeBlock | null {
  const step = 15;
  for (let start = w.start; start + duration <= w.end; start += step) {
    const candidate: TimeBlock = { day: w.day, start, end: start + duration };
    if (!collidesAny(candidate, committed)) return candidate;
  }
  return null;
}

export interface ProtectedResult {
  placed: ProtectedSlot[];
  /** slots the engine could not place inside her stated availability */
  unplaceable: ProtectedSlot[];
  /** the committed protected blocks — these are immovable in Pass 2 */
  committedBlocks: TimeBlock[];
  trace: string[];
}

/**
 * PASS 1 — placeProtected.
 *
 * Positions all protected slots using ONLY her availability windows and hard
 * calendar conflicts (immovable fixed anchors) as constraints. Flexible events
 * are not consulted here at all — they do not get to influence where her time
 * goes. Higher-weight slots are placed first when they compete for a window.
 */
export function placeProtected(
  slots: ProtectedSlot[],
  fixedAnchors: TimeBlock[],
): ProtectedResult {
  const trace: string[] = [];
  const committed: TimeBlock[] = [...fixedAnchors];
  const placed: ProtectedSlot[] = [];
  const unplaceable: ProtectedSlot[] = [];

  // heaviest first — sleep and therapy hold hardest
  const ordered = [...slots].sort((a, b) => b.weight - a.weight);

  for (const slot of ordered) {
    const windows = slot.eligibleWindows.length
      ? slot.eligibleWindows
      : defaultWakingWindows();

    let placement: TimeBlock | null = null;
    for (const w of windows) {
      placement = firstFit(slot.durationMinutes, w, committed);
      if (placement) break;
    }

    if (placement) {
      const withPlacement: ProtectedSlot = { ...slot, placement };
      placed.push(withPlacement);
      committed.push(placement);
      trace.push(
        `Pass 1 · placed protected "${slot.label}" on ${dayName(placement.day)} ${fmt(placement.start)}–${fmt(placement.end)} (before any logistics)`,
      );
    } else {
      unplaceable.push({ ...slot });
      trace.push(
        `Pass 1 · could NOT place "${slot.label}" inside her stated availability — surfacing rather than cramming`,
      );
    }
  }

  return { placed, unplaceable, committedBlocks: committed, trace };
}

export interface FlexibleResult {
  placed: FlexibleEvent[];
  /** flexible events that had no room and were left unplaced (never on top of protected) */
  unplaced: FlexibleEvent[];
  trace: string[];
}

/**
 * PASS 2 (base placement) — arrangeFlexible.
 *
 * Receives Pass-1 protected placements as IMMOVABLE. Fixed anchors keep their
 * time. Movable flexible events are positioned in the remaining space, and the
 * invariant is enforced here in code: a movable event is never committed to a
 * block that overlaps a protected placement.
 *
 * Choreography (sliding backgrounds under foregrounds to MANUFACTURE margin)
 * runs on top of this base placement — see choreography.ts. This function does
 * the honest, dumb thing: fit what fits, never touch her slots.
 */
export function arrangeFlexible(
  flexible: FlexibleEvent[],
  protectedBlocks: TimeBlock[],
): FlexibleResult {
  const trace: string[] = [];
  // protected blocks are immovable and off-limits
  const committed: TimeBlock[] = [...protectedBlocks];
  const placed: FlexibleEvent[] = [];
  const unplaced: FlexibleEvent[] = [];

  // fixed anchors first — they own their time
  for (const ev of flexible.filter((e) => e.fixed)) {
    const block = ev.fixed!;
    if (collidesAny(block, protectedBlocks)) {
      // a flexible event is trying to sit on her protected time: SURFACE, don't overwrite
      placed.push({ ...ev, placement: block });
      committed.push(block);
      trace.push(
        `Pass 2 · fixed "${ev.label}" overlaps a protected slot — flagged as a conflict for her to resolve (never silently moved)`,
      );
    } else {
      placed.push({ ...ev, placement: block });
      committed.push(block);
      trace.push(`Pass 2 · anchored fixed "${ev.label}" at ${dayName(block.day)} ${fmt(block.start)}`);
    }
  }

  // movable events fill the remaining gaps, never over protected time
  for (const ev of flexible.filter((e) => !e.fixed)) {
    const windows = defaultWakingWindows();
    let placement: TimeBlock | null = null;
    for (const w of windows) {
      placement = firstFit(ev.duration_minutes, w, committed);
      if (placement) break;
    }
    if (placement) {
      placed.push({ ...ev, placement });
      committed.push(placement);
      trace.push(`Pass 2 · fit movable "${ev.label}" into remaining space at ${dayName(placement.day)} ${fmt(placement.start)}`);
    } else {
      unplaced.push({ ...ev });
      trace.push(`Pass 2 · no room for "${ev.label}" without touching a protected slot — left it unplaced rather than overwrite her time`);
    }
  }

  return { placed, unplaced, trace };
}

// --- helpers ---

function defaultWakingWindows(): AvailabilityWindow[] {
  const days: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
  return days.map((day) => ({ day, start: 6 * 60, end: 22 * 60 }));
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export function dayName(d: Weekday): string {
  return DAY_NAMES[d] ?? `Day${d}`;
}

export function fmt(min: number): string {
  const m = ((min % DAY) + DAY) % DAY;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const ampm = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return mm === 0 ? `${h12}${ampm}` : `${h12}:${String(mm).padStart(2, '0')}${ampm}`;
}
