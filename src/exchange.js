import { EXERCISE_TYPES, ROUTINE_ROLES, WEEKDAYS } from './ids.js'
import { migrateState } from './model.js'
import { withDefaultAnchor } from './schedule.js'
import { emptyState } from './storage.js'

export const BACKUP_KIND = 'workout-mvp-backup'
export const BACKUP_VERSION = 1

export const ASSISTANT = {
  prompt: [
    'You are a training partner for this workout app. The user exported their full database so you can see everything: the exercise library, reusable routines (sets, reps, kg, rest, notes), the weekly calendar, and completed history.',
    '',
    'Do not jump straight to a new JSON file. Talk to the user first. Ask a few questions before changing data, for example:',
    '- What is the goal for the coming weeks (gain muscle, stay lean, get stronger, recover, time-crunched, etc.)?',
    '- What felt good or bad in recent workouts? Any pain, missed workouts, or equipment limits?',
    '- Do they want small tweaks, new routines added to the calendar, or a full schedule rewrite?',
    '',
    'Then recommend concrete changes. You may:',
    '- Edit existing routines (swap exercises, change sets/reps/kg/rest, add or remove a WU set).',
    '- Create new routines and put them on weekdays.',
    '- Add new exercises to the library when a routine needs a movement that is not there yet.',
    '- Change the whole weekly schedule, or only append a routine to a day.',
    '- Leave history alone unless the user explicitly asks to correct a logged workout.',
    '',
    'When you and the user agree, return the updated database as a workout-mvp-backup JSON (see import). No markdown fences. No commentary wrapped around the JSON.',
  ].join('\n'),
  howTheAppWorks: {
    summary:
      'Browser-only gym log. Exercises are the library. Routines are reusable templates with the full prescription (state.routines). Schedule is only the calendar. A live workout is a snapshot of a routine at Start. History is finished snapshots. Extra sets stay on today only until Finish; then skipped unlogged planned sets are recorded, and completed history writes next kg/reps onto the routine.',
    exercises:
      'Library of movements. type is machine | free | bodyweight | cardio. weightStep is a kg step, Alt 4/5, or n/a. Routines point at exercises by exerciseId.',
    routines:
      'Reusable templates. Ordered list of routine exercises. This is the source of truth for next time. Schedule does not store kg or reps. JSON field is state.routines.',
    routineExercise: {
      id: 'Stable routine-item id. Keep existing ids when editing a known row.',
      exerciseId: 'Must exist on state.exercises.',
      role:
        'warmup = WU routine: this whole exercise warms up the routine (e.g. rowing). main | finisher | cardio for the rest.',
      warmup:
        'null, or { reps: 12 } for a WU set: an easy set before working weight on that same exercise. Not the same as role warmup.',
      sets: 'Number of working sets (not counting the WU set).',
      targets: 'Reps or duration per working set, e.g. ["12","10","8"] or ["5-8 min"].',
      suggestedWeights: 'Kg per working set. Empty for bodyweight/cardio.',
      restSec: 'Seconds between working sets.',
      notes: 'Free text cues.',
    },
    schedule:
      'loopWeeks 1–4. anchor is the YYYY-MM-DD Monday of loop week 1 (keep it when editing; if absent, the app sets it to the Monday of the import week). slots: { id, week, weekday, routineId }. weekday 0=Sunday … 6=Saturday. week is 0-based inside the loop. A day can have several routines. Keep slot ids when the same day/routine should stay linked to history.',
    workout:
      'Starting copies the routine into snapshot. Logging writes sets. Extra sets live on the live snapshot only. Finish records unlogged planned sets as skipped, and stores the snapshot in workouts. Finish never changes the routine; only an explicit History recalculation writes suggestedWeights/targets onto it. Do not invent completed workouts.',
    ids: 'Reuse existing ids. New ones: ex-…, rtn-…, si-…, slot-…, wo-… Existing routine ids may still be sess-….',
  },
  import: {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    instructions: [
      'Return one JSON object of kind workout-mvp-backup, version 1.',
      'Put the complete updated database in state. The app replaces everything on import.',
      'You may omit the assistant field on the file you return.',
      'Keep state.workouts unless the user asked to change history.',
      'state.routines must include every routine still in use, including ones you did not edit.',
      'state.schedule.slots must only reference routine ids that exist.',
      'Do not wrap the JSON in markdown.',
    ].join('\n'),
    stateShape: {
      exercises: [
        {
          id: 'ex-chest-press',
          name: 'Chest Press',
          equipment: 'Chest Press (Star Trac)',
          type: 'machine',
          weightStep: '5',
          muscles: 'Chest, Triceps, Front Delts',
          cues: 'string',
          archivedAt: null,
        },
      ],
      routines: [
        {
          id: 'sess-upper',
          name: 'Upper Body',
          focus: 'Machines | Free weights | Bodyweight | Cardio | Mobility | Mixed',
          archivedAt: null,
          exercises: [
            {
              id: 'si-sess-upper-0-ex-rowing',
              exerciseId: 'ex-rowing',
              role: 'warmup',
              restSec: 0,
              notes: 'Routine warm-up',
              warmup: null,
              sets: 1,
              targets: ['5-8 min'],
              suggestedWeights: [],
            },
            {
              id: 'si-sess-upper-1-ex-chest-press',
              exerciseId: 'ex-chest-press',
              role: 'main',
              restSec: 90,
              notes: '',
              warmup: { reps: 12 },
              sets: 3,
              targets: ['12', '10', '8'],
              suggestedWeights: [25, 30, 30],
            },
          ],
        },
      ],
      schedule: {
        loopWeeks: 1,
        anchor: '2026-08-24',
        slots: [{ id: 'slot-sess-upper', week: 0, weekday: 1, routineId: 'sess-upper' }],
      },
      workouts: 'Keep the existing array unless asked to edit history.',
      plannedWorkouts: [],
      draftWorkouts: [],
      activeWorkout: null,
    },
    enums: {
      weekdays: WEEKDAYS,
      exerciseTypes: EXERCISE_TYPES,
      routineRoles: ROUTINE_ROLES,
    },
  },
}

