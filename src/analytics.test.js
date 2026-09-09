import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  ANALYTICS_KEY,
  applyButton,
  applyScreen,
  emptyAnalytics,
  exportAnalytics,
  recordButton,
  recordScreen,
} from './analytics.js'
import { parseRoute } from './route.js'
import { buildBackup } from './exchange.js'

describe('pure count logic', () => {
  it('recordScreen increments the screen and the prev>>next transition', () => {
    const data = emptyAnalytics()
    applyScreen(data, 'today', null)
    assert.equal(data.screens.today, 1)
    assert.deepEqual(data.transitions, {})

    applyScreen(data, 'workout', 'today')
    assert.equal(data.screens.workout, 1)
    assert.equal(data.transitions['today>>workout'], 1)

    applyScreen(data, 'workout-item-log', 'workout')
    applyScreen(data, 'workout', 'workout-item-log')
    applyScreen(data, 'workout-item-log', 'workout')
    assert.equal(data.screens['workout-item-log'], 2)
    assert.equal(data.transitions['workout>>workout-item-log'], 2)
    assert.equal(data.transitions['workout-item-log>>workout'], 1)
  })

  it('does not record a self-transition (same screen twice)', () => {
    const data = emptyAnalytics()
    applyScreen(data, 'today', 'today')
    assert.equal(data.screens.today, 1)
    assert.deepEqual(data.transitions, {})
  })

  it('recordButton increments the button count', () => {
    const data = emptyAnalytics()
    applyButton(data, 'complete-set')
    applyButton(data, 'complete-set')
    applyButton(data, 'skip-set')
    assert.equal(data.buttons['complete-set'], 2)
    assert.equal(data.buttons['skip-set'], 1)
  })
})

describe('id-bearing paths collapse to the bounded route name', () => {
  it('two different workouts/exercises map to the same screen + transition keys', () => {
    const a = emptyAnalytics()
    const b = emptyAnalytics()
    // Different ids in the path, same route name — so the store stays bounded.
    const nameA = parseRoute('/workout/routine-1/item/item-aaa/log').name
    const nameB = parseRoute('/workout/routine-9/item/item-zzz/log').name
    assert.equal(nameA, 'workout-item-log')
    assert.equal(nameB, 'workout-item-log')

    applyScreen(a, nameA, parseRoute('/workout/routine-1').name)
    applyScreen(b, nameB, parseRoute('/workout/routine-9').name)
    assert.deepEqual(Object.keys(a.screens), Object.keys(b.screens))
    assert.deepEqual(Object.keys(a.transitions), ['workout>>workout-item-log'])
    assert.deepEqual(Object.keys(b.transitions), ['workout>>workout-item-log'])
  })
})

describe('fail-silent storage writes', () => {
  it('recordScreen / recordButton do not throw when setItem throws (quota / private mode)', () => {
    const orig = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    globalThis.localStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    try {
      assert.doesNotThrow(() => recordScreen('today'))
      assert.doesNotThrow(() => recordScreen('workout'))
      assert.doesNotThrow(() => recordButton('complete-set'))
    } finally {
      if (orig) Object.defineProperty(globalThis, 'localStorage', orig)
      else delete globalThis.localStorage
    }
  })
})

describe('export and isolation from workout history', () => {
  it('exportAnalytics returns the live, mutating analytics object', () => {
    const before = exportAnalytics()
    assert.deepEqual(Object.keys(before).sort(), ['buttons', 'screens', 'transitions'])
    recordButton('export-analytics-e2e')
    assert.ok(exportAnalytics().buttons['export-analytics-e2e'] >= 1)
    // Same reference each call — the raw stored object, not a copy.
    assert.equal(exportAnalytics(), before)
  })

  it('analytics uses a separate key and never rides in the workout backup', () => {
    assert.equal(ANALYTICS_KEY, 'workout-mvp-analytics')
    assert.notEqual(ANALYTICS_KEY, 'workout-mvp-v8')

    // The workout backup is built only from store state, which has no analytics
    // fields — recording analytics can never change it.
    const state = { exercises: [], routines: [], workouts: [], schedule: {} }
    const pack = buildBackup(state)
    assert.equal(pack.state.screens, undefined)
    assert.equal(pack.state.transitions, undefined)
    assert.equal(pack.state.buttons, undefined)
  })
})
