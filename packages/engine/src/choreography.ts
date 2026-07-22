/**
 * The choreography engine (PRD 6A.2 — the scheduling genius).
 *
 * Every scheduler in the market schedules one task per slot. Their data model
 * cannot represent "laundry runs under dinner prep." This one can, and that is
 * how the margin her protected slot sits in gets MANUFACTURED.
 *
 * Objective function: MAXIMISE CONTIGUOUS PROTECTED MARGIN. Never "minimise
 * idle time," never "fit more in." A solver that maximises utilisation is the
 * wrong objective and reproduces the Motion failure mode (a fuller, tighter
 * day). We optimise for the empty block.
 *
 * V1 is a greedy pass, which is sufficient to produce the one surfaced eureka
 * move with reasoning shown (Bible: exactly one act of choreography per user).
 */

import { channelsCollide, } from './classifier.ts';
import { dayName, fmt, overlaps } from './placement.ts';
import type {
  ChoreographyMove,
  FlexibleEvent,
  ProtectedSlot,
  TimeBlock,
} from './types.ts';

/** A foreground anchor a background process can be slid underneath. */
interface Anchor {
  id: string;
  label: string;
  block: TimeBlock;
  channels: FlexibleEvent['resource_channels'];
  location: FlexibleEvent['location'];
  /** true for her protected slots — they host backgrounds but are never divided */
  isProtected: boolean;
}

/** setup this short can interleave with a foreground (loading a machine mid-prep). */
const INTERLEAVE_SETUP_MAX = 15;

function abuts(a: TimeBlock, b: TimeBlock): boolean {
  return a.day === b.day && (a.end === b.start || b.end === a.start);
}

function contains(outer: TimeBlock, inner: TimeBlock): boolean {
  return outer.day === inner.day && inner.start >= outer.start && inner.end <= outer.end;
}

function locationsCompatible(a: FlexibleEvent['location'], b: FlexibleEvent['location']): boolean {
  if (a === 'EITHER' || b === 'EITHER') return true;
  return a === b;
}

/**
 * Can this background process be slid under this anchor?
 *  - never two HIGH-attention tasks (background is LOW by definition — ok)
 *  - locations compatible (laundry HOME under dinner HOME)
 *  - EITHER the brief setup interleaves, OR the human channels don't collide
 *  - the unattended run needs only to be able to run through the anchor window;
 *    it occupies no human channel, only LOCATION.
 */
function canAttach(bg: FlexibleEvent, anchor: Anchor): boolean {
  if (!bg.is_background_process) return false;
  if (!locationsCompatible(bg.location, anchor.location)) return false;
  // A home chore's SETUP needs her at home — so its anchor must be a home
  // activity. She cannot load the laundry from the school gate or the office.
  if (bg.location === 'HOME' && anchor.location !== 'HOME') return false;

  const setupInterleaves = bg.setup_minutes <= INTERLEAVE_SETUP_MAX;
  const channelsFree = !channelsCollide(bg.resource_channels, anchor.channels);
  if (!setupInterleaves && !channelsFree) return false;

  // the anchor must be long enough to host the setup
  const anchorLen = anchor.block.end - anchor.block.start;
  if (anchorLen < bg.setup_minutes) return false;

  return true;
}

export interface ChoreographyResult {
  /** flexible events after choreography (backgrounds attached, some blocks freed) */
  flexible: FlexibleEvent[];
  /** protected slots, with hasMargin set where a freed block gives them room */
  protected: ProtectedSlot[];
  /** the ONE surfaced move (reasoning shown), or null if none was possible */
  surfacedMove: ChoreographyMove | null;
  /** total minutes reclaimed by not giving backgrounds their own slots */
  marginMinutes: number;
  trace: string[];
}

/**
 * Run choreography over a base placement.
 *
 * @param placedProtected protected slots already placed in Pass 1 (immovable)
 * @param placedFlexible  flexible events after arrangeFlexible base placement
 */
