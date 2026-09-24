import { itemKey, itemLoggingState } from '../../workout-log'
import { inWorkoutFallback, itemCurrentPath, itemDonePath, itemLogPath, itemReplacePath } from '../../workout-paths'
import { recordButton } from '../../analytics'
import { useEffect } from 'react'
import { go } from '../../route'
import { leaveWorkoutToToday } from '../../workout-actions'
import { findRoutine } from '../../storage'
import { useStore } from '../../store-context'
import { Missing } from '../shared'
import { askConfirm } from '../../ui/confirm.js'

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

// req-153 — the render for an in-workout route that can't show: with no active workout
// for this (known) routine it redirects, replacing, to the routine's overview; otherwise
// "Not found." (inWorkoutFallback decides).
export function NotInWorkout({ routineId }) {
  const store = useStore()
  const outcome = inWorkoutFallback({
    active: store.activeWorkout,
    routineId,
    routineKnown: Boolean(findRoutine(store.routines, routineId).routine),
  })
  useEffect(() => {
    if (outcome === 'redirect') go(`/workout/${routineId}`, { replace: true })
  }, [outcome, routineId])
  return outcome === 'redirect' ? null : <MissingItem />
}

export function itemSetsPath(routineId, item, workout) {
  if (!item) return `/workout/${routineId}`
  return itemCurrentPath(routineId, item, itemLoggingState(workout, item).plannedDone)
}

// Discard the active workout (confirm first). Shared by the overview's Abandon and, since
// req-116, the Finish screen's "Nothing logged" Abandon.
export async function abandonWorkout(store) {
  if (!(await askConfirm('Abandon?', { confirmLabel: 'Abandon' }))) return
  recordButton('abandon-workout')
  store.abandonWorkout()
  leaveWorkoutToToday()
}
