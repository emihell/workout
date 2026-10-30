import { recordButton } from '../../analytics'
import { go } from '../../route'
import { useStore } from '../../store-context'
import { WorkoutPill as UIWorkoutPill } from '../../ui/index.jsx'
import { itemKey, workoutPillState, workoutPosition } from '../../workout-log'
import { itemLogPath } from '../../workout-paths'
import { useRestCountdown } from './rest-countdown.js'

// req-186 (DEC-103 §3) — the one workout pill, replacing req-78's RestPill on every
// in-workout screen. Self-contained: reads activeWorkout only (rest state is the already
// persisted restEndsAt / restPausedRemaining, so it survives navigation and reload) and is
// `position: fixed`. What it shows is the pure workoutPillState (workout-log.js): from the
// start of the workout (req-222) until all is done; resting → "1:12" over "Set 2/4 · Ex 3/7"
// in words (req-244); rest over → "GO" over the same line.
// req-192 (DEC-108 §3, supersedes DEC-103 §3's tap rule) — what a tap does depends on where
// it is: `ownItemKey` is the item whose log screen hosts the pill (item.jsx passes it). On the
// current exercise's own screen, while resting, a tap SKIPS the rest (the write req-78's pill
// and req-186's SkipRest made) and the pill's line 2 reads "Tap to skip rest" (req-244). Everywhere else a tap opens
// the current exercise (go() is a no-op on that screen itself, e.g. at GO).
export function WorkoutPill({ ownItemKey = null } = {}) {
  const store = useStore()
  const active = store.activeWorkout
  // Ticks while a rest runs; the pill state re-derives from the same clock.
  const { now } = useRestCountdown(active)
  if (!active) return null
  const pill = workoutPillState(active, now)
  if (!pill) return null
  const skip = pill.resting && ownItemKey != null && itemKey(pill.item) === ownItemKey
  const onOpen = () => {
    if (skip) {
      recordButton('rest-skip')
      store.patchActive({ restEndsAt: null, restPausedRemaining: null })
      return
    }
    recordButton('workout-pill')
    go(itemLogPath(active.routineId, pill.item))
  }
  // req-244 — the pill formats words ("Set 2 of 4 · Ex 3 of 7") from numbers: the set position
  // only once the item has a logged set (pill.setText non-empty, req-203 §7), the workout
  // position from workoutPosition — the same call workoutPillState makes for countText.
  const set = pill.setText ? { current: pill.current, total: pill.total } : null
  const position = workoutPosition(active)
  const exercise = position ? { current: position.current, total: position.total } : null
  return <UIWorkoutPill clock={pill.clock} set={set} exercise={exercise} go={pill.go} skip={skip} onOpen={onOpen} />
}
