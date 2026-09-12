import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { completedOnDayKey, emptyState, getLoadUnreadable, getSaveFailed, historyPrescription, historySetPrefill, isExternalStateChange, loadState, saveState } from './storage.js'
import { dateKey } from './schedule.js'

// Swap in a localStorage whose setItem records normally, throws, or silently
// no-ops (the iOS/Safari Private Mode failure the req-06 read-back defends
// against). `seed` pre-populates keys; removeItem deletes from the same map.
function withLocalStorage({ throwOnSet = false, silentSet = false, seed = {} } = {}, run) {
  const previous = globalThis.localStorage
  const map = new Map(Object.entries(seed))
  globalThis.localStorage = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      if (throwOnSet) throw new Error('QuotaExceededError')
      if (silentSet) return
      map.set(key, String(value))
    },
    removeItem: (key) => {
      map.delete(key)
    },
  }
  try {
    return run(map)
  } finally {
    globalThis.localStorage = previous
  }
}

describe('saveState guards a failed write', () => {
  it('does not throw and sets the failure signal when setItem throws', () => {
    withLocalStorage({ throwOnSet: true }, () => {
      assert.doesNotThrow(() => saveState(emptyState()))
      assert.equal(getSaveFailed(), true)
    })
  })

  it('a normal save leaves the failure signal clear', () => {
    withLocalStorage({}, () => {
      saveState(emptyState())
      assert.equal(getSaveFailed(), false)
    })
  })

  it('a throwing save followed by a succeeding one ends clear', () => {
    // First a failure: signal goes true.
    withLocalStorage({ throwOnSet: true }, () => {
      saveState(emptyState())
      assert.equal(getSaveFailed(), true)
    })
    // Then a success: signal clears.
    withLocalStorage({}, () => {
      saveState(emptyState())
      assert.equal(getSaveFailed(), false)
    })
  })
})

describe('blank device storage', () => {
  it('starts with no routines, exercises, or history', () => {
    const state = emptyState()
    assert.equal(state.routines.length, 0)
    assert.equal(state.exercises.length, 0)
    assert.equal(state.workouts.length, 0)
    assert.equal(state.schedule.slots.length, 0)
  })

  it('loadState is empty when this browser has no saved data', () => {
    const previous = globalThis.localStorage
    const map = new Map()
    globalThis.localStorage = {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => {
        map.set(key, String(value))
      },
    }
    try {
      const state = loadState()
      assert.equal(state.routines.length, 0)
      assert.equal(state.exercises.length, 0)
    } finally {
      globalThis.localStorage = previous
    }
  })

  it('keeps a saved database on this browser', () => {
    const previous = globalThis.localStorage
    const map = new Map()
    globalThis.localStorage = {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => {
        map.set(key, String(value))
      },
    }
    try {
      saveState({
        ...emptyState(),
        routines: [{ id: 'sess-1', name: 'Upper', focus: 'Machines', exercises: [] }],
      })
      const state = loadState()
      assert.equal(state.routines[0].name, 'Upper')
    } finally {
      globalThis.localStorage = previous
    }
  })

  it('flattens a v6 program backup onto routines and stores v8', () => {
    const previous = globalThis.localStorage
    const map = new Map()
    globalThis.localStorage = {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => {
        map.set(key, String(value))
      },
    }
    try {
      map.set(
        'workout-mvp-v6',
        JSON.stringify({
          schemaVersion: 6,
          exercises: [{ id: 'ex-1', name: 'Press', equipment: 'Machine', type: 'machine', weightStep: '5' }],
          programs: [
            {
              id: 'prog-1',
              name: 'Gym',
              sessions: [
                {
                  id: 'sess-1',
                  name: 'Upper',
                  focus: 'Machines',
                  exercises: [
                    {
                      exerciseId: 'ex-1',
                      sets: 1,
                      targets: ['5-8 min'],
                      suggestedWeights: [],
                    },
                  ],
                },
              ],
            },
          ],
          schedule: { loopWeeks: 1, slots: [{ week: 0, weekday: 1, programId: 'prog-1', sessionId: 'sess-1' }] },
          workouts: [],
        }),
      )
      const state = loadState()
      assert.equal(state.routines[0].name, 'Upper')
      assert.equal(state.routines[0].exercises[0].sets, 1)
      assert.equal(state.programs, undefined)
      assert.equal(state.sessions, undefined)
      const stored = JSON.parse(map.get('workout-mvp-v8'))
      assert.equal(stored.routines[0].id, 'sess-1')
      assert.equal(stored.programs, undefined)
    } finally {
      globalThis.localStorage = previous
    }
  })
})

