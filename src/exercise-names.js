// req-127 / DEC-059 §3–4 — names for exercises and routines, pure so the rules are
// unit-tested (views can't be imported by node --test).
//
// A name is trimmed; an empty one blocks Save with an inline error. Matching is on the
// trimmed, case-insensitive name. A live (non-archived) match warns ("Use it" / "Create
// anyway"); with no live match, the most recently archived match is offered for Restore
// (same id, so its history and "last time" come back).

import { DEFAULT_DURATION_SEC } from './model.js'

export const NAME_REQUIRED = 'Name is required.'

export function normalName(name) {
  return String(name ?? '').trim().toLowerCase()
}

// The inline error for a name field, or null when it may be saved.
export function nameError(name) {
  return String(name ?? '').trim() ? null : NAME_REQUIRED
}

// { kind: 'live' | 'archived', exercise } for the exercise a new `name` collides with,
// or null. Precedence: any live match wins; otherwise the newest `archivedAt`.
export function exerciseNameMatch(exercises, name) {
  const key = normalName(name)
  if (!key) return null
  const same = (exercises || []).filter((ex) => normalName(ex.name) === key)
  const live = same.find((ex) => !ex.archivedAt)
  if (live) return { kind: 'live', exercise: live }
  const archived = same
    .filter((ex) => ex.archivedAt)
    .sort((a, b) => String(b.archivedAt).localeCompare(String(a.archivedAt)))
  return archived.length ? { kind: 'archived', exercise: archived[0] } : null
}

// req-127 — Start needs something to start: an empty routine would create an empty
// active workout (and could abandon a real one). The preview already hides it.
export function routineStartable(routine) {
  return (routine?.exercises || []).length > 0
}

// req-127 — the record store.addExercise appends (moved here unchanged so the "Create
// anyway" path — a NEW id — is testable next to Restore, which keeps the old one).
export function exerciseFromData(data, id) {
  return {
    id,
    name: data.name.trim(),
    equipment: (data.equipment || '').trim() || 'Unknown',
    weightStep: (data.weightStep || '').trim() || 'n/a',
    muscles: (data.muscles || '').trim(),
    cues: (data.cues || '').trim(),
    type: data.type || 'free',
    // req-85 — orthogonal timer flag + default target seconds.
    hasDuration: Boolean(data.hasDuration),
    durationSec: data.durationSec != null ? Number(data.durationSec) : DEFAULT_DURATION_SEC,
    // req-130 — the library entry it was added from; absent (never null/'') otherwise.
    ...(data.libraryId ? { libraryId: String(data.libraryId) } : {}),
  }
}

// req-127 — where picking an existing exercise (Use it / Restore) continues to: in a
// routine flow the add-to-routine screen for THAT id (Search's "Add to routine" path);
// in the library, its detail screen. `paths` is Exercises.jsx createPaths().
export function pickedExercisePath(paths, returnBase, exerciseId) {
  return returnBase ? paths.afterCreate(exerciseId) : `/exercises/${exerciseId}`
}
