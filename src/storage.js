import { SCHEMA_VERSION, findRoutineInState, migrateState } from './model.js'
import { defaultSchedule } from './schedule.js'

const STORAGE_KEY = 'workout-mvp-v8'
const LEGACY_KEYS = ['workout-mvp-v7', 'workout-mvp-v6', 'workout-mvp-v5']

export function emptyState() {
  return migrateState({
    schemaVersion: SCHEMA_VERSION,
    exercises: [],
    routines: [],
    schedule: defaultSchedule(),
    workouts: [],
    plannedWorkouts: [],
    draftWorkouts: [],
    activeWorkout: null,
    legacyRecommendations: {},
  })
}

export function loadState() {
  try {
    const current = localStorage.getItem(STORAGE_KEY)
    const raw = current || LEGACY_KEYS.map((key) => localStorage.getItem(key)).find(Boolean)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw)
    const state = migrateState({ ...emptyState(), ...parsed })
    if (!current || Number(parsed.schemaVersion) !== SCHEMA_VERSION) {
      saveState(state)
    }
    return state
  } catch {
    return emptyState()
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function routineById(routines, routineId) {
  return (routines || []).find((routine) => routine.id === routineId) ?? null
}

export function findRoutine(routines, routineId) {
  return findRoutineInState(routines, routineId)
}

export function groupWorkoutsByRoutine(workouts, routines) {
  const groups = []
  const indexByRoutine = new Map()
  for (const w of workouts || []) {
    const routineId = w.routineId || w.sessionId || 'unknown'
    const name = w.snapshot?.routineName || w.snapshot?.sessionName
    const key = w.snapshot ? `${routineId}::${w.snapshot.programName || ''}::${name}` : routineId
    if (!indexByRoutine.has(key)) {
      const { routine } = findRoutine(routines, routineId)
      indexByRoutine.set(key, groups.length)
      groups.push({
        groupId: key,
        routineId,
        program: w.snapshot?.programName
          ? { id: w.snapshot.programId, name: w.snapshot.programName }
          : null,
        routine: w.snapshot
          ? {
              id: w.snapshot.routineId || w.snapshot.sessionId,
              name: w.snapshot.routineName || w.snapshot.sessionName,
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
    const key = item.routineItemId || item.sessionItemId || item.id || item.exerciseId
    if (item.exerciseId && !seen.has(key)) {
      seen.add(key)
      routineItems.push({ key, exerciseId: item.exerciseId })
    }
  }
  const extra = []
  for (const s of list) {
    const key = s.routineItemId || s.sessionItemId || s.exerciseId
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
      .filter((x) => (x.s.routineItemId || x.s.sessionItemId || x.s.exerciseId) === key),
  }))
}

export function routinesUsingExercise(routines, exerciseId) {
  return (routines || []).filter((routine) =>
    (routine.exercises || []).some((item) => item.exerciseId === exerciseId),
  )
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
      exercise: (exercises || []).find((e) => e.id === id) || null,
      routines: routinesUsingExercise(routines, id),
    }))
    .sort((a, b) => (a.exercise?.name || a.id).localeCompare(b.exercise?.name || b.id))
}

export function lastSetsForExercise(workouts, exerciseId) {
  const done = [...(workouts || [])]
    .filter((w) => w.finishedAt)
    .sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)))
  for (const w of done) {
    const sets = (w.sets || []).filter((s) => s.exerciseId === exerciseId)
    if (sets.length) return { workout: w, sets }
  }
  return null
}

function isSkippedSet(set) {
  return String(set?.reps || '').toLowerCase() === 'skipped'
}

function workingSetsFromHistory(sets) {
  return (sets || []).filter((set) => set.setType !== 'wu' && !isSkippedSet(set))
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
  const snapshotItem = (last.workout?.snapshot?.items || []).find((item) => item.exerciseId === exerciseId)
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

export function exerciseById(exercises, id) {
  return exercises.find((e) => e.id === id) ?? null
}

export function durationLabel(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return ''
  const ms = new Date(finishedAt) - new Date(startedAt)
  const min = Math.max(1, Math.round(ms / 60000))
  return `${min} min`
}
