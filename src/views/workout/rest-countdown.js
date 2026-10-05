// req-165 (F-LINT-1) — moved out of rest.jsx so that file exports components only.
import { useEffect, useState } from 'react'
import { restRemaining } from '../../workout-log'

// Reads the workout-level rest state (restEndsAt / restPausedRemaining, both
// already persisted on activeWorkout) and ticks a display clock while a rest is
// running. Used by the WorkoutPill / SkipRest for display; the countdown logic lives in one place.
export function useRestCountdown(active) {
  const restEndsAt = active?.restEndsAt ?? null
  const restPausedRemaining = active?.restPausedRemaining ?? null
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!restEndsAt && restPausedRemaining == null) return undefined
    // req-186 — tick once now, so a rest armed long after mount doesn't read a stale
    // `now` (an inflated remaining time) for the first 250 ms.
    const tick = () => setNow(Date.now())
    tick()
    const t = setInterval(tick, 250)
    return () => clearInterval(t)
  }, [restEndsAt, restPausedRemaining])
  // req-186 — `now` too, so the workout pill derives its state from the same tick.
  return { ...restRemaining(active, now), now }
}
