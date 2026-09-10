import { useState } from 'react'
import { RPE_OPTIONS, formatSetLine, roleLabel, rpeOptionValue } from '../ids'
import { formatProgressionLine } from '../progress'
import { go } from '../route'
import { dateKey } from '../schedule'
import {
  durationLabel,
  exerciseById,
  exercisesInHistory,
  findRoutine,
  groupSetsByExercise,
  groupWorkoutsByRoutine,
  workoutVolume,
} from '../storage'
import { useStore } from '../store-context'
import { RoutineScreens, navForBase } from './Routine'
import { Back, Missing, NavLink } from './shared'
import {
  Button,
  Field,
  List,
  NumberField,
  Row,
  Screen,
  SectionHeader,
  SegmentedControl,
  Select,
  Textarea,
  Title,
} from '../ui/index.jsx'

function itemIdOf(obj) {
  return obj?.routineItemId || obj?.sessionItemId || obj?.id || ''
}

function workoutRoutineId(workout) {
  return workout?.routineId || workout?.sessionId
}

function workoutRoutineName(workout, routine) {
  return workout?.snapshot?.routineName || workout?.snapshot?.sessionName || routine?.name || 'Workout'
}

function routineTitle(program, routine) {
  if (program && routine) return `${program.name} — ${routine.name}`
  if (routine) return routine.name
  return 'Routine'
}

function workoutDateKey(workout) {
  if (workout.performedOn) return workout.performedOn
  const stamp = workout.finishedAt || workout.startedAt
  if (stamp) return dateKey(stamp)
  return workout.scheduledFor || 'unknown'
}

