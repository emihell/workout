// req-158 (audit F-DEAD-4, DEC-085 §3) — stop recording two persisted fields nothing reads.
//   1. legacyRecommendations: recorded only for legacy (pre-v9) input; v9 loads add nothing;
//      stored entries are kept as they are; legacy migration is byte-for-byte what it was.
//   2. workout.progression: a new Finish doesn't write it; old workouts keep theirs.
// No schema bump, no rewrite. main's model.js is frozen in req-158.model-main.fixture.js
// for the "identical" comparisons.
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { migrateState } from './model.js'
import { migrateState as migrateStateMain } from './req-158.model-main.fixture.js'
import { finishedState } from './workout-log.js'
import { loadState, saveState } from './storage.js'
import { filledLike } from './test-support/fill.js'

const v8 = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
const count = (state) => Object.keys(state.legacyRecommendations || {}).length

let previous
let disk
beforeEach(() => {
  previous = globalThis.localStorage
  disk = new Map()
  globalThis.localStorage = {
    getItem: (key) => (disk.has(key) ? disk.get(key) : null),
    setItem: (key, value) => disk.set(key, String(value)),
    removeItem: (key) => disk.delete(key),
  }
})
afterEach(() => {
  globalThis.localStorage = previous
})

describe('1 — legacy (v8) migration is identical to main', () => {
  it('migrateState(v8 fixture, { legacy: true }) deep-equals main', () => {
    const branch = migrateState(structuredClone(v8), { legacy: true })
    const main = migrateStateMain(structuredClone(v8), { legacy: true })
    assert.deepEqual(branch, main)
    assert.equal(count(branch), count(main))
    assert.ok(count(branch) > 0, 'legacy input still records its baselines')
  })
  it('the real load path: a v8 key → loadState deep-equals main-migrated, and so does the saved v9', () => {
    disk.set('workout-mvp-v8', JSON.stringify(v8))
    const loaded = loadState()
    // req-178 (sanctioned edit) — main's migration with the one-time routine-kg fill applied.
    const main = filledLike(migrateStateMain({ ...structuredClone(v8) }, { legacy: true }))
    // loadState merges emptyState() first and defaults a missing schedule anchor; compare the migrated parts
    for (const key of ['exercises', 'routines', 'workouts', 'legacyRecommendations', 'plannedWorkouts']) {
      assert.deepEqual(loaded[key], main[key], key)
    }
    assert.deepEqual(JSON.parse(disk.get('workout-mvp-v9')).legacyRecommendations, main.legacyRecommendations)
  })
})

describe('1 — v9 loads no longer grow legacyRecommendations', () => {
  function v9WithNewItem() {
    const state = migrateState(structuredClone(v8), { legacy: true })
    // a routine item created on v9: it has targets but no recorded baseline
    state.routines[0].exercises.push({ ...state.routines[0].exercises[0], id: 'si-new-on-v9', targets: ['10'], suggestedWeights: [50] })
    return state
  }
  it('main added an entry for the new v9 item; the branch does not (and keeps every stored entry)', () => {
    const state = v9WithNewItem()
    const before = structuredClone(state.legacyRecommendations)
    const main = migrateStateMain(structuredClone(state))
    const branch = migrateState(structuredClone(state))
    assert.equal(count(main), count(state) + 1, 'main: grows by one')
    assert.equal('si-new-on-v9' in main.legacyRecommendations, true)
    assert.equal(count(branch), count(state), 'branch: unchanged')
    assert.deepEqual(branch.legacyRecommendations, before, 'stored entries untouched')
    // everything else is what main produces
    const { legacyRecommendations: _a, ...restBranch } = branch
    const { legacyRecommendations: _b, ...restMain } = main
    assert.deepEqual(restBranch, restMain)
  })
  it('loadState → save → loadState twice: the count is the same each time', () => {
    disk.set('workout-mvp-v9', JSON.stringify(v9WithNewItem()))
    const counts = []
    for (let i = 0; i < 3; i++) {
      const state = loadState()
      counts.push(count(state))
      saveState(state)
      counts.push(count(JSON.parse(disk.get('workout-mvp-v9'))))
    }
    assert.equal(new Set(counts).size, 1, `counts: ${counts}`)
  })
})

