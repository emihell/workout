// req-164 (F-STRUCT-6) — the history queries, split out of storage.js: pure reads over
// the stored workouts — "last time" (lastSetsForExercise, prefill, prescription), the
// previous same-routine workouts and the summary stats, grouping for History/Today.
import { exerciseById, routineById } from './model.js'
import { isCurrentWorkout } from './current-workout.js'
import { dateKey } from './schedule.js'
import { isAddedMidWorkout, isSkippedSet, loggedSetCount } from './workout-log.js'

// req-28 — the workouts finished on a given calendar day (dateKey(finishedAt) ===
// dayKey), newest-finished first. The Today page's "Completed today" section reads
// this. Only genuinely finished workouts count (a `finishedAt` timestamp); a
// workout re-dated via `performedOn`/`startedAt` is not "completed today", so this
// filters on `finishedAt` alone rather than the history view's workoutDateKey. Pure.
export function completedOnDayKey(workouts, dayKey) {
  return (workouts || [])
    .filter((workout) => workout.finishedAt && dateKey(workout.finishedAt) === dayKey)
    .sort((a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime())
}

// req-55 / DEC-038 — the unfinished in-progress workouts to surface for resolution
// (Continue / Abandon). Exactly one workout can be actively in progress; it is only
// "stale" here once it is no longer CURRENT — req-114 / DEC-058 §2: started today or
// within the last 6 h (isCurrentWorkout) is the today-page hero, not a stale row. Legacy
// `draftWorkouts` (the removed multi-draft feature) are always surfaced so old data
// can be resolved through the normal UI, then the field drains empty. These are
// NEVER finished history: they live outside `workouts` and never feed progress.js.
export function staleInProgressWorkouts(state, todayKey = dateKey(new Date()), now = new Date()) {
  const items = []
  const active = state?.activeWorkout
  if (active && !isCurrentWorkout(active, now, todayKey)) items.push(active)
  for (const draft of state?.draftWorkouts || []) items.push(draft)
  return items
}

export function groupWorkoutsByRoutine(workouts, routines) {
  const groups = []
  const indexByRoutine = new Map()
  for (const w of workouts || []) {
    const routineId = w.routineId || 'unknown'
    const name = w.snapshot?.routineName
    const key = w.snapshot ? `${routineId}::${w.snapshot.programName || ''}::${name}` : routineId
    if (!indexByRoutine.has(key)) {
      const routine = routineById(routines, routineId)
      indexByRoutine.set(key, groups.length)
      groups.push({
        groupId: key,
        routineId,
        program: w.snapshot?.programName
          ? { id: w.snapshot.programId, name: w.snapshot.programName }
          : null,
        routine: w.snapshot
          ? {
              id: w.snapshot.routineId,
              name: w.snapshot.routineName,
              exercises: w.snapshot.items || [],
            }
          : routine,
        workouts: [],
      })
    }
    groups[indexByRoutine.get(key)].workouts.push(w)
  }
  return groups
}

export function groupSetsByExercise(sets, routine) {
  const list = sets || []
  const routineItems = []
  const seen = new Set()
  for (const item of routine?.exercises || []) {
    const key = item.routineItemId || item.id || item.exerciseId
    if (item.exerciseId && !seen.has(key)) {
      seen.add(key)
      routineItems.push({ key, exerciseId: item.exerciseId })
    }
  }
  const extra = []
  for (const s of list) {
    const key = s.routineItemId || s.exerciseId
    if (s.exerciseId && !seen.has(key)) {
      seen.add(key)
      extra.push({ key, exerciseId: s.exerciseId })
    }
  }
  return [...routineItems, ...extra].map(({ key, exerciseId }) => ({
    routineItemId: key,
    exerciseId,
    items: list
      .map((s, index) => ({ s, index }))
      .filter((x) => (x.s.routineItemId || x.s.exerciseId) === key),
  }))
}

export function routinesUsingExercise(routines, exerciseId) {
  return (routines || []).filter((routine) =>
    (routine.exercises || []).some((item) => item.exerciseId === exerciseId),
  )
}

// req-114 / req-119 — Today's first-run "No data" screen: nothing at all yet. Not
// merely "no routines": mid-workout after deleting its routine, or with history,
// Today keeps its normal layout (Continue, the history peek).
export function isFirstRun(state) {
  return !(state?.routines || []).length && !(state?.workouts || []).length && !state?.activeWorkout
}

export function exercisesInHistory(workouts, exercises, routines) {
  const ids = []
  const seen = new Set()
  for (const w of workouts || []) {
    for (const s of w.sets || []) {
      if (s.exerciseId && !seen.has(s.exerciseId)) {
        seen.add(s.exerciseId)
        ids.push(s.exerciseId)
      }
    }
  }
  return ids
    .map((id) => ({
      id,
      exercise: exerciseById(exercises, id),
      routines: routinesUsingExercise(routines, id),
    }))
    .sort((a, b) => (a.exercise?.name || a.id).localeCompare(b.exercise?.name || b.id))
}

// req-163 (audit F-CODE-3) — the ONE order for every "previous / last time" choice:
// finished workouts only, newest `finishedAt` first, ties broken by id (descending) — never
// by array position. `workouts` is newest-first only while every workout was appended by
// Finish; an imported backup can hold any order (e.g. oldest-first), and Finish's
// beat-last-time then compared against the OLDEST workout while the prefill
// (lastSetsForExercise) read the newest. Both now read this.
export function finishedNewestFirst(workouts) {
  return (workouts || [])
    .filter((w) => w?.finishedAt)
    .sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)) || String(b.id ?? '').localeCompare(String(a.id ?? '')))
}

