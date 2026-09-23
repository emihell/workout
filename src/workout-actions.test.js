import { describe, it, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  ABANDON_ON_NEW_WARNING,
  abandonInProgress,
  continueInProgress,
  resumeTarget,
  startOrContinue,
} from './workout-actions.js'
import { dateKey } from './schedule.js'
import { hashPath } from './route.js'

// req-55 / DEC-038 — start-while-active abandons the one in-progress workout after a
// warning (no draft stacking); Continue/Abandon resolve a stale in-progress or a
// legacy draft. workout-actions.js is the orchestration layer (store.jsx is JSX and
// can't be imported by `node --test`), so these drive it with a fake store that
// records calls, plus a stubbed window.confirm. A source guard below locks the store
// itself to the one-in-progress shape (no draftWorkouts write on start).

function fakeStore(overrides = {}) {
  const calls = []
  const record = (name) => (...args) => calls.push({ name, args })
  return {
    activeWorkout: null,
    draftWorkouts: [],
    calls,
    abandonWorkout: record('abandonWorkout'),
    startWorkout: record('startWorkout'),
    continueDraft: record('continueDraft'),
    abandonDraft: record('abandonDraft'),
    ...overrides,
  }
}

let confirmReturn = true
let confirmMessages = []
const previousWindow = globalThis.window

beforeEach(() => {
  confirmReturn = true
  confirmMessages = []
  globalThis.window = {
    location: { hash: '' },
    confirm: (message) => {
      confirmMessages.push(message)
      return confirmReturn
    },
  }
})
afterEach(() => {
  globalThis.window = previousWindow
})

const names = (store) => store.calls.map((c) => c.name)

describe('startOrContinue — abandon-on-new (DEC-038)', () => {
  it('no active workout → starts, no confirm, never touches drafts', () => {
    const store = fakeStore()
    startOrContinue(store, 'rtn-new')
    assert.deepEqual(confirmMessages, [])
    assert.deepEqual(names(store), ['startWorkout'])
    // draftWorkouts did not grow — nothing was pushed anywhere.
    assert.equal(store.draftWorkouts.length, 0)
    assert.ok(!names(store).includes('abandonDraft'))
  })

  it('different workout active + OK → warns, abandons, then starts (no draft kept)', () => {
    const store = fakeStore({ activeWorkout: { id: 'a1', routineId: 'rtn-old' } })
    confirmReturn = true
    startOrContinue(store, 'rtn-new')
    assert.deepEqual(confirmMessages, [ABANDON_ON_NEW_WARNING])
    // The discard happens before the new start, and no draft is created.
    assert.deepEqual(names(store), ['abandonWorkout', 'startWorkout'])
    assert.equal(store.draftWorkouts.length, 0)
  })

  it('different workout active + Cancel → does nothing (keeps the active one)', () => {
    const store = fakeStore({ activeWorkout: { id: 'a1', routineId: 'rtn-old' } })
    confirmReturn = false
    startOrContinue(store, 'rtn-new')
    assert.deepEqual(confirmMessages, [ABANDON_ON_NEW_WARNING])
    assert.deepEqual(names(store), []) // no abandon, no start
    assert.equal(store.draftWorkouts.length, 0)
  })

  it('continuing the SAME active workout (started today) → no confirm, no restart, just navigates', () => {
    const store = fakeStore({
      activeWorkout: { id: 'a1', routineId: 'rtn-x', startedAt: new Date().toISOString() },
    })
    startOrContinue(store, 'rtn-x')
    assert.deepEqual(confirmMessages, [])
    assert.deepEqual(names(store), []) // neither abandonWorkout nor startWorkout
  })

  // req-55 fix (post-review) — an inline Today/Upcoming Start passes no occurrenceId.
  // When the active workout for the same routine is STALE (started a prior day), that
  // is a genuinely new workout, not a continuation: it must abandon-on-new, never
  // silently resume yesterday's in-progress sets under yesterday's occurrence/date.
  it('STALE active (same routine, started a prior day) + no occurrenceId → warns, abandons, starts fresh', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const store = fakeStore({
      activeWorkout: { id: 'a1', routineId: 'rtn-x', startedAt: yesterday.toISOString() },
    })
    confirmReturn = true
    startOrContinue(store, 'rtn-x', {
      scheduledFor: dateKey(new Date()),
      scheduleSlotId: 'slot-today',
    })
    assert.deepEqual(confirmMessages, [ABANDON_ON_NEW_WARNING])
    // Does NOT silently continue: it discards the stale one then starts a fresh workout.
    assert.deepEqual(names(store), ['abandonWorkout', 'startWorkout'])
    assert.equal(store.draftWorkouts.length, 0)
  })

  it('resuming TODAY\'s active (same routine, started today) + no occurrenceId → no warning, no new startWorkout', () => {
    const store = fakeStore({
      activeWorkout: { id: 'a1', routineId: 'rtn-x', startedAt: new Date().toISOString() },
    })
    startOrContinue(store, 'rtn-x', {
      scheduledFor: dateKey(new Date()),
      scheduleSlotId: 'slot-today',
    })
    assert.deepEqual(confirmMessages, [])
    assert.deepEqual(names(store), []) // neither abandonWorkout nor startWorkout — just navigates
  })
})

