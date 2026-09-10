import { itemKey, itemLoggingState } from '../../workout-log'
import { Missing } from '../shared'

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
  return Boolean(active && (active.routineId || active.sessionId) === routineId)
}

export function MissingItem() {
  return <Missing>Not found.</Missing>
}

export function itemLogPath(routineId, item) {
  return `/workout/${routineId}/item/${itemKey(item)}/log`
}

export function itemDonePath(routineId, item) {
  return `/workout/${routineId}/item/${itemKey(item)}/done`
}

// One branch, written once: a done exercise goes to its done screen, otherwise
// its log screen. The `done` boolean varies by caller (marked-done+plannedDone
// on the overview, plannedDone alone on the setup form), so it stays an argument.
export function itemCurrentPath(routineId, item, done) {
  return done ? itemDonePath(routineId, item) : itemLogPath(routineId, item)
}

export function itemSetsPath(routineId, item, workout) {
  if (!item) return `/workout/${routineId}`
  return itemCurrentPath(routineId, item, itemLoggingState(workout, item).plannedDone)
}
