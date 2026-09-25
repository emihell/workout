// req-171 — where the History screens' Back (and their Cancel/Save/Delete exits that
// return "up") go. A workout detail is reached from the History month list, Today and
// a finished workout's overview; one exercise in it from the detail and from the
// exercise's history list. The link in carries `?from=` (route.js withFrom) and these
// return there, else to the fixed parent. JSX-free so `node --test` can import it.

import { findInFromChain, parseRoute, withFrom } from '../../route.js'

export function historyDetailPath(workoutId) {
  return `/history/${workoutId}`
}

export function historyExercisePath(workoutId, itemId) {
  return `/history/${workoutId}/exercise/${itemId}`
}

// The workout detail's Back and Delete: where it was opened from, else the History list.
export function historyDetailBack(from) {
  return from || '/history'
}

// The workout detail as the user last saw it (carrying its own `from`), found up the
// chain — for exits that return to the workout from any depth (Edit, the Add-set
// picker, the recalc after a set change). The plain detail when the chain has none.
export function historyDetailReturn(workoutId, from) {
  return (
    findInFromChain(from, (route) => route.name === 'history-detail' && route.id === workoutId) ||
    historyDetailPath(workoutId)
  )
}

// One exercise in a past workout: back to the exercise's history list or the workout
// it was opened from, else the workout.
export function historyExerciseBack(workoutId, from) {
  return from || historyDetailPath(workoutId)
}

// A set of one exercise: back to that exercise screen as it was opened.
export function historySetBack(workoutId, itemId, from) {
  return from || historyExercisePath(workoutId, itemId)
}

// The add-set form (req-117): back to the exercise screen it was opened from; from the
// workout's Add-set picker, to the exercise's screen when the workout already has it
// (as before), else to the workout.
export function historyAddSetBack(workoutId, itemId, known, from) {
  if (from && parseRoute(from).name === 'history-workout-exercise') return from
  const detail = historyDetailReturn(workoutId, from)
  if (!known) return detail
  const detailFrom = detail === historyDetailPath(workoutId) ? null : detail
  return withFrom(historyExercisePath(workoutId, itemId), detailFrom)
}
