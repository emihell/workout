import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildPlannedWorkout, migrateState, SCHEMA_VERSION } from './model.js'

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
  it('moves prescriptions out of sessions and keeps a stable baseline', () => {
    const migrated = migrateState(stateFixture())
    const item = migrated.programs[0].sessions[0].exercises[0]
    assert.equal(migrated.schemaVersion, SCHEMA_VERSION)
    assert.equal(item.id, 'si-s-1-0-ex-1')
    assert.equal('targets' in item, false)
    assert.equal('suggestedWeights' in item, false)
    assert.deepEqual(migrated.legacyRecommendations[item.id].suggestedWeights, [20, 25, 25])
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
    assert.equal(migrated.workouts[0].snapshot.sessionName, 'Push')
    assert.equal(migrated.workouts[0].snapshot.items[0].exerciseName, 'Chest press')
    assert.deepEqual(migrated.workouts[0].snapshot.items[0].targets, ['12', '10', '8'])
    assert.deepEqual(migrated.workouts[0].snapshot.items[0].suggestedWeights, [20])
    assert.equal(migrated.workouts[0].sets[0].sessionItemId, 'si-s-1-0-ex-1')
  })
})

describe('dated planned workouts', () => {
  it('uses program reps and requests calibration when no weight history or baseline exists', () => {
    const source = stateFixture()
    delete source.programs[0].sessions[0].exercises[0].targets
    delete source.programs[0].sessions[0].exercises[0].suggestedWeights
    const state = migrateState(source)
    const plan = buildPlannedWorkout(state, {
      sessionId: 's-1',
      date: '2026-08-31',
      scheduleSlotId: 'slot-1',
    })
    assert.equal(plan.occurrenceId, 'slot-1@2026-08-31')
    assert.deepEqual(plan.items[0].targets, ['12', '10', '8'])
    assert.deepEqual(plan.items[0].suggestedWeights, [])
    assert.equal(plan.items[0].calibrationRequired, true)
  })

  it('keeps edits scoped to the exact date', () => {
    const state = migrateState(stateFixture())
    const monday = buildPlannedWorkout(state, {
      sessionId: 's-1',
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
      sessionId: 's-1',
      date: '2026-09-07',
      scheduleSlotId: 'slot-1',
    })
    assert.deepEqual(buildPlannedWorkout(state, {
      sessionId: 's-1',
      date: '2026-08-31',
      scheduleSlotId: 'slot-1',
    }).items[0].suggestedWeights, [99, 99, 99])
    assert.deepEqual(nextMonday.items[0].suggestedWeights, [20, 25, 25])
  })
})