// req-06 — legacy keys are removed only after v8 is confirmed persisted by a
// read-back. The failure-case tests are the point: a failed or silent upgrade
// must leave the legacy copy intact, because it is the only surviving history.
describe('req-06 legacy-key cleanup', () => {
  const legacyV7 = JSON.stringify({
    schemaVersion: 7,
    exercises: [{ id: 'ex-1', name: 'Press', equipment: 'Machine', type: 'machine', weightStep: '5' }],
    routines: [{ id: 'sess-1', name: 'Upper', focus: 'Machines', exercises: [] }],
  })
  const validV8 = JSON.stringify({
    ...emptyState(),
    routines: [{ id: 'sess-1', name: 'Upper', focus: 'Machines', exercises: [] }],
  })

  it('happy path: migrates v7, writes v8, and removes every legacy key', () => {
    withLocalStorage({ seed: { 'workout-mvp-v7': legacyV7 } }, (map) => {
      const state = loadState()
      assert.equal(state.routines[0].name, 'Upper')
      assert.ok(map.get('workout-mvp-v8')) // v8 was written
      assert.equal(map.get('workout-mvp-v7') ?? null, null) // legacy gone
      assert.equal(map.get('workout-mvp-v6') ?? null, null)
      assert.equal(map.get('workout-mvp-v5') ?? null, null)
    })
  })

  it('failure — throwing write: v7 survives a failed upgrade', () => {
    withLocalStorage({ throwOnSet: true, seed: { 'workout-mvp-v7': legacyV7 } }, (map) => {
      const state = loadState()
      assert.equal(state.routines[0].name, 'Upper') // load still returns usable state
      assert.equal(map.get('workout-mvp-v8') ?? null, null) // nothing persisted
      assert.ok(map.get('workout-mvp-v7')) // legacy copy is still here
    })
  })

  it('failure — silent no-op write: v7 survives (the read-back is the whole point)', () => {
    // setItem does nothing and does NOT throw, so getItem('...v8') stays null.
    // A cleanup keyed on "saveState didn't throw" would wrongly delete v7 here.
    withLocalStorage({ silentSet: true, seed: { 'workout-mvp-v7': legacyV7 } }, (map) => {
      const state = loadState()
      assert.equal(state.routines[0].name, 'Upper')
      assert.equal(map.get('workout-mvp-v8') ?? null, null) // silently stored nothing
      assert.ok(map.get('workout-mvp-v7')) // legacy copy still present — not deleted
    })
  })

  it('already on v8, no legacy: unchanged, nothing removed, no throw', () => {
    withLocalStorage({ seed: { 'workout-mvp-v8': validV8 } }, (map) => {
      const before = map.get('workout-mvp-v8')
      let state
      assert.doesNotThrow(() => {
        state = loadState()
      })
      assert.equal(state.routines[0].name, 'Upper')
      assert.equal(map.get('workout-mvp-v8'), before) // v8 write path untouched
    })
  })

  it('already on v8 with a leftover legacy key: reclaims the legacy copy', () => {
    withLocalStorage(
      { seed: { 'workout-mvp-v8': validV8, 'workout-mvp-v7': legacyV7 } },
      (map) => {
        loadState()
        assert.ok(map.get('workout-mvp-v8')) // v8 intact
        assert.equal(map.get('workout-mvp-v7') ?? null, null) // interrupted cleanup finished
      },
    )
  })
})

