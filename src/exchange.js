import { EXERCISE_TYPES, ROUTINE_ROLES, WEEKDAYS } from './ids.js'
import { DISTANCE_UNITS } from './cardio-set.js'
import { SCHEMA_VERSION, migrateState } from './model.js'
import { withDefaultAnchor } from './schedule.js'
import { emptyState } from './persistence.js'

export const BACKUP_KIND = 'workout-mvp-backup'
export const BACKUP_VERSION = 1

// req-220 (DEC-121 §1, DEC-123) — every stored field the user's AI can meet in an export, with
// what it means. `undocumentedFields` (below) checks a state against this map, and
// exchange.test.js builds a full sample state through migrateState so a new stored field with
// no line here fails the gate. Entity → field → description. Keep it in step with
// handoff/reference/schema.md.
export const FIELDS = {
  state: {
    schemaVersion: 'Storage version (9). Keep as it is.',
    exercises: 'The exercise library (see exercise).',
    routines: 'Reusable plans; the app calls each one a "Workout" (see routine).',
    schedule: 'The calendar (see schedule).',
    workouts: 'Finished, logged workouts: the user\'s real history (see workout). Never invent or add one.',
    draftWorkouts: 'Legacy unfinished workouts from an old version. Keep as it is.',
    activeWorkout: 'The workout in progress on the device, or null. Keep as it is.',
    plannedWorkouts: 'Legacy, no longer read. Keep as it is (usually []).',
    legacyRecommendations: 'Legacy baselines for old data, keyed by routine-item id. Keep as it is.',
  },
  exercise: {
    id: 'Stable id (ex-…). Routines and history point at it.',
    name: 'Name shown in the app.',
    equipment: 'Machine or equipment name, e.g. "Chest Press (Star Trac)", "Barbell", "Bodyweight".',
    muscles: 'Comma-separated muscles, e.g. "Chest, Triceps".',
    cues: 'Free-text technique cues.',
    type: 'machine | free | bodyweight | cardio. machine and free carry kg; bodyweight progresses by reps; cardio logs time / level / distance.',
    weightStep:
      'How kg moves for this exercise: a number in kg (e.g. "2.5"), "Steps A/B" (two step sizes that alternate, A added first), "Alt 4/5" (legacy: 5 then 4, from 9 when no lightestWeight), or "n/a" (no known step: the app never suggests a kg change).',
    lightestWeight: 'Optional. The first weight of the stack in kg; suggested kg count up from it and never go below it.',
    weightOptions: 'Optional list of the exact kg values the equipment allows; when present it decides every suggested kg.',
    archivedAt: 'ISO time it was deleted while history still used it, else null. Archived exercises are hidden but kept for history.',
    hasDuration: 'true for a timed exercise (a plank, a hang): sets log seconds instead of reps.',
    durationSec: 'Default target seconds per set for a timed exercise.',
    libraryId: 'Optional. Id of the built-in library entry it was picked from. Keep it; omit it on exercises you create.',
  },
  routine: {
    id: 'Stable id (rtn-…, older ones sess-…). Keep it when editing.',
    name: 'Name shown in the app.',
    focus: 'Short label, e.g. "Machines", "Upper".',
    archivedAt: 'ISO time it was deleted while history still used it, else null.',
    exercises: 'The ordered routine items (see routineItem): the full prescription for next time.',
  },
  routineItem: {
    id: 'Stable routine-item id (si-…). Keep existing ids when editing a known row; history links to it.',
    exerciseId: 'Must exist in state.exercises.',
    role: 'warmup (a warm-up exercise, e.g. 5 min bike), main, finisher, or cardio.',
    sets: 'Number of working sets (not counting a warm-up set).',
    targets: 'Reps (or a duration text for cardio) per working set, e.g. ["12","10","8"] or ["5-8 min"]. A range or text target holds: the app never moves its kg.',
    suggestedWeights: 'Kg per working set: the workout starts each set at this kg. [] for bodyweight/cardio. Change it to progress.',
    durations: 'Target seconds per working set for a timed exercise, else [].',
    restSec: 'Seconds of rest between working sets.',
    notes: 'Free-text cues for this routine.',
    warmup: '{ reps } for one easy set at lighter kg before the working sets of the same exercise, or null. Keep existing ones; null on new items.',
  },
  schedule: {
    loopWeeks: 'Length of the repeating loop in weeks, 1–4.',
    anchor: 'YYYY-MM-DD Monday of loop week 1. Keep it when editing; if absent the app sets it to the Monday of the import week.',
    slots: 'Calendar entries (see scheduleSlot). A day can hold several routines.',
    moves: 'One-date moves (see scheduleMove). Keep them; drop any whose slot you remove.',
  },
  scheduleSlot: {
    id: 'Stable slot id (slot-…). Keep it when the same day/routine stays; history links to it.',
    week: '0-based week inside the loop.',
    weekday: '0=Sunday … 6=Saturday.',
    routineId: 'Must exist in state.routines.',
  },
  scheduleMove: {
    id: 'Stable move id.',
    slotId: 'The slot moved; must exist in schedule.slots.',
    from: 'YYYY-MM-DD the slot normally falls on.',
    to: 'YYYY-MM-DD it is on instead, for that one date only (same Monday–Sunday week).',
  },
  workout: {
    id: 'Stable id (wo-…).',
    routineId: 'The routine it was started from (it may since be archived or deleted).',
    occurrenceId: 'Which calendar occurrence it was, e.g. "slot-…@2026-09-01", or null.',
    scheduleSlotId: 'The schedule slot it was started from, or null.',
    scheduledFor: 'YYYY-MM-DD it was scheduled for, or null.',
    performedOn: 'YYYY-MM-DD it was done.',
    startedAt: 'ISO time started.',
    finishedAt: 'ISO time finished (null only on activeWorkout).',
    overallNote: 'The user\'s note for the whole workout.',
    overallFeel: 'The user\'s overall feel picked at Finish, or "".',
    completedItemIds: 'Snapshot item ids marked done.',
    restEndsAt: 'Live rest timer; null once finished.',
    restPausedRemaining: 'Live rest timer; null once finished.',
    schemaVersion: 'Storage version the record was migrated to.',
    progression: 'Legacy, on old workouts only; not read.',
    snapshot: 'The routine as it was at Start (see snapshot): what was planned that day.',
    sets: 'Every logged set, in order (see set).',
    seedOverrides: 'activeWorkout only: live kg carried between sets; dropped at Finish.',
    setDraft: 'activeWorkout only: what is typed into the open set; dropped at Finish.',
    autoFinishDismissed: 'activeWorkout only: the user dismissed the auto-finish offer; dropped at Finish.',
    stopwatch: 'activeWorkout only: a running cardio stopwatch; dropped at Finish and on import.',
    firstTimeSetup: 'activeWorkout only: first-time setup answers, keyed by exercise id (see firstTimeSetup); dropped at Finish.',
  },
  snapshot: {
    routineId: 'The routine started.',
    routineName: 'Its name at Start.',
    focus: 'Its focus at Start.',
    programId: 'Legacy program id on old workouts.',
    programName: 'Legacy program name on old workouts.',
    items: 'The planned items (see snapshotItem).',
  },
  snapshotItem: {
    id: 'Item id in this workout.',
    routineItemId: 'The routine item it came from; sets point at it.',
    exerciseId: 'The exercise.',
    exerciseName: 'Exercise name at Start.',
    equipment: 'Equipment at Start.',
    exerciseType: 'Exercise type at Start.',
    hasDuration: 'Timed at Start.',
    weightStep: 'Weight step at Start.',
    role: 'Role at Start.',
    sets: 'Planned working sets (Add set raises it).',
    targets: 'Planned reps per working set.',
    suggestedWeights: 'Planned kg per working set.',
    durations: 'Planned seconds per working set (timed).',
    restSec: 'Planned rest.',
    notes: 'Routine notes at Start.',
    warmup: 'Planned warm-up set, or null.',
    addedSets: 'How many sets Add set added during this workout.',
    addedMidWorkout: 'true on an exercise swapped in or added during the workout (not in the routine).',
    replacesItemId: 'On a swapped-in exercise: the item it replaced.',
    calibrationRequired: 'true when the routine had no kg for a weighted exercise (start light and adjust).',
    recommendationReason: 'Why the plan has the kg it has, e.g. "From the routine.".',
  },
  set: {
    exerciseId: 'The exercise.',
    routineItemId: 'The snapshot item (routine item) it belongs to.',
    setType: 'work (a working set) or wu (the warm-up set).',
    weight: 'Kg lifted (0 for bodyweight; one dumbbell for dumbbell work).',
    reps: 'Reps done as text, e.g. "10", or "skipped" for a set not done.',
    rpe:
      'Effort, set once per exercise (the same value on every logged working set of that exercise): 2 Easy, 3 Medium, 4 Hard; 5 Failure on older sets; null when not picked, on warm-ups and cardio.',
    note: 'Free-text note ("skipped" on skipped sets).',
    targetReps: 'The planned reps for this set at the time.',
    targetWeight: 'The planned kg for this set at the time, or null.',
    durationSec: 'Seconds done, on a timed or cardio set.',
    level: 'Cardio: machine level, only when entered.',
    distance: 'Cardio: distance, only when entered.',
    distanceUnit: 'Cardio: m or km, with distance.',
    loggedAt: 'ISO time the set was logged (absent on older sets and on sets Finish recorded as skipped).',
  },
  // Nested values (review round 1): each described the same way.
  warmup: {
    reps: 'Reps of the one easy warm-up set before the working sets.',
  },
  legacyRecommendation: {
    sets: 'Legacy baseline: working sets.',
    targets: 'Legacy baseline: reps per set.',
    suggestedWeights: 'Legacy baseline: kg per set.',
  },
  seedOverride: {
    weight: 'activeWorkout only: the kg the user changed to this session, carried to the next sets of that exercise.',
    reps: 'activeWorkout only: reps carried the same way (older sessions).',
  },
  setDraft: {
    key: 'activeWorkout only: which set the draft is for.',
    weight: 'Typed kg (text).',
    reps: 'Typed reps (text).',
    effort: 'Picked effort, or "".',
    durationSec: 'Typed seconds (timed).',
    cardio: 'Typed cardio values (see setDraftCardio).',
    note: 'Typed note.',
  },
  setDraftCardio: {
    durationSec: 'Typed duration in seconds, or null.',
    level: 'Typed level, or null.',
    distance: 'Typed distance, or null.',
    distanceUnit: 'm or km, or null.',
  },
  stopwatch: {
    draftKey: 'activeWorkout only: the set the cardio stopwatch runs for.',
    startedAt: 'When it started (ms since 1970).',
    baseSec: 'Seconds already on it when started.',
  },
  firstTimeSetup: {
    mode: 'activeWorkout only, keyed by exercise id: "setup" (guided first-time setup) or "manual".',
    itemKey: 'The workout item the prompt was answered on.',
    answered: 'How set 1 felt: easy | medium | hard | skip. Never stored on a set.',
    seed: 'The suggested set 2 it produced (see firstTimeSetupSeed).',
  },
  firstTimeSetupSeed: {
    itemKey: 'The workout item.',
    workIndex: 'Which working set it prefills (1 = set 2).',
    weight: 'Suggested kg for set 2 (text).',
    reps: 'Suggested reps for set 2 (bodyweight, text).',
    reason: 'Why, shown to the user.',
    overrideWeight: 'The session kg override when the suggestion was made.',
  },
}

