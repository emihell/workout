// req-130 / DEC-060 — our own exercise library: a pinned copy of free-exercise-db
// (Unlicense) with our extras, our own entries and our added fields folded in.
// Provenance: src/library/PROVENANCE.md.
//
// src/library/exercises.json is GENERATED from the pinned source by
// scripts/build-library.mjs using deriveLibrary() below — never hand-edit it; change
// the tables here and re-run the script (exerciseLibrary.test.js fails on drift).
//
// Nothing from RepDB goes in the library, links included: RepDB stays a live,
// unmodified fetch in exerciseCatalog.js.
//
// Ids are stored data (exercise.libraryId) and permanent: free-db ids unchanged,
// `extra-*` for the extras, `own-*` for entries of ours. Never rename or reuse one.

import { EXTRA_EXERCISES } from './exerciseExtras.js'

// Name key used for dedupe, aliases and the resolver (re-exported by exerciseCatalog.js).
export function catalogNameKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/push[\s-]*ups?/g, 'pushup')
    .replace(/[^a-z0-9]+/g, '')
}

export const FREE_DB_COMMIT = 'a859101d633a01c4a1a920d6a8ce41dabba0705f'
// sha256 of the pinned dist/exercises.json (JSON.stringify(list, null, 2) + '\n'
// reproduces it byte for byte).
export const FREE_DB_SHA256 = '5bb747e3fc658f095a60dcbf6d53c96627acdcc6ffb6fffde86f7e26995d40bf'
export const FREE_DB_SOURCE_URL = `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${FREE_DB_COMMIT}/dist/exercises.json`
export const FREE_DB_PHOTO_BASE = `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${FREE_DB_COMMIT}/exercises/`

// The fields we add to a free-db entry (stripped again to prove the rest is unchanged).
export const OWN_FIELDS = ['aliases', 'muscleGroups', 'photos']

// primaryMuscles → coarse group. Every primary muscle in the library must be here.
// rhomboids / rear delts come from the extras (unconfirmed, req-130 spec).
export const MUSCLE_GROUPS = {
  Chest: ['chest'],
  Back: ['lats', 'middle back', 'lower back', 'traps', 'rhomboids'],
  Shoulders: ['shoulders', 'neck', 'rear delts'],
  Arms: ['biceps', 'triceps', 'forearms'],
  Legs: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'abductors', 'adductors'],
  Core: ['abdominals'],
}

const GROUP_OF = new Map(
  Object.entries(MUSCLE_GROUPS).flatMap(([group, muscles]) => muscles.map((m) => [m, group])),
)

// Groups in table order; throws on a muscle the table doesn't cover.
export function muscleGroupsFor(primaryMuscles) {
  const found = new Set()
  for (const muscle of primaryMuscles || []) {
    const group = GROUP_OF.get(muscle)
    if (!group) throw new Error(`No muscle group for primary muscle "${muscle}".`)
    found.add(group)
  }
  return Object.keys(MUSCLE_GROUPS).filter((group) => found.has(group))
}

// The 22 seed names (src/db.json), verbatim, on the entry each resolves to
// (table confirmed by Emilio 2026-09-24). Library-wide aliases are req-133.
export const SEED_ALIASES = {
  'Rowing_Stationary': ['Rowing'],
  'Leverage_Chest_Press': ['Chest Press'],
  'Wide-Grip_Lat_Pulldown': ['Lat Pulldown'],
  'Machine_Shoulder_Military_Press': ['Shoulder Press'],
  'Machine_Bicep_Curl': ['Biceps Curl'],
  'Dip_Machine': ['Triceps Press'],
  'Ab_Crunch_Machine': ['Ab Machine'],
  'Plank': ['Plank'],
  'Pushups': ['Push-Ups'],
  'Stairmaster': ['Stairs'],
  'Leg_Press': ['Leg Press'],
  'Leg_Extensions': ['Leg Extension'],
  'Seated_Leg_Curl': ['Leg Curl'],
  'Thigh_Abductor': ['Abduction'],
  'Thigh_Adductor': ['Adduction'],
  'Calf_Press_On_The_Leg_Press_Machine': ['Calf Raises (Leg Press)'],
  'Incline_Dumbbell_Press': ['Incline DB Press'],
  'One-Arm_Dumbbell_Row': ['One-Arm DB Row'],
  'Dumbbell_Shoulder_Press': ['Overhead DB Press'],
  'Pullups': ['Pull-Ups (BW)'],
  'Dips_-_Triceps_Version': ['Dips (BW)'],
  'own-hanging-knee-raise': ['Hanging Knee Raises'],
}

