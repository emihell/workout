import { go } from '../../route'
import { dateKey } from '../../schedule'
import { exerciseById } from '../../storage'

// Shared helpers for the history screens (req-19 split of History.jsx): id/name
// resolution, date formatting + grouping, and the add-a-set-to-a-finished-workout
// mutation. Used by more than one history/ screen module. `workoutMonthKey` stays
// internal (only groupWorkoutsByMonth uses it).

export function itemIdOf(obj) {
  return obj?.routineItemId || obj?.sessionItemId || obj?.id || ''
}

export function workoutRoutineId(workout) {
  return workout?.routineId || workout?.sessionId
}

export function workoutRoutineName(workout, routine) {
  return workout?.snapshot?.routineName || workout?.snapshot?.sessionName || routine?.name || 'Workout'
}

export function routineTitle(program, routine) {
  if (program && routine) return `${program.name} — ${routine.name}`
  if (routine) return routine.name
  return 'Routine'
}

export function workoutDateKey(workout) {
  if (workout.performedOn) return workout.performedOn
  const stamp = workout.finishedAt || workout.startedAt
  if (stamp) return dateKey(stamp)
  return workout.scheduledFor || 'unknown'
}

export function compactDate(key) {
  if (key === 'unknown') return 'Unknown'
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function whenLabel(workout) {
  return compactDate(workoutDateKey(workout))
}

export function sortWorkoutsByDate(workouts) {
  return [...(workouts || [])].sort((a, b) => {
    const left = workoutDateKey(a)
    const right = workoutDateKey(b)
    if (left === 'unknown' && right !== 'unknown') return 1
    if (right === 'unknown' && left !== 'unknown') return -1
    if (left !== right) return right.localeCompare(left)
    return new Date(b.finishedAt || b.startedAt || 0).getTime() - new Date(a.finishedAt || a.startedAt || 0).getTime()
  })
}

export function addSetToWorkout(store, workout, exerciseId, routineItemId = null) {
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

export function monthLabel(key) {
  if (key === 'unknown') return 'Unknown'
  const [year, month] = key.split('-').map(Number)
  if (!year || !month) return key
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

export function groupWorkoutsByMonth(workouts) {
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