export const ASSISTANT = {
  prompt: [
    'You are a training partner for this workout app. The user exported their full database so you can see everything: the exercise library, reusable routines (sets, reps, kg, rest, notes), the weekly calendar, and completed history.',
    '',
    'Do not jump straight to a new JSON file. Talk to the user first. Ask a few questions before changing data, for example:',
    '- What is the goal for the coming weeks (gain muscle, stay lean, get stronger, recover, time-crunched, etc.)?',
    '- What felt good or bad in recent workouts? Any pain, missed workouts, or equipment limits?',
    '- Do they want small tweaks, new routines added to the calendar, or a full schedule rewrite?',
    '',
    'Read their history before suggesting numbers (see howTheAppWorks.history): effort per exercise, missed reps, and when sets were logged.',
    '',
    'Then recommend concrete changes. You may:',
    '- Edit existing routines (swap exercises, change sets/reps/kg/rest). To progress someone, change the routine\'s suggestedWeights and targets.',
    '- Create new routines and put them on weekdays.',
    '- Add new exercises to the library when a routine needs a movement that is not there yet.',
    '- Change the whole weekly schedule, or only append a routine to a day.',
    '',
    'Never invent completed workouts or sets. state.workouts is what the user really did: return it exactly as it is, unless the user explicitly asks to correct a logged workout.',
    '',
    'When you and the user agree, return the updated database as a workout-mvp-backup JSON (see import). No markdown fences. No commentary wrapped around the JSON.',
  ].join('\n'),
  howTheAppWorks: {
    summary:
      'Browser-only gym log. Exercises are the library. Routines are reusable templates with the full prescription (state.routines). Schedule is only the calendar. A live workout is a snapshot of a routine at Start. History is finished snapshots plus their logged sets. Extra sets stay on today only until Finish; then skipped unlogged planned sets are recorded. Each working set starts at the routine kg (suggestedWeights) next time. In the app\'s screens a routine is called a "Workout" (the plan), and a logged workout is shown as a session, by its name and date; the JSON keeps routines and workouts.',
    exercises:
      'Library of movements. type is machine | free | bodyweight | cardio. weightStep is a kg step, Steps A/B (two step sizes that alternate, A added first), Alt 4/5 (legacy: 5 then 4, from 9 when no lightestWeight), or n/a. lightestWeight (optional, kg) is the first weight of the stack; suggestions count from it. hasDuration marks a timed exercise (sets log seconds; durationSec is its default). libraryId links a built-in library entry: keep it. Routines point at exercises by exerciseId.',
    routines:
      'Reusable templates. Ordered list of routine exercises. This is the source of truth for next time. Schedule does not store kg or reps. JSON field is state.routines.',
    routineExercise: {
      id: 'Stable routine-item id. Keep existing ids when editing a known row.',
      exerciseId: 'Must exist on state.exercises.',
      role:
        'warmup for a warm-up exercise (e.g. 5 min bike), otherwise main; keep finisher/cardio where they already exist.',
      warmup:
        'Keep an existing { reps } as it is; null on new items. (An easy set before working weight on that same exercise; not the same as role warmup.)',
      sets: 'Number of working sets (not counting a warm-up set).',
      targets: 'Reps or duration per working set, e.g. ["12","10","8"] or ["5-8 min"].',
      suggestedWeights: 'Kg per working set; the workout starts each set at this kg. Empty for bodyweight/cardio.',
      durations: 'Target seconds per working set for a timed exercise (hasDuration), else [].',
      restSec: 'Seconds between working sets.',
      notes: 'Free text cues.',
    },
    schedule:
      'loopWeeks 1–4. anchor is the YYYY-MM-DD Monday of loop week 1 (keep it when editing; if absent, the app sets it to the Monday of the import week). slots: { id, week, weekday, routineId }. weekday 0=Sunday … 6=Saturday. week is 0-based inside the loop. A day can have several routines. Keep slot ids when the same day/routine should stay linked to history. moves (optional): one-date moves { id, slotId, from, to } (YYYY-MM-DD, same Mon–Sun week) — that slot is on to instead of from for that one date only; keep them, and drop any whose slot you remove.',
    workout:
      'Starting copies the routine into snapshot. Logging writes sets. Extra sets live on the live snapshot only. Finish records unlogged planned sets as skipped, and stores the snapshot in workouts. Finish never changes the routine; it changes only when the user edits it, confirms the "Use … kg next time?" offer after an exercise (the kg of that one routine), or applies a History recalculation (suggestedWeights/targets). Do not invent completed workouts.',
    sets:
      'A logged set: { exerciseId, routineItemId, setType (work | wu), weight (kg), reps (text, or "skipped"), rpe, note, targetReps, targetWeight, loggedAt }. A timed set adds durationSec. A cardio set adds durationSec, level, distance and distanceUnit (m | km), each only when the user entered it. Every field is described in fields.set.',
    history:
      'How to read history for progression. Effort (rpe) is picked once per exercise after its last set and written on every logged working set of it: 2 Easy, 3 Medium, 4 Hard (5 Failure on older sets; null = not picked). Missed reps = reps done below the set\'s target. The app\'s own rule (progress.js): missed reps or effort 5 → one weight step down; effort 2 or less with no missed reps → one weight step up; otherwise keep (Hard = 4 keeps). Bodyweight exercises move reps by one instead of kg; cardio, timed, range or text targets hold. A step is the exercise\'s weightStep (or weightOptions) from lightestWeight; with weightStep n/a there is no step, so keep the kg. loggedAt tells when each set was done (spacing, how long ago); performedOn is the day. To progress, write the new kg into the routine item\'s suggestedWeights (and reps into targets) — never into history.',
    ids: 'Reuse existing ids. New ones: ex-…, rtn-…, si-…, slot-…, wo-… Existing routine ids may still be sess-….',
  },
  fields: FIELDS,
  import: {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    instructions: [
      'Return one JSON object of kind workout-mvp-backup, version 1.',
      'Put the complete updated database in state. Before anything changes, the app shows the user what the file changes (workouts, exercises, schedule, logged history).',
      'You may omit the assistant field on the file you return.',
      'Return state.workouts exactly as exported unless the user asked to change history. If logged history differs, the app asks the user whether to keep their own history (the default) or replace it.',
      'Never add workouts or sets the user did not do.',
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
          lightestWeight: 10,
          muscles: 'Chest, Triceps, Front Delts',
          cues: 'string',
          hasDuration: false,
          durationSec: 30,
          libraryId: 'Leverage_Chest_Press',
          archivedAt: null,
        },
      ],
      routines: [
        {
          id: 'sess-upper',
          name: 'Upper Body',
          focus: 'Machines',
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
              durations: [],
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
              durations: [],
            },
          ],
        },
      ],
      schedule: {
        loopWeeks: 1,
        anchor: '2026-08-24',
        slots: [{ id: 'slot-sess-upper', week: 0, weekday: 1, routineId: 'sess-upper' }],
        moves: [{ id: 'mv-1', slotId: 'slot-sess-upper', from: '2026-08-31', to: '2026-09-02' }],
      },
      workouts: 'Keep the existing array exactly as exported unless asked to edit history.',
      plannedWorkouts: [],
      draftWorkouts: [],
      activeWorkout: null,
    },
    // Two logged sets as they appear in state.workouts[].sets (a working set, a cardio set).
    sampleSets: [
      {
        exerciseId: 'ex-chest-press',
        routineItemId: 'si-sess-upper-1-ex-chest-press',
        setType: 'work',
        weight: 30,
        reps: '10',
        rpe: 3,
        note: '',
        targetReps: '10',
        targetWeight: 30,
        loggedAt: '2026-09-01T17:05:00.000Z',
      },
      {
        exerciseId: 'ex-rowing',
        routineItemId: 'si-sess-upper-0-ex-rowing',
        setType: 'work',
        weight: 0,
        reps: '',
        rpe: null,
        note: '',
        targetReps: '5-8 min',
        targetWeight: null,
        durationSec: 360,
        level: 8,
        distance: 1.2,
        distanceUnit: 'km',
        loggedAt: '2026-09-01T16:55:00.000Z',
      },
    ],
    enums: {
      weekdays: WEEKDAYS,
      exerciseTypes: EXERCISE_TYPES,
      routineRoles: ROUTINE_ROLES,
      effort: [
        { value: 2, label: 'Easy' },
        { value: 3, label: 'Medium' },
        { value: 4, label: 'Hard' },
        { value: 5, label: 'Failure (older sets only)' },
      ],
      distanceUnits: DISTANCE_UNITS,
    },
  },
}

