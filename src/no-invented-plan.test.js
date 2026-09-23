// req-120 (audit C) — loading never invents plan values. The logged-sets backfill and
// the legacyRecommendations baseline (model.js workoutSnapshot / migrateRoutine) run
// only for legacy (pre-v9) input; the signal is computed from the RAW value by
// storage.loadState and exchange.applyBackup. Exercised through the real migrateState,
// loadState and applyBackup.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { migrateState } from './model.js'
import { loadState } from './storage.js'
import { BACKUP_KIND, applyBackup, backupIsLegacy } from './exchange.js'

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

const EXERCISES = [{ id: 'ex-a', name: 'Chest Press', equipment: 'Machine', type: 'machine', weightStep: '5' }]

// schemaVersion: null → the key is omitted (the assistant's stateShape has none).
// A state whose routine item ri-a and whose active snapshot item for it both have EMPTY
// targets/weights (the user cleared them), with one logged working set 60×7.
function stateWithEmptyItem({ schemaVersion = 9, legacyRecommendations = {} } = {}) {
  const item = {
    id: 'ri-a',
    exerciseId: 'ex-a',
    role: 'main',
    restSec: 90,
    notes: '',
    warmup: null,
    sets: 3,
    targets: [],
    suggestedWeights: [],
    durations: [],
  }
  return {
    ...(schemaVersion === null ? {} : { schemaVersion }),
    exercises: EXERCISES,
    routines: [{ id: 'r1', name: 'Push', focus: 'Machines', archivedAt: null, exercises: [item] }],
    schedule: { loopWeeks: 1, anchor: '2026-09-21', slots: [] },
    workouts: [],
    plannedWorkouts: [],
    draftWorkouts: [],
    legacyRecommendations,
    activeWorkout: {
      id: 'wo-1',
      routineId: 'r1',
      startedAt: '2026-09-23T09:00:00.000Z',
      finishedAt: null,
      completedItemIds: [],
      snapshot: {
        routineId: 'r1',
        routineName: 'Push',
        items: [
          {
            routineItemId: 'ri-a',
            exerciseId: 'ex-a',
            exerciseName: 'Chest Press',
            equipment: 'Machine',
            exerciseType: 'machine',
            weightStep: '5',
            role: 'main',
            sets: 3,
            targets: [],
            suggestedWeights: [],
            durations: [],
          },
        ],
      },
      sets: [
        {
          routineItemId: 'ri-a',
          exerciseId: 'ex-a',
          setType: 'work',
          weight: 60,
          reps: '7',
          rpe: 3,
          note: '',
          targetReps: '',
          targetWeight: null,
        },
      ],
    },
  }
}

const snapItem = (state) => state.activeWorkout.snapshot.items[0]
const routineItem = (state) => state.routines[0].exercises[0]
// Set N's target as workout-log.js reads it (targets[i], else the last target, else ''):
// with the old backfill ['7'], set 2's target was '7', invented from set 1's reps.
const targetOfSet = (item, n) => item.targets?.[n - 1] ?? item.targets?.[item.targets.length - 1] ?? ''

const STALE = { 'ri-a': { targets: ['10', '10', '10'], suggestedWeights: [40, 40], sets: 3 } }

describe('req-120 failure case — v9 reload never backfills from logged sets', () => {
  it('empty item + one logged 60×7 → migrateState(…, {legacy:false}) → still empty; set 2 target is ""', () => {
    const after = snapItem(migrateState(stateWithEmptyItem(), { legacy: false }))
    assert.deepEqual([after.targets, after.suggestedWeights], [[], []])
    assert.equal(targetOfSet(after, 2), '')
  })

  it('the default (no options) is the safe side: legacy:false', () => {
    const after = snapItem(migrateState(stateWithEmptyItem()))
    assert.deepEqual([after.targets, after.suggestedWeights], [[], []])
  })

  it('stable across repeated reloads (JSON round-trip, as loadState does)', () => {
    let state = stateWithEmptyItem()
    for (let i = 0; i < 3; i += 1) state = migrateState(JSON.parse(JSON.stringify(state)))
    assert.deepEqual([snapItem(state).targets, snapItem(state).suggestedWeights], [[], []])
  })
})

