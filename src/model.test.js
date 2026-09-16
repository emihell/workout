import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyProgressionToRoutines,
  buildPlannedWorkout,
  migrateState,
  progressionForItem,
  progressionFromWorkout,
  SCHEMA_VERSION,
} from './model.js'

function stateFixture() {
  return {
    exercises: [
      { id: 'ex-1', name: 'Chest press', equipment: 'Machine', type: 'machine', weightStep: '5' },
    ],
    programs: [
      {
        id: 'p-1',
        name: 'Gym',
        goal: 'gain',
        sessions: [
          {
            id: 's-1',
            name: 'Push',
            focus: 'Machines',
            exercises: [
              {
                exerciseId: 'ex-1',
                sets: 3,
                targets: ['12', '10', '8'],
                suggestedWeights: [20, 25, 25],
                restSec: 90,
              },
            ],
          },
        ],
      },
    ],
    schedule: {
      loopWeeks: 1,
      anchorDate: '2026-08-24',
      slots: [{ id: 'slot-1', week: 0, weekday: 1, programId: 'p-1', sessionId: 's-1' }],
    },
    workouts: [],
  }
}

describe('state migration', () => {
  it('keeps prescriptions on routine exercises', () => {
    const migrated = migrateState(stateFixture())
    const item = migrated.routines[0].exercises[0]
    assert.equal(migrated.schemaVersion, SCHEMA_VERSION)
    assert.equal(migrated.routines[0].name, 'Push')
    assert.equal(migrated.programs, undefined)
    assert.equal(migrated.sessions, undefined)
    assert.equal(migrated.schedule.slots[0].programId, undefined)
    assert.equal(migrated.schedule.slots[0].routineId, 's-1')
    assert.equal(item.id, 'si-s-1-0-ex-1')
    assert.equal(item.sets, 3)
    assert.deepEqual(item.targets, ['12', '10', '8'])
    assert.deepEqual(item.suggestedWeights, [20, 25, 25])
    assert.deepEqual(migrated.legacyRecommendations[item.id].suggestedWeights, [20, 25, 25])
  })

  it('restores stripped routine fields from legacyRecommendations', () => {
    const source = stateFixture()
    source.legacyRecommendations = {
      'si-s-1-0-ex-1': { sets: 1, targets: ['5-8 min'], suggestedWeights: [] },
    }
    source.programs[0].sessions[0].exercises[0] = {
      id: 'si-s-1-0-ex-1',
      exerciseId: 'ex-1',
      role: 'cardio',
      restSec: 0,
      notes: '',
      warmup: null,
    }
    const migrated = migrateState(source)
    const item = migrated.routines[0].exercises[0]
    assert.equal(item.sets, 1)
    assert.deepEqual(item.targets, ['5-8 min'])
    assert.deepEqual(item.suggestedWeights, [])
  })

  it('snapshots historical names and prescriptions', () => {
    const source = stateFixture()
    source.workouts = [
      {
        id: 'w-1',
        sessionId: 's-1',
        finishedAt: '2026-08-20T10:00:00.000Z',
        sets: [{ exerciseId: 'ex-1', weight: 20, reps: '12', rpe: 3 }],
      },
    ]
    const migrated = migrateState(source)
    assert.equal(migrated.workouts[0].snapshot.programName, 'Gym')
    assert.equal(migrated.workouts[0].snapshot.routineName, 'Push')
    assert.equal(migrated.workouts[0].routineId, 's-1')
    assert.equal(migrated.workouts[0].snapshot.items[0].exerciseName, 'Chest press')
    assert.deepEqual(migrated.workouts[0].snapshot.items[0].targets, ['12', '10', '8'])
    assert.deepEqual(migrated.workouts[0].snapshot.items[0].suggestedWeights, [20])
    assert.equal(migrated.workouts[0].sets[0].routineItemId, 'si-s-1-0-ex-1')
  })

  // req-83 (N9) — the live seed-override map is an optional transient field on
  // activeWorkout (no schema-version bump). migrateState must carry it through
  // untouched, AND an older active-workout key that predates it must still load.
  it('preserves activeWorkout.seedOverrides through migration', () => {
    const source = stateFixture()
    source.activeWorkout = {
      id: 'wo-1',
      sessionId: 's-1',
      startedAt: '2026-09-16T09:00:00.000Z',
      finishedAt: null,
      sets: [],
      seedOverrides: { 'ex-1::work': { weight: '5' } },
    }
    const migrated = migrateState(source)
    assert.deepEqual(migrated.activeWorkout.seedOverrides, { 'ex-1::work': { weight: '5' } })
  })

  it('loads an older activeWorkout that has no seedOverrides (field simply absent)', () => {
    const source = stateFixture()
    source.activeWorkout = {
      id: 'wo-1',
      sessionId: 's-1',
      startedAt: '2026-09-16T09:00:00.000Z',
      finishedAt: null,
      sets: [],
    }
    const migrated = migrateState(source)
    assert.equal(migrated.activeWorkout.seedOverrides, undefined)
    assert.equal(migrated.activeWorkout.routineId, 's-1')
  })
})

