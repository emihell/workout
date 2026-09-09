import { SCHEMA_VERSION, findRoutineInState, migrateState } from './model.js'
import { defaultSchedule } from './schedule.js'

const STORAGE_KEY = 'workout-mvp-v8'
const LEGACY_KEYS = ['workout-mvp-v7', 'workout-mvp-v6', 'workout-mvp-v5']

// "Last save failed" signal. saveState writes are unguarded against a throwing
// localStorage.setItem (quota exceeded, Safari/iOS private mode), and the write
// runs inside the store's setState updater — an escaped throw would lose data
// silently. We swallow the throw here and expose the failure as a subscribable
// external store so the app can show a persistent banner until a save succeeds.
let saveFailed = false
const saveFailedListeners = new Set()

function setSaveFailed(value) {
  if (saveFailed === value) return
  saveFailed = value
  for (const listener of saveFailedListeners) listener()
}

export function getSaveFailed() {
  return saveFailed
}

export function subscribeSaveFailed(listener) {
  saveFailedListeners.add(listener)
  return () => saveFailedListeners.delete(listener)
}

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

// req-06 — remove the superseded legacy keys, but ONLY after the v8 value is
// confirmed persisted by reading it back. A save that fails *silently* (iOS/Safari
// Private Mode has historically accepted the write and stored nothing) must never
// trigger a delete — that is the one path that could destroy the only surviving
// copy of the user's history. "saveState didn't throw" is NOT confirmation; the
// read-back is the entire safety mechanism. Best-effort and self-contained: a
// throwing removeItem/getItem is swallowed here so a cleanup failure degrades to
// "legacy stays", never to loadState returning emptyState and orphaning the data.
function removeLegacyKeysIfV8Persisted() {
  try {
    if (localStorage.getItem(STORAGE_KEY) == null) return
    for (const key of LEGACY_KEYS) {
      localStorage.removeItem(key)
    }
  } catch {
    // read-back or removeItem threw — leave every legacy key in place.
  }
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
    // Only reached when this device had data (fresh migration, or already v8 with
    // a legacy copy left over from an interrupted cleanup). The read-back gate
    // decides whether any legacy key is actually removed.
    removeLegacyKeysIfV8Persisted()
    return state
  } catch {
    return emptyState()
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    setSaveFailed(false)
    return true
  } catch {
    setSaveFailed(true)
    return false
  }
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