export function choreograph(
  placedProtected: ProtectedSlot[],
  placedFlexible: FlexibleEvent[],
): ChoreographyResult {
  const trace: string[] = [];

  // Build the anchor set: fixed/placed FOREGROUND flexible events + her protected slots.
  const anchors: Anchor[] = [];
  for (const ev of placedFlexible) {
    if (ev.role === 'FOREGROUND' && ev.placement) {
      anchors.push({
        id: ev.id,
        label: ev.label,
        block: ev.placement,
        channels: ev.resource_channels,
        location: ev.location,
        isProtected: false,
      });
    }
  }
  for (const slot of placedProtected) {
    if (slot.placement) {
      anchors.push({
        id: slot.id,
        label: slot.label,
        block: slot.placement,
        channels: ['FOCUS', 'PRESENCE'],
        location: 'HOME',
        isProtected: true,
      });
    }
  }

  const flexible = placedFlexible.map((e) => ({ ...e, co_running_with: [...e.co_running_with] }));
  const protectedOut = placedProtected.map((s) => ({ ...s }));

  const candidateMoves: ChoreographyMove[] = [];
  let marginMinutes = 0;

  // For each background process currently holding its own block, try to slide it
  // under a compatible anchor. Prefer anchors that are NOT her protected slot
  // (we'd rather run the chore under dinner than under her run), but a protected
  // slot can host a truly passive background (a slow cooker under her run).
  const backgrounds = flexible.filter((e) => e.is_background_process && e.placement);
  const orderedAnchors = [...anchors].sort((a, b) => Number(a.isProtected) - Number(b.isProtected));

  for (const bg of backgrounds) {
    const standaloneBlock = bg.placement!; // what it would otherwise occupy

    // Every anchor this background could legally run under.
    const candidates = orderedAnchors.filter((a) => a.id !== bg.id && canAttach(bg, a));
    if (!candidates.length) continue;

    // Prefer running the chore under a household foreground (dinner prep), never
    // under her protected slot, when both are possible.
    const nonProtected = candidates.filter((a) => !a.isProtected);
    const usable = nonProtected.length ? nonProtected : candidates;

    // Choose the anchor most tightly BEFORE the block the chore would have taken,
    // on the same day — so the causal story is "it ran while you were prepping,
    // which freed the later block." Falls back to the nearest anchor by time.
    const sameDay = usable.filter((a) => a.block.day === standaloneBlock.day);
    const pool = sameDay.length ? sameDay : usable;
    const before = pool.filter((a) => a.block.start <= standaloneBlock.start);
    const attachedTo: Anchor = before.length
      ? before.reduce((x, y) => (y.block.start > x.block.start ? y : x))
      : pool.reduce((x, y) =>
          Math.abs(y.block.start - standaloneBlock.start) < Math.abs(x.block.start - standaloneBlock.start) ? y : x,
        );

    void contains;

    // Attach: the background now runs under the anchor and needs no standalone slot.
    bg.co_running_with.push(attachedTo.id);
    // Show it co-running DURING its anchor (dinner prep), not as a block of its
    // own — so it never visually spills onto her protected time. The unattended
    // tail is implied; it claims none of her attention.
    bg.placement = { ...attachedTo.block };
    // mark the anchor event as co-running too
    const anchorEv = flexible.find((e) => e.id === attachedTo!.id);
    if (anchorEv) anchorEv.co_running_with.push(bg.id);

    // The block it WOULD have occupied is now free — that reclaimed time is margin.
    const freed = standaloneBlock;
    const freedMinutes = freed.end - freed.start;
    marginMinutes += freedMinutes;

    // Which protected slot now enjoys this margin? Prefer one adjacent to or
    // containing the freed block; else the deferral / movement slot.
    const benefiting = pickBenefitingProtected(protectedOut, freed);

    trace.push(
      `Choreography · slid "${bg.label}" under "${attachedTo.label}" — it runs unattended, so it no longer needs its own ${freedMinutes}-min block; that block is now margin`,
    );

    if (benefiting) {
      benefiting.hasMargin = true;
      candidateMoves.push({
        backgroundTaskId: bg.id,
        anchorId: attachedTo.id,
        freedBlock: freed,
        filledProtectedId: benefiting.id,
        reason: buildReason(bg, attachedTo, freed, benefiting),
      });
    }
  }

  // Surface EXACTLY ONE move — the one that gives a protected slot real margin.
  const surfacedMove = candidateMoves[0] ?? null;
  if (surfacedMove) {
    const bg = flexible.find((e) => e.id === surfacedMove.backgroundTaskId);
    if (bg) bg.choreography_reason = surfacedMove.reason;
    trace.push(`Choreography · surfaced ONE move with reasoning shown (V1 scope: one eureka, not a suite)`);
  } else {
