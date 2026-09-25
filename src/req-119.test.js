// req-119 — setup edits never reach into the live workout. (1) DEC-058 §5 (amends
// DEC-031): the in-progress workout is a reference, so deleting an exercise/routine
// it uses archives it. (2) Today's first-run screen needs no routines, no workouts
// and no active workout. (3) The live set form reads type/Timed from the snapshot
// (new optional snapshot-item field `hasDuration`). Exercised through the real
// migrateState, buildPlannedWorkout → planSnapshot (store.startWorkout),
// replacementItem, finishedState (store.finishWorkout) and the extracted delete
// reducers store.removeExercise / store.removeRoutine now call.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildPlannedWorkout, migrateState, planSnapshot } from './model.js'
import {
  deletionConfirmHead,
  exerciseDeletionImpact,
  exerciseInActiveWorkout,
  exercisesInHistory,
  routineById,
  isFirstRun,
  removeExerciseFromState,
  removeRoutineFromState,
  routineDeletionImpact,
  routineInActiveWorkout,
} from './storage.js'
import { durationTargetFor, finishedState, itemKey, replacementItem, sessionExercise } from './workout-log.js'
import { isWeightedType } from './ids.js'

const NOW = '2026-09-23T12:00:00.000Z'
const EXERCISES = [
  { id: 'ex-b', name: 'Bench', equipment: 'Barbell', type: 'free', weightStep: '2.5', cues: 'retract', hasDuration: false, durationSec: 30 },
  { id: 'ex-x', name: 'Cable Fly', equipment: 'Cable', type: 'machine', weightStep: '5', hasDuration: false },
  { id: 'ex-p', name: 'Plank', equipment: '', type: 'bodyweight', weightStep: 'n/a', hasDuration: true, durationSec: 45 },
]

// Routine r1 (Push) = Bench + Cable Fly, started the real way; never finished before.
function liveState() {
  const state = migrateState({
    schemaVersion: 9,
    exercises: EXERCISES,
    routines: [
      {
        id: 'r1',
        name: 'Push',
        focus: 'Chest',
        exercises: [
          { id: 'ri-b', exerciseId: 'ex-b', role: 'main', sets: 3, targets: ['8', '8', '8'], suggestedWeights: [60, 60, 60] },
          { id: 'ri-x', exerciseId: 'ex-x', role: 'main', sets: 2, targets: ['12', '12'], suggestedWeights: [20, 20] },
        ],
      },
      { id: 'r2', name: 'Other', exercises: [{ id: 'ri-o', exerciseId: 'ex-x', sets: 1 }] },
    ],
    schedule: { loopWeeks: 1, slots: [{ id: 'sl1', routineId: 'r1', weekday: 3 }] },
    workouts: [],
    activeWorkout: null,
  })
  const plan = buildPlannedWorkout(state, { routineId: 'r1', date: '2026-09-23' })
  state.activeWorkout = {
    id: 'wo-live',
    routineId: 'r1',
    performedOn: '2026-09-23',
    occurrenceId: plan.occurrenceId,
    snapshot: planSnapshot(plan),
    startedAt: '2026-09-23T10:00:00.000Z',
    finishedAt: null,
    completedItemIds: [],
    restEndsAt: null,
    restPausedRemaining: null,
    sets: [],
    seedOverrides: {},
  }
  return state
}

const reload = (state) => migrateState(JSON.parse(JSON.stringify(state)))
const benchItem = (state) => state.activeWorkout.snapshot.items[0]
const logSet = (state, item, weight = 60, reps = '8') => ({
  ...state,
  activeWorkout: {
    ...state.activeWorkout,
    sets: [...state.activeWorkout.sets, { routineItemId: itemKey(item), exerciseId: item.exerciseId, setType: 'work', weight, reps, rpe: 3, note: '' }],
  },
})

describe('req-119 delete during a workout archives (DEC-058 §5)', () => {
  it('exercise used ONLY by the active workout → archived, not deleted; after Finish history names it', () => {
    let state = logSet(liveState(), benchItem(liveState()))
    assert.equal(exerciseDeletionImpact(state, 'ex-b').hasHistory, false) // no finished history
    assert.equal(exerciseInActiveWorkout(state, 'ex-b'), true)
    state = removeExerciseFromState(state, 'ex-b', NOW)
    const bench = state.exercises.find((ex) => ex.id === 'ex-b')
    assert.equal(bench?.archivedAt, NOW)
    // Unchanged side effects: stripped from routines; the live snapshot is untouched.
    assert.equal(state.routines[0].exercises.some((item) => item.exerciseId === 'ex-b'), false)
    assert.equal(benchItem(state).exerciseId, 'ex-b')
    state = reload(finishedState(state, {}, NOW))
    const row = exercisesInHistory(state.workouts, state.exercises, state.routines).find((r) => r.id === 'ex-b')
    assert.equal(row.exercise?.name || row.id, 'Bench')
  })

  it('an exercise in the active snapshot with no set logged yet also counts', () => {
    const state = removeExerciseFromState(liveState(), 'ex-b', NOW)
    assert.equal(state.exercises.find((ex) => ex.id === 'ex-b')?.archivedAt, NOW)
  })

  it('unreferenced exercise is still hard-deleted (DEC-031 unchanged)', () => {
    const state = liveState()
    state.activeWorkout = null
    const next = removeExerciseFromState(state, 'ex-b', NOW)
    assert.equal(next.exercises.some((ex) => ex.id === 'ex-b'), false)
  })

  it("routine of the active workout → archived; slots dropped; after Finish History lists it by name", () => {
    let state = liveState()
    assert.equal(routineDeletionImpact(state, 'r1').hasHistory, false)
    assert.equal(routineInActiveWorkout(state, 'r1'), true)
    state = removeRoutineFromState(state, 'r1', NOW)
    assert.equal(state.routines.find((r) => r.id === 'r1')?.archivedAt, NOW)
    assert.equal(state.schedule.slots.length, 0) // unchanged: slots still removed
    assert.equal(state.activeWorkout.routineId, 'r1') // live workout untouched
    assert.equal(isFirstRun(state), false) // Today keeps its normal layout (Continue)
    state = reload(finishedState(logSet(state, benchItem(state)), {}, NOW))
    const workout = state.workouts[0]
    // History names a workout by snapshot.routineName, else the routine record
    // (views/history/helpers.js workoutRoutineName — .js but imports a bare path).
    const routine = routineById(state.routines, workout.routineId) // req-165: the one routine lookup
    assert.equal(routine?.id, 'r1') // the id still points at a routine record
    assert.equal(routine?.name, 'Push')
    assert.equal(workout.snapshot.routineName, 'Push')
  })

  it('unreferenced routine is still hard-deleted', () => {
    const state = removeRoutineFromState(liveState(), 'r2', NOW)
    assert.equal(state.routines.some((r) => r.id === 'r2'), false)
  })

  it('the confirm says it is in the current workout', () => {
    assert.equal(
      deletionConfirmHead('Push', { hasHistory: false, inCurrentWorkout: true }),
      'Push is in the current workout and will be archived (the workout keeps it).',
    )
    assert.equal(
      deletionConfirmHead('Push', { hasHistory: true, inCurrentWorkout: false }),
      'Push has past workouts and will be archived (kept in your history).',
    )
    assert.equal(deletionConfirmHead('Push', { hasHistory: false, inCurrentWorkout: false }), 'Delete Push?')
  })
})

