import { go } from '../../route'
import { recordButton } from '../../analytics'
import { useStore } from '../../store-context'
import { Back } from '../shared'
import { Screen, Title } from '../../ui/index.jsx'
import { ExercisePicker } from '../ExercisePicker'
import { NotInWorkout } from './helpers'
import { isActiveFor } from './workout-helpers.js'
import { WorkoutPill } from './rest'

// req-188 (DEC-103 §2) — "Add exercise" from the workout list (Emilio: "why not just add?").
// The routine's picker (ExercisePicker, DEC-097): your exercises first, then the whole
// library, multi-select, each pick showing its prescription (history, else the starting
// plan — never a kg). A library pick creates your exercise record (the picker's add path,
// near-duplicate guard included). "Add N" appends each one to THIS workout as a mid-workout
// item (store.addWorkoutItems → itemsAddedState) and returns to the list; the routine is
// never touched. Back / Cancel change nothing.
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
      <ExercisePicker
        cancelTo={backTo}
        onAdd={(added) => {
          recordButton('add-workout-exercise')
          store.addWorkoutItems(added)
          go(backTo, { replace: true })
        }}
      />
    </Screen>
  )
}
