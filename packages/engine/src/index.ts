/**
 * @margia/engine — the owned asset.
 *
 * The protection + choreography engine, exposed as a surface-agnostic service.
 * A web app, an SMS handler, or an agent surface all call the SAME operation
 * (generatePlan) and render what it returns. No protection rule, attention-cost
 * rule, or scheduling decision lives anywhere but here (6A.0).
 */

export { generatePlan } from './generatePlan.ts';
export { classify, channelsCollide } from './classifier.ts';
export { choreograph } from './choreography.ts';
export { placeProtected, arrangeFlexible, overlaps, fmt, dayName } from './placement.ts';
export {
  DEFAULT_CHECKLIST,
  computeGaps,
  buildHealthNudge,
  applyChecklistChange,
  rescoreAllUsers,
  buildChangeNotice,
} from './health.ts';
export type {
  ScreeningId,
  ScreeningDefinition,
  ScreeningRecord,
  ScreeningGap,
  GapStatus,
  HealthNudge,
  ChecklistHistoryEntry,
  ChecklistChange,
  UserForRescore,
  RescoreResult,
} from './health.ts';
export * from './types.ts';
