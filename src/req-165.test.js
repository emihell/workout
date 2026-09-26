// req-165 — the cleanup changes no loaded state, and no finished history but the one
// DEC-088 change. `req-165.golden.json.gz` is MAIN's output (recorded at the sha inside it,
// before any req-165 change, by scripts/req-165-golden.mjs) for two old stored docs
// (req-165.old-docs.js): a legacy v8 doc with `session*` keys at every level, a stale
// planned workout and an in-progress workout whose snapshot items have NO `id`; and a v9
// doc with a stale plan and an in-progress workout of today's shape (items with ids). The
// branch must produce the deep-equal state through migrateState, loadState (state + disk)
// and finishedState — except, for the id-less v8 in-progress workout, its sets (DEC-088).
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { migrateState } from './model.js'
import { loadState } from './storage.js'
import { finishedState } from './workout-log.js'
import { OLD_V8, OLD_V9_WITH_PLAN } from './req-165.old-docs.js'
import { filledLike, loadFilledLike } from './test-support/fill.js'

const golden = JSON.parse(gunzipSync(readFileSync(new URL('./req-165.golden.json.gz', import.meta.url))).toString('utf8'))

let previous
let disk
beforeEach(() => {
  previous = globalThis.localStorage
  disk = new Map()
  globalThis.localStorage = {
    getItem: (k) => (disk.has(k) ? disk.get(k) : null),
    setItem: (k, v) => disk.set(k, String(v)),
    removeItem: (k) => disk.delete(k),
    get length() {
      return disk.size
    },
    key: (i) => [...disk.keys()][i] ?? null,
  }
})
afterEach(() => {
  globalThis.localStorage = previous
})

function load(key, doc) {
  disk.set(key, JSON.stringify(doc))
  const state = JSON.parse(JSON.stringify(loadState()))
  return { state, disk: Object.fromEntries([...disk].map(([k, v]) => [k, JSON.parse(v)])) }
}
const plain = (value) => JSON.parse(JSON.stringify(value))
const FINISHED_AT = '2026-09-25T12:00:00.000Z' // as scripts/req-165-golden.mjs
const finishLoaded = (key, doc) => plain(finishedState(load(key, doc).state, { overallFeel: 'Good' }, FINISHED_AT))
const skippedOf = (workout) => workout.sets.filter((set) => set.reps === 'skipped')

describe(`req-165 — old docs load to the same v9 state as main (${golden.mainSha})`, () => {
  it('legacy v8 with session* keys + a stale plan: migrateState deep-equals main', () => {
    assert.deepEqual(plain(migrateState(structuredClone(OLD_V8), { legacy: true })), golden.migrate_v8)
  })
  it('v9 with a stale plan: migrateState deep-equals main', () => {
    assert.deepEqual(plain(migrateState(structuredClone(OLD_V9_WITH_PLAN))), golden.migrate_v9)
  })
  // req-178 (sanctioned edit) — main's output with the one-time routine-kg fill applied
  // (test-support/fill.js); everything else still deep-equals main.
  it('loadState of each (the state AND what is left on disk) deep-equals main', () => {
    const v8 = load('workout-mvp-v8', OLD_V8)
    assert.deepEqual(v8, loadFilledLike(golden.load_v8, v8.state))
    disk.clear()
    const v9 = load('workout-mvp-v9', OLD_V9_WITH_PLAN)
    assert.deepEqual(v9, loadFilledLike(golden.load_v9, v9.state))
  })
  it('the fixtures really carry what they claim, and main kept the stale plan and stripped every session* key', () => {
    assert.match(JSON.stringify(OLD_V8), /"sessionId"/)
    assert.match(JSON.stringify(OLD_V8), /"sessionItemId"/)
    assert.match(JSON.stringify(OLD_V8), /completedSessionItemIds/)
    assert.equal(golden.migrate_v8.plannedWorkouts.length, 1)
    assert.equal(golden.load_v9.disk['workout-mvp-v9'].plannedWorkouts.length, 1, 'the key survives a save')
    assert.doesNotMatch(JSON.stringify(golden.migrate_v8), /"session(Id|ItemId|Name)"|completedSessionItemIds/)
  })
  // req-178 (sanctioned edit, this and the next) — Finish never touches routines (DEC-056):
  // main's finish with the loaded, filled routines and the marker.
  const withFilled = (finish, loadGolden, branch) => ({
    ...finish,
    routines: filledLike(loadGolden.state, branch.routineKgFilledAt).routines,
    routineKgFilledAt: branch.routineKgFilledAt,
  })
  it('finish (the path that writes history): a v9 in-progress workout (items with ids) finishes deep-equal to main', () => {
    const branch = finishLoaded('workout-mvp-v9', OLD_V9_WITH_PLAN)
    assert.deepEqual(branch, withFilled(golden.finish_v9, golden.load_v9, branch))
    assert.equal(skippedOf(golden.finish_v9.workouts[0]).length, 12, 'the case has teeth: unlogged sets are written skipped')
  })
  it('finish of the id-less v8 in-progress workout: everything deep-equals main except its sets (DEC-088)', () => {
    const branch = finishLoaded('workout-mvp-v8', OLD_V8)
    const main = withFilled(golden.finish_v8, golden.load_v8, branch)
    const { sets: branchSets, ...branchRest } = branch.workouts[0]
    const { sets: mainSets, ...mainRest } = main.workouts[0]
    assert.deepEqual(branchRest, mainRest)
    assert.deepEqual({ ...branch, workouts: branch.workouts.slice(1) }, { ...main, workouts: main.workouts.slice(1) })
    // The logged sets are the same; main wrote no skipped sets (every set matched every id-less item).
    assert.deepEqual(branchSets.filter((set) => set.reps !== 'skipped'), mainSets)
    assert.equal(skippedOf(main.workouts[0]).length, 0)
  })
})

// req-165 / DEC-088 — the one behaviour change (reviewer-found): on main, setsForItem's
// `set.sessionItemId === item?.id` was `undefined === undefined` for a snapshot item with no
// `id` (a legacy-migrated in-progress or draft workout: neither migrateState path adds one),
// so EVERY set counted as that item's — every item read done, auto-complete armed, and Finish
// wrote no skipped sets. Now each item shows its real state and Finish records the rest.
describe('DEC-088 — an old in-progress workout whose snapshot items have no id finishes with its real sets', () => {
  it('finishedState(migrateState(old v8)) → the 2 logged sets plus exactly the unlogged ones, skipped (13)', () => {
    const state = migrateState(structuredClone(OLD_V8), { legacy: true })
    const items = state.activeWorkout.snapshot.items
    assert.ok(items.every((item) => item.id === undefined), 'the fixture really is id-less')
    const logged = state.activeWorkout.sets
    assert.equal(logged.length, 2)
    // Expected, computed independently of setsForItem: each item's planned sets (its
    // warm-up + work sets) minus the sets already logged under its routineItemId.
    const planned = (item) => (item.warmup ? 1 : 0) + (Number(item.sets) || 1)
    const expected = items.reduce((n, item) => n + planned(item) - logged.filter((s) => s.routineItemId === item.routineItemId).length, 0)
    assert.equal(expected, 13)
    const finished = finishedState(state, {}, FINISHED_AT).workouts[0]
    assert.equal(skippedOf(finished).length, 13)
    assert.equal(finished.sets.length, 2 + 13)
    for (const item of items) {
      const mine = finished.sets.filter((s) => s.routineItemId === item.routineItemId)
      assert.equal(mine.length, planned(item), `${item.exerciseName}: one set per planned set`)
    }
  })
})
