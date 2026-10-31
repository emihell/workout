// req-270 — split from workout-log.js: the stopwatch and the rest timer.
import { setDraftKey } from './set-drafts.js'
import { itemIsMarkedDone, itemLoggingState } from './workout-items.js'

// req-194 review fix 1 — the cardio stopwatch: ONE optional field on the active workout,
// `stopwatch: { draftKey, startedAt, baseSec }` — the set it runs for (setDraftKey), its
// start (epoch ms) and the seconds it resumed from. Separate from `setDraft` (one draft for
// the whole workout, replaced by the next exercise's typing), so another exercise's edits
// can't drop it. Load path: loadState → migrateState → workoutSnapshot, whose snapshotted
// branch spreads `...workout` (kept as is); finishedState strips it; withLoggedSet clears it
// on Done / Skip set of its own set. At most one exists: a second Start is refused while
// the first one's set is still the current set of an exercise not done (stopwatchOwner);
// a stale one (that exercise skipped / swapped / done elsewhere) is taken over.

// The stopwatch running for the set `key`, or null. req-194 re-review — only while it is
// live (stopwatchOwner: its set is still the current set of an exercise not done), so a
// stale one (its item skipped / swapped / done) never shows as running, even if that set's
// key comes back (Add set after Skip exercise).
export function stopwatchFor(workout, key) {
  const watch = workout?.stopwatch
  if (!watch || typeof watch !== 'object' || watch.draftKey !== key) return null
  return stopwatchOwner(workout) ? watch : null
}

// The snapshot item whose CURRENT set the stopwatch runs for, while that exercise isn't
// done — else null (no stopwatch, or a stale one).
export function stopwatchOwner(workout) {
  const key = workout?.stopwatch?.draftKey
  if (!key) return null
  for (const item of workout?.snapshot?.items || []) {
    if (itemIsMarkedDone(workout, item)) continue
    const state = itemLoggingState(workout, item)
    if (state.plannedDone) continue
    if (setDraftKey(item, state.needsWu ? 'wu' : 'work', state.currentWorkIndex) === key) return item
  }
  return null
}

// The patch that starts the stopwatch for the set `key` (from `baseSec`, at `now`), or
// null when another set's stopwatch is still live (refused — stop that one first).
export function startStopwatchPatch(workout, key, baseSec = 0, now = Date.now()) {
  const owner = stopwatchOwner(workout)
  if (owner && workout.stopwatch.draftKey !== key) return null
  return { stopwatch: { draftKey: key, startedAt: now, baseSec: Math.max(0, Math.floor(Number(baseSec) || 0)) } }
}

// req-25 — the rest-patch decision, made pure so "when does rest run after a set"
// is inspectable and testable outside the component (DESIGN rule). Rest is armed
// by *completion*, not suppressed by whether it's the last set (that was the bug:
// the final, usually hardest, set got no rest). Only a *skipped* set suppresses
// rest; restSec === 0 means the exercise never rests. Shapes match what the store
// merges into activeWorkout: an armed rest sets restEndsAt (a future ms timestamp)
// and clears any paused value; restSec === 0 leaves restEndsAt untouched (it is
// never armed for such an item, so there is nothing to clear). Uses Date.now() so
// callers stay trivial; tests assert restEndsAt is in the future rather than exact.
export function restPatchAfterSet({ restSec, skipped = false }) {
  if (skipped) return { restEndsAt: null, restPausedRemaining: null }
  if (restSec > 0) {
    return { restEndsAt: Date.now() + restSec * 1000, restPausedRemaining: null }
  }
  return { restPausedRemaining: null }
}

// Pure rest-timer state, derived from the persisted workout-level fields
// (activeWorkout.restEndsAt / restPausedRemaining) and the current time. Kept
// side-effect-free so the "remaining time is recomputed from restEndsAt, not
// frozen or reset across navigation/reload" rule is unit-testable; the
// useRestCountdown hook is just this function plus a tick.
export function restRemaining(active, now) {
  const restEndsAt = active?.restEndsAt ?? null
  const restPausedRemaining = active?.restPausedRemaining ?? null
  const remainingMs =
    restPausedRemaining != null
      ? restPausedRemaining
      : restEndsAt
        ? Math.max(0, restEndsAt - now)
        : 0
  const paused = restPausedRemaining != null
  const resting = remainingMs > 0 || paused
  return { remainingMs, paused, resting }
}
