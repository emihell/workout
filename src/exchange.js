import { EXERCISE_TYPES, ROUTINE_ROLES, WEEKDAYS } from './ids.js'
import { migrateState } from './model.js'
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
      'loopWeeks 1–4. slots: { id, week, weekday, routineId }. weekday 0=Sunday … 6=Saturday. week is 0-based inside the loop. A day can have several routines. Keep slot ids when the same day/routine should stay linked to history.',
    workout:
      'Starting copies the routine into snapshot. Logging writes sets. Extra sets live on the live snapshot only. Finish records unlogged planned sets as skipped, stores the snapshot in workouts, and ticks suggestedWeights/targets on the routine from completed (non-skipped) history. Do not invent completed workouts.',
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

export function unwrapBackup(payload) {
  if (!payload || typeof payload !== 'object') return null
  if (payload.kind === BACKUP_KIND) {
    return payload.state && typeof payload.state === 'object' ? payload : null
  }
  if (
    Array.isArray(payload.exercises) &&
    (Array.isArray(payload.routines) || Array.isArray(payload.sessions) || Array.isArray(payload.programs))
  ) {
    return payload
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
  const state = migrateState({ ...emptyState(), ...raw })
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