// req-111 / DEC-053 — "last time" is the most recent finished workout with at least
// one NON-skipped WORKING set of the exercise. A workout where every work set was
// skipped (incl. "warmed up, then the machine was taken") holds no work load/reps for
// it, so it is passed over (never reinterpreted). Only if the exercise has never had a
// done work set does a warm-up-only workout count (it still seeds the warm-up). None →
// null, i.e. no history, so DEC-002's kg carry applies as for a new exercise. A partly
// skipped workout still counts; its skipped sets are returned but every reader
// (historySetPrefill / historyPrescription) already drops them.
export function lastSetsForExercise(workouts, exerciseId) {
  const done = finishedNewestFirst(workouts)
  let warmupOnly = null
  for (const w of done) {
    const sets = (w.sets || []).filter((s) => s.exerciseId === exerciseId)
    const real = sets.filter((s) => !isSkippedSet(s))
    if (real.some((s) => s.setType !== 'wu')) return { workout: w, sets }
    if (real.length && !warmupOnly) warmupOnly = { workout: w, sets }
  }
  return warmupOnly
}

function workingSetsFromHistory(sets) {
  return (sets || []).filter((set) => set.setType !== 'wu' && !isSkippedSet(set))
}

// req-152 — whether the last finished workout has a set at this index at all (a set
// beyond its count — e.g. one "Add set" appended — has none, so its kg may carry).
export function historyHasSetAt(last, { setType, workIndex } = {}) {
  if (!last?.sets?.length) return false
  return setType === 'wu'
    ? last.sets.some((candidate) => candidate.setType === 'wu' && !isSkippedSet(candidate))
    : Boolean(workingSetsFromHistory(last.sets)[workIndex])
}

export function historySetPrefill(last, { setType, workIndex } = {}) {
  if (!last?.sets?.length) return { weight: '', reps: '' }
  const set =
    setType === 'wu'
      ? last.sets.find((candidate) => candidate.setType === 'wu' && !isSkippedSet(candidate))
      : workingSetsFromHistory(last.sets)[workIndex]
  if (!set) return { weight: '', reps: '' }
  const weight = set.weight != null && Number(set.weight) !== 0 ? String(set.weight) : ''
  const reps = set.reps != null && set.reps !== '' ? String(set.reps) : ''
  return { weight, reps }
}

