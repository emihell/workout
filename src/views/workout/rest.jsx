import { recordButton } from '../../analytics'
import { go } from '../../route'
import { useStore } from '../../store-context'
import { Button, WorkoutPill as UIWorkoutPill } from '../../ui/index.jsx'
import { workoutPillState } from '../../workout-log'
import { itemLogPath } from '../../workout-paths'
import { useRestCountdown } from './rest-countdown.js'

// req-186 (DEC-103 §3) — the one workout pill, replacing req-78's RestPill on every
// in-workout screen. Self-contained: reads activeWorkout only (rest state is the already
// persisted restEndsAt / restPausedRemaining, so it survives navigation and reload) and is
// `position: fixed`. What it shows is the pure workoutPillState (workout-log.js): nothing
// until a current exercise exists; resting → "1:12 · set 2/4"; rest over → "GO · set 2/4".
// A tap opens the current exercise's log screen (go() is a no-op on that screen itself).
export function WorkoutPill() {
  const store = useStore()
  const active = store.activeWorkout
  // Ticks while a rest runs; the pill state re-derives from the same clock.
  const { now } = useRestCountdown(active)
  if (!active) return null
  const pill = workoutPillState(active, now)
  if (!pill) return null
  const onOpen = () => {
    recordButton('workout-pill')
    go(itemLogPath(active.routineId, pill.item))
  }
  return <UIWorkoutPill clock={pill.clock} setText={pill.setText} go={pill.go} onOpen={onOpen} />
}

// req-186 (DEC-103 §3) — skipping the rest moved off the pill to a quiet control on the
// exercise log screen, shown only while resting. Same write the pill's tap made (req-78).
export function SkipRest() {
  const store = useStore()
  const active = store.activeWorkout
  const { resting } = useRestCountdown(active)
  if (!active || !resting) return null
  return (
    <Button
      variant="quiet"
      className="ui-skiprest"
      onClick={() => {
        recordButton('rest-skip')
        store.patchActive({ restEndsAt: null, restPausedRemaining: null })
      }}
    >
      Skip rest
    </Button>
  )
}