// req-220 — how the stored entities nest: entity → field → the entity it holds. `[entity]` an
// array of them, `{ map: entity }` an object keyed by ids (values are that entity), a string one
// object. OPAQUE fields are legacy values nothing reads, kept as they are and described as such
// in FIELDS; their insides are not checked. Every other field holding an object (or an array of
// objects) must be in NESTING, or the check reports it as "entity.field{}" — so a new nested
// shape can't slip past undocumented (review round 1).
const NESTING = {
  state: {
    exercises: ['exercise'],
    routines: ['routine'],
    schedule: 'schedule',
    workouts: ['workout'],
    draftWorkouts: ['workout'],
    activeWorkout: 'workout',
    legacyRecommendations: { map: 'legacyRecommendation' },
  },
  routine: { exercises: ['routineItem'] },
  routineItem: { warmup: 'warmup' },
  schedule: { slots: ['scheduleSlot'], moves: ['scheduleMove'] },
  workout: {
    snapshot: 'snapshot',
    sets: ['set'],
    seedOverrides: { map: 'seedOverride' },
    setDraft: 'setDraft',
    stopwatch: 'stopwatch',
    firstTimeSetup: { map: 'firstTimeSetup' },
  },
  snapshot: { items: ['snapshotItem'] },
  snapshotItem: { warmup: 'warmup' },
  setDraft: { cardio: 'setDraftCardio' },
  firstTimeSetup: { seed: 'firstTimeSetupSeed' },
}
const OPAQUE = { state: ['plannedWorkouts'], workout: ['progression'] }

