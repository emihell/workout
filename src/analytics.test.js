import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  ANALYTICS_KEY,
  BUILD_ID,
  LEGACY_DAY,
  applyButton,
  applyButtonEvent,
  applyScreen,
  applyScreenEvent,
  emptyAnalytics,
  emptyDay,
  exportAnalytics,
  exportAndResetAnalytics,
  loadAnalytics,
  parseAnalytics,
  recordButton,
  recordScreen,
  resetAnalytics,
  sumDays,
} from './analytics.js'
import { parseRoute } from './route.js'
import { buildBackup } from './exchange.js'

describe('pure count logic', () => {
  it('recordScreen increments the screen and the prev>>next transition', () => {
    const data = emptyDay()
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
    const data = emptyDay()
    applyScreen(data, 'today', 'today')
    assert.equal(data.screens.today, 1)
    assert.deepEqual(data.transitions, {})
  })

  it('recordButton increments the button count', () => {
    const data = emptyDay()
    applyButton(data, 'complete-set')
    applyButton(data, 'complete-set')
    applyButton(data, 'skip-set')
    assert.equal(data.buttons['complete-set'], 2)
    assert.equal(data.buttons['skip-set'], 1)
  })
})

describe('id-bearing paths collapse to the bounded route name', () => {
  it('two different workouts/exercises map to the same screen + transition keys', () => {
    const a = emptyDay()
    const b = emptyDay()
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
    // req-197 — was ['buttons', 'screens', 'transitions']: the counts now sit in day buckets.
    assert.deepEqual(Object.keys(before).sort(), ['days', 'v'])
    recordButton('export-analytics-e2e', new Date(2026, 9, 7, 12))
    assert.ok(exportAnalytics().days['2026-10-07'].buttons['export-analytics-e2e'] >= 1)
    // Same reference each call — the raw stored object, not a copy.
    assert.equal(exportAnalytics(), before)
  })

  it('analytics uses a separate key and never rides in the workout backup', () => {
    assert.equal(ANALYTICS_KEY, 'workout-mvp-analytics')
    assert.notEqual(ANALYTICS_KEY, 'workout-mvp-v9')

    // The workout backup is built only from store state, which has no analytics
    // fields — recording analytics can never change it.
    const state = { exercises: [], routines: [], workouts: [], schedule: {} }
    const pack = buildBackup(state)
    assert.equal(pack.state.screens, undefined)
    assert.equal(pack.state.transitions, undefined)
    assert.equal(pack.state.buttons, undefined)
  })
})

// ---- req-197 — per day, per build; v1 kept; Export analytics resets ----

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    map,
  }
}

function withStorage(storage, fn) {
  const orig = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  globalThis.localStorage = storage
  try {
    return fn()
  } finally {
    if (orig) Object.defineProperty(globalThis, 'localStorage', orig)
    else delete globalThis.localStorage
  }
}

