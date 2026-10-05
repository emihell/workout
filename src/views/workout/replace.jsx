import { useEffect, useRef } from 'react'
import { go } from '../../route'
import { recordButton } from '../../analytics'
import { useStore } from '../../store-context'
import { itemIsMarkedDone, itemKey, itemLoggingState } from '../../workout-log'
import { Back } from '../shared'
import { Screen, Title } from '../../ui/index.jsx'
import { MidWorkoutPicker } from './mid-workout-picker.jsx'
import { MissingItem, NotInWorkout } from './helpers'
import { exerciseName, findItem, isActiveFor, itemLogPath } from './workout-helpers.js'
import { WorkoutPill } from './rest'

// req-109 — the Swap exercise picker. Picking one is an action (it writes): the original's
// remaining sets are logged skipped and an item for the picked exercise is inserted directly
// after it, for this workout only (store.replaceItem), and the picker lands on the new item's
// log screen (req-124). Back / Cancel change nothing. An exercise that is already done can't
// be replaced (re-open it first), so a done item bounces back to the overview.
// req-188 (DEC-103 §2) — reached from the overview row's "⋯" sheet (no longer the log screen),
// so Back / Cancel return to the overview. The picker is the routine's (ExercisePicker,
// DEC-097): your exercises first, then the whole library, single pick, its near-duplicate
// "Use your …?" guard. DEC-104 — the swapped-in item takes history's prescription, or with no
// history the sets / rest asked for in a step (MidWorkoutPicker); a library pick's record is
// created only on that final confirm, then the swap.
export function WorkoutItemReplace({ routineId, itemId }) {
  const store = useStore()
  const active = store.activeWorkout
  const mine = isActiveFor(active, routineId)
  const item = mine ? findItem(active.snapshot?.items, itemId) : null
  const done = Boolean(item && (itemIsMarkedDone(active, item) || itemLoggingState(active, item).plannedDone))
  // req-124 — a pick marks the original done (skipped), which would re-fire the bounce
  // below and override the navigation to the new item; a picked screen never bounces.
  const picked = useRef(false)

  useEffect(() => {
    if (done && !picked.current) go(`/workout/${routineId}`, { replace: true })
  }, [done, routineId])

  if (!mine) return <NotInWorkout routineId={routineId} />
  if (!item || done) return <MissingItem />

  const backTo = `/workout/${routineId}`

  function pick(exerciseId, prescription) {
    recordButton('replace-exercise')
    picked.current = true
    // req-124 — land on the new exercise's log screen (replacing the picker in history).
    const newKey = store.replaceItem(itemKey(item), exerciseId, prescription)
    go(itemLogPath(routineId, { id: newKey }), { replace: true })
  }

  return (
    <Screen>
      <Back to={backTo} />
      <WorkoutPill />
      <p className="ui-sub">{exerciseName(item)}</p>
      <Title>Swap exercise</Title>
      <MidWorkoutPicker
        cancelTo={backTo}
        max={1}
        addLabel={() => 'Swap'}
        onDone={([choice]) => {
          if (choice) pick(choice.exerciseId, choice.item)
        }}
      />
    </Screen>
  )
}
