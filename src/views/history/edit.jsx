import { useState } from 'react'
import { go } from '../../route'
import { exerciseById, routineById } from '../../model.js'
import { useStore } from '../../store-context'
import { SetEditForm } from '../set-edit'
import { historySetFields, historySetKind } from '../set-values.js'
import { Back, Missing } from '../shared'
import { Actions, Button, List, NavLink, Row, Screen, SectionHeader, SegmentedControl, Textarea, Title } from '../../ui/index.jsx'
import { historyAddSetDraft, historyAddSetPath, withHistorySet } from './add-set'
import { itemIdOf, workoutRoutineId, workoutRoutineName } from './helpers'
import { snapshotItemFor } from './snapshot-item.js'
import { askConfirm } from '../../ui/confirm.js'

export function HistoryEdit({ workoutId }) {
  const store = useStore()
  const workout = store.workouts.find((x) => x.id === workoutId)
  const [overallFeel, setOverallFeel] = useState(workout?.overallFeel || '')
  const [overallNote, setOverallNote] = useState(workout?.overallNote || '')

  if (!workout) {
    return <Missing>Not found.</Missing>
  }

  return (
    <Screen>
      <Back to={`/history/${workout.id}`} />
      <Title>Edit</Title>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          store.updateWorkout(workout.id, { overallFeel, overallNote })
          go(`/history/${workout.id}`)
        }}
      >
        <SectionHeader>Feel</SectionHeader>
        <SegmentedControl
          clearable
          options={['Easy', 'Good', 'Hard', 'Exhausting']}
          value={overallFeel}
          onChange={setOverallFeel}
          ariaLabel="Feel"
        />
        <Textarea label="Note" value={overallNote} onChange={(e) => setOverallNote(e.target.value)} rows={3} />
        <Actions
          retreat={<NavLink to={`/history/${workout.id}`} look="quiet">Cancel</NavLink>}
          forward={<Button type="submit" variant="primary">Save</Button>}
        />
      </form>
    </Screen>
  )
}

export function HistorySetNew({ workoutId }) {
  const store = useStore()
  const workout = store.workouts.find((x) => x.id === workoutId)

  if (!workout) {
    return <Missing>Not found.</Missing>
  }

  const routine = routineById(store.routines, workoutRoutineId(workout))
  const snapshotItems = workout.snapshot?.items || []
  const fromRoutine = snapshotItems.length
    ? snapshotItems.map((item) => ({
        routineItemId: itemIdOf(item),
        exerciseId: item.exerciseId,
        name: item.exerciseName,
      }))
    : (routine?.exercises || []).map((item) => ({
        routineItemId: item.id,
        exerciseId: item.exerciseId,
        name: exerciseById(store.exercises, item.exerciseId)?.name,
      }))
  const byKey = new Map(fromRoutine.map((item) => [item.routineItemId || item.exerciseId, item]))
  for (const set of workout.sets || []) {
    const key = itemIdOf(set) || set.exerciseId
    if (!byKey.has(key)) {
      byKey.set(key, {
        routineItemId: itemIdOf(set),
        exerciseId: set.exerciseId,
        name: exerciseById(store.exercises, set.exerciseId)?.name,
      })
    }
  }
  for (const exercise of store.exercises.filter((candidate) => !candidate.archivedAt)) {
    const alreadyIncluded = [...byKey.values()].some(
      (choice) => choice.exerciseId === exercise.id,
    )
    if (!alreadyIncluded) {
      const routineItemId = `history-${workout.id}-${exercise.id}`
      byKey.set(routineItemId, {
        routineItemId,
        exerciseId: exercise.id,
        name: exercise.name,
      })
    }
  }
  const choices = [...byKey.values()]

  return (
    <Screen>
      <Back to={`/history/${workout.id}`} />
      <Title>Add set</Title>
      {choices.length === 0 ? <p className="ui-sub">None.</p> : null}
      <List>
        {choices.map((choice) => (
          <Row key={choice.routineItemId || choice.exerciseId}>
            {/* req-117 — opens the add form; nothing is written until its Save. */}
            <Button onClick={() => go(historyAddSetPath(workout, choice.exerciseId, choice.routineItemId))}>
              {choice.name || choice.exerciseId}
            </Button>
          </Row>
        ))}
      </List>
    </Screen>
  )
}

