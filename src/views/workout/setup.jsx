import { useState } from 'react'
import { go } from '../../route'
import { exerciseById } from '../../storage'
import { useStore } from '../../store-context'
import { itemLoggingState } from '../../workout-log'
import { navForBase, RoutineScreens } from '../Routine'
import { Back, Missing } from '../shared'
import { Actions, Button, Field, NavLink, Screen, Textarea, Title } from '../../ui/index.jsx'
import { exerciseName, findItem, isActiveFor, itemCurrentPath } from './helpers'
import { RestPill } from './rest'

export function WorkoutItemExercise({ routineId, itemId }) {
  const store = useStore()
  const active = store.activeWorkout
  const mine = isActiveFor(active, routineId)
  const item = mine ? findItem(active.snapshot?.items, itemId) : null
  const ex = item ? exerciseById(store.exercises, item.exerciseId) : null
  const [weightStep, setWeightStep] = useState(ex?.weightStep || '')
  const [cues, setCues] = useState(ex?.cues || '')

  if (!mine || !item) {
    return <Missing>Not found.</Missing>
  }

  // req-49 — this "edit exercise details" screen is reached from the item's log/done
  // screen, so Back returns there (the same target as the form's Cancel below).
  const backTo = itemCurrentPath(routineId, item, itemLoggingState(active, item).plannedDone)

  if (!ex) {
    return (
      <Screen>
        <Back to={backTo} />
        <Title>{exerciseName(item)}</Title>
        <p className="ui-sub">Not found.</p>
      </Screen>
    )
  }

  return (
    <Screen>
      <Back to={backTo} />
      <RestPill />
      <Title>{exerciseName(item)}</Title>
      <p className="ui-sub">{ex.equipment}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          store.updateExercise(ex.id, {
            weightStep: weightStep.trim() || 'n/a',
            cues: cues.trim(),
          })
          go(
            itemCurrentPath(routineId, item, itemLoggingState(active, item).plannedDone),
            { replace: true },
          )
        }}
      >
        <Field
          label="Weight step"
          value={weightStep}
          onChange={(event) => setWeightStep(event.target.value)}
        />
        <Textarea
          label="Form cues"
          value={cues}
          onChange={(event) => setCues(event.target.value)}
          rows={3}
        />
        {/* req-121 — Cancel only navigates (to backTo), so a NavLink (DEC-040). */}
        <Actions
          retreat={<NavLink to={backTo} look="secondary">Cancel</NavLink>}
          forward={<Button type="submit" variant="primary">Save</Button>}
        />
      </form>
    </Screen>
  )
}

export function WorkoutSetup({
  routineId,
  scheduleSlotId = null,
  date = null,
  screen = 'detail',
  itemId,
  exerciseId,
}) {
  const preview =
    scheduleSlotId && date
      ? `/workout/${routineId}/${scheduleSlotId}/${date}`
      : `/workout/${routineId}`
  const paths = navForBase(`${preview}/setup`, preview, { showDelete: false })
  return (
    <RoutineScreens
      routineId={routineId}
      paths={paths}
      screen={screen}
      itemId={itemId}
      exerciseId={exerciseId}
    />
  )
}