describe('routine snapshots', () => {
  it('uses the routine prescription and asks for calibration when there is no weight', () => {
    const source = stateFixture()
    source.programs[0].sessions[0].exercises[0].suggestedWeights = []
    const state = migrateState(source)
    const plan = buildPlannedWorkout(state, {
      routineId: 's-1',
      date: '2026-08-31',
      scheduleSlotId: 'slot-1',
    })
    assert.equal(plan.occurrenceId, 'slot-1@2026-08-31')
    assert.equal(plan.items[0].sets, 3)
    assert.deepEqual(plan.items[0].targets, ['12', '10', '8'])
    assert.deepEqual(plan.items[0].suggestedWeights, [])
    assert.equal(plan.items[0].calibrationRequired, true)
  })

  it('does not pad cardio or duration work to a 3-set pattern', () => {
    const source = {
      exercises: [
        { id: 'ex-row', name: 'Rowing', equipment: 'Rower', type: 'cardio', weightStep: 'n/a' },
        { id: 'ex-plank', name: 'Plank', equipment: 'None', type: 'bodyweight', weightStep: 'n/a' },
        { id: 'ex-push', name: 'Push-up', equipment: 'None', type: 'bodyweight', weightStep: 'n/a' },
      ],
      programs: [
        {
          id: 'p-1',
          name: 'Gym',
          sessions: [
            {
              id: 's-1',
              name: 'Push',
              focus: 'Mixed',
              exercises: [
                {
                  exerciseId: 'ex-row',
                  role: 'warmup',
                  sets: 1,
                  targets: ['5-8 min'],
                  suggestedWeights: [],
                  restSec: 0,
                },
                {
                  exerciseId: 'ex-plank',
                  role: 'finisher',
                  sets: 1,
                  targets: ['60s'],
                  suggestedWeights: [],
                  restSec: 0,
                },
                {
                  exerciseId: 'ex-push',
                  role: 'main',
                  sets: 2,
                  targets: ['AMRAP', 'AMRAP'],
                  suggestedWeights: [],
                  restSec: 60,
                },
              ],
            },
          ],
        },
      ],
      schedule: { loopWeeks: 1, slots: [] },
      workouts: [],
    }
    const state = migrateState(source)
    const plan = buildPlannedWorkout(state, { routineId: 's-1', date: '2026-08-31' })
    assert.equal(plan.items[0].sets, 1)
    assert.deepEqual(plan.items[0].targets, ['5-8 min'])
    assert.equal(plan.items[1].sets, 1)
    assert.deepEqual(plan.items[1].targets, ['60s'])
    assert.equal(plan.items[2].sets, 2)
    assert.deepEqual(plan.items[2].targets, ['AMRAP', 'AMRAP'])
  })

  it('uses the routine prescription for every date', () => {
    const state = migrateState(stateFixture())
    const monday = buildPlannedWorkout(state, {
      routineId: 's-1',
      date: '2026-08-31',
      scheduleSlotId: 'slot-1',
    })
    state.plannedWorkouts = [
      {
        ...monday,
        manuallyEdited: true,
        items: monday.items.map((item) => ({ ...item, suggestedWeights: [99, 99, 99] })),
      },
    ]
    const nextMonday = buildPlannedWorkout(state, {
      routineId: 's-1',
      date: '2026-09-07',
      scheduleSlotId: 'slot-1',
    })
    assert.deepEqual(
      buildPlannedWorkout(state, {
        routineId: 's-1',
        date: '2026-08-31',
        scheduleSlotId: 'slot-1',
      }).items[0].suggestedWeights,
      [20, 25, 25],
    )
    assert.deepEqual(nextMonday.items[0].suggestedWeights, [20, 25, 25])
  })

  it('writes next kg and reps onto the routine exercise', () => {
    const state = migrateState(stateFixture())
    const item = state.routines[0].exercises[0]
    const next = applyProgressionToRoutines(state.routines, 's-1', [
      {
        routineItemId: item.id,
        to: [25, 30, 30],
        targetsTo: ['12', '10', '8'],
      },
    ])
    assert.deepEqual(next[0].exercises[0].suggestedWeights, [25, 30, 30])
    assert.deepEqual(next[0].exercises[0].targets, ['12', '10', '8'])
    assert.equal(next[0].exercises[0].sets, 3)
  })
})

