import { useEffect, useState } from 'react'
import { recordButton } from '../../analytics'
import { useStore } from '../../store-context'
import { restRemaining } from '../../workout-log'
import { RestBar as UIRestBar } from '../../ui/index.jsx'

// Reads the workout-level rest state (restEndsAt / restPausedRemaining, both
// already persisted on activeWorkout) and ticks a display clock while a rest is
// running. Used by the persistent RestBar for display and by WorkoutItemLive for
// its set-flow gating, so the countdown logic lives in one place.
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

// The single, persistent rest UI. Self-contained: it reads only activeWorkout rest
// state and renders nothing when no rest is active, so it can be dropped into any
// in-workout screen and the counter keeps ticking regardless of which screen shows.
export function RestBar() {
  const store = useStore()
  const active = store.activeWorkout
  const { remainingMs, paused, resting } = useRestCountdown(active)
  if (!active || !resting) return null
  const sec = Math.ceil(remainingMs / 1000)
  // req-11 / DEC-013: [Pause/Resume] [+30s] on the left, "Next" (end the rest and
  // advance) as the primary on the right. The handlers are unchanged from the
  // inline version — only the markup moved onto the ui/ RestBar molecule.
  const onPauseResume = () => {
    if (paused) {
      recordButton('rest-resume')
      store.patchActive({
        restEndsAt: Date.now() + (store.activeWorkout.restPausedRemaining || 0),
        restPausedRemaining: null,
      })
    } else {
      recordButton('rest-pause')
      store.patchActive({
        restPausedRemaining: Math.max(0, (store.activeWorkout.restEndsAt || Date.now()) - Date.now()),
        restEndsAt: null,
      })
    }
  }
  const onAddTime = () => {
    recordButton('rest-plus-30')
    if (paused) {
      store.patchActive({ restPausedRemaining: (store.activeWorkout.restPausedRemaining || 0) + 30000 })
    } else {
      store.patchActive({ restEndsAt: (store.activeWorkout.restEndsAt || Date.now()) + 30000 })
    }
  }
  const onNext = () => {
    recordButton('rest-next')
    store.patchActive({ restEndsAt: null, restPausedRemaining: null })
  }
  return (
    <UIRestBar
      seconds={sec}
      paused={paused}
      onPauseResume={onPauseResume}
      onAddTime={onAddTime}
      onNext={onNext}
    />
  )
}
