// req-270 — split from workout-log.js: finishing a workout.
import { isSkippedSet } from './set-rules.js'
import { withSkippedUnloggedSets } from './workout-items.js'

// req-224 (DEC-125 §4) — a workout left open. `lastSetAt`: the latest `loggedAt` (req-212)
// among the workout's LOGGED sets, as the stored string, or null. Skipped sets never count —
// a Skip set tap writes `loggedAt` too, and skipping the rest next morning must not hide the
// gap (review round 1); Finish / Skip exercise skips have none anyway. Sets without a
// readable `loggedAt` (older sets) never count. Pure.
export function lastSetAt(workout) {
  let last = null
  let lastMs = -Infinity
  for (const set of workout?.sets || []) {
    if (isSkippedSet(set)) continue
    const ms = Date.parse(set?.loggedAt ?? '')
    if (Number.isFinite(ms) && ms > lastMs) {
      last = set.loggedAt
      lastMs = ms
    }
  }
  return last
}

// More than this between the last logged set and Finish → the workout was left open.
export const LEFT_OPEN_MS = 3 * 60 * 60 * 1000

// req-224 — the finish time Finish saves (screen Save and auto-complete, via
// store.finishWorkout) and the Finish screen / auto-complete summary show: the last set's
// `loggedAt` when now − lastSetAt > 3 h (exactly 3 h → now), else now. `leftOpen` says which
// rule answered, so the screen can say so. Real data only: no loggedAt → now. Pure.
export function finishTimeFor(workout, now = Date.now()) {
  const nowMs = now instanceof Date ? now.getTime() : Number(now)
  const last = lastSetAt(workout)
  if (last && nowMs - Date.parse(last) > LEFT_OPEN_MS) return { finishedAt: last, leftOpen: true }
  return { finishedAt: new Date(nowMs).toISOString(), leftOpen: false }
}

// store.finishWorkout's reducer (manual Finish and the req-84 auto-complete both call
// it). req-158 (audit F-DEAD-4, DEC-085 §3) — a new finished record no longer carries
// `progression`: nothing read it (History recalc recomputes from the sets,
// progressionFromWorkout), and it went stale after a set edit. No caller passes one; a
// `progression` on the active workout (the start-time null an in-progress workout saved
// before req-158 may carry) is stripped. Workouts finished before keep theirs untouched,
// and nothing may start reading it.
//
// req-112 / DEC-056: `routines` is NOT touched — updating the routine is a deliberate
// choice (History recalc), never a side effect of Finish. req-83 (N9) — the live
// seed-override map is transient session state, dropped so it never lands on the
// finished-history record (which feeds history-prefill from `sets` alone). req-116 —
// the auto-finish dismissed flag is transient in the same way and is dropped too.
// req-125 — so is the set-form draft (`setDraft`). req-194 — and the cardio stopwatch.
// req-10 — and the first-time setup answers (`firstTimeSetup`): never part of history.
export function finishedState(state, { overallNote, overallFeel } = {}, finishedAt = new Date().toISOString()) {
  if (!state?.activeWorkout) return state
  const {
    seedOverrides: _seedOverrides,
    firstTimeSetup: _firstTimeSetup,
    autoFinishDismissed: _dismissed,
    setDraft: _draft,
    stopwatch: _stopwatch,
    progression: _progression,
    ...activeToFinish
  } = state.activeWorkout
  const finished = withSkippedUnloggedSets({
    ...activeToFinish,
    finishedAt,
    overallNote: overallNote || '',
    overallFeel: overallFeel || '',
    restEndsAt: null,
    restPausedRemaining: null,
  })
  return {
    ...state,
    activeWorkout: null,
    workouts: [finished, ...(state.workouts || [])],
  }
}