describe('continueInProgress — resolve a stale/draft workout', () => {
  it('the stale ACTIVE workout is already active → just navigate, no confirm', () => {
    const active = { id: 'a1', routineId: 'rtn-x' }
    const store = fakeStore({ activeWorkout: active })
    continueInProgress(store, active)
    assert.deepEqual(confirmMessages, [])
    assert.deepEqual(names(store), []) // no continueDraft, no abandon
  })

  it('a legacy draft, no current active → promotes it, no confirm', () => {
    const store = fakeStore({ activeWorkout: null })
    const draft = { id: 'd1', routineId: 'rtn-d' }
    continueInProgress(store, draft)
    assert.deepEqual(confirmMessages, [])
    assert.deepEqual(names(store), ['continueDraft'])
    assert.deepEqual(store.calls[0].args, ['d1'])
  })

  it('a legacy draft while a different active exists + OK → warns, then promotes', () => {
    const store = fakeStore({ activeWorkout: { id: 'a1', routineId: 'rtn-x' } })
    const draft = { id: 'd1', routineId: 'rtn-d' }
    confirmReturn = true
    continueInProgress(store, draft)
    assert.deepEqual(confirmMessages, [ABANDON_ON_NEW_WARNING])
    assert.deepEqual(names(store), ['continueDraft'])
  })

  it('a legacy draft while a different active exists + Cancel → nothing', () => {
    const store = fakeStore({ activeWorkout: { id: 'a1', routineId: 'rtn-x' } })
    confirmReturn = false
    continueInProgress(store, { id: 'd1', routineId: 'rtn-d' })
    assert.deepEqual(names(store), [])
  })
})

describe('resumeTarget (req-76) — Continue lands on the current exercise', () => {
  // Real snapshot items carry a distinct `id` as well as the routineItemId; include
  // it so setsForItem's id-fallback clauses don't false-match a set to the wrong item.
  const items = [
    { id: 'x1', routineItemId: 'i1', sets: 2 },
    { id: 'x2', routineItemId: 'i2', sets: 2 },
    { id: 'x3', routineItemId: 'i3', sets: 2 },
  ]
  const workout = (sets = [], completedItemIds = []) => ({
    routineId: 'rtn-x',
    snapshot: { items },
    sets,
    completedItemIds,
  })

  it('nothing done → first item log page', () => {
    assert.equal(resumeTarget(workout()), '/workout/rtn-x/item/i1/log')
  })

  it('first item marked done → next not-done item', () => {
    assert.equal(resumeTarget(workout([], ['i1'])), '/workout/rtn-x/item/i2/log')
  })

  it('first item planned-done (all work sets logged) → next not-done item', () => {
    const sets = [
      { routineItemId: 'i1', setType: 'work' },
      { routineItemId: 'i1', setType: 'work' },
    ]
    assert.equal(resumeTarget(workout(sets)), '/workout/rtn-x/item/i2/log')
  })

  it('a fully-skipped exercise counts as done and is passed over', () => {
    const sets = [
      { routineItemId: 'i1', setType: 'work', reps: 'skipped' },
      { routineItemId: 'i1', setType: 'work', reps: 'skipped' },
    ]
    assert.equal(resumeTarget(workout(sets)), '/workout/rtn-x/item/i2/log')
  })

  it('every exercise done → overview (Finish visible), not a broken item page', () => {
    assert.equal(resumeTarget(workout([], ['i1', 'i2', 'i3'])), '/workout/rtn-x')
  })

  it('no items / no snapshot → overview', () => {
    assert.equal(resumeTarget({ routineId: 'rtn-x', snapshot: { items: [] } }), '/workout/rtn-x')
    assert.equal(resumeTarget({ routineId: 'rtn-x' }), '/workout/rtn-x')
  })

  it('resuming the same active workout navigates into the current exercise (no restart)', () => {
    const active = {
      id: 'a1',
      routineId: 'rtn-x',
      startedAt: new Date().toISOString(),
      snapshot: { items: [{ id: 'x1', routineItemId: 'i1', sets: 1 }, { id: 'x2', routineItemId: 'i2', sets: 1 }] },
      sets: [{ routineItemId: 'i1', setType: 'work' }], // i1 planned-done
      completedItemIds: [],
    }
    const store = fakeStore({ activeWorkout: active })
    startOrContinue(store, 'rtn-x')
    assert.deepEqual(names(store), []) // neither abandon nor restart
    assert.equal(hashPath(globalThis.window.location.hash), '/workout/rtn-x/item/i2/log')
  })
})

