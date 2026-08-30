import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyProgressionToRoutines,
  buildPlannedWorkout,
  migrateState,
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
