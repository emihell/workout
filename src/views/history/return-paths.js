// req-171 — where the History screens' Back (and their Cancel/Save/Delete exits that
// return "up") go. A workout detail is reached from the History month list, Today and
// a finished workout's overview; one exercise in it from the detail and from the
// exercise's history list. The link in carries `?from=` (route.js withFrom) and these
// return there, else to the fixed parent. JSX-free so `node --test` can import it.

import { findInFromChain, parseRoute, withFrom } from '../../route.js'
import { navForBase } from '../routine-nav.js'

// req-263 (DEC-155 §4) — the History routes whose `id` is a workout id (`history-exercise`'s
// is an exercise id, so it is not here).
const WORKOUT_ROUTES = new Set([
  'history-detail',
  'history-workout-exercise',
  'history-set',
  'history-set-add',
  'history-set-new',
  'history-edit',
  'history-recalculate',
  'history-routine',
])

// req-263 — a `from` naming a workout that is no longer in `workouts` (deleted since the
// link was made: a kept URL, browser history) is dropped, so the caller falls back to its
// fixed parent instead of landing on "Not found.". DEC-092 accepted a stale id with a valid
// shape; DEC-155 §6 overrides that. With no `workouts` handed in, `from` is kept as given.
export function liveFrom(from, workouts) {
  if (!from) return null
  if (!workouts) return from
  const route = parseRoute(from)
  if (WORKOUT_ROUTES.has(route.name) && !workouts.some((workout) => workout.id === route.id)) return null
  return from
}

export function historyDetailPath(workoutId) {
  return `/history/${workoutId}`
}

export function historyExercisePath(workoutId, itemId) {
  return `/history/${workoutId}/exercise/${itemId}`
}

// The workout detail's Back and Delete: where it was opened from, else the History list.
export function historyDetailBack(from, workouts) {
  return liveFrom(from, workouts) || '/history'
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
export function historyExerciseBack(workoutId, from, workouts) {
  return liveFrom(from, workouts) || historyDetailPath(workoutId)
}

// A set of one exercise: back to that exercise screen as it was opened.
export function historySetBack(workoutId, itemId, from, workouts) {
  return liveFrom(from, workouts) || historyExercisePath(workoutId, itemId)
}

// The add-set form (req-117): back to the exercise screen it was opened from; from the
// workout's Add-set picker, to the exercise's screen when the workout already has it
// (as before), else to the workout. req-274 — an exercise `from` at a deleted workout is
// dropped (liveFrom, as the other helpers) and the fallback below is taken.
export function historyAddSetBack(workoutId, itemId, known, from, workouts) {
  const live = liveFrom(from, workouts)
  if (live && parseRoute(live).name === 'history-workout-exercise') return live
  const detail = historyDetailReturn(workoutId, from)
  if (!known) return detail
  const detailFrom = detail === historyDetailPath(workoutId) ? null : detail
  return withFrom(historyExercisePath(workoutId, itemId), detailFrom)
}

// req-263 (DEC-155 §6) — the routine screen's own `from` (the recalc it was opened from, and
// so on up), seen from any of its screens: the routine screen itself carries it; an inner
// screen (an exercise, Edit, Add exercise…) carries a chain that passes through the routine
// screen, whose `from` it is. null when the routine screen was entered without one.
export function historyRoutineFrom(workoutId, screen, from) {
  if (screen === 'detail') return from || null
  const routine = findInFromChain(
    from,
    (route) => route.name === 'history-routine' && route.id === workoutId && route.screen === 'detail',
  )
  return routine ? parseRoute(routine).from || null : null
}

// The history routine editor's route set (routine-nav.js): its Back goes to the recalc it was
// opened from (else the bare recalc), and its inner screens keep that chain (req-263).
export function historyRoutinePaths(workoutId, screen, from, { extra = null, workouts } = {}) {
  const routineFrom = liveFrom(historyRoutineFrom(workoutId, screen, from), workouts)
  return navForBase(`/history/${workoutId}/routine`, routineFrom || `/history/${workoutId}/recalculate`, {
    extra,
    showDelete: false,
    showDays: false,
    from: routineFrom,
  })
}