describe('abandonInProgress — discard entirely, no history record', () => {
  it('the stale ACTIVE workout → abandonWorkout (never adds to workouts)', () => {
    const active = { id: 'a1', routineId: 'rtn-x' }
    const store = fakeStore({ activeWorkout: active })
    confirmReturn = true
    abandonInProgress(store, active)
    assert.equal(confirmMessages.length, 1)
    assert.deepEqual(names(store), ['abandonWorkout'])
  })

  it('a legacy draft → abandonDraft(id)', () => {
    const store = fakeStore({ activeWorkout: { id: 'a1', routineId: 'rtn-x' } })
    confirmReturn = true
    abandonInProgress(store, { id: 'd1', routineId: 'rtn-d' })
    assert.deepEqual(names(store), ['abandonDraft'])
    assert.deepEqual(store.calls[0].args, ['d1'])
  })

  it('Cancel at the confirm → nothing discarded', () => {
    const active = { id: 'a1', routineId: 'rtn-x' }
    const store = fakeStore({ activeWorkout: active })
    confirmReturn = false
    abandonInProgress(store, active)
    assert.deepEqual(names(store), [])
  })
})

// Source guard (mirrors store.test.js's approach): the store's one-in-progress shape
// can't be exercised through import, so lock it against regression — startWorkout must
// not write draftWorkouts, and resumeDraft must be gone.
describe('req-55 store.jsx is one-in-progress (source guard)', () => {
  const src = readFileSync(fileURLToPath(new URL('./store.jsx', import.meta.url)), 'utf8')

  it('startWorkout no longer stacks drafts and resumeDraft is removed', () => {
    // The old draft-stacking push assigned draftWorkouts from s.activeWorkout.
    assert.equal(
      /draftWorkouts:\s*s\.activeWorkout/.test(src),
      false,
      'startWorkout must not push the active workout into draftWorkouts',
    )
    assert.equal(/resumeDraft\s*\(/.test(src), false, 'resumeDraft must be removed')
    // The replacements exist.
    assert.match(src, /continueDraft\s*\(/)
    assert.match(src, /abandonDraft\s*\(/)
    assert.match(src, /abandonWorkout\s*\(\)/)
  })
})

// req-114 / DEC-058 §2 — "continuing the same workout" uses the shared current rule
// (started today OR within 6 h), and today's Start names its occurrence. The clock is
// faked (mock.timers Date) at Wed 2026-09-23 00:05 local.
describe('req-114 startOrContinue across midnight', () => {
  beforeEach(() => mock.timers.enable({ apis: ['Date'], now: new Date(2026, 8, 23, 0, 5) }))
  afterEach(() => mock.timers.reset())

  const tuesdayR = () => ({
    id: 'a1',
    routineId: 'rtn-r',
    scheduleSlotId: 'slot-tue',
    occurrenceId: 'slot-tue@2026-09-22',
    startedAt: new Date(2026, 8, 22, 23, 50).toISOString(),
  })

  it('the hero Continue (no occurrence) on a Tue 23:50 workout at Wed 00:05 → continues, no confirm', () => {
    const store = fakeStore({ activeWorkout: tuesdayR() })
    startOrContinue(store, 'rtn-r')
    assert.deepEqual(confirmMessages, [])
    assert.deepEqual(names(store), [])
  })

  it("Wed's slot of the same routine (its own occurrence) → asks before abandoning", () => {
    const store = fakeStore({ activeWorkout: tuesdayR() })
    confirmReturn = false
    startOrContinue(store, 'rtn-r', {
      scheduledFor: '2026-09-23',
      scheduleSlotId: 'slot-wed',
      occurrenceId: 'slot-wed@2026-09-23',
    })
    assert.deepEqual(confirmMessages, [ABANDON_ON_NEW_WARNING])
    assert.deepEqual(names(store), []) // Cancel keeps the Tuesday workout
  })

  it('the same occurrence named explicitly → continues', () => {
    const store = fakeStore({ activeWorkout: tuesdayR() })
    startOrContinue(store, 'rtn-r', { occurrenceId: 'slot-tue@2026-09-22' })
    assert.deepEqual(confirmMessages, [])
    assert.deepEqual(names(store), [])
  })

  it('started yesterday 08:00, now 09:00 → stale: abandon-on-new', () => {
    mock.timers.setTime(new Date(2026, 8, 23, 9, 0).getTime())
    const store = fakeStore({
      activeWorkout: { ...tuesdayR(), startedAt: new Date(2026, 8, 22, 8, 0).toISOString() },
    })
    startOrContinue(store, 'rtn-r')
    assert.deepEqual(confirmMessages, [ABANDON_ON_NEW_WARNING])
    assert.deepEqual(names(store), ['abandonWorkout', 'startWorkout'])
  })
})
