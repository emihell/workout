import { dateKey } from '../../schedule'

// Shared helpers for the history screens (req-19 split of History.jsx): id/name
// resolution, date formatting + grouping. Used by more than one history/ screen module. `workoutMonthKey` stays
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

// req-14 (Emilio review iter 6) — the ONE shared `when` format for the Workout
// screen's rows (Upcoming / Today / Recent), so all three read the same way:
// weekday + short date, e.g. "Sun, Oct 13". The year is appended only when it is
// not the current year, so this year's dates stay compact and older history reads
// "Sun, Oct 13, 2024". Takes a "YYYY-MM-DD" key; `now` is injectable for testing.
// Format is the chosen default and is Emilio-tweakable.
export function weekdayDate(key, now = new Date()) {
  if (!key || key === 'unknown') return 'Unknown'
  const [year, month, day] = key.split('-').map(Number)
  const opts = { weekday: 'short', month: 'short', day: 'numeric' }
  if (year !== now.getFullYear()) opts.year = 'numeric'
  return new Date(year, month - 1, day).toLocaleDateString(undefined, opts)
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

// req-117 — addSetToWorkout (which wrote a placeholder set before the form opened) is
// gone; History "Add set" now opens the form unsaved and writes on Save (add-set.js).

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
