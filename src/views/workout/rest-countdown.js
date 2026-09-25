// req-165 (F-LINT-1) — moved out of rest.jsx so that file exports components only.
import { useEffect, useState } from 'react'
import { restRemaining } from '../../workout-log'

// Reads the workout-level rest state (restEndsAt / restPausedRemaining, both
// already persisted on activeWorkout) and ticks a display clock while a rest is
// running. Used by the RestPill for display; the countdown logic lives in one place.
export function useRestCountdown(active) {
  const restEndsAt = active?.restEndsAt ?? null
  const restPausedRemaining = active?.restPausedRemaining ?? null
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!restEndsAt && restPausedRemaining == null) return undefined
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [restEndsAt, restPausedRemaining])
  return restRemaining(active, now)
}