// req-37 (audit F-RISK-1) — `workout-mvp-v5` is a claimed-supported legacy key but
// had no round-trip test (v6 :107-158, v7 :175-227 do; v5 had only a delete
// assertion :182). There is no distinct v5 on-disk shape in git history and
// migrateState is uniform/shape-driven (model.js:219), so this seeds a v5
// (program-wrapped) shape and — the real prize — covers the legacy paths the v6/v7
// tests skip: workout-level `sessionId`/`programName` (workoutSnapshot +
// stripLegacyWorkoutKeys) and plan `sessionId` → routineId. Test-only; no
// production change.
describe('req-37 v5 migration round-trip', () => {
  const v5 = JSON.stringify({
    schemaVersion: 5,
    exercises: [{ id: 'ex-1', name: 'Press', equipment: 'Machine', type: 'machine', weightStep: '5' }],
    programs: [
      {
        id: 'prog-1',
        name: 'Gym',
        sessions: [
          {
            id: 'sess-1',
            name: 'Upper',
            focus: 'Machines',
            exercises: [{ exerciseId: 'ex-1', sets: 1, targets: ['8'], suggestedWeights: [40] }],
          },
        ],
      },
    ],
    schedule: { loopWeeks: 1, slots: [{ week: 0, weekday: 1, programId: 'prog-1', sessionId: 'sess-1' }] },
    // Legacy workout shape the v6/v7 tests skip: sessionId + programName on the
    // workout, a snapshot to migrate, and logged sets.
    workouts: [
      {
        id: 'wo-1',
        sessionId: 'sess-1',
        programName: 'Gym',
        finishedAt: '2026-08-20T10:00:00.000Z',
        snapshot: { sessionId: 'sess-1', sessionName: 'Upper', programName: 'Gym', items: [{ exerciseId: 'ex-1', sessionItemId: 'si-old-1' }] },
        sets: [{ exerciseId: 'ex-1', sessionItemId: 'si-old-1', setType: 'work', weight: 40, reps: '8' }],
      },
    ],
    // Legacy plan shape: plan-level sessionId → routineId.
    plannedWorkouts: [{ id: 'pw-1', sessionId: 'sess-1', date: '2026-08-27', items: [{ exerciseId: 'ex-1', sessionItemId: 'si-old-1' }] }],
  })

  it('reads the v5 key, flattens programs, maps every sessionId→routineId, writes v8', () => {
    withLocalStorage({ seed: { 'workout-mvp-v5': v5 } }, (map) => {
      const state = loadState()

      // Routine flatten + opaque id + fields preserved; program wrapper dropped.
      assert.equal(state.routines.length, 1)
      assert.equal(state.routines[0].id, 'sess-1')
      assert.equal(state.routines[0].name, 'Upper')
      assert.equal(state.routines[0].focus, 'Machines')
      assert.equal(state.programs, undefined)
      assert.equal(state.sessions, undefined)

      // Schedule slot: sessionId → routineId, no leftover sessionId.
      assert.equal(state.schedule.slots.length, 1)
      assert.equal(state.schedule.slots[0].routineId, 'sess-1')
      assert.equal(state.schedule.slots[0].sessionId, undefined)

      // Workout: routineId from sessionId, sessionId stripped off the workout,
      // snapshot migrated (its own sessionId dropped) and programName preserved.
      assert.equal(state.workouts.length, 1)
      assert.equal(state.workouts[0].routineId, 'sess-1')
      assert.equal(state.workouts[0].sessionId, undefined)
      assert.equal(state.workouts[0].snapshot.routineId, 'sess-1')
      assert.equal(state.workouts[0].snapshot.sessionId, undefined)
      assert.equal(state.workouts[0].snapshot.programName, 'Gym')
      // Snapshot item: legacy sessionItemId → routineItemId, sessionItemId dropped.
      assert.equal(state.workouts[0].snapshot.items[0].exerciseId, 'ex-1')
      assert.equal(state.workouts[0].snapshot.items[0].routineItemId, 'si-old-1')
      assert.equal(state.workouts[0].snapshot.items[0].sessionItemId, undefined)
      // Set: legacy sessionItemId → routineItemId too.
      assert.equal(state.workouts[0].sets[0].routineItemId, 'si-old-1')
      assert.equal(state.workouts[0].sets[0].sessionItemId, undefined)

      // Plan: sessionId → routineId.
      assert.equal(state.plannedWorkouts.length, 1)
      assert.equal(state.plannedWorkouts[0].routineId, 'sess-1')
      assert.equal(state.plannedWorkouts[0].sessionId, undefined)

      // Persisted as v8, program wrapper gone from disk too.
      const stored = JSON.parse(map.get('workout-mvp-v8'))
      assert.equal(stored.schemaVersion, 8)
      assert.equal(stored.routines[0].id, 'sess-1')
      assert.equal(stored.programs, undefined)
    })
  })
})

