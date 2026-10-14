// req-165 (F-LINT-1) — the in-workout screens' shared plain helpers, moved out of
// helpers.jsx (which now exports components only). JSX-free.
import { autoCompleteArmed, itemKey, itemLoggingState } from '../../workout-log'
import { itemCurrentPath, itemDonePath, itemLogPath, itemReplacePath } from '../../workout-paths'
import { recordButton } from '../../analytics'
import { leaveWorkoutToToday } from '../../workout-actions'
import { askConfirm } from '../../ui/confirm.js'

// req-76 — the item log/done path builders now live in the JSX-free workout-paths
// module (so workout-actions.js can share them); re-exported here so the workout
// screens import them from here.
export { itemCurrentPath, itemDonePath, itemLogPath, itemReplacePath }

// Shared helpers for the in-workout screens (req-19 split of Workout.jsx). These
// are the only symbols used by more than one of the workout/ screen modules;
// single-screen helpers stay local to their module.

export function exerciseName(item) {
  return item.exerciseName || 'Exercise'
}

export function findItem(items, itemId) {
  return (items || []).find((item) => itemKey(item) === itemId || item.id === itemId) || null
}

export function isActiveFor(active, routineId) {
  return Boolean(active && active.routineId === routineId)
}

export function itemSetsPath(routineId, item, workout) {
  if (!item) return `/workout/${routineId}`
  return itemCurrentPath(routineId, item, itemLoggingState(workout, item).plannedDone)
}

// Discard the active workout (confirm first). Shared by the overview's Abandon and, since
// req-116, the Finish screen's "Nothing logged" Abandon.
// req-201 — the confirm names the session's workout ("Abandon Upper Body?").
export async function abandonWorkout(store) {
  const name = store.activeWorkout?.snapshot?.routineName || 'this session'
  if (!(await askConfirm(`Abandon ${name}?`, { confirmLabel: 'Abandon' }))) return
  recordButton('abandon-workout')
  store.abandonWorkout()
  leaveWorkoutToToday()
}

// req-223 (DEC-103 §2, DEC-125 §2) — the two exercise actions, in one place for both places
// that offer them: the list row's "⋯" sheet (overview.jsx rowActions) and the log screen's
// "Up next" bar. Swap is navigation (the Swap picker; nothing written until a pick). Skip is
// one write: every remaining set logged skipped and the item done (store.skipItem).
export function swapExercisePath(routineId, item) {
  return itemReplacePath(routineId, item)
}

export function skipExercise(store, item) {
  recordButton('skip-exercise')
  store.skipItem(itemKey(item))
}

// Where "Finish" goes with no exercise left (req-212's review rule, shared with the Up next
// bar's Skip, req-223): the auto-complete summary on the overview when it is armed, else the
// Finish screen.
export function finishTarget(workout, routineId) {
  return autoCompleteArmed(workout) ? `/workout/${routineId}` : `/workout/${routineId}/finish`
}