describe('req-197 — counts by day and by build', () => {
  it('AC1: two events on different days land in two day keys, each with its own builds count', () => {
    const data = emptyAnalytics()
    applyScreenEvent(data, 'today', null, '2026-10-06', 'aaa1111')
    applyScreenEvent(data, 'library', { name: 'today', day: '2026-10-06' }, '2026-10-06', 'aaa1111')
    applyScreenEvent(data, 'settings', { name: 'library', day: '2026-10-06' }, '2026-10-07', 'bbb2222')
    assert.deepEqual(Object.keys(data.days).sort(), ['2026-10-06', '2026-10-07'])
    assert.deepEqual(data.days['2026-10-06'].builds, { aaa1111: 2 })
    assert.deepEqual(data.days['2026-10-07'].builds, { bbb2222: 1 })
    assert.deepEqual(data.days['2026-10-06'].screens, { today: 1, library: 1 })
    assert.deepEqual(data.days['2026-10-06'].transitions, { 'today>>library': 1 })
    // a transition never crosses a day boundary
    assert.deepEqual(data.days['2026-10-07'].transitions, {})
  })

  it('AC1 (live recorder): recordScreen on two mocked days splits by local date, builds counted per day', () => {
    withStorage(memoryStorage(), () => {
      resetAnalytics()
      recordScreen('today', new Date(2026, 9, 6, 23, 59))
      recordScreen('library', new Date(2026, 9, 7, 0, 1))
      recordScreen('settings', new Date(2026, 9, 7, 0, 2))
      const { days } = exportAnalytics()
      assert.deepEqual(Object.keys(days).sort(), ['2026-10-06', '2026-10-07'])
      assert.deepEqual(days['2026-10-06'].builds, { [BUILD_ID]: 1 })
      assert.deepEqual(days['2026-10-07'].builds, { [BUILD_ID]: 2 })
      assert.deepEqual(days['2026-10-07'].transitions, { 'library>>settings': 1 })
      assert.equal(BUILD_ID, 'dev', 'no __BUILD_ID__ under node --test')
    })
  })

  it('a button press lands in its day bucket', () => {
    const data = emptyAnalytics()
    applyButtonEvent(data, 'complete-set', '2026-10-07')
    applyButtonEvent(data, 'complete-set', '2026-10-07')
    assert.deepEqual(data.days['2026-10-07'].buttons, { 'complete-set': 2 })
  })

  it('AC2: a v1 blob in storage loads as days["before-dates"] with its counts unchanged', () => {
    const v1 = {
      screens: { today: 113, library: 64, settings: 43 },
      transitions: { 'today>>library': 46, 'library>>today': 42 },
      buttons: { 'finish-workout': 2 },
    }
    const loaded = withStorage(memoryStorage({ [ANALYTICS_KEY]: JSON.stringify(v1) }), () => loadAnalytics())
    assert.equal(loaded.v, 2)
    assert.deepEqual(Object.keys(loaded.days), [LEGACY_DAY])
    assert.equal(LEGACY_DAY, 'before-dates')
    assert.deepEqual(loaded.days['before-dates'], { ...v1, builds: {} })
    // a v2 blob round-trips unchanged
    assert.deepEqual(parseAnalytics(JSON.stringify(loaded)), loaded)
  })

  it('AC3: Export analytics downloads the populated object; the stored key then holds only the post-reset press', () => {
    const storage = memoryStorage()
    withStorage(storage, () => {
      resetAnalytics()
      const now = new Date(2026, 9, 7, 9)
      recordScreen('today', now)
      recordScreen('settings', now)
      recordButton('complete-set', now)
      let downloaded = null
      exportAndResetAnalytics((obj) => {
        downloaded = JSON.parse(JSON.stringify(obj))
      }, now)
      assert.deepEqual(downloaded.days['2026-10-07'].screens, { today: 1, settings: 1 })
      assert.deepEqual(downloaded.days['2026-10-07'].buttons, { 'complete-set': 1 })
      assert.equal(downloaded.days['2026-10-07'].buttons['export-analytics'], undefined, 'press not in the download')
      const stored = JSON.parse(storage.map.get(ANALYTICS_KEY))
      assert.deepEqual(stored, {
        v: 2,
        days: { '2026-10-07': { screens: {}, transitions: {}, buttons: { 'export-analytics': 1 }, builds: {} } },
      })
    })
  })

  it('AC3: a throwing download resets nothing', () => {
    withStorage(memoryStorage(), () => {
      resetAnalytics()
      recordButton('complete-set', new Date(2026, 9, 7, 9))
      assert.throws(() =>
        exportAndResetAnalytics(() => {
          throw new Error('download failed')
        }),
      )
      assert.equal(exportAnalytics().days['2026-10-07'].buttons['complete-set'], 1)
    })
  })

  it('AC4: corrupt or non-object blobs load as empty, never throw', () => {
    for (const raw of ['{not json', '42', '"x"', '[1,2]', 'null', '{"v":2,"days":[1]}', '{"v":9}']) {
      const loaded = withStorage(memoryStorage({ [ANALYTICS_KEY]: raw }), () => loadAnalytics())
      assert.equal(loaded.v, 2, raw)
      assert.deepEqual(loaded.days, {}, raw)
    }
    // a corrupt day bucket inside a v2 blob is normalised, so recording into it can't throw
    const odd = parseAnalytics(JSON.stringify({ v: 2, days: { '2026-10-07': 'x' } }))
    assert.doesNotThrow(() => applyScreenEvent(odd, 'today', null, '2026-10-07', 'dev'))
    // getItem itself throwing
    const throwing = {
      getItem: () => {
        throw new Error('denied')
      },
    }
    assert.deepEqual(
      withStorage(throwing, () => loadAnalytics()),
      emptyAnalytics(),
    )
  })

  it('AC4: a throwing setItem never throws out of recordScreen, recordButton, or Export analytics', () => {
    withStorage(
      {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError')
        },
      },
      () => {
        assert.doesNotThrow(() => recordScreen('today', new Date(2026, 9, 7)))
        assert.doesNotThrow(() => recordButton('complete-set', new Date(2026, 9, 7)))
        assert.doesNotThrow(() => exportAndResetAnalytics(() => {}))
      },
    )
  })

  it('sumDays adds every day bucket together', () => {
    const data = emptyAnalytics()
    applyButtonEvent(data, 'x', '2026-10-06')
    applyButtonEvent(data, 'x', '2026-10-07')
    assert.equal(sumDays(data).buttons.x, 2)
  })
})