// req-36 / DEC-032 — a corrupt-but-present `workout-mvp-v8` value must never be
// silently overwritten. loadState distinguishes "absent" (blank device) from
// "present but unreadable"; the latter latches getLoadUnreadable() and makes
// saveState refuse to write, so the raw corrupt bytes stay on disk and recoverable.
describe('req-36 corrupt v8 guard', () => {
  const corrupt = '{not valid json, definitely-not-parseable'

  it('(a) preserves a corrupt v8 value byte-for-byte across a mutation', () => {
    withLocalStorage({ seed: { 'workout-mvp-v8': corrupt } }, (map) => {
      const state = loadState()
      // Renders as a blank device rather than throwing...
      assert.equal(state.routines.length, 0)
      assert.equal(state.workouts.length, 0)
      // ...but the "unreadable" signal is latched (distinct from save-failed)...
      assert.equal(getLoadUnreadable(), true)
      assert.equal(getSaveFailed(), false)
      // ...and a subsequent save (what the store's first mutation would do) is a
      // no-op that returns false and leaves the raw corrupt string untouched.
      const wrote = saveState({
        ...emptyState(),
        routines: [{ id: 'sess-x', name: 'New', focus: 'Machines', exercises: [] }],
      })
      assert.equal(wrote, false)
      assert.equal(map.get('workout-mvp-v8'), corrupt) // byte-for-byte unchanged
    })
  })

  it('(b) an absent key is a blank device: signal clear, saves work', () => {
    withLocalStorage({ seed: {} }, (map) => {
      const state = loadState()
      assert.equal(state.routines.length, 0)
      assert.equal(getLoadUnreadable(), false)
      assert.equal(saveState(emptyState()), true)
      assert.ok(map.get('workout-mvp-v8')) // save went through
    })
  })

  it('(c) a valid v8 value clears the signal and loads normally', () => {
    const validV8 = JSON.stringify({
      ...emptyState(),
      routines: [{ id: 'sess-1', name: 'Upper', focus: 'Machines', exercises: [] }],
    })
    withLocalStorage({ seed: { 'workout-mvp-v8': validV8 } }, () => {
      const state = loadState()
      assert.equal(state.routines[0].name, 'Upper')
      assert.equal(getLoadUnreadable(), false)
    })
  })

  it('an unreadable legacy-only key (no v8) counts as unreadable', () => {
    withLocalStorage({ seed: { 'workout-mvp-v7': corrupt } }, (map) => {
      const state = loadState()
      assert.equal(state.routines.length, 0)
      assert.equal(getLoadUnreadable(), true)
      assert.equal(saveState(emptyState()), false)
      assert.equal(map.get('workout-mvp-v7'), corrupt) // only surviving copy kept
      assert.equal(map.get('workout-mvp-v8') ?? null, null) // nothing written over it
    })
    // Cleanup / assertion: a later readable load clears the latched signal, so it
    // reflects the *current* stored value and never leaks into other tests.
    withLocalStorage({ seed: {} }, () => {
      loadState()
      assert.equal(getLoadUnreadable(), false)
    })
  })
})

