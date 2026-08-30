import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyBack, applyVisit, hashPath, parseRoute } from './route.js'

describe('back visits the previous screen', () => {
  it('normalizes hashes to paths', () => {
    assert.equal(hashPath('#/routines'), '/routines')
    assert.equal(hashPath('/schedule'), '/schedule')
    assert.equal(hashPath(''), '/')
  })

  it('records every new screen, including returning to an earlier one via a link', () => {
    const stack = []
    applyVisit(stack, '/')
    applyVisit(stack, '/exercises')
    applyVisit(stack, '/')
    applyVisit(stack, '/workout/sess-upper')
    assert.deepEqual(stack, ['/', '/exercises', '/', '/workout/sess-upper'])
    assert.equal(applyBack(stack, '/workout/sess-upper'), '/')
    assert.deepEqual(stack, ['/', '/exercises', '/'])
    assert.equal(applyBack(stack, '/'), '/exercises')
  })

  it('replaces the current screen when a preview becomes the live workout', () => {
    const stack = []
    applyVisit(stack, '/')
    applyVisit(stack, '/start')
    applyVisit(stack, '/workout/sess-upper/slot-a/2026-08-31')
    applyVisit(stack, '/workout/sess-upper', { replace: true })
    assert.deepEqual(stack, ['/', '/start', '/workout/sess-upper'])
    assert.equal(applyBack(stack, '/workout/sess-upper'), '/start')
  })
})

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
    assert.deepEqual(parseRoute('/workout/sess-upper/slot-a/2026-08-31'), {
      name: 'workout-preview',
      routineId: 'sess-upper',
      scheduleSlotId: 'slot-a',
      date: '2026-08-31',
    })
    assert.deepEqual(parseRoute('/workout/sess-upper'), {
      name: 'workout',
      routineId: 'sess-upper',
    })
    assert.deepEqual(parseRoute('/workout/sess-upper/item/si-row'), {
      name: 'workout-item',
      routineId: 'sess-upper',
      itemId: 'si-row',
    })
    assert.deepEqual(parseRoute('/workout/sess-upper/item/si-row/log'), {
      name: 'workout-item-log',
      routineId: 'sess-upper',
      itemId: 'si-row',
    })
    assert.deepEqual(parseRoute('/workout/sess-upper/item/si-row/done'), {
      name: 'workout-item-done',
      routineId: 'sess-upper',
      itemId: 'si-row',
    })
    assert.deepEqual(parseRoute('/workout/sess-upper/item/si-row/exercise'), {
      name: 'workout-item-exercise',
      routineId: 'sess-upper',
      itemId: 'si-row',
    })
  })

  it('parses routine routes only under /routines', () => {
    assert.deepEqual(parseRoute('/routines/s/exercise/si-s-0-ex'), {
      name: 'routine-exercise',
      routineId: 's',
      itemId: 'si-s-0-ex',
    })
    assert.deepEqual(parseRoute('/routines'), { name: 'routines' })
    assert.deepEqual(parseRoute('/routines/new'), { name: 'routine-new' })
    assert.deepEqual(parseRoute('/routines/s'), { name: 'routine', routineId: 's' })
    assert.deepEqual(parseRoute('/sessions/s'), { name: 'today' })
    assert.deepEqual(parseRoute('/programs'), { name: 'today' })
  })

  it('parses settings', () => {
    assert.deepEqual(parseRoute('/settings'), { name: 'settings' })
    assert.deepEqual(parseRoute('/settings/assistant'), { name: 'settings' })
  })

  it('parses add-exercise choices', () => {
    assert.deepEqual(parseRoute('/exercises/new'), { name: 'exercise-new' })
    assert.deepEqual(parseRoute('/exercises/new/manual'), { name: 'exercise-new-manual' })
    assert.deepEqual(parseRoute('/exercises/new/search'), { name: 'exercise-new-search' })
    assert.deepEqual(parseRoute('/exercises/type/machine'), {
      name: 'exercises-type',
      type: 'machine',
    })
    assert.deepEqual(parseRoute('/history/month/2026-08'), {
      name: 'history-month',
      month: '2026-08',
    })
    assert.deepEqual(parseRoute('/routines/s/exercise/create'), {
      name: 'routine-exercise-create',
      routineId: 's',
    })
    assert.deepEqual(parseRoute('/routines/s/exercise/create/search'), {
      name: 'routine-exercise-create-search',
      routineId: 's',
    })
  })
})
