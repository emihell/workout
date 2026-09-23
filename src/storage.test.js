import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { completedOnDayKey, emptyState, exerciseDeletionImpact, getLoadUnreadable, getSaveFailed, historyPrescription, historySetPrefill, isExternalStateChange, lastSetsForExercise, loadState, previousSameRoutineWorkout, previousSameRoutineWorkouts, routineDeletionImpact, saveState, staleInProgressWorkouts, workoutSummaryStats } from './storage.js'
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
      const stored = JSON.parse(map.get('workout-mvp-v9'))
      assert.equal(stored.routines[0].id, 'sess-1')
      assert.equal(stored.programs, undefined)
    } finally {
      globalThis.localStorage = previous
    }
  })
})

// req-06 — legacy keys are removed only after the current key is confirmed persisted
// by a read-back. The failure-case tests are the point: a failed or silent upgrade
// must leave the legacy copy intact, because it is the only surviving history.
// (req-85 bumped the current key v8→v9, so v8 is now one of the legacy keys.)
describe('req-06 legacy-key cleanup', () => {
  const legacyV7 = JSON.stringify({
    schemaVersion: 7,
    exercises: [{ id: 'ex-1', name: 'Press', equipment: 'Machine', type: 'machine', weightStep: '5' }],
    routines: [{ id: 'sess-1', name: 'Upper', focus: 'Machines', exercises: [] }],
  })
  const validCurrent = JSON.stringify({
    ...emptyState(),
    routines: [{ id: 'sess-1', name: 'Upper', focus: 'Machines', exercises: [] }],
  })

  it('happy path: migrates v7, writes v9, and removes every legacy key', () => {
    withLocalStorage({ seed: { 'workout-mvp-v7': legacyV7 } }, (map) => {
      const state = loadState()
      assert.equal(state.routines[0].name, 'Upper')
      assert.ok(map.get('workout-mvp-v9')) // v9 was written
      assert.equal(map.get('workout-mvp-v8') ?? null, null) // legacy gone
      assert.equal(map.get('workout-mvp-v7') ?? null, null)
      assert.equal(map.get('workout-mvp-v6') ?? null, null)
      assert.equal(map.get('workout-mvp-v5') ?? null, null)
    })
  })

  it('failure — throwing write: v7 survives a failed upgrade', () => {
    withLocalStorage({ throwOnSet: true, seed: { 'workout-mvp-v7': legacyV7 } }, (map) => {
      const state = loadState()
      assert.equal(state.routines[0].name, 'Upper') // load still returns usable state
      assert.equal(map.get('workout-mvp-v9') ?? null, null) // nothing persisted
      assert.ok(map.get('workout-mvp-v7')) // legacy copy is still here
    })
  })

  it('failure — silent no-op write: v7 survives (the read-back is the whole point)', () => {
    // setItem does nothing and does NOT throw, so getItem('...v9') stays null.
    // A cleanup keyed on "saveState didn't throw" would wrongly delete v7 here.
    withLocalStorage({ silentSet: true, seed: { 'workout-mvp-v7': legacyV7 } }, (map) => {
      const state = loadState()
      assert.equal(state.routines[0].name, 'Upper')
      assert.equal(map.get('workout-mvp-v9') ?? null, null) // silently stored nothing
      assert.ok(map.get('workout-mvp-v7')) // legacy copy still present — not deleted
    })
  })

  it('already on v9, no legacy: unchanged, nothing removed, no throw', () => {
    withLocalStorage({ seed: { 'workout-mvp-v9': validCurrent } }, (map) => {
      const before = map.get('workout-mvp-v9')
      let state
      assert.doesNotThrow(() => {
        state = loadState()
      })
      assert.equal(state.routines[0].name, 'Upper')
      assert.equal(map.get('workout-mvp-v9'), before) // v9 write path untouched
    })
  })

  it('already on v9 with a leftover legacy key: reclaims the legacy copy', () => {
    withLocalStorage(
      { seed: { 'workout-mvp-v9': validCurrent, 'workout-mvp-v8': legacyV7 } },
      (map) => {
        loadState()
        assert.ok(map.get('workout-mvp-v9')) // v9 intact
        assert.equal(map.get('workout-mvp-v8') ?? null, null) // interrupted cleanup finished
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

  it('reads the v5 key, flattens programs, maps every sessionId→routineId, writes v9', () => {
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

      // Persisted as v9, program wrapper gone from disk too.
      const stored = JSON.parse(map.get('workout-mvp-v9'))
      assert.equal(stored.schemaVersion, 9)
      assert.equal(stored.routines[0].id, 'sess-1')
      assert.equal(stored.programs, undefined)
    })
  })
})

// req-36 / DEC-032 — a corrupt-but-present `workout-mvp-v9` value must never be
// silently overwritten. loadState distinguishes "absent" (blank device) from
// "present but unreadable"; the latter latches getLoadUnreadable() and makes
// saveState refuse to write, so the raw corrupt bytes stay on disk and recoverable.
describe('req-36 corrupt v9 guard', () => {
  const corrupt = '{not valid json, definitely-not-parseable'

  it('(a) preserves a corrupt v9 value byte-for-byte across a mutation', () => {
    withLocalStorage({ seed: { 'workout-mvp-v9': corrupt } }, (map) => {
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
      assert.equal(map.get('workout-mvp-v9'), corrupt) // byte-for-byte unchanged
    })
  })

  it('(b) an absent key is a blank device: signal clear, saves work', () => {
    withLocalStorage({ seed: {} }, (map) => {
      const state = loadState()
      assert.equal(state.routines.length, 0)
      assert.equal(getLoadUnreadable(), false)
      assert.equal(saveState(emptyState()), true)
      assert.ok(map.get('workout-mvp-v9')) // save went through
    })
  })

  it('(c) a valid v9 value clears the signal and loads normally', () => {
    const validCurrent = JSON.stringify({
      ...emptyState(),
      routines: [{ id: 'sess-1', name: 'Upper', focus: 'Machines', exercises: [] }],
    })
    withLocalStorage({ seed: { 'workout-mvp-v9': validCurrent } }, () => {
      const state = loadState()
      assert.equal(state.routines[0].name, 'Upper')
      assert.equal(getLoadUnreadable(), false)
    })
  })

  it('an unreadable legacy-only key (no v9) counts as unreadable', () => {
    withLocalStorage({ seed: { 'workout-mvp-v7': corrupt } }, (map) => {
      const state = loadState()
      assert.equal(state.routines.length, 0)
      assert.equal(getLoadUnreadable(), true)
      assert.equal(saveState(emptyState()), false)
      assert.equal(map.get('workout-mvp-v7'), corrupt) // only surviving copy kept
      assert.equal(map.get('workout-mvp-v9') ?? null, null) // nothing written over it
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
    assert.equal(isExternalStateChange({ key: 'workout-mvp-v9' }), true)
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

describe('req-43 deletion-impact helpers (audit F-DIV-3)', () => {
  const state = {
    routines: [
      { id: 'r1', exercises: [{ exerciseId: 'e1' }, { exerciseId: 'e2' }] },
      { id: 'r2', exercises: [{ exerciseId: 'e1' }] },
      { id: 'r3', exercises: [{ exerciseId: 'e2' }] },
    ],
    schedule: {
      slots: [
        { routineId: 'r1' },
        { sessionId: 'r1' }, // legacy field name still counts
        { routineId: 'r2' },
      ],
    },
    plannedWorkouts: [{ routineId: 'r1' }, { routineId: 'other' }],
    workouts: [
      { routineId: 'r2', sets: [{ exerciseId: 'e1' }] },
      { sessionId: 'r-old', sets: [{ exerciseId: 'e2' }] },
    ],
  }

  it('routineDeletionImpact counts slots + plans and flags no history', () => {
    // r1: two slots (routineId + legacy sessionId), one plan, never finished.
    assert.deepEqual(routineDeletionImpact(state, 'r1'), {
      slots: 2,
      plans: 1,
      hasHistory: false,
    })
  })

  it('routineDeletionImpact flags history via routineId || sessionId', () => {
    // r2: one slot, no plan, has a finished workout (routineId).
    assert.deepEqual(routineDeletionImpact(state, 'r2'), {
      slots: 1,
      plans: 0,
      hasHistory: true,
    })
    // r-old referenced only by a workout's legacy sessionId still counts as history.
    assert.equal(routineDeletionImpact(state, 'r-old').hasHistory, true)
  })

  it('a routine with no references at all is all-zero, no history', () => {
    assert.deepEqual(routineDeletionImpact(state, 'nope'), {
      slots: 0,
      plans: 0,
      hasHistory: false,
    })
  })

  it('exerciseDeletionImpact counts routines and flags history', () => {
    // e1: in r1 + r2, and a finished set exists.
    assert.deepEqual(exerciseDeletionImpact(state, 'e1'), {
      routines: 2,
      hasHistory: true,
    })
    // e2: in r1 + r3, finished set exists (in the sessionId workout).
    assert.deepEqual(exerciseDeletionImpact(state, 'e2'), {
      routines: 2,
      hasHistory: true,
    })
  })

  it('exerciseDeletionImpact: an exercise used in a routine but never logged', () => {
    const s = { routines: [{ id: 'r', exercises: [{ exerciseId: 'e9' }] }], workouts: [] }
    assert.deepEqual(exerciseDeletionImpact(s, 'e9'), { routines: 1, hasHistory: false })
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

// req-55 / DEC-038 — exactly one in-progress workout; the multi-draft feature is
// removed but any LEGACY stored draft must be surfaced (Continue/Abandon), never
// silently dropped, and an unfinished workout is NEVER finished history.
describe('req-55 staleInProgressWorkouts (surface, don\'t drop)', () => {
  const todayKey = dateKey(new Date())
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const priorKey = dateKey(yesterday)

  it('an active workout started TODAY is the hero, not a stale row', () => {
    const state = { activeWorkout: { id: 'a1', startedAt: new Date().toISOString() }, draftWorkouts: [] }
    assert.deepEqual(staleInProgressWorkouts(state, todayKey), [])
  })

  it('an active workout started a PRIOR day is surfaced as stale', () => {
    const active = { id: 'a1', startedAt: yesterday.toISOString() }
    const state = { activeWorkout: active, draftWorkouts: [] }
    // Sanity: the two keys really differ (guards a same-day flake at midnight).
    assert.notEqual(priorKey, todayKey)
    assert.deepEqual(staleInProgressWorkouts(state, todayKey), [active])
  })

  it('legacy drafts are always surfaced, alongside a stale active', () => {
    const active = { id: 'a1', startedAt: yesterday.toISOString() }
    const draft = { id: 'd1', startedAt: '2026-01-01T10:00:00.000Z' }
    const state = { activeWorkout: active, draftWorkouts: [draft] }
    assert.deepEqual(staleInProgressWorkouts(state, todayKey), [active, draft])
  })

  it('no active, no drafts → nothing to resolve', () => {
    assert.deepEqual(staleInProgressWorkouts({ activeWorkout: null, draftWorkouts: [] }, todayKey), [])
    assert.deepEqual(staleInProgressWorkouts({}, todayKey), [])
  })
})

// The persisted-data proof: a stored key carrying a `draftWorkouts` entry still
// loads, the draft survives to disk (v9), it is SURFACED for resolution, and it is
// NOT promoted into finished history — so it can never feed a recommendation.
describe('req-55 legacy-draft migration is non-destructive', () => {
  // A v7 key (routine-based) carrying one in-progress draft + one finished workout.
  const seeded = JSON.stringify({
    schemaVersion: 7,
    exercises: [{ id: 'ex-1', name: 'Press', equipment: 'Machine', type: 'machine', weightStep: '5' }],
    routines: [{ id: 'rtn-1', name: 'Upper', focus: 'Machines', exercises: [] }],
    schedule: { loopWeeks: 1, slots: [] },
    workouts: [
      {
        id: 'wo-done',
        routineId: 'rtn-1',
        finishedAt: '2026-08-20T10:00:00.000Z',
        snapshot: { routineId: 'rtn-1', routineName: 'Upper', items: [{ exerciseId: 'ex-1', routineItemId: 'si-1' }] },
        sets: [{ exerciseId: 'ex-1', routineItemId: 'si-1', setType: 'work', weight: 40, reps: '8' }],
      },
    ],
    plannedWorkouts: [],
    // The legacy draft — an UNFINISHED workout with logged sets for the same exercise.
    draftWorkouts: [
      {
        id: 'draft-1',
        routineId: 'rtn-1',
        startedAt: '2026-08-25T09:00:00.000Z',
        finishedAt: null,
        snapshot: { routineId: 'rtn-1', routineName: 'Upper', items: [{ exerciseId: 'ex-1', routineItemId: 'si-1' }] },
        sets: [{ exerciseId: 'ex-1', routineItemId: 'si-1', setType: 'work', weight: 999, reps: '5' }],
      },
    ],
    activeWorkout: null,
  })

  it('loads the draft, surfaces it, keeps it out of finished history + recommendations, persists v8', () => {
    withLocalStorage({ seed: { 'workout-mvp-v7': seeded } }, (map) => {
      const state = loadState()

      // (1) The draft is NOT dropped — it survives the load and migration.
      assert.equal(state.draftWorkouts.length, 1)
      assert.equal(state.draftWorkouts[0].id, 'draft-1')

      // (2) It is SURFACED for resolution (Continue/Abandon UI reads this).
      const surfaced = staleInProgressWorkouts(state, dateKey(new Date()))
      assert.ok(surfaced.some((w) => w.id === 'draft-1'), 'legacy draft must be surfaced')

      // (3) It is NOT finished history — only the genuinely finished workout is.
      assert.equal(state.workouts.length, 1)
      assert.equal(state.workouts[0].id, 'wo-done')
      assert.ok(!state.workouts.some((w) => w.id === 'draft-1'))

      // (4) It never feeds a recommendation: historyPrescription reads `workouts`
      // only, so the draft's 999kg set is invisible — the prescription comes from
      // the finished 40kg workout, never the unfinished one.
      const rx = historyPrescription(state.workouts, 'ex-1')
      assert.deepEqual(rx.suggestedWeights, [40])
      assert.ok(!rx.suggestedWeights.includes(999))

      // (5) Persisted to v9 with the draft intact (non-destructive on disk too).
      const stored = JSON.parse(map.get('workout-mvp-v9'))
      assert.equal(stored.schemaVersion, 9)
      assert.equal(stored.draftWorkouts.length, 1)
      assert.equal(stored.draftWorkouts[0].id, 'draft-1')
    })
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

// req-84 — the "vs last time" summary. Pure helpers: stats + delta, and the
// selection of the prior same-routine workout. The no-prior case (no invented
// comparison) is the DESIGN §1 no-invent rule made testable.
describe('req-84 workoutSummaryStats', () => {
  const START = Date.parse('2026-09-16T10:00:00Z')
  const workSet = (weight, reps) => ({ setType: 'work', weight, reps })
  const active = {
    startedAt: new Date(START).toISOString(),
    sets: [{ setType: 'wu', weight: 40, reps: 5 }, workSet(100, 5), workSet(100, 5)],
  }
  const now = START + 30 * 60000 // 30 min in

  it('no prior workout → stats with no delta (no-invent)', () => {
    const s = workoutSummaryStats(active, null, now)
    assert.deepEqual(s, { volume: 1000, duration: 30, sets: 3, deltas: null })
  })

  it('with a prior → per-number deltas', () => {
    const prior = {
      startedAt: new Date(START - 60 * 60000).toISOString(),
      finishedAt: new Date(START - 40 * 60000).toISOString(), // 20 min
      sets: [workSet(100, 5)], // vol 500, 1 set
    }
    const s = workoutSummaryStats(active, prior, now)
    assert.equal(s.volume, 1000)
    assert.equal(s.duration, 30)
    assert.equal(s.sets, 3)
    assert.deepEqual(s.deltas, { volume: 500, duration: 10, sets: 2 })
  })

  it('warmup sets excluded from volume, counted in set total', () => {
    const s = workoutSummaryStats(active, null, now)
    assert.equal(s.volume, 1000) // wu 40x5 not counted
    assert.equal(s.sets, 3) // wu counted
  })
})

describe('req-84 previousSameRoutineWorkout', () => {
  const wk = (id, routineId, name, extra = {}) => ({
    id,
    routineId,
    snapshot: { routineId, routineName: name },
    ...extra,
  })
  const active = wk('active', 'r1', 'Push')

  it('returns the most recent finished workout of the same routine', () => {
    const workouts = [wk('w2', 'r1', 'Push'), wk('w1', 'r1', 'Push'), wk('x', 'r2', 'Pull')]
    const prior = previousSameRoutineWorkout(active, workouts, [])
    assert.equal(prior.id, 'w2')
  })

  it('no same-routine workout → null (first time)', () => {
    const workouts = [wk('x', 'r2', 'Pull')]
    assert.equal(previousSameRoutineWorkout(active, workouts, []), null)
  })

  it('empty history → null', () => {
    assert.equal(previousSameRoutineWorkout(active, [], []), null)
    assert.equal(previousSameRoutineWorkout(active, null, []), null)
  })
})

// req-85 (v9) — the schema-version bump v8→v9 adds the timed-exercise fields. This is
// the migration round-trip the merge gate hangs on: a real v8 key (plus an older v5)
// must load into v9 with NOTHING lost, only the new fields defaulted, and the legacy
// keys removed ONLY after the v9 write is confirmed by read-back (the req-06 rule).
describe('req-85 v9 migration round-trip', () => {
  const v8 = JSON.stringify({
    schemaVersion: 8,
    exercises: [
      { id: 'ex-1', name: 'Press', equipment: 'Machine', type: 'machine', weightStep: '5', archivedAt: null },
    ],
    routines: [
      {
        id: 'rtn-1',
        name: 'Upper',
        focus: 'Machines',
        archivedAt: null,
        exercises: [
          {
            id: 'si-1',
            exerciseId: 'ex-1',
            role: 'main',
            restSec: 90,
            notes: '',
            warmup: null,
            sets: 3,
            targets: ['12', '10', '8'],
            suggestedWeights: [20, 25, 25],
          },
        ],
      },
    ],
    schedule: { loopWeeks: 1, slots: [] },
    workouts: [
      {
        id: 'wo-1',
        routineId: 'rtn-1',
        startedAt: '2026-09-01T09:00:00.000Z',
        finishedAt: '2026-09-01T10:00:00.000Z',
        snapshot: {
          routineId: 'rtn-1',
          routineName: 'Upper',
          items: [
            { routineItemId: 'si-1', exerciseId: 'ex-1', exerciseName: 'Press', targets: ['12'], suggestedWeights: [20] },
          ],
        },
        sets: [{ routineItemId: 'si-1', exerciseId: 'ex-1', setType: 'work', weight: 20, reps: '12', rpe: 3 }],
      },
    ],
    plannedWorkouts: [],
    draftWorkouts: [],
    activeWorkout: null,
    legacyRecommendations: {},
  })
  const v5 = JSON.stringify({ schemaVersion: 5, exercises: [], programs: [] })

  it('loads a v8 (+v5) device into v9 with nothing lost and only defaults added', () => {
    withLocalStorage({ seed: { 'workout-mvp-v8': v8, 'workout-mvp-v5': v5 } }, (map) => {
      const state = loadState()

      // Exercise: original fields intact, gains ONLY the two defaulted timer fields.
      const ex = state.exercises[0]
      assert.equal(ex.name, 'Press')
      assert.equal(ex.hasDuration, false)
      assert.equal(ex.durationSec, 30)

      // Routine item: prescription intact, gains durations:[] (defaulted).
      const item = state.routines[0].exercises[0]
      assert.deepEqual(item.targets, ['12', '10', '8'])
      assert.deepEqual(item.suggestedWeights, [20, 25, 25])
      assert.deepEqual(item.durations, [])

      // Finished history untouched: the logged set keeps weight/reps, no duration added.
      const set = state.workouts[0].sets[0]
      assert.equal(set.weight, 20)
      assert.equal(set.reps, '12')
      assert.equal(set.durationSec, undefined)
      assert.equal(state.workouts[0].snapshot.items[0].exerciseName, 'Press')

      // Persisted as v9, and the legacy keys are reclaimed after the read-back.
      const stored = JSON.parse(map.get('workout-mvp-v9'))
      assert.equal(stored.schemaVersion, 9)
      assert.equal(map.get('workout-mvp-v8') ?? null, null)
      assert.equal(map.get('workout-mvp-v5') ?? null, null)
    })
  })

  it('a throwing write leaves the v8 copy intact (no premature delete)', () => {
    withLocalStorage({ throwOnSet: true, seed: { 'workout-mvp-v8': v8 } }, (map) => {
      const state = loadState()
      assert.equal(state.routines[0].name, 'Upper') // still usable in memory
      assert.equal(map.get('workout-mvp-v9') ?? null, null) // nothing persisted
      assert.ok(map.get('workout-mvp-v8')) // the only surviving copy is kept
    })
  })
})

// req-111 / DEC-053 — "last time" looks past a workout where the exercise was entirely
// skipped (Finish's auto-skip writes weight 0, reps 'skipped').
describe('req-111 lastSetsForExercise skips all-skipped workouts', () => {
  const fin = (id, finishedAt, sets) => ({ id, finishedAt, sets })
  const done = (weight, reps) => ({ exerciseId: 'bench', setType: 'work', weight, reps })
  const skip = () => ({ exerciseId: 'bench', setType: 'work', weight: 0, reps: 'skipped' })

  it('looks past: w2 all skipped, w1 40x8 → w1, set-1 prefill 40 kg', () => {
    const workouts = [
      fin('w2', '2026-09-22T10:00:00Z', [skip(), skip(), skip()]),
      fin('w1', '2026-09-20T10:00:00Z', [done(40, '8'), done(40, '8')]),
    ]
    const last = lastSetsForExercise(workouts, 'bench')
    assert.equal(last.workout.id, 'w1')
    assert.deepEqual(historySetPrefill(last, { setType: 'work', workIndex: 0 }), { weight: '40', reps: '8' })
    assert.equal(historyPrescription(workouts, 'bench').suggestedWeights[0], 40)
  })

  it('only skipped history → null (no history), not the skipped workout', () => {
    const workouts = [fin('w1', '2026-09-20T10:00:00Z', [skip(), skip()])]
    assert.equal(lastSetsForExercise(workouts, 'bench'), null)
    assert.equal(historyPrescription(workouts, 'bench'), null)
  })

  it('partial skip is still history: w2 1 done + 2 skipped → w2, done set is set 1', () => {
    const workouts = [
      fin('w2', '2026-09-22T10:00:00Z', [done(45, '6'), skip(), skip()]),
      fin('w1', '2026-09-20T10:00:00Z', [done(40, '8')]),
    ]
    const last = lastSetsForExercise(workouts, 'bench')
    assert.equal(last.workout.id, 'w2')
    assert.deepEqual(historySetPrefill(last, { setType: 'work', workIndex: 0 }), { weight: '45', reps: '6' })
  })

  const wu = (weight, reps) => ({ exerciseId: 'bench', setType: 'wu', weight, reps })

  it('warm-up done + all work skipped is passed over: older 40x8 → older, work set 1 prefills 40', () => {
    const workouts = [
      fin('w2', '2026-09-22T10:00:00Z', [wu(20, '10'), skip(), skip()]),
      fin('w1', '2026-09-20T10:00:00Z', [wu(20, '12'), done(40, '8'), done(40, '8')]),
    ]
    const last = lastSetsForExercise(workouts, 'bench')
    assert.equal(last.workout.id, 'w1')
    assert.deepEqual(historySetPrefill(last, { setType: 'work', workIndex: 0 }), { weight: '40', reps: '8' })
    const rx = historyPrescription(workouts, 'bench')
    assert.deepEqual(rx.suggestedWeights, [40, 40])
    assert.deepEqual(rx.warmup, { reps: '12' })
  })

  it('warm-up-only history ever → that workout (seeds the warm-up, work blank)', () => {
    const workouts = [fin('w1', '2026-09-20T10:00:00Z', [wu(20, '10'), skip(), skip()])]
    const last = lastSetsForExercise(workouts, 'bench')
    assert.equal(last.workout.id, 'w1')
    assert.deepEqual(historySetPrefill(last, { setType: 'wu' }), { weight: '20', reps: '10' })
    assert.deepEqual(historySetPrefill(last, { setType: 'work', workIndex: 0 }), { weight: '', reps: '' })
    assert.equal(historyPrescription(workouts, 'bench'), null)
  })
})

describe('req-111 previousSameRoutineWorkouts', () => {
  const wk = (id, routineId, name) => ({ id, routineId, snapshot: { routineId, routineName: name } })
  const active = wk('active', 'r1', 'Push')

  it('every prior same-routine workout newest-first; head equals previousSameRoutineWorkout', () => {
    const workouts = [wk('w3', 'r1', 'Push'), wk('x', 'r2', 'Pull'), wk('w1', 'r1', 'Push')]
    assert.deepEqual(previousSameRoutineWorkouts(active, workouts, []).map((w) => w.id), ['w3', 'w1'])
    assert.equal(previousSameRoutineWorkout(active, workouts, []).id, 'w3')
  })

  it('no active / no same-routine → []', () => {
    assert.deepEqual(previousSameRoutineWorkouts(null, [], []), [])
    assert.deepEqual(previousSameRoutineWorkouts(active, [wk('x', 'r2', 'Pull')], []), [])
  })
})