describe('req-119 Today first run', () => {
  it('first run only with no routines, no workouts, no active workout', () => {
    assert.equal(isFirstRun({ routines: [], workouts: [], activeWorkout: null }), true)
    assert.equal(isFirstRun({}), true)
    assert.equal(isFirstRun({ routines: [], workouts: [], activeWorkout: { id: 'w' } }), false)
    assert.equal(isFirstRun({ routines: [], workouts: [{ id: 'w' }], activeWorkout: null }), false)
    assert.equal(isFirstRun({ routines: [{ id: 'r' }], workouts: [], activeWorkout: null }), false)
  })
})

describe('req-119 the live set form reads type/Timed from the snapshot', () => {
  it('buildPlannedWorkout freezes hasDuration on each item; it survives a reload', () => {
    const state = reload(liveState())
    assert.equal(benchItem(state).hasDuration, false)
    const plank = buildPlannedWorkout(
      { ...state, routines: [{ id: 'rp', name: 'Core', exercises: [{ id: 'ri-p', exerciseId: 'ex-p', sets: 1 }] }] },
      { routineId: 'rp', date: '2026-09-23' },
    )
    assert.equal(plank.items[0].hasDuration, true)
  })

  it('failure case — Library edit to bodyweight + Timed mid-workout leaves the form unchanged (kg, no countdown)', () => {
    let state = liveState()
    state = {
      ...state,
      exercises: state.exercises.map((ex) => (ex.id === 'ex-b' ? { ...ex, type: 'bodyweight', hasDuration: true, weightStep: '5' } : ex)),
    }
    const live = state.exercises.find((ex) => ex.id === 'ex-b')
    const ex = sessionExercise(live, benchItem(state))
    assert.equal(ex.type, 'free')
    assert.equal(isWeightedType(ex.type), true) // kg shown; completeSet keeps the weight
    assert.equal(Boolean(ex.hasDuration), false) // timedSet false → no countdown
    assert.equal(ex.name, 'Bench')
    assert.equal(ex.equipment, 'Barbell')
    // Weight step and cues stay live (edited from inside the workout, setup.jsx).
    assert.equal(ex.weightStep, '5')
    assert.equal(ex.cues, 'retract')
    assert.equal(ex.id, 'ex-b') // the title's Library link still resolves
  })

  it('old active workout — a snapshot item without hasDuration falls back to the live exercise (unchanged)', () => {
    const state = liveState()
    const { hasDuration: _drop, ...oldItem } = benchItem(state)
    assert.equal('hasDuration' in oldItem, false)
    const live = { ...state.exercises[0], type: 'bodyweight', hasDuration: true }
    assert.equal(sessionExercise(live, oldItem), live) // exactly the old liveExercise result
    // Deleted exercise + old item → the old snapshot-built fallback, unchanged.
    assert.deepEqual(sessionExercise(null, oldItem), {
      name: 'Bench',
      equipment: 'Barbell',
      type: 'free',
      weightStep: '2.5',
      cues: '',
    })
  })

  it('a deleted exercise with a new snapshot item still reads the snapshot Timed', () => {
    const plankItem = { exerciseId: 'gone', exerciseName: 'Plank', equipment: '', exerciseType: 'bodyweight', weightStep: 'n/a', hasDuration: true }
    const ex = sessionExercise(null, plankItem)
    assert.equal(ex.hasDuration, true)
    assert.equal(durationTargetFor({ durations: [] }, ex, 0) > 0, true)
  })

  it('replacement — a req-109 replacement item carries hasDuration from its exercise', () => {
    const original = benchItem(liveState())
    const plank = replacementItem({ id: 'rep-1', original, exercise: EXERCISES[2], restSec: 60 })
    assert.equal(plank.hasDuration, true)
    const fly = replacementItem({ id: 'rep-2', original, exercise: EXERCISES[1], restSec: 0 })
    assert.equal(fly.hasDuration, false)
    // A Library edit after the replacement doesn't reach it either.
    assert.equal(sessionExercise({ ...EXERCISES[2], hasDuration: false }, plank).hasDuration, true)
  })
})
