import { go, hashPath } from './route.js'
import { dateKey } from './schedule.js'
import { itemIsMarkedDone, itemLoggingState } from './workout-log.js'
import { itemCurrentPath } from './workout-paths.js'

// req-55 / DEC-038 — the one warning shown before an in-progress workout is
// discarded. There is exactly one in-progress workout; starting a different one, or
// continuing a legacy draft while another is active, abandons the current active.
export const ABANDON_ON_NEW_WARNING =
  'Starting a new workout will abandon the workout in progress. Continue?'

function workoutRoutineId(workout) {
  return workout?.routineId || workout?.sessionId
}

// req-76 — where a Continue/resume lands. Route straight into the "current" exercise:
// the first item that is NOT done — neither marked-done nor planned-done. A skipped
// exercise ends up planned-done (its skipped sets still fill its set count), so it
// counts as done and is passed over, matching the decision that completed AND skipped
// are both "not-current". If every exercise is done, land on the overview (with Finish
// visible) rather than a broken/empty exercise page.
export function resumeTarget(workout) {
  const routineId = workoutRoutineId(workout)
  const overview = `/workout/${routineId}`
  const items = workout?.snapshot?.items || []
  const current = items.find(
    (item) => !(itemIsMarkedDone(workout, item) || itemLoggingState(workout, item).plannedDone),
  )
  return current ? itemCurrentPath(routineId, current, false) : overview
}

export function startOrContinue(store, routineId, options = {}) {
  const config = typeof options === 'string' ? { scheduledFor: options } : options
  const scheduledFor = config.scheduledFor || dateKey(new Date())
  const scheduleSlotId = config.scheduleSlotId || null
  const active = store.activeWorkout
  const activeId = workoutRoutineId(active)
  // "Continuing the same in-progress workout" — same routine, (when an
  // occurrence is named) the same occurrence, AND started today. A stale active
  // started on a prior day is a genuinely different workout: tapping today's
  // Start must abandon-on-new, not silently resume yesterday's sets under
  // yesterday's occurrence/date (DEC-038). Anything else is different too.
  const sameOccurrence = !config.occurrenceId || active?.occurrenceId === config.occurrenceId
  const startedToday = !!active && dateKey(active.startedAt) === dateKey(new Date())
  const continuingSame = !!active && activeId === routineId && sameOccurrence && startedToday
  // req-55 / DEC-038 — start-while-active abandons the current, with a warning
  // (replaces the old "Save draft?" path). Cancel: do nothing, keep the active one.
  if (active && !continuingSame) {
    if (!window.confirm(ABANDON_ON_NEW_WARNING)) return
    store.abandonWorkout()
  }
  if (!continuingSame) {
    store.startWorkout(routineId, scheduledFor, scheduleSlotId, config.plan || null)
  }
  const base = `/workout/${routineId}`
  // req-76 — resuming the same in-progress workout lands on its current exercise;
  // starting new keeps the overview as the landing (start-new is out of scope). The
  // replace decision stays tied to the workout base: if we're already anywhere in
  // this workout, replace rather than stacking history.
  const target = continuingSame ? resumeTarget(active) : base
  const here = hashPath(typeof window === 'undefined' ? '/' : window.location.hash)
  const replace = here === base || here.startsWith(`${base}/`)
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
    // req-76 — resume straight into the current exercise (or the overview if all done).
    go(resumeTarget(active))
    return
  }
  if (active) {
    if (!window.confirm(ABANDON_ON_NEW_WARNING)) return
  }
  store.continueDraft(workout.id)
  go(resumeTarget(workout))
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