function dataOnly(state) {
  return Object.fromEntries(Object.entries(state || {}).filter(([, value]) => typeof value !== 'function'))
}

export function buildBackup(state, { includeAssistant = false } = {}) {
  const pack = {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    state: structuredClone(dataOnly(state)),
  }
  if (includeAssistant) pack.assistant = structuredClone(ASSISTANT)
  return pack
}

// req-39 (F-RISK-4) — a backup may legitimately OMIT any collection (migrateState
// defaults them), but a field that is PRESENT must be an array. Otherwise
// migrateState's `.map()` throws a raw "map is not a function" TypeError instead of
// the friendly reject below. Validated here, at the import boundary, and NEVER by
// array-guarding migrateState: the load path relies on migrateState throwing on a
// corrupt value so req-36/DEC-032's corrupt-v8 guard fires instead of silently
// overwriting it.
const COLLECTION_FIELDS = [
  'exercises',
  'routines',
  'sessions',
  'programs',
  'workouts',
  'plannedWorkouts',
  'draftWorkouts',
]

// req-115 (audit D) — the req-39 array check, deepened: every element of every
// collection must be a plain object, and every nested collection an array. A `[null]`
// element either throws inside migrateState or passes it and crashes a later render,
// so it is rejected here, at the import boundary, with the same friendly message.
// migrateState itself stays unguarded (see req-39 above).
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// Absent (undefined) is fine — migrateState defaults it; present must be an array of
// plain objects, each also passing `each` (its nested checks) when one is given.
// Used strict for top-level collections (req-39: a present `exercises: null` was
// already a reject on main).
function arrayOfObjects(value, each) {
  if (value === undefined) return true
  if (!Array.isArray(value)) return false
  return value.every((element) => isPlainObject(element) && (!each || each(element)))
}

// Nested collections: migrateState reads them as `x || []`, so `null` is absent too
// (hand/AI-edited backups write `sets: null`). Elements are still plain objects only.
function nestedArrayOfObjects(value, each) {
  return value === null || arrayOfObjects(value, each)
}

// A falsy snapshot is absent to migrateState (`if (workout.snapshot)`); a truthy one
// must be an object whose items are an array of objects (or null/absent).
function snapshotValid(snapshot) {
  if (!snapshot) return true
  return isPlainObject(snapshot) && nestedArrayOfObjects(snapshot.items)
}