// req-40 (F-CODE-1) — Finish (finish.jsx) and History recalc (progressionFromWorkout)
// used to compute the per-item progression twice with divergent set-matching, so the
// same workout could save two different recommendations (fails DESIGN §2). Both now
// derive their saved core from the one pure helper `progressionForItem`, reconciled to
// the fuller model.js matcher + the keep-item.targets empty-sets fallback.
describe('req-40 unified progression (Finish == recalc)', () => {
  const exercises = [{ id: 'ex-1', name: 'Press', equipment: 'Machine', type: 'machine', weightStep: '5' }]

  it('the fuller matcher catches a sessionItemId-keyed set the old finish matcher missed', () => {
    // The item resolves to key 'ri-1'; the working set is keyed by sessionItemId only
    // (no routineItemId) — exactly what finish.jsx's `routineItemId`-only filter missed.
    const item = { exerciseId: 'ex-1', exerciseName: 'Press', routineItemId: 'ri-1', targets: ['8'], suggestedWeights: [40] }
    const workout = {
      snapshot: { items: [item] },
      sets: [{ sessionItemId: 'ri-1', setType: 'work', weight: 40, reps: '8', rpe: 1 }],
    }

    const core = progressionForItem(exercises, workout, item)
    assert.equal(core.sets.length, 1, 'the sessionItemId-keyed set is matched')
    assert.deepEqual(core.to, [45], 'rpe<=2, not missed → up one 5kg step')
    assert.deepEqual(core.targetsTo, ['8'])

    // The recalc path returns the SAME {to, targetsTo} — the consistency this req buys.
    const [recalc] = progressionFromWorkout({ exercises }, workout)
    assert.equal(recalc.routineItemId, 'ri-1')
    assert.deepEqual({ to: recalc.to, targetsTo: recalc.targetsTo }, { to: core.to, targetsTo: core.targetsTo })

    // Prove it was a real divergence: the OLD finish filter (routineItemId only) saw
    // zero sets and would have saved the unchanged [40], not the [45] both paths now save.
    const oldFinishSets = workout.sets.filter(
      (set) =>
        set.setType !== 'wu' &&
        set.routineItemId === 'ri-1' &&
        String(set.reps).toLowerCase() !== 'skipped',
    )
    assert.equal(oldFinishSets.length, 0, 'old finish matcher missed the set')
    assert.notDeepEqual(core.to, item.suggestedWeights, 'so old finish would have saved a different (stale) recommendation')
  })

  it('empty matched sets keep item.targets / item.suggestedWeights, not a from-zero recommendation', () => {
    const item = { exerciseId: 'ex-1', routineItemId: 'ri-1', targets: ['12', '10'], suggestedWeights: [30, 30] }
    const workout = { snapshot: { items: [item] }, sets: [] }
    const core = progressionForItem(exercises, workout, item)
    assert.equal(core.sets.length, 0)
    assert.deepEqual(core.to, [30, 30])
    assert.deepEqual(core.targetsTo, ['12', '10'])
    // recalc agrees
    const [recalc] = progressionFromWorkout({ exercises }, workout)
    assert.deepEqual({ to: recalc.to, targetsTo: recalc.targetsTo }, { to: [30, 30], targetsTo: ['12', '10'] })
  })

  it('a normal routineItemId-keyed workout yields the same recommendation as before (regression guard)', () => {
    const item = { exerciseId: 'ex-1', routineItemId: 'ri-1', targets: ['8'], suggestedWeights: [40] }
    const workout = {
      snapshot: { items: [item] },
      sets: [{ routineItemId: 'ri-1', setType: 'work', weight: 40, reps: '8', rpe: 1 }],
    }
    const [p] = progressionFromWorkout({ exercises }, workout)
    assert.deepEqual(p, { routineItemId: 'ri-1', to: [45], targetsTo: ['8'] })
  })

  it('a warm-up and a skipped set never feed the recommendation', () => {
    const item = { exerciseId: 'ex-1', routineItemId: 'ri-1', targets: ['8'], suggestedWeights: [40] }
    const workout = {
      snapshot: { items: [item] },
      sets: [
        { routineItemId: 'ri-1', setType: 'wu', weight: 20, reps: '8', rpe: 1 },
        { routineItemId: 'ri-1', setType: 'work', weight: 40, reps: 'skipped' },
      ],
    }
    const core = progressionForItem(exercises, workout, item)
    assert.equal(core.sets.length, 0, 'wu + skipped are both excluded')
    assert.deepEqual(core.to, [40])
    assert.deepEqual(core.targetsTo, ['8'])
  })
})