// The stored fields of `state` that FIELDS does not describe, as "entity.field" strings (sorted,
// unique), walking NESTING from the root. Empty = the export describes everything.
export function undocumentedFields(state) {
  const missing = new Set()
  const holdsObjects = (value) => isPlainObject(value) || (Array.isArray(value) && value.some(isPlainObject))
  const visit = (entity, record) => {
    if (!isPlainObject(record)) return
    for (const [key, value] of Object.entries(record)) {
      if (!Object.hasOwn(FIELDS[entity], key)) missing.add(`${entity}.${key}`)
      const inner = NESTING[entity]?.[key]
      if (inner === undefined) {
        if (holdsObjects(value) && !OPAQUE[entity]?.includes(key)) missing.add(`${entity}.${key}{}`)
      } else if (Array.isArray(inner)) {
        for (const element of Array.isArray(value) ? value : []) visit(inner[0], element)
      } else if (typeof inner === 'object') {
        for (const element of isPlainObject(value) ? Object.values(value) : []) visit(inner.map, element)
      } else {
        visit(inner, value)
      }
    }
  }
  visit('state', state)
  return [...missing].sort()
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

// req-120 (audit C) — whether an imported state predates v9, read from the RAW state
// before the emptyState merge. A present schemaVersion decides; a missing one (the
// assistant's stateShape has none) is legacy only when the pre-v9 `sessions` /
// `programs` collections are present — otherwise it is treated as v9.
export function backupIsLegacy(raw) {
  if (raw.schemaVersion != null) return Number(raw.schemaVersion) !== SCHEMA_VERSION
  return raw.sessions != null || raw.programs != null
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
  const state = importedState(raw, backupIsLegacy(raw))
  return { state, summary: summaryOf(state) }
}

// The import's state from a validated raw document: migrated, a stale stopwatch dropped, the
// anchor defaulted. Shared by applyBackup and importPreview's view of the current data, so
// both sides of the comparison go through the same normalisation.
function importedState(raw, legacy) {
  const migrated = migrateState({ ...emptyState(), ...raw }, { legacy })
  // req-194 re-review — a restored backup never resumes a cardio stopwatch: its start time
  // belongs to the session that exported it. The active workout itself is kept as before.
  if (migrated.activeWorkout?.stopwatch !== undefined) {
    const { stopwatch: _stopwatch, ...active } = migrated.activeWorkout
    migrated.activeWorkout = active
  }
  // req-114 (audit G) — the imported schedule replaces the default one wholesale, so
  // an anchor-less file would anchor every week on the queried date (always week 0).
  // Default it to this Monday, like a new schedule; the import's save persists it.
  return { ...migrated, schedule: withDefaultAnchor(migrated.schedule) }
}

export function summaryOf(state) {
  return {
    routines: (state.routines || []).length,
    exercises: (state.exercises || []).length,
    workouts: (state.workouts || []).length,
    slots: (state.schedule?.slots || []).length,
    // req-202 — the import summary reads "N scheduled days": distinct week/weekday pairs,
    // so a day holding two workouts counts once.
    scheduledDays: new Set((state.schedule?.slots || []).map((slot) => `${slot.week}-${slot.weekday}`)).size,
  }
}

// ---------------------------------------------------------------------------------------
// req-220 (DEC-123 §2) — the import preview, "Keep my history", and the history-safe write.
//
// importPreview(current, incoming): what replacing `current` (the store's data) with
// `incoming` (applyBackup(payload).state) would change, counted by id. `current` goes through
// the same migration as the file first, so a fresh export of the same data compares equal
// (a just-finished workout has no `schemaVersion` until the next load; the migration adds it
// on both sides). Records compare by a key-order-independent JSON string.
//
// "Logged history" = finished `workouts` + legacy `draftWorkouts` (review round 1: drafts are
// the user's logged sets too). `conflict` — the file would change it: a record changed or
// removed, records added while the device already has history, or the workout in progress
// replaced or dropped. Only then does the import offer Keep my history / Replace everything.
// With no history on the device there is nothing to keep (a restore onto a new device takes
// the file's history without a choice).

function stableJson(value) {
  return JSON.stringify(value, (_key, v) =>
    isPlainObject(v) ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, v[key]])) : v,
  )
}

