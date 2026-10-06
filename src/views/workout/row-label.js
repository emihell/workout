// req-189 — the overview row's done suffix, derived from the workout (no stored marker):
// " · done" when any set was logged; all sets skipped → " · swapped" when a Swap replaced it
// (an item in the snapshot carries `replacesItemId` = its key, set by workout-log.js
// replacementItem), else " · skipped" (⋯ → Skip exercise, or every set skipped by hand).
import { itemAllSkipped, itemKey } from '../../workout-log.js'

export function itemSwappedAway(active, item) {
  const key = itemKey(item)
  return Boolean(key) && (active?.snapshot?.items || []).some((other) => other.replacesItemId === key)
}

export function doneRowSuffix(active, item) {
  if (!itemAllSkipped(active, item)) return ' · done'
  return itemSwappedAway(active, item) ? ' · swapped' : ' · skipped'
}