// Entries of ours, shaped like free-db entries. Text written by us.
export const OWN_EXERCISES = [
  {
    name: 'Hanging Knee Raise',
    force: 'pull',
    level: 'beginner',
    mechanic: 'isolation',
    equipment: 'body only',
    primaryMuscles: ['abdominals'],
    secondaryMuscles: [],
    instructions: [
      'Hang from a pull-up bar with an overhand grip about shoulder-width apart, arms straight and legs hanging down. This is the starting position.',
      'Brace your abs and bend your knees, drawing them up toward your chest until your thighs are at least level with the floor. Breathe out as you lift.',
      'Pause for a moment at the top, then lower your legs slowly back to the start as you breathe in. Keep the movement controlled and avoid swinging.',
      'Repeat for the recommended number of repetitions.',
    ],
    category: 'strength',
    images: [],
    id: 'own-hanging-knee-raise',
  },
]

function withOwnFields(entry, { aliases = [], photos = [] }) {
  const out = { ...entry }
  for (const field of OWN_FIELDS) delete out[field]
  if (aliases.length) out.aliases = aliases
  out.muscleGroups = muscleGroupsFor(entry.primaryMuscles)
  out.photos = photos
  return out
}

// The pinned free-db list → our library: free-db entries (order and fields unchanged,
// our fields appended), then the extras, then our own entries.
export function deriveLibrary(freeDb) {
  const list = [
    ...freeDb.map((entry) =>
      withOwnFields(entry, {
        aliases: SEED_ALIASES[entry.id] || [],
        photos: (entry.images || []).map((path) => FREE_DB_PHOTO_BASE + path),
      }),
    ),
    ...EXTRA_EXERCISES.map((entry) => withOwnFields(entry, { aliases: entry.aliases || [] })),
    ...OWN_EXERCISES.map((entry) => withOwnFields(entry, { aliases: SEED_ALIASES[entry.id] || [] })),
  ]
  const known = new Set(list.map((entry) => entry.id))
  for (const id of Object.keys(SEED_ALIASES)) {
    if (!known.has(id)) throw new Error(`Alias target "${id}" is not in the library.`)
  }
  return list
}

// Lazy chunk (~1 MB) so the main bundle doesn't carry it. The `with` attribute is
// required by node --test (ERR_IMPORT_ATTRIBUTE_MISSING without it).
let libraryPromise = null
export function loadExerciseLibrary() {
  if (!libraryPromise) {
    libraryPromise = import('./library/exercises.json', { with: { type: 'json' } })
      .then((mod) => mod.default)
      .catch((error) => {
        libraryPromise = null
        throw error
      })
  }
  return libraryPromise
}

const indexes = new WeakMap()
function indexFor(library) {
  let index = indexes.get(library)
  if (!index) {
    index = { byId: new Map(), byName: new Map(), byAlias: new Map() }
    for (const entry of library) {
      index.byId.set(entry.id, entry)
      const nameKey = catalogNameKey(entry.name)
      if (nameKey && !index.byName.has(nameKey)) index.byName.set(nameKey, entry)
      for (const alias of entry.aliases || []) {
        const aliasKey = catalogNameKey(alias)
        if (aliasKey && !index.byAlias.has(aliasKey)) index.byAlias.set(aliasKey, entry)
      }
    }
    indexes.set(library, index)
  }
  return index
}

// The library entry for a stored exercise: its libraryId when that's in the library,
// else the exact name key, else an alias key, else null. No fuzzy guess.
export function libraryEntryFor(exercise, library) {
  if (!exercise || !library) return null
  const index = indexFor(library)
  if (exercise.libraryId && index.byId.has(exercise.libraryId)) return index.byId.get(exercise.libraryId)
  const key = catalogNameKey(exercise.name)
  if (!key) return null
  return index.byName.get(key) || index.byAlias.get(key) || null
}