function byId(records) {
  return new Map((records || []).map((record, index) => [record?.id ?? `#${index}`, stableJson(record)]))
}

function diffById(before, after) {
  const prev = byId(before)
  const next = byId(after)
  let added = 0
  let changed = 0
  for (const [id, value] of next) {
    if (!prev.has(id)) added += 1
    else if (prev.get(id) !== value) changed += 1
  }
  const removed = [...prev.keys()].filter((id) => !next.has(id)).length
  return { added, changed, removed, unchanged: next.size - added - changed }
}

function scheduleOf(state) {
  const { loopWeeks, anchor, slots, moves } = state?.schedule || {}
  return { loopWeeks, anchor, slots, moves }
}

const loggedHistory = (state) => [...(state?.workouts || []), ...(state?.draftWorkouts || [])]

// Every record that references setup: logged workouts, legacy drafts and the workout in progress.
function historyRecords(state) {
  return [...loggedHistory(state), ...(state?.activeWorkout ? [state.activeWorkout] : [])]
}

// What a counted area cannot show (review round 1 nit): every root field outside the counted
// ones, schedule fields beyond loopWeeks/anchor/slots/moves, and the ORDER of the records both
// sides share (a reorder changes no record).
function outsideCounts(state, other) {
  const { exercises, routines, workouts, draftWorkouts, activeWorkout: _active, schedule, ...root } = state
  const { loopWeeks: _l, anchor: _a, slots: _s, moves: _m, ...scheduleRest } = schedule || {}
  const shared = (records, others) => {
    const ids = new Set((others || []).map((record) => record?.id))
    return (records || []).map((record) => record?.id).filter((id) => ids.has(id))
  }
  return {
    root,
    scheduleRest,
    order: [
      shared(exercises, other.exercises),
      shared(routines, other.routines),
      shared(workouts, other.workouts),
      shared(draftWorkouts, other.draftWorkouts),
    ],
  }
}

