import { go, hashPath } from './route.js'
import { dateKey } from './schedule.js'

// req-55 / DEC-038 — the one warning shown before an in-progress workout is
// discarded. There is exactly one in-progress workout; starting a different one, or
// continuing a legacy draft while another is active, abandons the current active.
export const ABANDON_ON_NEW_WARNING =
  'Starting a new workout will abandon the workout in progress. Continue?'

function workoutRoutineId(workout) {
  return workout?.routineId || workout?.sessionId
}

export function startOrContinue(store, routineId, options = {}) {
  const config = typeof options === 'string' ? { scheduledFor: options } : options
  const scheduledFor = config.scheduledFor || dateKey(new Date())
  const scheduleSlotId = config.scheduleSlotId || null
  const active = store.activeWorkout
  const activeId = workoutRoutineId(active)
  // "Continuing the same in-progress workout" — same routine, and (when an
  // occurrence is named) the same occurrence. Anything else is a genuinely
  // different workout.
  const sameOccurrence = !config.occurrenceId || active?.occurrenceId === config.occurrenceId
  const continuingSame = !!active && activeId === routineId && sameOccurrence
  // req-55 / DEC-038 — start-while-active abandons the current, with a warning
  // (replaces the old "Save draft?" path). Cancel: do nothing, keep the active one.
  if (active && !continuingSame) {
    if (!window.confirm(ABANDON_ON_NEW_WARNING)) return
    store.abandonWorkout()
  }
  if (!continuingSame) {
    store.startWorkout(routineId, scheduledFor, scheduleSlotId, config.plan || null)
  }
  const target = `/workout/${routineId}`
  const here = hashPath(typeof window === 'undefined' ? '/' : window.location.hash)
  const replace = here === target || here.startsWith(`${target}/`)
  go(target, { replace })
}

// req-55 — Continue an unfinished in-progress workout surfaced in History / the
// recent peek. Two kinds: (1) the single stale `activeWorkout` (started a prior
// day) — already active, so just navigate; (2) a legacy `draftWorkout` — promote it
// to the single active, discarding any current active (with the warning).
export function continueInProgress(store, workout) {
  const routineId = workoutRoutineId(workout)
  const active = store.activeWorkout
  if (active && active.id === workout.id) {
    go(`/workout/${routineId}`)
    return
  }
  if (active) {
    if (!window.confirm(ABANDON_ON_NEW_WARNING)) return
  }
  store.continueDraft(workout.id)
  go(`/workout/${routineId}`)
}

// req-55 — Abandon an unfinished in-progress workout from History. Discards
// entirely: no finished-history record (DESIGN §1). The stale active workout goes
// through abandonWorkout(); a legacy draft through abandonDraft().
export function abandonInProgress(store, workout) {
  if (!window.confirm('Abandon this workout? It will not be saved.')) return
  const active = store.activeWorkout
  if (active && active.id === workout.id) {
    store.abandonWorkout()
  } else {
    store.abandonDraft(workout.id)
  }
}
