import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as route from './route.js'
import { activeTab, applyVisit, hashPath, parseRoute } from './route.js'

// req-49 — Back returns to a screen's logical PARENT (a `to` prop passed at each
// call site), never the last-visited screen. The visit-stack "go back" primitive
// (back()/applyBack) that popped NAV_KEY has been removed: nothing derives Back
// from visit order any more, so parent resolution is independent of how you
// arrived. The visit stack itself stays, but only to feed screen-view analytics
// (recordScreen), which is why applyVisit remains.
describe('req-49 — the visit-stack back primitive is gone', () => {
  it('normalizes hashes to paths (hashPath stays — Back builds targets from it)', () => {
    assert.equal(hashPath('#/routines'), '/routines')
    assert.equal(hashPath('/schedule'), '/schedule')
    assert.equal(hashPath(''), '/')
  })

  it('no longer exports back() or applyBack() — Back no longer pops the visit stack', () => {
    assert.equal(route.back, undefined, 'back() must be removed: Back navigates to a fixed parent, not a stack pop')
    assert.equal(route.applyBack, undefined, 'applyBack() must be removed with its only caller')
  })

  it('still records every screen for analytics, independent of any back logic', () => {
    // applyVisit feeds recordScreen (screen-view counting) — a separate concern that
    // stays. It records visit order but nothing reads it to resolve a Back target.
    const stack = []
    applyVisit(stack, '/')
    applyVisit(stack, '/exercises')
    applyVisit(stack, '/')
    applyVisit(stack, '/workout/sess-upper')
    assert.deepEqual(stack, ['/', '/exercises', '/', '/workout/sess-upper'])
  })

  it('replaces the current screen when a preview becomes the live workout', () => {
    const stack = []
    applyVisit(stack, '/')
    applyVisit(stack, '/schedule')
    applyVisit(stack, '/workout/sess-upper/slot-a/2026-08-31')
    applyVisit(stack, '/workout/sess-upper', { replace: true })
    assert.deepEqual(stack, ['/', '/schedule', '/workout/sess-upper'])
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
  // req-56: schedule/* moved from Workouts to Library — Schedule is now the first
  // Library segment, so every schedule screen lights the Library circle.
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
    'schedule',
    'schedule-loop',
    'schedule-day',
    'schedule-day-add',
    'schedule-slot',
  ]
  const WORKOUTS = [
    'today',
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

  it('maps routines/*, exercises/* and schedule/* to Library', () => {
    for (const name of LIBRARY) assert.equal(activeTab(name), 'library', name)
    // req-56 — the schedule screens specifically light Library, not Workouts.
    assert.equal(activeTab('schedule'), 'library')
    assert.equal(activeTab('schedule-day'), 'library')
    assert.equal(activeTab('schedule-slot'), 'library')
  })

  it('maps today, history/* and the workout flow to Workouts', () => {
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