// DESIGN §3 / removeRoutineFromState — setup that history references is archived, not deleted.
// `records` (the history the import will write) may name a routine or exercise the file left
// out: the device's own copy comes back, archived (its archivedAt kept when it already had one).
// Review round 2 — as removeExerciseFromState: only an exercise the RECORDS reference comes back;
// a brought-back routine's items whose exercise ends up in neither the file nor the brought-back
// set are stripped from it (the app strips a deleted exercise from routines). Nothing is invented: every record is
// the device's own, and a reference the device can't resolve either stays as it is (migrateState
// already shows it as "Deleted routine" / "Deleted exercise").
export function setupKeptForHistory(incoming, records, current, archivedAt) {
  const incomingRoutines = new Set((incoming?.routines || []).map((routine) => routine.id))
  const incomingExercises = new Set((incoming?.exercises || []).map((exercise) => exercise.id))
  const routineIds = new Set(records.map((record) => record.routineId || record.snapshot?.routineId).filter(Boolean))
  const routines = (current?.routines || [])
    .filter((routine) => routineIds.has(routine.id) && !incomingRoutines.has(routine.id))
    .map((routine) => ({ ...routine, archivedAt: routine.archivedAt || archivedAt }))
  const exerciseIds = new Set()
  for (const record of records) {
    for (const set of record.sets || []) exerciseIds.add(set.exerciseId)
    for (const item of record.snapshot?.items || []) exerciseIds.add(item.exerciseId)
  }
  const exercises = (current?.exercises || [])
    .filter((exercise) => exerciseIds.has(exercise.id) && !incomingExercises.has(exercise.id))
    .map((exercise) => ({ ...exercise, archivedAt: exercise.archivedAt || archivedAt }))
  const present = new Set([...incomingExercises, ...exercises.map((exercise) => exercise.id)])
  const stripped = routines.map((routine) =>
    (routine.exercises || []).every((item) => present.has(item.exerciseId))
      ? routine
      : { ...routine, exercises: routine.exercises.filter((item) => present.has(item.exerciseId)) },
  )
  return { routines: stripped, exercises }
}

