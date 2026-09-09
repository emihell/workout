import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  itemIsMarkedDone,
  itemKey,
  itemLoggingState,
  lastLoggedSetIndex,
  withOneMoreSet,
  addWorkingSetToState,
  withSkippedUnloggedSets,
  restRemaining,
} from './workout-log.js'

const item = {
  id: 'pi-si-row',
  routineItemId: 'si-row',
  exerciseId: 'ex-rowing',
  sets: 1,
  warmup: null,
}

describe('workout logging', () => {
  it('uses the routine item id as the stable key', () => {
    assert.equal(itemKey(item), 'si-row')
  })

  it('is not done until every planned working set is logged', () => {
    const empty = itemLoggingState({ sets: [] }, item)
    assert.equal(empty.plannedDone, false)
    const done = itemLoggingState(
      { sets: [{ routineItemId: 'si-row', exerciseId: 'ex-rowing', setType: 'work', reps: '6 min' }] },
      item,
    )
    assert.equal(done.plannedDone, true)
  })

  it('marks an exercise done only after the review screen', () => {
    assert.equal(itemIsMarkedDone({ completedItemIds: [] }, item), false)
    assert.equal(itemIsMarkedDone({ completedItemIds: ['si-row'] }, item), true)
  })

  it('finds the last logged set for this exercise so you can go back', () => {
    const workout = {
      sets: [
        { routineItemId: 'si-other', reps: '8' },
        { routineItemId: 'si-row', setType: 'work', reps: '10' },
        { routineItemId: 'si-row', setType: 'work', reps: 'skipped' },
      ],
    }
    assert.equal(lastLoggedSetIndex(workout, item), 2)
    assert.equal(lastLoggedSetIndex({ sets: [] }, item), -1)
  })

  it('adds a working set to this workout only, not the routine', () => {
    const extra = withOneMoreSet({
      routineItemId: 'si-row',
      sets: 1,
      targets: ['5-8 min'],
      suggestedWeights: [],
    })
    assert.equal(extra.sets, 2)
    assert.deepEqual(extra.targets, ['5-8 min', '5-8 min'])

    const next = addWorkingSetToState(
      {
        routines: [
          {
            id: 'sess-upper',
            exercises: [
              {
                id: 'si-row',
                exerciseId: 'ex-rowing',
                sets: 1,
                targets: ['5-8 min'],
                suggestedWeights: [],
              },
            ],
          },
        ],
        activeWorkout: {
          routineId: 'sess-upper',
          snapshot: {
            items: [{ routineItemId: 'si-row', sets: 1, targets: ['5-8 min'], suggestedWeights: [] }],
          },
        },
      },
      'si-row',
    )
    assert.equal(next.activeWorkout.snapshot.items[0].sets, 2)
    assert.equal(next.routines[0].exercises[0].sets, 1)
    assert.deepEqual(next.routines[0].exercises[0].targets, ['5-8 min'])
  })

  it('records unopened planned sets as skipped when the workout is finished', () => {
    const next = withSkippedUnloggedSets({
      sets: [],
      completedItemIds: [],
      snapshot: {
        items: [
          {
            routineItemId: 'si-row',
            exerciseId: 'ex-rowing',
            sets: 2,
            targets: ['10', '10'],
            warmup: { reps: 12 },
          },
        ],
      },
    })
    assert.equal(next.sets.length, 3)
    assert.equal(next.sets[0].setType, 'wu')
    assert.equal(next.sets[0].reps, 'skipped')
    assert.equal(next.sets[1].reps, 'skipped')
    assert.equal(next.sets[2].reps, 'skipped')
    assert.deepEqual(next.completedItemIds, ['si-row'])
  })
})

describe('restRemaining (rest timer recompute)', () => {
  it('(a) active countdown recomputes from restEndsAt for any now, not frozen/reset', () => {
    const active = { restEndsAt: 10_000, restPausedRemaining: null }
    // Different `now` values yield different remaining — proves it is recomputed,
    // which is what keeps navigating away and back showing the correct time.
    assert.deepEqual(restRemaining(active, 2_000), { remainingMs: 8_000, paused: false, resting: true })
    assert.deepEqual(restRemaining(active, 7_500), { remainingMs: 2_500, paused: false, resting: true })
    assert.equal(restRemaining(active, 9_999).remainingMs, 1)
  })

  it('(b) paused: remaining is the frozen paused value, regardless of now', () => {
    const active = { restEndsAt: null, restPausedRemaining: 4_200 }
    assert.deepEqual(restRemaining(active, 0), { remainingMs: 4_200, paused: true, resting: true })
    assert.deepEqual(restRemaining(active, 1_000_000), { remainingMs: 4_200, paused: true, resting: true })
  })

  it('(c) expired: now at/after restEndsAt clamps to 0 and stops resting', () => {
    const active = { restEndsAt: 10_000, restPausedRemaining: null }
    assert.deepEqual(restRemaining(active, 10_000), { remainingMs: 0, paused: false, resting: false })
    assert.deepEqual(restRemaining(active, 12_345), { remainingMs: 0, paused: false, resting: false })
  })

  it('(d) no rest: both fields null → not resting', () => {
    assert.deepEqual(restRemaining({ restEndsAt: null, restPausedRemaining: null }, 5_000), {
      remainingMs: 0,
      paused: false,
      resting: false,
    })
    // and tolerates a missing/absent active workout
    assert.equal(restRemaining(null, 5_000).resting, false)
  })
})
