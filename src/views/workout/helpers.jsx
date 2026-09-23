import { itemKey, itemLoggingState } from '../../workout-log'
import { itemCurrentPath, itemDonePath, itemLogPath, itemReplacePath } from '../../workout-paths'
import { recordButton } from '../../analytics'
import { go } from '../../route'
import { Missing } from '../shared'

// req-76 — the item log/done path builders now live in the JSX-free workout-paths
// module (so workout-actions.js can share them); re-exported here so the workout
// screens' `import { itemCurrentPath, … } from './helpers'` keep working unchanged.
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
  return Boolean(active && (active.routineId || active.sessionId) === routineId)
}

export function MissingItem() {
  return <Missing>Not found.</Missing>
}

export function itemSetsPath(routineId, item, workout) {
  if (!item) return `/workout/${routineId}`
  return itemCurrentPath(routineId, item, itemLoggingState(workout, item).plannedDone)
}

// Discard the active workout (confirm first). Shared by the overview's Abandon and, since
// req-116, the Finish screen's "Nothing logged" Abandon.
export function abandonWorkout(store) {
  if (!window.confirm('Abandon?')) return
  recordButton('abandon-workout')
  store.abandonWorkout()
  go('/')
}
