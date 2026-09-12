import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { activeTab, applyBack, applyVisit, hashPath, parseRoute } from './route.js'

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
  it('opens old schedule plan URLs as the day routine', () => {
    assert.deepEqual(
      parseRoute('/schedule/0/1/slot-a/plan/2026-08-31/item/pi-si-a'),
      {
        name: 'schedule-slot',
        week: 0,
        weekday: 1,
        slotId: 'slot-a',
        screen: 'detail',
      },
    )
  })

  it('keeps scheduled routine screens under the day URL', () => {
    assert.deepEqual(parseRoute('/schedule/0/1/slot-sess-upper'), {
      name: 'schedule-slot',
      week: 0,
      weekday: 1,
      slotId: 'slot-sess-upper',
      screen: 'detail',
    })
    assert.deepEqual(parseRoute('/schedule/0/1/slot-sess-upper/edit'), {
      name: 'schedule-slot',
      week: 0,
      weekday: 1,
      slotId: 'slot-sess-upper',
      screen: 'edit',
    })
    assert.deepEqual(parseRoute('/schedule/0/1/slot-sess-upper/exercise/new'), {
      name: 'schedule-slot',
      week: 0,
      weekday: 1,
      slotId: 'slot-sess-upper',
      screen: 'exercise-pick',
    })
    assert.deepEqual(parseRoute('/schedule/0/1/slot-sess-upper/exercise/si-row'), {
      name: 'schedule-slot',
      week: 0,
      weekday: 1,
      slotId: 'slot-sess-upper',
      screen: 'exercise',
      itemId: 'si-row',
    })
    assert.deepEqual(parseRoute('/schedule/0/1/slot-sess-upper/exercise/new/ex-row'), {
      name: 'schedule-slot',
      week: 0,
      weekday: 1,
      slotId: 'slot-sess-upper',
      screen: 'exercise-new',
      exerciseId: 'ex-row',
    })
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
    assert.deepEqual(parseRoute('/workout/sess-upper/setup'), {
      name: 'workout-setup',
      routineId: 'sess-upper',
      screen: 'detail',
    })
    assert.deepEqual(parseRoute('/workout/sess-upper/slot-a/2026-08-31/setup/exercise/new'), {
      name: 'workout-setup',
      routineId: 'sess-upper',
      scheduleSlotId: 'slot-a',
      date: '2026-08-31',
      screen: 'exercise-pick',
    })
    assert.deepEqual(parseRoute('/history/wo-1/routine'), {
      name: 'history-routine',
      id: 'wo-1',
      screen: 'detail',
    })
    assert.deepEqual(parseRoute('/history/wo-1/delete'), {
      name: 'history-detail',
      id: 'wo-1',
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

describe('activeTab maps every route name to its bottom tab (req-14 / DEC-024)', () => {
  // The full inventory of route names parseRoute can return, each asserted
  // against the tab DEC-024 groups it under. Deep routes must light the group's
  // tab, not fall through: editing a routine is still Library, a schedule slot is
  // still Workouts. If parseRoute grows a route name, add it here.
  const LIBRARY = [
    'routines',
    'routine',
    'routine-new',
    'routine-edit',
    'routine-exercise',
    'routine-exercise-pick',
    'routine-exercise-new',
    'routine-exercise-create',
    'routine-exercise-create-manual',
    'routine-exercise-create-search',
    'exercises',
    'exercises-type',
    'exercise',
    'exercise-edit',
    'exercise-new',
    'exercise-new-manual',
    'exercise-new-search',
  ]
  const WORKOUTS = [
    'today',
    'schedule',
    'schedule-loop',
    'schedule-day',
    'schedule-day-add',
    'schedule-slot',
    'history',
    'history-month',
    'history-detail',
    'history-edit',
    'history-recalculate',
    'history-routine',
    'history-set',
    'history-set-new',
    'history-exercises',
    'history-exercise',
    'history-workout-exercise',
    'start',
    'workout',
    'workout-preview',
    'workout-setup',
    'workout-set',
    'workout-item',
    'workout-item-log',
    'workout-item-done',
    'workout-item-exercise',
    'workout-finish',
  ]

  it('maps routines/* and exercises/* to Library', () => {
    for (const name of LIBRARY) assert.equal(activeTab(name), 'library', name)
  })

  it('maps today, schedule/*, history/*, the workout flow + start to Workouts', () => {
    for (const name of WORKOUTS) assert.equal(activeTab(name), 'workouts', name)
  })

  it('maps settings to Settings and the dev showcase to no tab', () => {
    assert.equal(activeTab('settings'), 'settings')
    assert.equal(activeTab('components'), null)
  })

  it('defaults an unknown route to Workouts (the fallback surface)', () => {
    assert.equal(activeTab('some-future-route'), 'workouts')
    assert.equal(activeTab(undefined), 'workouts')
  })
})
