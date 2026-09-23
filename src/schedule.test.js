import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  coveringWorkout,
  dateKey,
  occurrenceId,
} from './schedule.js'

describe('coveringWorkout', () => {
  it('matches a workout tagged for that scheduled day', () => {
    const workouts = [
      {
        routineId: 'sess-upper',
        scheduledFor: '2026-08-31',
        finishedAt: '2026-08-29T18:00:00',
      },
    ]
    const found = coveringWorkout(workouts, 'sess-upper', '2026-08-31')
    assert.equal(found.scheduledFor, '2026-08-31')
    assert.equal(dateKey(found.finishedAt), '2026-08-29')
  })

  it('does not count an early finish against a different day', () => {
    const workouts = [
      {
        routineId: 'sess-upper',
        scheduledFor: '2026-08-31',
        finishedAt: '2026-08-29T18:00:00',
      },
    ]
    assert.equal(coveringWorkout(workouts, 'sess-upper', '2026-08-29'), null)
  })
})

describe('schedule slot occurrences', () => {
  it('uses slot and date as the durable occurrence identity', () => {
    assert.equal(occurrenceId('slot-monday', new Date(2026, 7, 31)), 'slot-monday@2026-08-31')
  })

  it('does not let another slot cover the same routine occurrence', () => {
    const workouts = [
      {
        routineId: 'sess-upper',
        scheduleSlotId: 'slot-one',
        scheduledFor: '2026-08-31',
        finishedAt: '2026-08-30T10:00:00.000Z',
      },
    ]
    assert.equal(coveringWorkout(workouts, 'sess-upper', '2026-08-31', 'slot-two'), null)
  })
})
