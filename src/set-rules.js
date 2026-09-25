// req-164 (F-STRUCT-6) — the few rules both model.js and workout-log.js need, in a leaf
// module with no imports, so neither has to import the other: model.js imported these
// two predicates from workout-log.js, which imported DEFAULT_DURATION_SEC back (a cycle,
// "safe under live bindings"), and progress.js kept its own isSkipped to stay out of it.
// model.js re-exports DEFAULT_DURATION_SEC and workout-log.js the two predicates, so every
// existing import keeps working.

// req-85 — default target seconds for a timed exercise that has no per-set
// duration set yet. Used as the exercise-level default and the fallback when a
// routine item's `durations` array is empty.
export const DEFAULT_DURATION_SEC = 30

// req-44 — the one shared skipped-set predicate (was duplicated in storage.js and
// inlined in model.js/item.jsx/finish.jsx; req-164: and progress.js). Guards a
// null/undefined `reps` via `|| ''` — the finish.jsx site previously dropped that guard.
export function isSkippedSet(set) {
  return String(set?.reps || '').toLowerCase() === 'skipped'
}

// req-109 — the marker on a snapshot item added mid-workout (a replacement). It tells
// workoutSnapshot (model.js) to skip, for this item, the routine-template match and the
// targets/weights backfill, so the item keeps its own unique routineItemId (never a
// template id → applyProgressionToRoutines never writes it onto the routine) and stays
// blank across reloads. Persisted on the snapshot item; absent on every other item.
export function isAddedMidWorkout(item) {
  return item?.addedMidWorkout === true
}