function compactDate(key) {
  if (key === 'unknown') return 'Unknown'
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function whenLabel(workout) {
  return compactDate(workoutDateKey(workout))
}

function sortWorkoutsByDate(workouts) {
  return [...(workouts || [])].sort((a, b) => {
    const left = workoutDateKey(a)
    const right = workoutDateKey(b)
    if (left === 'unknown' && right !== 'unknown') return 1
    if (right === 'unknown' && left !== 'unknown') return -1
    if (left !== right) return right.localeCompare(left)
    return new Date(b.finishedAt || b.startedAt || 0).getTime() - new Date(a.finishedAt || a.startedAt || 0).getTime()
  })
}

function addSetToWorkout(store, workout, exerciseId, routineItemId = null) {
  const last = (workout.sets || [])
    .filter((s) =>
      routineItemId ? itemIdOf(s) === routineItemId : s.exerciseId === exerciseId,
    )
    .at(-1)
  const resolvedItemId = routineItemId || itemIdOf(last) || `history-${workout.id}-${exerciseId}`
  const sets = [
    ...(workout.sets || []),
    {
      exerciseId,
      routineItemId: resolvedItemId,
      setType: 'work',
      weight: last?.weight || 0,
      reps: '',
      rpe: null,
      note: '',
    },
  ]
  const exercise = exerciseById(store.exercises, exerciseId)
  const snapshot = workout.snapshot
    ? {
        ...workout.snapshot,
        items: (workout.snapshot.items || []).some(
          (item) => itemIdOf(item) === resolvedItemId,
        )
          ? workout.snapshot.items
          : [
              ...(workout.snapshot.items || []),
              {
                routineItemId: resolvedItemId,
                exerciseId,
                exerciseName: exercise?.name || 'Deleted exercise',
                equipment: exercise?.equipment || '',
                exerciseType: exercise?.type || 'free',
                weightStep: exercise?.weightStep || 'n/a',
                role: 'main',
                targets: [],
                suggestedWeights: [],
                restSec: 0,
                notes: 'Added during history correction',
                warmup: null,
              },
            ],
      }
    : workout.snapshot
  store.updateWorkout(workout.id, { sets, snapshot })
  go(`/history/${workout.id}/set/${sets.length - 1}`)
}

function workoutMonthKey(workout) {
  const key = workoutDateKey(workout)
  if (key === 'unknown' || !/^\d{4}-\d{2}/.test(key)) return 'unknown'
  return key.slice(0, 7)
}

function monthLabel(key) {
  if (key === 'unknown') return 'Unknown'
  const [year, month] = key.split('-').map(Number)
  if (!year || !month) return key
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

function groupWorkoutsByMonth(workouts) {
  const sorted = sortWorkoutsByDate(workouts)
  const byMonth = new Map()
  for (const workout of sorted) {
    const key = workoutMonthKey(workout)
    if (!byMonth.has(key)) byMonth.set(key, [])
    byMonth.get(key).push(workout)
  }
  return [...byMonth.entries()]
    .sort(([left], [right]) => {
      if (left === 'unknown') return 1
      if (right === 'unknown') return -1
      return right.localeCompare(left)
    })
    .map(([key, items]) => ({ key, workouts: items }))
}

function WorkoutHistoryRow({ store, workout }) {
  const { routine } = findRoutine(store.routines, workoutRoutineId(workout))
  const programName = workout.snapshot?.programName
  const name = workoutRoutineName(workout, routine)
  const label = programName ? `${programName} — ${name}` : name
  return (
    <Row to={`/history/${workout.id}`}>
      {label} — {compactDate(workoutDateKey(workout))}
    </Row>
  )
}

export function History({ month = null }) {
  const store = useStore()
  const months = groupWorkoutsByMonth(store.workouts || [])

  if (month) {
    const group = months.find((candidate) => candidate.key === month)
    const workouts = group?.workouts || []
    return (
      <Screen>
        <Back />
        <Title>{monthLabel(month)}</Title>
        {workouts.length === 0 ? (
          <p className="ui-sub">None.</p>
        ) : (
          <List>
            {workouts.map((workout) => (
              <WorkoutHistoryRow key={workout.id} store={store} workout={workout} />
            ))}
          </List>
        )}
      </Screen>
    )
  }

  return (
    <Screen>
      <Title>History</Title>
      <p>
        <NavLink to="/history/exercises">By exercise</NavLink>
      </p>
      {months.length === 0 ? <p className="ui-sub">None.</p> : null}
      <List>
        {months.map((group) => (
          <Row key={group.key} to={`/history/month/${group.key}`} value={String(group.workouts.length)}>
            {monthLabel(group.key)}
          </Row>
        ))}
      </List>
    </Screen>
  )
}

export function HistoryExercises() {
  const store = useStore()
  const list = exercisesInHistory(store.workouts || [], store.exercises, store.routines)

  return (
    <Screen>
      <Back />
      <Title>By exercise</Title>
      {list.length === 0 ? <p className="ui-sub">None.</p> : null}
      <List>
        {list.map((item) => (
          <Row key={item.id} to={`/history/exercise/${item.id}`}>
            {item.exercise?.name || item.id}
            {item.routines.length ? ` — ${item.routines.map((routine) => routine.name).join(', ')}` : ''}
          </Row>
        ))}
      </List>
    </Screen>
  )
}

export function HistoryExercise({ exerciseId }) {
  const store = useStore()
  const ex = exerciseById(store.exercises, exerciseId)
  const visits = (store.workouts || []).filter((w) => (w.sets || []).some((s) => s.exerciseId === exerciseId))
  const groups = groupWorkoutsByRoutine(visits, store.routines)

  return (
    <Screen>
      <Back />
      <Title>{ex?.name || exerciseId}</Title>
      {groups.length === 0 ? <p className="ui-sub">None.</p> : null}
      {groups.map((group) => (
        <div key={group.groupId || group.routineId}>
          <SectionHeader>{routineTitle(group.program, group.routine)}</SectionHeader>
          <List>
            {sortWorkoutsByDate(group.workouts).map((w) => {
              const count = (w.sets || []).filter((s) => s.exerciseId === exerciseId).length
              return (
                <Row key={w.id} to={`/history/${w.id}/exercise/${exerciseId}`} value={`${count} set${count === 1 ? '' : 's'}`}>
                  {whenLabel(w)}
                </Row>
              )
            })}
          </List>
        </div>
      ))}
    </Screen>
  )
}

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
      <Back />
      <Title>Correct</Title>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          store.updateWorkout(workout.id, { overallFeel, overallNote })
          go(`/history/${workout.id}`)
        }}
      >
        <SectionHeader>Feel</SectionHeader>
        <SegmentedControl
          options={[
            { value: '', label: '—' },
            'Easy',
            'Good',
            'Hard',
            'Exhausting',
          ]}
          value={overallFeel}
          onChange={setOverallFeel}
          ariaLabel="Feel"
        />
        <Textarea label="Note" value={overallNote} onChange={(e) => setOverallNote(e.target.value)} rows={3} />
        <div className="ui-actions">
          <Button type="submit" variant="primary">
            Save
          </Button>
          <NavLink to={`/history/${workout.id}`}>Cancel</NavLink>
        </div>
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

  const { routine } = findRoutine(store.routines, workoutRoutineId(workout))
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
      <Back />
      <Title>Add set</Title>
      {choices.length === 0 ? <p className="ui-sub">None.</p> : null}
      <List>
        {choices.map((choice) => (
          <Row key={choice.routineItemId || choice.exerciseId}>
            <Button onClick={() => addSetToWorkout(store, workout, choice.exerciseId, choice.routineItemId)}>
              {choice.name || choice.exerciseId}
            </Button>
          </Row>
        ))}
      </List>
    </Screen>
  )
}

