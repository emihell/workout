import { go } from '../../route'
import { recordButton } from '../../analytics'
import { useStore } from '../../store-context'
import { Back } from '../shared'
import { Screen, Title } from '../../ui/index.jsx'
import { MidWorkoutPicker } from './mid-workout-picker.jsx'
import { NotInWorkout } from './helpers'
import { isActiveFor } from './workout-helpers.js'
import { WorkoutPill } from './rest'

// req-188 (DEC-103 §2) — "Add exercise" from the workout list (Emilio: "why not just add?").
// The routine's picker (ExercisePicker, DEC-097): your exercises first, then the whole
// library, multi-select, near-duplicate guard. DEC-104 — a pick with history takes history's
// prescription; no-history picks get one step asking Sets and Rest for each (MidWorkoutPicker).
// "Add N" appends each one to THIS workout as a mid-workout item (store.addWorkoutItems →
// itemsAddedState) and returns to the list; the routine is never touched. Back / Cancel change
// nothing (no record created either).
export function WorkoutAdd({ routineId }) {
  const store = useStore()
  const mine = isActiveFor(store.activeWorkout, routineId)
  if (!mine) return <NotInWorkout routineId={routineId} />
  const backTo = `/workout/${routineId}`
  return (
    <Screen>
      <Back to={backTo} />
      <WorkoutPill />
      <Title>Add exercise</Title>
      <MidWorkoutPicker
        cancelTo={backTo}
        addLabel={(n) => `Add ${n}`}
        onDone={(added) => {
          recordButton('add-workout-exercise')
          store.addWorkoutItems(added)
          go(backTo, { replace: true })
        }}
      />
    </Screen>
  )
}
