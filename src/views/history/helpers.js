import { roleTag, setParts, setValueText, WITH_WARMUP } from '../../ids.js'
import { isSkippedSet } from '../../workout-log.js'
import { dateKey } from '../../schedule.js'
import { compareWorkoutsNewestFirst, lastSetsForExercise } from '../../history-queries.js'

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
    snapshotItem?.warmup ? WITH_WARMUP : '',
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
  return 'Workout'
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

// req-201 (DEC-110 §2) — a logged session is named by its workout's name and date
// ("Upper Body · Oct 6, 2026"), never the generic "workout" (which means the plan in the UI).
export function sessionLabel(workout, routine) {
  return `${workoutRoutineName(workout, routine)} · ${whenLabel(workout)}`
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

// req-203 §5 (Lena s48) — History › By exercise: a date row's numbers, the session's
// heaviest WORKING set of that exercise as "25 kg × 10". Working = not a warm-up and not
// skipped, with a kg above 0. A tie on kg goes to the most reps (20×12, 25×10, 25×8 →
// "25 kg × 10"). No reps logged → "25 kg". No such set (bodyweight, cardio, all skipped)
// → null, and the row keeps its "N sets". Logged values only (DESIGN §1). Pure.
export function topSetText(sets, exerciseId) {
  let top = null
  for (const set of sets || []) {
    if (set?.exerciseId !== exerciseId || set.setType === 'wu' || isSkippedSet(set)) continue
    const kg = Number(set.weight)
    if (set.weight == null || set.weight === '' || !Number.isFinite(kg) || kg <= 0) continue
    const reps = Number(set.reps)
    const repsRank = Number.isFinite(reps) ? reps : -1
    if (!top || kg > top.kg || (kg === top.kg && repsRank > top.repsRank)) top = { kg, repsRank, set }
  }
  if (!top) return null
  // req-209 §3 — the one set format (ids.js setValueText): "25 kg × 10", or "25 kg".
  return setValueText({ weight: top.set.weight, reps: top.set.reps })
}

// req-209 §2 — a History detail exercise row's sets, inline after the name:
// "14 kg × 15, × 15, × 15" (kg once when every logged work set shares it), else each set
// with its own kg ("12 kg × 10, 14 kg × 8"). A set without kg reads "× 15"; a timed set its
// duration ("30s"), a cardio set its time/level/distance; a skipped set "skipped"; a
// warm-up set "warm-up 10 kg × 12". Every set skipped → just "skipped". A non-main role
// keeps its tag first ("Finisher · …", req-93). Logged values only (DESIGN §1). Pure.
export function historyGroupSetsText(snapshotItem, groupItems, kind = {}) {
  const sets = (groupItems || []).map(({ s }) => s)
  const tag = roleTag(snapshotItem?.role)
  const withTag = (text) => [tag, text].filter(Boolean).join(' · ')
  if (sets.length === 0) return withTag('0 sets')
  if (sets.every((s) => isSkippedSet(s))) return withTag('skipped')
  const work = sets.filter((s) => s.setType !== 'wu' && !isSkippedSet(s))
  const workParts = work.map((s) => setParts(s, kind))
  const sharedKg =
    workParts.length > 1 && workParts.every((p) => p.kg && !p.cardio && p.kg === workParts[0].kg) ? workParts[0].kg : null
  let firstWork = true
  const texts = sets.map((s) => {
    if (isSkippedSet(s)) return s.setType === 'wu' ? 'warm-up skipped' : 'skipped'
    const parts = setParts(s, kind)
    const bare = parts.cardio || (s.durationSec != null && s.durationSec !== '')
    const tail = parts.amount ? (bare ? parts.amount : `× ${parts.amount}`) : ''
    let text
    if (s.setType !== 'wu' && sharedKg && !firstWork) text = tail
    else if (parts.kg) text = parts.amount ? `${parts.kg} ${parts.cardio ? '· ' : '× '}${parts.amount}` : parts.kg
    else text = tail
    if (s.setType !== 'wu') firstWork = false
    text = text || 'logged'
    return s.setType === 'wu' ? `warm-up ${text}` : text
  })
  return withTag(texts.join(', '))
}

// req-209 §4 — a short date, "Oct 7" (the year added when it isn't `now`'s). Pure.
export function shortDate(key, now = new Date()) {
  if (!key || key === 'unknown') return 'Unknown'
  const [year, month, day] = key.split('-').map(Number)
  const opts = { month: 'short', day: 'numeric' }
  if (year !== now.getFullYear()) opts.year = 'numeric'
  return new Date(year, month - 1, day).toLocaleDateString(undefined, opts)
}

// req-209 §4 — the exercise page's "Last time: Oct 7 · 14 kg × 15": the most recent
// FINISHED workout with a done set of this exercise (lastSetsForExercise, the same "last
// time" the set screen uses — never the live workout), its heaviest working set
// (topSetText, as By exercise). No kg in it → its set count. No history → null (the page
// shows nothing). Pure.
export function exerciseLastTimeText(workouts, exerciseId, now = new Date()) {
  const last = lastSetsForExercise(workouts, exerciseId)
  if (!last) return null
  const top = topSetText(last.workout.sets, exerciseId)
  const count = last.sets.filter((s) => !isSkippedSet(s)).length
  const detail = top || `${count} ${count === 1 ? 'set' : 'sets'}`
  return `Last time: ${shortDate(workoutDateKey(last.workout), now)} · ${detail}`
}