// The state an import writes, on every path. `keepHistory` (Keep my history): the file, except
// the device's logged records and workout in progress, which stay exactly as they are (the same
// arrays/objects, so `workouts` is byte-identical when saved). Otherwise (Replace everything,
// and every no-conflict import): the file as it is. Then, on both, setupKeptForHistory for the
// records being written; a routine brought back archived loses its schedule slots (and their
// moves), as removeRoutineFromState drops them. With nothing to bring back the result is the
// file (or the Keep merge) unchanged — byte-for-byte the pre-req-220 replace.
export function importResult(incoming, current, { keepHistory = false, archivedAt = new Date().toISOString() } = {}) {
  const base = keepHistory
    ? {
        ...incoming,
        workouts: current?.workouts || [],
        draftWorkouts: current?.draftWorkouts || [],
        activeWorkout: current?.activeWorkout ?? null,
      }
    : incoming
  const kept = setupKeptForHistory(incoming, historyRecords(base), current, archivedAt)
  if (!kept.routines.length && !kept.exercises.length) return base
  const archived = new Set(kept.routines.map((routine) => routine.id))
  const slots = (base.schedule?.slots || []).filter((slot) => !archived.has(slot.routineId))
  const slotIds = new Set(slots.map((slot) => slot.id))
  return {
    ...base,
    routines: [...(base.routines || []), ...kept.routines],
    exercises: [...(base.exercises || []), ...kept.exercises],
    schedule: archived.size
      ? { ...base.schedule, slots, moves: (base.schedule?.moves || []).filter((move) => slotIds.has(move.slotId)) }
      : base.schedule,
  }
}

export function keptHistoryState(incoming, current, archivedAt = new Date().toISOString()) {
  return importResult(incoming, current, { keepHistory: true, archivedAt })
}

export function importPreview(current, incoming) {
  const data = dataOnly(current)
  const before = importedState(data, false)
  const history = diffById(loggedHistory(before), loggedHistory(incoming))
  const activeBefore = before.activeWorkout ? stableJson(before.activeWorkout) : null
  const activeAfter = incoming.activeWorkout ? stableJson(incoming.activeWorkout) : null
  let active = 'same'
  if (activeBefore !== activeAfter) active = activeBefore === null ? 'added' : activeAfter === null ? 'removed' : 'replaced'
  const hasHistory = loggedHistory(data).length > 0
  const count = (kept) => ({ routines: kept.routines.length, exercises: kept.exercises.length })
  const keepRecords = historyRecords({ ...incoming, workouts: data.workouts, draftWorkouts: data.draftWorkouts, activeWorkout: data.activeWorkout })
  const nothingChanged = stableJson(before) === stableJson(incoming)
  return {
    nothingChanged,
    routines: diffById(before.routines, incoming.routines),
    exercises: diffById(before.exercises, incoming.exercises),
    scheduleChanged: stableJson(scheduleOf(before)) !== stableJson(scheduleOf(incoming)),
    // The schedule each path WRITES: importResult drops the slots of a routine it brings back
    // archived, so a file that kept such a slot still changes the schedule.
    scheduleChangedOn: {
      replace: stableJson(scheduleOf(before)) !== stableJson(scheduleOf(importResult(incoming, data, { archivedAt: null }))),
      keep: stableJson(scheduleOf(before)) !== stableJson(scheduleOf(importResult(incoming, data, { keepHistory: true, archivedAt: null }))),
    },
    history,
    active,
    otherChanged: !nothingChanged && stableJson(outsideCounts(before, incoming)) !== stableJson(outsideCounts(incoming, before)),
    conflict:
      history.changed > 0 ||
      history.removed > 0 ||
      (history.added > 0 && hasHistory) ||
      active === 'replaced' ||
      active === 'removed',
    // What importResult brings back archived on each path (review round 1, item 1).
    archived: {
      replace: count(setupKeptForHistory(incoming, historyRecords(incoming), data, null)),
      keep: count(setupKeptForHistory(incoming, keepRecords, data, null)),
    },
  }
}