// req-117 — the History add-set form. The set is an unsaved draft (historyAddSetDraft);
// Save writes it (and its snapshot item, if new) in one updateWorkout, then goes on to
// the recalc preview as editing a set does. Cancel/Back write nothing: they return to
// the exercise's page when the workout already has it, else to the workout.
export function HistorySetAdd({ workoutId, exerciseId, itemId }) {
  const store = useStore()
  const workout = store.workouts.find((x) => x.id === workoutId)

  if (!workout || !exerciseId || !itemId) {
    return <Missing>Not found.</Missing>
  }

  const known =
    (workout.snapshot?.items || []).some((item) => itemIdOf(item) === itemId) ||
    (workout.sets || []).some((set) => itemIdOf(set) === itemId)
  const backTo = known ? `/history/${workout.id}/exercise/${itemId}` : `/history/${workout.id}`
  // req-163 — Effort / Duration shown as the live forms decide (historySetKind).
  const kind = historySetKind(snapshotItemFor(workout.snapshot?.items, itemId, exerciseId), exerciseById(store.exercises, exerciseId))

  return (
    <Screen>
      <Back to={backTo} />
      <p className="ui-sub">{workoutRoutineName(workout, null)}</p>
      <Title>Add set</Title>
      <SetEditForm
        set={historyAddSetDraft(workout, exerciseId, itemId)}
        showLoad
        showEffort={kind.showEffort}
        showDuration={kind.showDuration}
        setTypeOptions={[
          { value: 'wu', label: 'WU set' },
          { value: 'work', label: 'Work' },
        ]}
        cancelTo={backTo}
        onSave={(values) => {
          const exercise = exerciseById(store.exercises, exerciseId)
          const patch = withHistorySet(workout, { exerciseId, itemId, exercise, values })
          if (!patch) return
          store.updateWorkout(workout.id, patch)
          go(`/history/${workout.id}/recalculate`)
        }}
      />
    </Screen>
  )
}

export function HistorySet({ workoutId, index }) {
  const store = useStore()
  const workout = store.workouts.find((x) => x.id === workoutId)
  const set = workout?.sets?.[index]

  if (!workout || !set) {
    return <Missing>Not found.</Missing>
  }
  // req-163 — Effort hidden on a warm-up / cardio set (saves rpe null), Duration on a timed
  // exercise's work set (historySetKind, the live forms' rule).
  const kind = historySetKind(snapshotItemFor(workout.snapshot?.items, itemIdOf(set), set.exerciseId), exerciseById(store.exercises, set.exerciseId))

  return (
    <Screen>
      {/* req-49 — a set is opened from its exercise screen, so Back returns there
          (the same target as the form's Cancel), not two levels up to the workout. */}
      <Back to={`/history/${workout.id}/exercise/${itemIdOf(set) || set.exerciseId}`} />
      <p className="ui-sub">{workoutRoutineName(workout, null)}</p>
      <Title>Set</Title>
      <SetEditForm
        set={set}
        showLoad
        showEffort={kind.showEffort}
        showDuration={kind.showDuration}
        setTypeOptions={[
          { value: 'wu', label: 'WU set' },
          { value: 'work', label: 'Work' },
        ]}
        cancelTo={`/history/${workout.id}/exercise/${itemIdOf(set) || set.exerciseId}`}
        onSave={(values) => {
          // req-154 — `22,5` → 22.5; unreadable kg → null (the form already shows why).
          const fields = historySetFields(values)
          if (!fields) return
          const sets = (workout.sets || []).map((s, i) => (i === index ? { ...s, ...fields } : s))
          store.updateWorkout(workout.id, { sets })
          go(`/history/${workout.id}/recalculate`)
        }}
      />
      <Button
        onClick={async () => {
          if (!(await askConfirm('Remove set?', { confirmLabel: 'Remove' }))) return
          store.updateWorkout(workout.id, { sets: (workout.sets || []).filter((_, i) => i !== index) })
          go(`/history/${workout.id}/recalculate`)
        }}
      >
        Remove
      </Button>
    </Screen>
  )
}