export function HistorySet({ workoutId, index }) {
  const store = useStore()
  const workout = store.workouts.find((x) => x.id === workoutId)
  const set = workout?.sets?.[index]
  const [setType, setSetType] = useState(set?.setType || 'work')
  const [weight, setWeight] = useState(set?.weight ?? '')
  const [reps, setReps] = useState(set?.reps ?? '')
  const [rpe, setRpe] = useState(() => (set?.rpe != null && set.rpe !== '' ? String(rpeOptionValue(set.rpe)) : ''))
  const [note, setNote] = useState(set?.note || '')

  if (!workout || !set) {
    return <Missing>Not found.</Missing>
  }

  return (
    <Screen>
      <Back />
      <p className="ui-sub">{workoutRoutineName(workout, null)}</p>
      <Title>Set</Title>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const sets = (workout.sets || []).map((s, i) =>
            i === index
              ? {
                  ...s,
                  setType,
                  weight: weight === '' ? '' : Number(weight),
                  reps,
                  rpe: rpe === '' ? null : Number(rpe),
                  note,
                }
              : s,
          )
          store.updateWorkout(workout.id, { sets })
          go(`/history/${workout.id}/recalculate`)
        }}
      >
        <SectionHeader>Type</SectionHeader>
        <SegmentedControl
          options={[
            { value: 'wu', label: 'WU set' },
            { value: 'work', label: 'Work' },
          ]}
          value={setType}
          onChange={setSetType}
          ariaLabel="Type"
        />
        <NumberField label="kg" value={weight} onChange={(e) => setWeight(e.target.value)} />
        <Field label="Reps" value={reps} onChange={(e) => setReps(e.target.value)} />
        <SectionHeader>Effort</SectionHeader>
        {/* leading '—' keeps effort clearable, as the old <select> did */}
        <SegmentedControl
          options={[{ value: '', label: '—' }, ...RPE_OPTIONS]}
          value={rpe}
          onChange={setRpe}
          ariaLabel="Effort"
        />
        <Field label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="ui-actions">
          <Button type="submit" variant="primary">
            Save
          </Button>
          <NavLink to={`/history/${workout.id}/exercise/${itemIdOf(set) || set.exerciseId}`}>Cancel</NavLink>
        </div>
      </form>
      <Button
        onClick={() => {
          if (!window.confirm('Remove set?')) return
          store.updateWorkout(workout.id, { sets: (workout.sets || []).filter((_, i) => i !== index) })
          go(`/history/${workout.id}/recalculate`)
        }}
      >
        Remove
      </Button>
    </Screen>
  )
}

export function HistoryRecalculate({ workoutId }) {
  const store = useStore()
  const workout = store.workouts.find((candidate) => candidate.id === workoutId)
  if (!workout) {
    return <Missing>Not found.</Missing>
  }
  const routinePath = workoutRoutineId(workout) ? `/history/${workout.id}/routine` : null

  return (
    <Screen>
      <Back />
      <Title>Update?</Title>
      <p className="ui-sub">
        {workoutRoutineName(workout, null)} — {whenLabel(workout)}
      </p>
      {routinePath ? (
        <p>
          <NavLink to={routinePath}>Routine</NavLink>
        </p>
      ) : null}
      <div className="ui-actions">
        <Button
          variant="primary"
          onClick={() => {
            store.recalculateFuturePlans(workout.id)
            go(`/history/${workout.id}`)
          }}
        >
          Apply
        </Button>
        <NavLink to={`/history/${workout.id}`}>Skip</NavLink>
      </div>
    </Screen>
  )
}

export function HistoryRoutine({ workoutId, screen = 'detail', itemId, exerciseId }) {
  const store = useStore()
  const workout = store.workouts.find((candidate) => candidate.id === workoutId)
  const routineId = workoutRoutineId(workout)
  if (!workout || !routineId) {
    return <Missing>Not found.</Missing>
  }
  const paths = navForBase(`/history/${workoutId}/routine`, `/history/${workoutId}/recalculate`, {
    extra: whenLabel(workout),
    showDelete: false,
  })
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