// "2 added, 1 changed" — with `noun` on the first part: "1 logged workout changed, 2 removed".
function countParts(diff, noun = '') {
  const parts = []
  for (const verb of ['added', 'changed', 'removed']) {
    if (!diff[verb]) continue
    const named = parts.length || !noun ? '' : ` ${noun}${diff[verb] === 1 ? '' : 's'}`
    parts.push(`${diff[verb]}${named} ${verb}`)
  }
  return parts.join(', ')
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// "2 workouts and 1 exercise kept as archived — your history uses them", or null.
export function archivedLine({ routines, exercises }) {
  const parts = [routines ? plural(routines, 'workout') : '', exercises ? plural(exercises, 'exercise') : ''].filter(Boolean)
  if (!parts.length) return null
  return `${parts.join(' and ')} kept as archived — your history uses ${routines + exercises === 1 ? 'it' : 'them'}.`
}

function scheduleText(preview, mode) {
  const on = preview.scheduleChangedOn
  const word = (changed) => (changed ? 'changed' : 'unchanged')
  if (!on) return word(preview.scheduleChanged)
  // Review round 2 — the two choices write different schedules: say which one this line is.
  if (mode === 'keep' && on.keep !== on.replace) return `${word(on.keep)} with Keep my history, ${word(on.replace)} with Replace everything`
  return word(on[mode])
}

// The preview as plain lines, for the confirm sheet (and tests). `mode` names the path the
// archived line describes: 'replace' (the plain confirm) or 'keep' (the choice sheet's default).
export function previewLines(preview, mode = preview.conflict ? 'keep' : 'replace') {
  if (preview.nothingChanged) return ['Nothing changed: this file matches the data on this device.']
  const lines = [
    `Workouts: ${countParts(preview.routines) || 'unchanged'}`,
    `Exercises: ${countParts(preview.exercises) || 'unchanged'}`,
    `Schedule: ${scheduleText(preview, mode)}`,
    `Logged history: ${countParts(preview.history, 'logged workout') || 'unchanged'}`,
  ]
  if (preview.otherChanged) lines.push('Other data: changed')
  if (preview.active === 'added') lines.push('Workout in progress: taken from the file.')
  if (preview.active === 'replaced') lines.push('Workout in progress: the file has a different one.')
  if (preview.active === 'removed') lines.push('Workout in progress: not in the file.')
  const archived = archivedLine(preview.archived?.[mode] || { routines: 0, exercises: 0 })
  // Review round 2 — on the choice sheet the line is Keep's (Replace can write a different set).
  if (archived) lines.push(mode === 'keep' ? `With Keep my history: ${archived}` : archived)
  return lines
}

// req-115 (audit D) — the one import step, pure so it is unit-tested. applyBackup runs
// to completion BEFORE setState is called: on a bad file it throws to the caller
// (Settings/Today's existing error path) and setState is never called, so state is
// unchanged. store.applyBackup used to run it INSIDE the setState updater, where React
// swallowed the throw and re-threw it during render, above every ErrorBoundary.
// req-220 — the written state (importResult: Keep my history, and the archived setup history
// uses) is computed here too, from `current` (the store's state the import was previewed
// against), BEFORE setState: the updater only returns the finished value, so nothing in it can
// throw (review round 1 — a malformed stored record throws here, to the caller, with nothing
// written).
export function commitBackup(payload, setState, { keepHistory = false, current = null } = {}) {
  const result = applyBackup(payload)
  const state = importResult(result.state, dataOnly(current), { keepHistory })
  setState(() => state)
  return { state, summary: summaryOf(state), ...(keepHistory ? { keptHistory: true } : {}) }
}