export function historyPrescription(workouts, exerciseId) {
  const last = lastSetsForExercise(workouts, exerciseId)
  if (!last) return null
  const work = workingSetsFromHistory(last.sets)
  if (!work.length) return null
  const weights = work.map((set) => Number(set.weight) || 0)
  // req-128 — the exercise can sit in the snapshot twice: its own routine item and a
  // req-109 replacement (rest 0, no notes) inserted for another item — possibly BEFORE
  // its own. Rest and notes are the routine item's, so prefer the item that was not
  // added mid-workout; only if every match was (replacement-only) fall back to the first.
  const matches = (last.workout?.snapshot?.items || []).filter((item) => item.exerciseId === exerciseId)
  const snapshotItem = matches.find((item) => !isAddedMidWorkout(item)) || matches[0]
  const wu = last.sets.find((set) => set.setType === 'wu' && !isSkippedSet(set))
  return {
    sets: work.length,
    targets: work.map((set) => String(set.reps ?? '')),
    suggestedWeights: weights.some((weight) => weight > 0) ? weights : [],
    restSec: snapshotItem?.restSec,
    notes: snapshotItem?.notes || '',
    warmup: wu ? { reps: wu.reps } : null,
  }
}

export function workoutVolume(workout) {
  let total = 0
  for (const s of workout.sets || []) {
    if (s.setType === 'wu') continue
    const w = Number(s.weight) || 0
    const r = Number(s.reps) || 0
    total += w * r
  }
  return total
}


export function durationLabel(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return ''
  const ms = new Date(finishedAt) - new Date(startedAt)
  const min = Math.max(1, Math.round(ms / 60000))
  return `${min} min`
}

// Minutes elapsed for a workout, matching finish.jsx:26 / durationLabel — at least
// 1, rounded. `end` lets the caller pass a live clock for the still-active workout
// (which has no finishedAt yet) or a stored finishedAt for a finished one.
function workoutMinutes(startedAt, end) {
  const started = startedAt ? new Date(startedAt).getTime() : end
  return Math.max(1, Math.round((end - started) / 60000))
}

// req-84 — the "vs last time" summary shown when a routine auto-completes. Pure and
// inspectable: given the just-finished (still-active) workout, the previous
// same-routine finished workout (or null), and a `now` clock for duration, it returns
// the three numbers plus a per-number delta. No prior → deltas is null: the summary
// shows the stats but INVENTS no comparison (DESIGN §1, the no-invent rule). Selection
// of `prior` (summaryPriorWorkout, req-128) is separate and equally testable.
// req-116 — `sets` counts only non-skipped sets (loggedSetCount), on both sides of the
// delta, so the summary matches the Finish screen and compares like with like.
export function workoutSummaryStats(active, prior, now) {
  const volume = workoutVolume(active)
  const duration = workoutMinutes(active?.startedAt, now)
  const sets = loggedSetCount(active)
  if (!prior) return { volume, duration, sets, deltas: null }
  return {
    volume,
    duration,
    sets,
    deltas: {
      volume: volume - workoutVolume(prior),
      duration: duration - workoutMinutes(prior.startedAt, new Date(prior.finishedAt).getTime()),
      sets: sets - loggedSetCount(prior),
    },
  }
}

// req-128 — the prior the auto-complete summary compares against: the most recent
// previous same-routine workout with a done WORKING set. An all-skipped prior holds no
// volume/sets to compare with, so its deltas would be nonsense; it is passed over.
// req-163 (req-111 a, DEC-053) — so is a warm-up-only one: warm-ups are outside the
// volume, and DEC-053 counts "only warm-ups done" as no work history. None → null →
// workoutSummaryStats shows no deltas.
export function summaryPriorWorkout(active, workouts, routines) {
  return previousSameRoutineWorkouts(active, workouts, routines).find(hasDoneWorkingSet) ?? null
}

function hasDoneWorkingSet(workout) {
  return (workout?.sets || []).some((set) => set.setType !== 'wu' && !isSkippedSet(set))
}

// req-111 — every prior same-routine finished workout, newest-first. The grouping reuses
// groupWorkoutsByRoutine's key (routineId + program + name) on [active, ...workouts]:
// `active` heads its own group, so the rest of that group are its priors. beat-last-time takes the whole list
// so each exercise can look past a workout where it was entirely skipped (DEC-053).
// req-163 — newest-first by finishedAt (finishedNewestFirst), not by array order.
export function previousSameRoutineWorkouts(active, workouts, routines) {
  if (!active) return []
  const groups = groupWorkoutsByRoutine([active, ...finishedNewestFirst(workouts)], routines)
  const group = groups.find((g) => g.workouts[0] === active)
  return group ? group.workouts.slice(1) : []
}