describe('2 — workout.progression', () => {
  const active = (extra = {}) => ({
    activeWorkout: {
      id: 'wo-live',
      routineId: 'r',
      occurrenceId: 'o',
      startedAt: '2026-09-25T10:00:00.000Z',
      snapshot: { items: [] },
      sets: [],
      progression: null, // what store.startWorkout wrote before req-158
      ...extra,
    },
    workouts: [],
    plannedWorkouts: [],
    routines: [],
  })
  it('a new Finish has no progression field, even when one is passed and the active workout had null', () => {
    const next = finishedState(active(), { overallFeel: 'Good', progression: [{ routineItemId: 'x', to: [40] }] }, '2026-09-25T11:00:00.000Z')
    assert.equal('progression' in next.workouts[0], false)
    assert.equal(next.workouts[0].overallFeel, 'Good')
  })
  it("an old workout's progression survives migrateState and load → save → load unchanged", () => {
    const state = migrateState(structuredClone(v8), { legacy: true })
    const old = [{ routineItemId: state.routines[0].exercises[0].id, from: [20], to: [22.5], reason: 'kept as history' }]
    state.workouts[0] = { ...state.workouts[0], progression: old }
    assert.deepEqual(migrateState(structuredClone(state)).workouts[0].progression, old)
    disk.set('workout-mvp-v9', JSON.stringify(state))
    const loaded = loadState()
    assert.deepEqual(loaded.workouts[0].progression, old)
    saveState(loaded)
    assert.deepEqual(loadState().workouts[0].progression, old)
    // and a Finish after it doesn't touch it
    const finished = finishedState({ ...loaded, ...active() , workouts: loaded.workouts }, {}, '2026-09-25T11:00:00.000Z')
    assert.deepEqual(finished.workouts[1].progression, old)
  })
  it('an in-progress workout saved before req-158 (progression: null) loads, finishes, and saves without the field', () => {
    const state = migrateState(structuredClone(v8), { legacy: true })
    disk.set('workout-mvp-v9', JSON.stringify({ ...state, ...active({ id: 'wo-old-live' }), workouts: state.workouts }))
    const loaded = loadState()
    assert.equal(loaded.activeWorkout.id, 'wo-old-live')
    assert.equal(loaded.activeWorkout.progression, null, 'load leaves the stale key alone (no rewrite)')
    const finished = finishedState(loaded, { overallFeel: 'Good' }, '2026-09-25T11:00:00.000Z')
    assert.equal(finished.activeWorkout, null)
    assert.equal(finished.workouts.length, state.workouts.length + 1)
    const saved = finished.workouts.find((w) => w.id === 'wo-old-live')
    assert.equal('progression' in saved, false)
    saveState(finished)
    assert.equal('progression' in loadState().workouts.find((w) => w.id === 'wo-old-live'), false)
  })
  it('startWorkout no longer writes progression; no src caller passes one to Finish', () => {
    const src = (f) => readFileSync(new URL(f, import.meta.url), 'utf8')
    assert.doesNotMatch(src('./store.jsx'), /progression: null/)
    for (const view of ['./views/workout/finish.jsx', './views/workout/auto-complete.jsx']) {
      assert.doesNotMatch(src(view), /buildFinishProgression|const progression|, progression/, view)
    }
  })
  it('nothing in src reads .progression (tests and the frozen fixture excluded)', async () => {
    const { execSync } = await import('node:child_process')
    const hits = execSync(
      "grep -rnE '\\.progression\\b' src --include='*.js' --include='*.jsx' | grep -v '\\.test\\.js' | grep -v 'fixture' || true",
      { cwd: new URL('..', import.meta.url), encoding: 'utf8' },
    )
    assert.equal(hits.trim(), '')
  })
})