function workoutValid(workout) {
  return nestedArrayOfObjects(workout.sets) && snapshotValid(workout.snapshot)
}

function routineValid(routine) {
  return nestedArrayOfObjects(routine.exercises)
}

const NESTED_CHECKS = {
  exercises: null,
  routines: routineValid,
  workouts: workoutValid,
  draftWorkouts: workoutValid,
  plannedWorkouts: (plan) => nestedArrayOfObjects(plan.items),
}

function collectionsAreValid(root) {
  // Top-level: present must be an array (req-39), for every collection field.
  for (const field of COLLECTION_FIELDS) {
    if (root[field] !== undefined && !Array.isArray(root[field])) return false
  }
  for (const field of Object.keys(NESTED_CHECKS)) {
    if (!arrayOfObjects(root[field], NESTED_CHECKS[field])) return false
  }
  // `programs[]` and their `sessions[]` elements are always read (model.js
  // programLabelFrom walks `(program.sessions || []).some(routine => routine.id …)`),
  // so those elements must be objects; `program.sessions: null` is absent.
  if (!arrayOfObjects(root.programs, (program) => nestedArrayOfObjects(program.sessions))) return false
  // Legacy routine CONTENTS are checked only where model.js flattenRoutines migrates
  // them: `routines` when non-empty, else `sessions` when non-empty, else
  // `programs[].sessions`. An unread legacy field (e.g. `sessions: [null]` next to a
  // non-empty `routines`) is dropped by migrateState and can't crash.
  if (!root.routines?.length) {
    if (root.sessions?.length) {
      if (!arrayOfObjects(root.sessions, routineValid)) return false
    } else if (!arrayOfObjects(root.programs, (program) => nestedArrayOfObjects(program.sessions, routineValid))) {
      return false
    }
  }
  // `?.` keeps a non-object/absent schedule safe; only a present `slots` (the
  // migrateState `.map` site) is checked.
  if (!arrayOfObjects(root.schedule?.slots)) return false
  // Falsy is "no active workout" to migrateState (`source.activeWorkout ? … : null`).
  const active = root.activeWorkout
  if (active && !(isPlainObject(active) && workoutValid(active))) return false
  return true
}

export function unwrapBackup(payload) {
  if (!payload || typeof payload !== 'object') return null
  if (payload.kind === BACKUP_KIND) {
    if (!isPlainObject(payload.state)) return null
    return collectionsAreValid(payload.state) ? payload : null
  }
  if (
    Array.isArray(payload.exercises) &&
    (Array.isArray(payload.routines) || Array.isArray(payload.sessions) || Array.isArray(payload.programs))
  ) {
    return collectionsAreValid(payload) ? payload : null
  }
  return null
}

export function applyBackup(payload) {
  const doc = unwrapBackup(payload)
  if (!doc) {
    throw new Error('Not a workout database backup.')
  }
  const raw = doc.kind === BACKUP_KIND ? doc.state : doc
  if (doc.kind === BACKUP_KIND && Number(doc.version) !== BACKUP_VERSION) {
    throw new Error('Not a workout-mvp-backup v1 document.')
  }
  const migrated = migrateState({ ...emptyState(), ...raw })
  // req-114 (audit G) — the imported schedule replaces the default one wholesale, so
  // an anchor-less file would anchor every week on the queried date (always week 0).
  // Default it to this Monday, like a new schedule; the import's save persists it.
  const state = { ...migrated, schedule: withDefaultAnchor(migrated.schedule) }
  return {
    state,
    summary: {
      routines: (state.routines || []).length,
      exercises: (state.exercises || []).length,
      workouts: (state.workouts || []).length,
      slots: (state.schedule?.slots || []).length,
    },
  }
}

// req-115 (audit D) — the one import step, pure so it is unit-tested. applyBackup runs
// to completion BEFORE setState is called: on a bad file it throws to the caller
// (Settings/Today's existing error path) and setState is never called, so state is
// unchanged. store.applyBackup used to run it INSIDE the setState updater, where React
// swallowed the throw and re-threw it during render, above every ErrorBoundary.
export function commitBackup(payload, setState) {
  const result = applyBackup(payload)
  setState(() => result.state)
  return result
}
