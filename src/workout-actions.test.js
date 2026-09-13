import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  ABANDON_ON_NEW_WARNING,
  abandonInProgress,
  continueInProgress,
  startOrContinue,
} from './workout-actions.js'

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

  it('continuing the SAME active workout → no confirm, no restart, just navigates', () => {
    const store = fakeStore({ activeWorkout: { id: 'a1', routineId: 'rtn-x' } })
    startOrContinue(store, 'rtn-x')
    assert.deepEqual(confirmMessages, [])
    assert.deepEqual(names(store), []) // neither abandonWorkout nor startWorkout
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
