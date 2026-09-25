import { roleTag } from '../../ids.js'
import { isSkippedSet } from '../../workout-log.js'
import { dateKey } from '../../schedule.js'
import { compareWorkoutsNewestFirst } from '../../history-queries.js'

// Shared helpers for the history screens (req-19 split of History.jsx): id/name
// resolution, date formatting + grouping. Used by more than one history/ screen module. `workoutMonthKey` stays
// internal (only groupWorkoutsByMonth uses it).

// req-128 — a History detail exercise row's meta after the name: the req-93 rule, so
// main (or an absent role) is unlabelled and only warm-up/finisher/cardio carry a tag
// (roleTag); then the existing `WU set` marker and the set count. Was `roleLabel`, which
// printed "Main" on nearly every row.
//
// req-152 (QA-4) — `skipped`: every set of the exercise was skipped, so the count reads
// "skipped" instead (the live overview's word, req-109). The caller passes the count of
// logged (non-skipped) sets, as the header does (req-116).
export function historyGroupMeta(snapshotItem, setCount, { skipped = false } = {}) {
  return [
    roleTag(snapshotItem?.role),
    snapshotItem?.warmup ? 'Warm-up set' : '',
    skipped ? 'skipped' : `${setCount} set${setCount === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

// req-153 — the meta for one History detail row from its group's sets ({ s, index }
// pairs, groupSetsByExercise): skipped sets aren't counted (as in the header, req-116),
// and an exercise whose every set was skipped reads "skipped".
export function historyGroupRowMeta(snapshotItem, groupItems) {
  const items = groupItems || []
  const logged = items.filter(({ s }) => !isSkippedSet(s)).length
  return historyGroupMeta(snapshotItem, logged, { skipped: items.length > 0 && logged === 0 })
}

export function itemIdOf(obj) {
  return obj?.routineItemId || obj?.id || ''
}

export function workoutRoutineId(workout) {
  return workout?.routineId
}

export function workoutRoutineName(workout, routine) {
  return workout?.snapshot?.routineName || routine?.name || 'Workout'
}

export function routineTitle(program, routine) {
  if (program && routine) return `${program.name} — ${routine.name}`
  if (routine) return routine.name
  return 'Routine'
}

export function workoutDateKey(workout) {
  if (workout.performedOn) return workout.performedOn
  // req-167 — an unreadable stamp falls through (was: 'NaN-NaN-NaN', which sorted before
  // every real date and displayed as "NaN"); only a readable one names the day.
  const stamp = [workout.finishedAt, workout.startedAt].find((value) => value && Number.isFinite(Date.parse(value)))
  if (stamp) return dateKey(stamp)
  // req-167 review — a legacy / imported workout with only `date` is dated by it, as
  // workoutTime (history-queries.js) dates it for "last time"; was filed as "Unknown".
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(workout.date || ''))) return workout.date
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
    // req-167 — within a day, the shared comparator (parsed time, as the priors use).
    return compareWorkoutsNewestFirst(a, b)
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
