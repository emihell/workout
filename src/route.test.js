import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseRoute } from './route.js'

describe('stable workflow routes', () => {
  it('parses dated schedule-plan item identities', () => {
    assert.deepEqual(
      parseRoute('/schedule/0/1/slot-a/plan/2026-08-31/item/pi-si-a'),
      {
        name: 'schedule-plan-item',
        week: 0,
        weekday: 1,
        slotId: 'slot-a',
        date: '2026-08-31',
        itemId: 'pi-si-a',
      },
    )
  })

  it('parses a scheduled workout preview separately from an ad-hoc preview', () => {
    assert.deepEqual(parseRoute('/workout/session-a/slot-a/2026-08-31'), {
      name: 'workout-preview',
      sessionId: 'session-a',
      scheduleSlotId: 'slot-a',
      date: '2026-08-31',
    })
    assert.deepEqual(parseRoute('/workout/session-a'), {
      name: 'workout',
      sessionId: 'session-a',
    })
  })

  it('keeps stable session item IDs instead of coercing array indexes', () => {
    assert.deepEqual(parseRoute('/programs/p/session/s/exercise/si-s-0-ex'), {
      name: 'session-exercise',
      programId: 'p',
      sessionId: 's',
      itemId: 'si-s-0-ex',
    })
  })
})
