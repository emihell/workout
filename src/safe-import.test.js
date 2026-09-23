import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { BACKUP_KIND, applyBackup, buildBackup, commitBackup } from './exchange.js'
import { emptyAnalytics } from './analytics.js'
import { emptyState, getLoadUnreadable, loadState, saveState } from './storage.js'

// req-115 (audit D) — a bad import must throw to the caller with state unchanged,
// never inside the setState updater (which blanked the whole app).

// Stand-in for the store's setState: records every call and applies the updater.
function fakeStore(initial) {
  const box = { state: initial, calls: 0 }
  box.setState = (updater) => {
    box.calls += 1
    box.state = updater(box.state)
  }
  return box
}

const wrap = (state) => ({ kind: BACKUP_KIND, version: 1, state })

const validState = () => ({
  ...emptyState(),
  exercises: [{ id: 'ex-press', name: 'Press', equipment: 'Machine', type: 'machine', weightStep: '5' }],
  routines: [
    {
      id: 'rtn-1',
      name: 'Upper',
      focus: 'Machines',
      exercises: [{ id: 'si-1', exerciseId: 'ex-press', role: 'main', restSec: 90, notes: '', warmup: null, sets: 1, targets: ['10'], suggestedWeights: [30] }],
    },
  ],
  schedule: { loopWeeks: 1, slots: [{ id: 'slot-1', week: 0, weekday: 1, routineId: 'rtn-1' }] },
  workouts: [
    {
      id: 'wo-1',
      routineId: 'rtn-1',
      finishedAt: '2026-09-20T18:00:00.000Z',
      performedOn: '2026-09-20',
      sets: [{ exerciseId: 'ex-press', routineItemId: 'si-1', setType: 'work', weight: 30, reps: '10' }],
    },
  ],
})

describe('req-115 commitBackup — failure cases throw, state unchanged', () => {
  // A real analytics export (Settings → Export analytics) is the measured repro.
  const analyticsExport = { ...emptyAnalytics(), screens: { today: 3, settings: 1 }, buttons: { import: 1 } }
  const cases = {
    'the analytics export': analyticsExport,
    '{workouts:[null]}': wrap({ workouts: [null] }),
    'routines[0].exercises:[null]': wrap({ routines: [{ id: 'r', name: 'R', exercises: [null] }] }),
    'schedule.slots:[null]': wrap({ schedule: { loopWeeks: 1, slots: [null] } }),
    'activeWorkout: 42': wrap({ activeWorkout: 42 }),
    // the rest of the recursive rule
    'exercises:[null] (bare doc)': { exercises: [null], routines: [] },
    'workouts[0].sets:"x"': wrap({ workouts: [{ id: 'w', sets: 'x' }] }),
    'workouts[0].sets:[null]': wrap({ workouts: [{ id: 'w', sets: [null] }] }),
    'workouts[0].snapshot.items:[null]': wrap({ workouts: [{ id: 'w', sets: [], snapshot: { items: [null] } }] }),
    'workouts[0].snapshot:"x"': wrap({ workouts: [{ id: 'w', sets: [], snapshot: 'x' }] }),
    'plannedWorkouts[0].items:[null]': wrap({ plannedWorkouts: [{ id: 'p', items: [null] }] }),
    'draftWorkouts:[7]': wrap({ draftWorkouts: [7] }),
    'programs[0].sessions:[null]': wrap({ programs: [{ id: 'g', sessions: [null] }] }),
    'activeWorkout.sets:[null]': wrap({ activeWorkout: { id: 'a', sets: [null] } }),
    'activeWorkout: []': wrap({ activeWorkout: [] }),
    'state: [] (array)': wrap([]),
  }
  for (const [name, payload] of Object.entries(cases)) {
    it(`${name} → "Not a workout database backup.", setState never called`, () => {
      const before = validState()
      const store = fakeStore(before)
      assert.throws(
        () => commitBackup(payload, store.setState),
        (err) => err instanceof Error && err.message === 'Not a workout database backup.',
      )
      assert.equal(store.calls, 0)
      assert.equal(store.state, before) // same object: nothing replaced
    })
  }
})

describe('req-115 commitBackup — success', () => {
  it('a valid backup imports as before and round-trips deep-equal', () => {
    const source = applyBackup(wrap(validState())).state // canonical (migrated) form
    const store = fakeStore(emptyState())
    const result = commitBackup(buildBackup(source), store.setState)
    assert.equal(store.calls, 1)
    assert.equal(store.state, result.state)
    assert.deepEqual(store.state, source)
    assert.deepEqual(result.summary, { routines: 1, exercises: 1, workouts: 1, slots: 1 })
    // and a second export → import is stable
    assert.deepEqual(commitBackup(buildBackup(store.state), fakeStore(null).setState).state, source)
  })

  it('activeWorkout: null and absent collections still import', () => {
    const store = fakeStore(emptyState())
    commitBackup(wrap({ exercises: [], routines: [], activeWorkout: null }), store.setState)
    assert.equal(store.calls, 1)
    assert.equal(store.state.activeWorkout, null)
  })

  it('store.jsx routes applyBackup through commitBackup, not inside a setState updater', () => {
    const src = readFileSync(fileURLToPath(new URL('./store.jsx', import.meta.url)), 'utf8')
    assert.match(src, /applyBackup\(payload\) \{\s*return commitBackup\(payload, setState\)/)
    assert.equal(/applyBackupFn/.test(src), false)
  })
})

// Mirrors storage.test.js's withLocalStorage (seeded map, recording setItem).
function withLocalStorage(seed, run) {
  const previous = globalThis.localStorage
  const map = new Map(Object.entries(seed))
  globalThis.localStorage = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  }
  try {
    return run(map)
  } finally {
    globalThis.localStorage = previous
  }
}

describe('req-115 a non-object v9 value is unreadable (DEC-032), not spread', () => {
  const v8 = JSON.stringify({ ...emptyState(), schemaVersion: 8, routines: [{ id: 'r8', name: 'Kept', focus: 'Machines', exercises: [] }] })
  for (const raw of ['"x"', '[1,2]', '42', 'null']) {
    it(`v9 = ${raw} + a v8 key → unreadable latched, v9 and v8 untouched`, () => {
      withLocalStorage({ 'workout-mvp-v9': raw, 'workout-mvp-v8': v8 }, (map) => {
        const state = loadState()
        assert.equal(getLoadUnreadable(), true)
        assert.equal(state.routines.length, 0)
        assert.equal(saveState(emptyState()), false) // saves held
        assert.equal(map.get('workout-mvp-v9'), raw)
        assert.equal(map.get('workout-mvp-v8'), v8)
      })
    })
  }
  it('cleanup: a later readable load clears the latch', () => {
    withLocalStorage({}, () => {
      loadState()
      assert.equal(getLoadUnreadable(), false)
    })
  })
})
