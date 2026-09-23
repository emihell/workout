// req-127 / DEC-059 §3–4 — names (trim, empty blocks Save), the duplicate / Restore
// match (live wins, else newest archived), the Restore reducer (ONE record, same id),
// and the empty-routine Start guard. Through the real removeExerciseFromState (the
// archive path), the store's record builder, migrateState and buildPlannedWorkout.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  exerciseFromData,
  exerciseNameMatch,
  NAME_REQUIRED,
  nameError,
  pickedExercisePath,
  routineStartable,
} from './exercise-names.js'
import { uid } from './ids.js'
import { buildPlannedWorkout, migrateState } from './model.js'
import { removeExerciseFromState, restoreExerciseInState } from './storage.js'

const bench = { id: 'ex-bench', name: 'Bench', type: 'free', archivedAt: null }
const squat = { id: 'ex-squat', name: 'Squat', type: 'free', archivedAt: null }

function stateWithHistory() {
  return {
    exercises: [bench, squat],
    routines: [
      {
        id: 'rtn-a',
        name: 'A',
        focus: 'Free',
        exercises: [{ id: 'si-1', exerciseId: 'ex-bench', sets: 3, targets: [8, 8, 8] }],
      },
    ],
    plannedWorkouts: [],
    workouts: [
      {
        id: 'wo-1',
        routineId: 'rtn-a',
        finishedAt: '2026-09-01T10:00:00.000Z',
        sets: [{ exerciseId: 'ex-bench', weight: 60, reps: 8, setType: 'working' }],
      },
    ],
    activeWorkout: null,
  }
}

// What every picker does (Exercises.jsx, Routine.jsx, replace.jsx, history/edit.jsx).
const pickable = (s) => s.exercises.filter((ex) => !ex.archivedAt).map((ex) => ex.id)

// The manual-add Save: create a NEW record exactly as store.addExercise does.
const createAnyway = (s, name) => {
  const exercise = exerciseFromData({ name, type: 'free' }, uid('ex'))
  return { state: { ...s, exercises: [...s.exercises, exercise] }, id: exercise.id }
}

describe('req-127 names', () => {
  it('"  " is an error; a real name (padded) is not', () => {
    assert.equal(nameError('  '), NAME_REQUIRED)
    assert.equal(nameError(''), NAME_REQUIRED)
    assert.equal(nameError(undefined), NAME_REQUIRED)
    assert.equal(nameError('  Bench '), null)
  })

  it('the store record is trimmed (exerciseFromData, unchanged from addExercise)', () => {
    const ex = exerciseFromData({ name: '  Row  ', equipment: ' ', weightStep: '' }, 'ex-x')
    assert.deepEqual(
      { id: ex.id, name: ex.name, equipment: ex.equipment, weightStep: ex.weightStep, type: ex.type },
      { id: 'ex-x', name: 'Row', equipment: 'Unknown', weightStep: 'n/a', type: 'free' },
    )
  })
})

describe('req-127 name match', () => {
  it('"Bench" vs existing "bench" → duplicate (trimmed, case-insensitive)', () => {
    const m = exerciseNameMatch([{ ...bench, name: 'bench' }], '  Bench ')
    assert.equal(m.kind, 'live')
    assert.equal(m.exercise.id, 'ex-bench')
  })

  it('vs archived "Bench" → restore candidate', () => {
    const m = exerciseNameMatch([{ ...bench, archivedAt: '2026-09-02T00:00:00.000Z' }], 'bench')
    assert.equal(m.kind, 'archived')
    assert.equal(m.exercise.id, 'ex-bench')
  })

  it('no match → null; empty name → null', () => {
    assert.equal(exerciseNameMatch([bench], 'Deadlift'), null)
    assert.equal(exerciseNameMatch([bench], '  '), null)
  })

  it('precedence: a live match wins over any archived one', () => {
    const list = [
      { id: 'old', name: 'Bench', archivedAt: '2026-09-03T00:00:00.000Z' },
      { id: 'live', name: 'BENCH', archivedAt: null },
    ]
    assert.deepEqual(exerciseNameMatch(list, 'bench'), { kind: 'live', exercise: list[1] })
  })

  it('precedence: otherwise the most recently archived', () => {
    const list = [
      { id: 'a1', name: 'Bench', archivedAt: '2026-08-01T00:00:00.000Z' },
      { id: 'a3', name: 'bench', archivedAt: '2026-09-10T00:00:00.000Z' },
      { id: 'a2', name: 'Bench ', archivedAt: '2026-09-01T00:00:00.000Z' },
    ]
    assert.equal(exerciseNameMatch(list, 'Bench').exercise.id, 'a3')
  })
})

