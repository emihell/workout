import { useEffect, useState } from 'react'
import { recordButton } from '../../analytics'
import { useStore } from '../../store-context'
import { restRemaining } from '../../workout-log'
import { RestPill as UIRestPill } from '../../ui/index.jsx'

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

// req-78 — the single, persistent rest UI, now a small floating pill (was RestBar).
// Self-contained: reads only activeWorkout rest state, renders nothing when no rest is
// active, and is `position: fixed`, so it can be dropped into any in-workout screen and
// the countdown keeps ticking regardless of which screen shows. Rest no longer blocks
// input (D2: the next set's form is always live), so the pill only shows the time and
// skips the rest on tap — the pause/+30s/next controls of the old blocking bar are gone.
export function RestPill() {
  const store = useStore()
  const active = store.activeWorkout
  const { remainingMs, resting } = useRestCountdown(active)
  if (!active || !resting) return null
  const sec = Math.ceil(remainingMs / 1000)
  const onSkip = () => {
    recordButton('rest-skip')
    store.patchActive({ restEndsAt: null, restPausedRemaining: null })
  }
  return <UIRestPill seconds={sec} onSkip={onSkip} />
}