describe('req-120 failure case — a stale legacyRecommendations baseline never refills v9', () => {
  it('v9 + stale entry: the empty routine item and the empty snapshot item both stay empty', () => {
    const state = migrateState(stateWithEmptyItem({ legacyRecommendations: STALE }), { legacy: false })
    assert.deepEqual([routineItem(state).targets, routineItem(state).suggestedWeights], [[], []])
    assert.deepEqual([snapItem(state).targets, snapItem(state).suggestedWeights], [[], []])
    // sets is not refilled from the baseline either (the item's own 3 stands)
    assert.equal(routineItem(state).sets, 3)
    // the recorded map itself is carried through unchanged
    assert.deepEqual(state.legacyRecommendations, STALE)
  })

  it('control: the same input as legacy DOES refill (so the gate, not the fixture, decides)', () => {
    const state = migrateState(stateWithEmptyItem({ legacyRecommendations: STALE }), { legacy: true })
    assert.deepEqual([routineItem(state).targets, routineItem(state).suggestedWeights], [['10', '10', '10'], [40, 40]])
    assert.deepEqual(snapItem(state).targets, ['10', '10', '10'])
  })
})

describe('req-120 legacy still backfills, and the signal is plumbed', () => {
  it('a v8-key state with an empty snapshot item + logged sets → after loadState it is backfilled', () => {
    const v8 = stateWithEmptyItem({ schemaVersion: 8 })
    const state = withLocalStorage({ 'workout-mvp-v8': JSON.stringify(v8) }, () => loadState())
    assert.deepEqual([snapItem(state).targets, snapItem(state).suggestedWeights], [['7'], [60]])
  })

  it('loadState from a v9 key → legacy:false (the same data stays empty)', () => {
    const v9 = stateWithEmptyItem({ schemaVersion: 9, legacyRecommendations: STALE })
    const state = withLocalStorage({ 'workout-mvp-v9': JSON.stringify(v9) }, () => loadState())
    assert.deepEqual([snapItem(state).targets, snapItem(state).suggestedWeights], [[], []])
    assert.deepEqual([routineItem(state).targets, routineItem(state).suggestedWeights], [[], []])
  })

  it('loadState from a v8 key → legacy:true (the stale baseline applies, as before)', () => {
    const v8 = stateWithEmptyItem({ schemaVersion: 8, legacyRecommendations: STALE })
    const state = withLocalStorage({ 'workout-mvp-v8': JSON.stringify(v8) }, () => loadState())
    assert.deepEqual(routineItem(state).targets, ['10', '10', '10'])
  })

  it('loadState from the v9 key holding a not-yet-v9 value → legacy:true', () => {
    const old = stateWithEmptyItem({ schemaVersion: 8 })
    const state = withLocalStorage({ 'workout-mvp-v9': JSON.stringify(old) }, () => loadState())
    assert.deepEqual(snapItem(state).targets, ['7'])
  })

  it('backupIsLegacy: version decides when present; missing → legacy only with sessions/programs', () => {
    assert.equal(backupIsLegacy({ schemaVersion: 9 }), false)
    assert.equal(backupIsLegacy({ schemaVersion: '9' }), false)
    assert.equal(backupIsLegacy({ schemaVersion: 8, routines: [] }), true)
    assert.equal(backupIsLegacy({ routines: [] }), false)
    assert.equal(backupIsLegacy({ sessions: [] }), true)
    assert.equal(backupIsLegacy({ programs: [] }), true)
  })

  it('applyBackup: no schemaVersion and no sessions → false (stays empty); with sessions → true (backfilled)', () => {
    const noVersion = stateWithEmptyItem({ schemaVersion: null }) // no schemaVersion key at all
    assert.equal('schemaVersion' in noVersion, false)
    const asV9 = applyBackup({ kind: BACKUP_KIND, version: 1, state: noVersion }).state
    assert.deepEqual([snapItem(asV9).targets, snapItem(asV9).suggestedWeights], [[], []])

    // pre-v9 shape: the routines live under `sessions` (flattenRoutines reads them)
    const { routines, ...rest } = noVersion
    const withSessions = { ...rest, sessions: routines }
    const asLegacy = applyBackup({ kind: BACKUP_KIND, version: 1, state: withSessions }).state
    assert.deepEqual([snapItem(asLegacy).targets, snapItem(asLegacy).suggestedWeights], [['7'], [60]])
  })

  it('applyBackup: an explicit schemaVersion 9 backup → stays empty; 8 → backfilled', () => {
    const v9 = applyBackup({ kind: BACKUP_KIND, version: 1, state: stateWithEmptyItem({ schemaVersion: 9 }) }).state
    assert.deepEqual(snapItem(v9).targets, [])
    const v8 = applyBackup({ kind: BACKUP_KIND, version: 1, state: stateWithEmptyItem({ schemaVersion: 8 }) }).state
    assert.deepEqual(snapItem(v8).targets, ['7'])
  })
})