describe('req-127 restore reducer', () => {
  it('clears archivedAt on ONE record only; everything else is the same reference', () => {
    const s = removeExerciseFromState(stateWithHistory(), 'ex-bench', '2026-09-05T00:00:00.000Z')
    const next = restoreExerciseInState(s, 'ex-bench')
    assert.equal(next.exercises.find((ex) => ex.id === 'ex-bench').archivedAt, null)
    assert.equal(next.exercises[1], s.exercises[1])
    assert.equal(next.workouts, s.workouts)
    assert.equal(next.routines, s.routines)
    assert.equal(next.activeWorkout, s.activeWorkout)
  })

  it('unknown or non-archived id → the same state reference (no write)', () => {
    const s = stateWithHistory()
    assert.equal(restoreExerciseInState(s, 'ex-bench'), s)
    assert.equal(restoreExerciseInState(s, 'ex-nope'), s)
  })

  it('brings back the exercise only, not the routine rows archiving removed (unconfirmed)', () => {
    const s = removeExerciseFromState(stateWithHistory(), 'ex-bench')
    const next = restoreExerciseInState(s, 'ex-bench')
    assert.deepEqual(next.routines[0].exercises, [])
  })

  it('a restored record survives migrateState (the load path) un-archived', () => {
    const s = restoreExerciseInState(removeExerciseFromState(stateWithHistory(), 'ex-bench'), 'ex-bench')
    const loaded = migrateState(JSON.parse(JSON.stringify(s)))
    const ex = loaded.exercises.find((candidate) => candidate.id === 'ex-bench')
    assert.equal(ex.archivedAt, null)
    assert.equal(loaded.exercises.length, 2)
  })
})

describe('req-127 failure case — Restore reuses the id', () => {
  it('archive X, add "X" → Restore: same length, same id live and pickable, continuing adds THAT id', () => {
    const archived = removeExerciseFromState(stateWithHistory(), 'ex-bench')
    assert.ok(archived.exercises.find((ex) => ex.id === 'ex-bench').archivedAt, 'history → archived, not deleted')
    assert.ok(!pickable(archived).includes('ex-bench'))

    const match = exerciseNameMatch(archived.exercises, 'bench')
    assert.equal(match.kind, 'archived')
    const restored = restoreExerciseInState(archived, match.exercise.id)

    assert.equal(restored.exercises.length, archived.exercises.length)
    assert.ok(pickable(restored).includes('ex-bench'))
    const routinePaths = { afterCreate: (id) => `/routines/rtn-a/exercise/new/${id}` }
    assert.equal(pickedExercisePath(routinePaths, '/routines/rtn-a', match.exercise.id), '/routines/rtn-a/exercise/new/ex-bench')
    assert.equal(pickedExercisePath(routinePaths, null, match.exercise.id), '/exercises/ex-bench')
    // Now a live match: a second add of "Bench" warns (Use it) instead of offering Restore.
    assert.deepEqual(exerciseNameMatch(restored.exercises, 'Bench').kind, 'live')
    console.log(
      `restore: length ${archived.exercises.length}→${restored.exercises.length}, id ${match.exercise.id}, pickable ${pickable(restored).includes('ex-bench')}`,
    )
  })

  it('the same flow without Restore (Create anyway) mints a NEW id; the old one stays archived', () => {
    const archived = removeExerciseFromState(stateWithHistory(), 'ex-bench')
    const { state: created, id } = createAnyway(archived, 'bench')
    assert.notEqual(id, 'ex-bench')
    assert.equal(created.exercises.length, archived.exercises.length + 1)
    assert.ok(created.exercises.find((ex) => ex.id === 'ex-bench').archivedAt)
    assert.ok(pickable(created).includes(id) && !pickable(created).includes('ex-bench'))
    console.log(`create anyway: length ${archived.exercises.length}→${created.exercises.length}, new id ${id}`)
  })
})

describe('req-127 empty routine has no Start', () => {
  it('routineStartable is false for 0 exercises, true otherwise', () => {
    assert.equal(routineStartable({ exercises: [] }), false)
    assert.equal(routineStartable({}), false)
    assert.equal(routineStartable(null), false)
    assert.equal(routineStartable(stateWithHistory().routines[0]), true)
  })

  it('agrees with the preview guard (buildPlannedWorkout items, overview.jsx)', () => {
    const s = { ...stateWithHistory(), routines: [...stateWithHistory().routines, { id: 'rtn-e', name: 'E', exercises: [] }] }
    for (const routine of s.routines) {
      const plan = buildPlannedWorkout(s, { routineId: routine.id, date: '2026-09-23' })
      assert.equal(routineStartable(routine), plan.items.length > 0)
    }
  })
})
