// req-189 — the overview row's done suffix, derived from the workout (no stored marker):
// " · done" when any set was logged; all sets skipped → " · swapped" when a Swap replaced it
// (an item in the snapshot carries `replacesItemId` = its key, set by workout-log.js
// replacementItem), else " · skipped" (⋯ → Skip exercise, or every set skipped by hand).
// req-222 — itemSwappedAway now lives in workout-log.js (the pill's whole-workout count uses it
// too); re-exported here so its callers are unchanged.
import { itemAllSkipped, itemSwappedAway } from '../../workout-progress.js'

export { itemSwappedAway }

export function doneRowSuffix(active, item) {
  if (!itemAllSkipped(active, item)) return ' · done'
  return itemSwappedAway(active, item) ? ' · swapped' : ' · skipped'
}
