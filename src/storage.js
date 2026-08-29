import db from './db.json'
import { SCHEMA_VERSION, findSessionInState, migrateState } from './model'
import { normalizeGoal } from './progress'
import { defaultSchedule } from './schedule'

const STORAGE_KEY = 'workout-mvp-v6'
const LEGACY_KEYS = ['workout-mvp-v5']

export function loadDb() {
  const data = structuredClone(db)
  if (!data.programs) data.programs = []
  if (!data.schedule) data.schedule = defaultSchedule()
  data.programs = data.programs.map((p) => ({ ...p, goal: normalizeGoal(p.goal) }))
  return migrateState(data)
}

export function loadState() {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      LEGACY_KEYS.map((key) => localStorage.getItem(key)).find(Boolean)
    if (!raw) return loadDb()
    const parsed = JSON.parse(raw)
    const base = loadDb()
    const next = migrateState({ ...base, ...parsed })
    if (!Array.isArray(next.programs)) next.programs = base.programs
    if (!next.schedule) next.schedule = base.schedule
    next.programs = next.programs.map((p) => ({ ...p, goal: normalizeGoal(p.goal) }))
    next.schemaVersion = SCHEMA_VERSION
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    return next
  } catch {
    return loadDb()
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function programById(programs, programId) {
  return (programs || []).find((p) => p.id === programId) ?? null
}

export function findSession(programs, sessionId) {
  return findSessionInState(programs, sessionId)
}

export function groupWorkoutsBySession(workouts, programs) {
  const groups = []
  const indexBySession = new Map()
  for (const w of workouts || []) {
    const sessionId = w.sessionId || 'unknown'
    const key = w.snapshot
      ? `${sessionId}::${w.snapshot.programName}::${w.snapshot.sessionName}`
      : sessionId
    if (!indexBySession.has(key)) {
      const { program, session } = findSession(programs, sessionId)
      indexBySession.set(key, groups.length)
      groups.push({
        groupId: key,
        sessionId,
        program: w.snapshot
          ? { id: w.snapshot.programId, name: w.snapshot.programName }
          : program,
        session: w.snapshot
          ? { id: w.snapshot.sessionId, name: w.snapshot.sessionName, exercises: w.snapshot.items || [] }
          : session,
        workouts: [],
      })
    }
    groups[indexBySession.get(key)].workouts.push(w)
  }
  return groups
}

export function groupSetsByExercise(sets, session) {
  const list = sets || []
  const sessionItems = []
  const seen = new Set()
  for (const item of session?.exercises || []) {
    const key = item.sessionItemId || item.id || item.exerciseId
    if (item.exerciseId && !seen.has(key)) {
      seen.add(key)
      sessionItems.push({ key, exerciseId: item.exerciseId })
    }
  }
  const extra = []
  for (const s of list) {
    const key = s.sessionItemId || s.exerciseId
    if (s.exerciseId && !seen.has(key)) {
      seen.add(key)
      extra.push({ key, exerciseId: s.exerciseId })
    }
  }
  return [...sessionItems, ...extra].map(({ key, exerciseId }) => ({
    sessionItemId: key,
    exerciseId,
    items: list
      .map((s, index) => ({ s, index }))
      .filter((x) => (x.s.sessionItemId || x.s.exerciseId) === key),
  }))
}

export function sessionsUsingExercise(programs, exerciseId) {
  const out = []
  for (const program of programs || []) {
    for (const session of program.sessions || []) {
      if ((session.exercises || []).some((item) => item.exerciseId === exerciseId)) {
        out.push({ program, session })
      }
    }
  }
  return out
}

export function exercisesInHistory(workouts, exercises, programs) {
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
      sessions: sessionsUsingExercise(programs, id),
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