describe('req-41 isExternalStateChange (audit F-RISK-3)', () => {
  it('is true when another tab wrote our key', () => {
    assert.equal(isExternalStateChange({ key: 'workout-mvp-v8' }), true)
  })

  it('is true when another tab cleared storage (key === null)', () => {
    assert.equal(isExternalStateChange({ key: null }), true)
  })

  it('is false for a different app key', () => {
    assert.equal(isExternalStateChange({ key: 'workout-mvp-analytics' }), false)
  })

  it('is false for an unrelated key', () => {
    assert.equal(isExternalStateChange({ key: 'something-else' }), false)
  })
})

describe('historyPrescription', () => {
  it('is empty when this exercise has never been logged', () => {
    assert.equal(historyPrescription([], 'ex-press'), null)
  })

  it('uses the last completed working sets', () => {
    const next = historyPrescription(
      [
        {
          finishedAt: '2026-08-20T10:00:00.000Z',
          sets: [
            { exerciseId: 'ex-press', setType: 'work', weight: 20, reps: '12' },
          ],
        },
        {
          finishedAt: '2026-08-27T10:00:00.000Z',
          sets: [
            { exerciseId: 'ex-press', setType: 'wu', weight: 15, reps: '12' },
            { exerciseId: 'ex-press', setType: 'work', weight: 30, reps: '12' },
            { exerciseId: 'ex-press', setType: 'work', weight: 35, reps: '10' },
            { exerciseId: 'ex-press', setType: 'work', weight: 35, reps: '8' },
          ],
        },
      ],
      'ex-press',
    )
    assert.deepEqual(next, {
      sets: 3,
      targets: ['12', '10', '8'],
      suggestedWeights: [30, 35, 35],
      restSec: undefined,
      notes: '',
      warmup: { reps: '12' },
    })
  })

  it('prefills a logged set from history and leaves missing sets blank', () => {
    const last = {
      sets: [
        { setType: 'wu', weight: 15, reps: '12' },
        { setType: 'work', weight: 30, reps: '12' },
        { setType: 'work', weight: 35, reps: '10' },
      ],
    }
    assert.deepEqual(historySetPrefill(last, { setType: 'wu' }), { weight: '15', reps: '12' })
    assert.deepEqual(historySetPrefill(last, { setType: 'work', workIndex: 1 }), { weight: '35', reps: '10' })
    assert.deepEqual(historySetPrefill(last, { setType: 'work', workIndex: 2 }), { weight: '', reps: '' })
    assert.deepEqual(historySetPrefill(null, { setType: 'work', workIndex: 0 }), { weight: '', reps: '' })
  })
})

// req-28 — the Today page's "Completed today" section reads this. Finished-today
// only (finishedAt === the given day), newest first; a previous day or an
// unfinished workout must not appear. Timestamps are built from local Date objects
// (like the app's `new Date().toISOString()`) and the day key from the same source,
// so the local↔UTC round-trip in dateKey can't make the test timezone-dependent.
describe('completedOnDayKey (req-28 completed today)', () => {
  const day = dateKey(new Date(2026, 8, 11, 12, 0))
  const morning = { id: 'w-morn', finishedAt: new Date(2026, 8, 11, 8, 0).toISOString() }
  const evening = { id: 'w-eve', finishedAt: new Date(2026, 8, 11, 18, 30).toISOString() }
  const yesterday = { id: 'w-yest', finishedAt: new Date(2026, 8, 10, 20, 0).toISOString() }
  const unfinished = { id: 'w-active', finishedAt: null, startedAt: new Date(2026, 8, 11, 9, 0).toISOString() }

  it("returns today's finished workouts, newest first", () => {
    const result = completedOnDayKey([morning, yesterday, evening, unfinished], day)
    assert.deepEqual(result.map((w) => w.id), ['w-eve', 'w-morn'])
  })

  it('excludes a workout finished on a previous day', () => {
    assert.deepEqual(completedOnDayKey([yesterday], day), [])
  })

  it('excludes an unfinished (no finishedAt) workout', () => {
    assert.deepEqual(completedOnDayKey([unfinished], day), [])
  })

  it('empty / missing input → empty list', () => {
    assert.deepEqual(completedOnDayKey([], day), [])
    assert.deepEqual(completedOnDayKey(null, day), [])
  })
})
