import { SCHEMA_VERSION, findRoutineInState, migrateState } from './model.js'
import { dateKey, defaultSchedule } from './schedule.js'

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

// req-36 / DEC-032 — "the stored data is present but unreadable" signal, parallel
// to saveFailed above. When a corrupt-but-present `workout-mvp-v8` value can't be
// parsed/migrated (F-RISK-2), loadState latches this instead of silently returning
// emptyState. While it is set, saveState refuses to write, so the raw corrupt value
// stays on disk and recoverable — the app must never overwrite the one record it
// exists to protect. Surfaced by a distinct persistent banner (App.jsx). Absent /
// blank / valid loads clear it, so the flag reflects the *current* stored value.
let loadUnreadable = false
const loadUnreadableListeners = new Set()

function setLoadUnreadable(value) {
  if (loadUnreadable === value) return
  loadUnreadable = value
  for (const listener of loadUnreadableListeners) listener()
}

export function getLoadUnreadable() {
  return loadUnreadable
}

export function subscribeLoadUnreadable(listener) {
  loadUnreadableListeners.add(listener)
  return () => loadUnreadableListeners.delete(listener)
}

// req-41 / DEC-029 (audit F-RISK-3) — warn when *another same-origin tab* changed
// our data. Each tab holds its own in-memory state and saveState writes the whole
// key, so two open tabs are last-writer-wins: a stale tab can clobber another's
// finished workout with no warning. We can't reconcile without a backend, so this
// is warn-only (no merge, no hold-saves): surface the condition and let the user
// reload. Pure predicate for the one testable decision — "is this StorageEvent one
// that changed our persisted state?". A `null` key means localStorage.clear()
// (also a change); a matching key is our own key being (re)written or removed.
// The `storage` event fires only in the *other* tabs, never the writer, so the
// banner lands on the stale tab — exactly the one that needs it.
export function isExternalStateChange(event) {
  return event.key === STORAGE_KEY || event.key === null
}

// Signal trio mirroring saveFailed/loadUnreadable above, backed by a single window
// `storage` listener. Warn-only and one-way: once another tab changes the data the
// signal latches true until this tab reloads (a reload re-reads the latest on mount
// and mounts a fresh module, clearing it) — there is nothing to un-warn about while
// this tab still holds its stale snapshot. The window listener is registered lazily
// on first subscribe and removed on last unsubscribe; `typeof window` guards it so
// storage.js still imports under `node --test` (no window, listener never wired).
let externalChanged = false
const externalChangeListeners = new Set()
let storageEventHandler = null

function handleStorageEvent(event) {
  if (externalChanged) return
  if (!isExternalStateChange(event)) return
  externalChanged = true
  for (const listener of externalChangeListeners) listener()
}

export function getExternalChanged() {
  return externalChanged
}

export function subscribeExternalChange(listener) {
  externalChangeListeners.add(listener)
  if (typeof window !== 'undefined' && !storageEventHandler) {
    storageEventHandler = handleStorageEvent
    window.addEventListener('storage', storageEventHandler)
  }
  return () => {
    externalChangeListeners.delete(listener)
    if (externalChangeListeners.size === 0 && typeof window !== 'undefined' && storageEventHandler) {
      window.removeEventListener('storage', storageEventHandler)
      storageEventHandler = null
    }
  }
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
  // Reading the raw value is separated from parsing/migrating it (req-36) so we can
  // tell "no value" (blank device) apart from "value present but unreadable". Only
  // the second is the corrupt-key case that must NOT be overwritten.
  let current
  let raw
  try {
    current = localStorage.getItem(STORAGE_KEY)
    raw = current || LEGACY_KEYS.map((key) => localStorage.getItem(key)).find(Boolean)
  } catch {
    // localStorage itself is unreadable (access denied). Nothing legible to
    // preserve, so behave like a blank device rather than latching the signal.
    setLoadUnreadable(false)
    return emptyState()
  }

  // Absent or genuinely empty → blank device. Byte-for-byte the pre-req-36 path:
  // emptyState(), saves work normally, signal clear.
  if (!raw) {
    setLoadUnreadable(false)
    return emptyState()
  }

  // A value IS present. If parse or migrate throws it is corrupt-but-present: latch
  // the unreadable signal (which makes saveState refuse to write, DEC-032) and hand
  // back emptyState so the UI still renders — under the distinct banner. The raw
  // value stays on disk untouched and recoverable. A legacy-only key that won't
  // parse counts too (it is the only surviving copy).
  try {
    const parsed = JSON.parse(raw)
    const state = migrateState({ ...emptyState(), ...parsed })
    setLoadUnreadable(false)
    if (!current || Number(parsed.schemaVersion) !== SCHEMA_VERSION) {
      saveState(state)
    }
    // Only reached when this device had data (fresh migration, or already v8 with
    // a legacy copy left over from an interrupted cleanup). The read-back gate
    // decides whether any legacy key is actually removed.
    removeLegacyKeysIfV8Persisted()
    return state
  } catch {
    setLoadUnreadable(true)
    return emptyState()
  }
}

export function saveState(state) {
  // req-36 / DEC-032 — the stored value was unreadable; refuse to overwrite it so
  // the corrupt-but-possibly-recoverable key is preserved untouched. No setItem.
  if (getLoadUnreadable()) return false
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

// req-43 / DEC-031 (audit F-DIV-3) — the blast radius of deleting a routine, so the
// confirm can name it. removeRoutine (store.jsx) also drops every schedule slot and
// planned workout that references the routine, and archives-vs-deletes on whether
// finished history references it. These are pure reads that mirror the store's own
// reference tests exactly (routineId || sessionId) so the confirm counts match what
// the delete removes. The logic in the store is unchanged (DEC-031) — this is only
// how we describe it.
export function routineDeletionImpact(state, routineId) {
  const refersTo = (obj) => (obj.routineId || obj.sessionId) === routineId
  return {
    slots: (state?.schedule?.slots || []).filter(refersTo).length,
    plans: (state?.plannedWorkouts || []).filter(refersTo).length,
    hasHistory: (state?.workouts || []).some(refersTo),
  }
}

// req-43 / DEC-031 — the blast radius of deleting an exercise. removeExercise strips
// it from every routine (and planned-workout item) and archives-vs-deletes on
// finished history (a set with this exerciseId). Reuses routinesUsingExercise for
// the routine count; history mirrors the store's set.exerciseId test.
export function exerciseDeletionImpact(state, exerciseId) {
  return {
    routines: routinesUsingExercise(state?.routines, exerciseId).length,
    hasHistory: (state?.workouts || []).some((workout) =>
      (workout.sets || []).some((set) => set.exerciseId === exerciseId),
    ),
  }
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
