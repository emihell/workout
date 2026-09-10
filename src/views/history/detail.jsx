import { formatSetLine, roleLabel } from '../../ids'
import { formatProgressionLine } from '../../progress'
import { go } from '../../route'
import { durationLabel, exerciseById, findRoutine, groupSetsByExercise, workoutVolume } from '../../storage'
import { useStore } from '../../store-context'
import { Back, Missing, NavLink } from '../shared'
import { Button, List, Row, Screen, SectionHeader, Title } from '../../ui/index.jsx'
import {
  addSetToWorkout,
  itemIdOf,
  routineTitle,
  whenLabel,
  workoutRoutineId,
  workoutRoutineName,
} from './helpers'

export function HistoryDetail({ workoutId }) {
  const store = useStore()
  const workout = store.workouts.find((x) => x.id === workoutId)
  if (!workout) {
    return <Missing>Not found.</Missing>
  }

  const { routine } = findRoutine(store.routines, workoutRoutineId(workout))
  const snapshot = workout.snapshot
  const sets = workout.sets || []
  const groups = groupSetsByExercise(sets, {
    exercises: snapshot?.items || routine?.exercises || [],
  })

  return (
    <Screen>
      <Back />
      <Title>
        {snapshot
          ? snapshot.programName
            ? `${snapshot.programName} — ${workoutRoutineName(workout, routine)}`
            : workoutRoutineName(workout, routine)
          : routineTitle(null, routine)}
      </Title>
      <p className="ui-sub">
        {[
          whenLabel(workout),
          durationLabel(workout.startedAt, workout.finishedAt),
          `${sets.length} sets`,
          `${workoutVolume(workout)} kg`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <p className="ui-sub">
        {workout.overallFeel ? `${workout.overallFeel} · ` : ''}
        <NavLink to={`/history/${workout.id}/edit`}>Correct</NavLink>
      </p>
      {workout.overallNote ? <p className="ui-sub">{workout.overallNote}</p> : null}

      <SectionHeader>Exercises</SectionHeader>
      {groups.length === 0 ? <p className="ui-sub">None.</p> : null}
      <List>
        {groups.map((group) => {
          const ex = exerciseById(store.exercises, group.exerciseId)
          const snapshotItem = snapshot?.items?.find(
            (item) => itemIdOf(item) === group.routineItemId || item.exerciseId === group.exerciseId,
          )
          const n = group.items.length
          return (
            <Row key={group.routineItemId} to={`/history/${workout.id}/exercise/${group.routineItemId}`}>
              {snapshotItem?.exerciseName || ex?.name || group.exerciseId}
              {` — ${roleLabel(snapshotItem?.role)}${snapshotItem?.warmup ? ' · WU set' : ''} · ${n} set${n === 1 ? '' : 's'}`}
            </Row>
          )
        })}
      </List>
      <p>
        <NavLink to={`/history/${workout.id}/set/new`}>Add set</NavLink>
      </p>

      {workout.progression?.length ? (
        <>
          <SectionHeader>Next time</SectionHeader>
          <List>
            {workout.progression.map((c) => {
              const none = c.reason === 'Skipped.' || c.reason === 'None.'
              const next = none
                ? c.reason
                : c.to?.length
                  ? `${c.to.join('/')} kg`
                  : (c.targetsTo || []).filter(Boolean).join('/') || formatProgressionLine(c).replace(`${c.name}: `, '')
              return (
                <Row key={itemIdOf(c) || c.exerciseId} value={next}>
                  {c.name}
                </Row>
              )
            })}
          </List>
        </>
      ) : null}

      <Button
        onClick={() => {
          if (!window.confirm(`Delete ${workoutRoutineName(workout, routine)}?`)) return
          store.removeWorkout(workout.id)
          go('/history')
        }}
      >
        Delete
      </Button>
    </Screen>
  )
}

export function HistoryWorkoutExercise({ workoutId, exerciseId }) {
  const store = useStore()
  const workout = store.workouts.find((x) => x.id === workoutId)
  const snapshotItem = workout?.snapshot?.items?.find(
    (item) => itemIdOf(item) === exerciseId || item.exerciseId === exerciseId,
  )
  const actualExerciseId = snapshotItem?.exerciseId || exerciseId
  const ex = exerciseById(store.exercises, actualExerciseId)
  const items = (workout?.sets || [])
    .map((s, index) => ({ s, index }))
    .filter((x) =>
      snapshotItem
        ? itemIdOf(x.s) === itemIdOf(snapshotItem)
        : x.s.exerciseId === exerciseId,
    )

  if (!workout) {
    return <Missing>Not found.</Missing>
  }

  return (
    <Screen>
      <Back />
      <Title>{snapshotItem?.exerciseName || ex?.name || exerciseId}</Title>
      <p className="ui-sub">
        {[roleLabel(snapshotItem?.role), snapshotItem?.warmup ? 'WU set' : null, whenLabel(workout)]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {items.length === 0 ? <p className="ui-sub">None.</p> : null}
      <List>
        {items.map(({ s, index }) => (
          <Row key={index} to={`/history/${workout.id}/set/${index}`}>
            {formatSetLine(s)}
            {s.note ? ` — ${s.note}` : ''}
          </Row>
        ))}
      </List>
      <Button onClick={() => addSetToWorkout(store, workout, actualExerciseId, itemIdOf(snapshotItem))}>
        Add set
      </Button>
    </Screen>
  )
}