// req-85 (v9) — the timed-exercise schema fields. Migration defaults them on every
// exercise/routine item; buildPlannedWorkout + the legacy workoutSnapshot rebuild
// thread the per-set durations through. All shape-driven and behaviour-neutral for
// non-timed data.
describe('req-85 timed-exercise schema (v9)', () => {
  it('defaults hasDuration:false + a durationSec on every migrated exercise', () => {
    const migrated = migrateState(stateFixture())
    const ex = migrated.exercises[0]
    assert.equal(ex.hasDuration, false)
    assert.equal(typeof ex.durationSec, 'number')
    assert.equal(ex.durationSec, 30) // DEFAULT_DURATION_SEC
    assert.equal(migrated.schemaVersion, 9)
  })

  it('preserves an exercise that already carries hasDuration + durationSec', () => {
    const source = stateFixture()
    source.exercises[0] = { ...source.exercises[0], hasDuration: true, durationSec: 45 }
    const ex = migrateState(source).exercises[0]
    assert.equal(ex.hasDuration, true)
    assert.equal(ex.durationSec, 45)
  })

  it('defaults durations:[] on every migrated routine item, and preserves a set one', () => {
    const migrated = migrateState(stateFixture())
    assert.deepEqual(migrated.routines[0].exercises[0].durations, [])

    const source = stateFixture()
    source.programs[0].sessions[0].exercises[0].durations = [30, 40, 50]
    const item = migrateState(source).routines[0].exercises[0]
    assert.deepEqual(item.durations, [30, 40, 50])
  })

  it('buildPlannedWorkout threads the routine item durations into the plan item', () => {
    const source = stateFixture()
    source.programs[0].sessions[0].exercises[0].durations = [30, 30, 30]
    const state = migrateState(source)
    const plan = buildPlannedWorkout(state, { routineId: 's-1', date: '2026-08-31' })
    assert.deepEqual(plan.items[0].durations, [30, 30, 30])
  })

  it('legacy workoutSnapshot rebuild includes durations from the template item', () => {
    const source = stateFixture()
    source.programs[0].sessions[0].exercises[0].durations = [25]
    // A legacy workout with no stored snapshot → the rebuild branch runs and must
    // carry the template item's durations onto the snapshot item.
    source.workouts = [
      {
        id: 'w-1',
        sessionId: 's-1',
        finishedAt: '2026-08-20T10:00:00.000Z',
        sets: [{ exerciseId: 'ex-1', weight: 20, reps: '12', rpe: 3 }],
      },
    ]
    const migrated = migrateState(source)
    assert.deepEqual(migrated.workouts[0].snapshot.items[0].durations, [25])
  })
})
