// req-164 — the storage split / cycle break changes nothing observable. The golden
// (req-164.golden.json.gz) is MAIN's output, recorded at the sha in it by
// scripts/req-164-golden.mjs before any req-164 change, for src/db.json under the v8 key
// and the two req-165 old docs. For each: migrateState, loadState (state + what's on disk),
// saveState → loadState again (state + disk), and finishedState of its in-progress workout
// must deep-equal main.
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { migrateState } from './model.js'
import { loadState, saveState } from './storage.js'
import { finishedState } from './workout-log.js'
import { OLD_V8, OLD_V9_WITH_PLAN } from './req-165.old-docs.js'
import { filledLike, loadFilledLike } from './test-support/fill.js'

const golden = JSON.parse(gunzipSync(readFileSync(new URL('./req-164.golden.json.gz', import.meta.url))).toString('utf8'))
const DB = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
const DOCS = { db_v8: ['workout-mvp-v8', DB, true], old_v8: ['workout-mvp-v8', OLD_V8, true], old_v9: ['workout-mvp-v9', OLD_V9_WITH_PLAN, false] }
const FINISHED_AT = '2026-09-25T12:00:00.000Z' // as scripts/req-164-golden.mjs

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
const plain = (v) => JSON.parse(JSON.stringify(v))
const snapshotDisk = () => Object.fromEntries([...disk].map(([k, v]) => [k, JSON.parse(v)]))

describe(`req-164 — migrate, load, save round-trip and finish deep-equal main (${golden.mainSha})`, () => {
  for (const [name, [key, doc, legacy]] of Object.entries(DOCS)) {
    it(`${name}: migrateState`, () => {
      assert.deepEqual(plain(migrateState(structuredClone(doc), { legacy })), golden[name].migrate)
    })
    it(`${name}: loadState, saveState → loadState, finishedState`, () => {
      disk.set(key, JSON.stringify(doc))
      const loaded = loadState()
      // req-178 (sanctioned edit) — main's output with the one-time routine-kg fill applied
      // (test-support/fill.js); everything else still deep-equals main.
      const at = loaded.routineKgFilledAt
      assert.ok(at, 'the fill ran and marked the state')
      assert.deepEqual({ state: plain(loaded), disk: snapshotDisk() }, loadFilledLike(golden[name].load, loaded))
      saveState(loaded)
      const reloaded = loadState()
      assert.equal(reloaded.routineKgFilledAt, at, 'the fill runs once')
      assert.deepEqual({ state: plain(reloaded), disk: snapshotDisk() }, loadFilledLike(golden[name].roundTrip, reloaded))
      const finish = loaded.activeWorkout ? plain(finishedState(loaded, { overallFeel: 'Good' }, FINISHED_AT)) : null
      // Finish never touches routines (DEC-056): main's finish, with the loaded (filled) routines.
      const mainFinish = golden[name].finish
      const filledRoutines = filledLike(golden[name].load.state, at).routines
      assert.deepEqual(finish, mainFinish && { ...mainFinish, routines: filledRoutines, routineKgFilledAt: at })
    })
  }
  it('the golden has teeth: db.json migrated (13 workouts, v8 key removed after the round-trip) and both finishes wrote sets', () => {
    assert.equal(golden.db_v8.load.state.workouts.length, 13)
    assert.equal('workout-mvp-v8' in golden.db_v8.roundTrip.disk, false)
    assert.equal(golden.old_v8.finish.workouts[0].sets.length, 15)
    assert.equal(golden.old_v9.finish.workouts[0].sets.length, 15)
  })
})

// req-164 step 3 — store.jsx's inline reducers, now pure in state-reducers.js. Behaviour
// tests (the store only makes ids/clock readings and hands them in).
import {
  activePatchedState,
  activeSetRemovedState,
  activeSetUpdatedState,
  draftAbandonedState,
  draftContinuedState,
  exerciseAddedState,
  exerciseUpdatedState,
  itemSkippedState,
  loopWeeksState,
  routineAddedState,
  routineItemAdded,
  routineItemMoved,
  routineItemRemoved,
  routineItemUpdated,
  routinePatchedState,
  setLoggedState,
  slotAddedState,
  slotRemovedState,
  startedWorkoutState,
  workoutAbandonedState,
  workoutRemovedState,
  workoutUpdatedState,
} from './state-reducers.js'

describe('req-164 — the moved store reducers', () => {
  const base = () => migrateState(structuredClone(DB), { legacy: true })
  const NOW = new Date(2026, 8, 21, 10, 0) // Mon 21 Sep 2026, 10:00 local

  it('Start: a new active workout from the plan, local day keys, seedOverrides {}, same occurrence → same state', () => {
    const s = base()
    const next = startedWorkoutState(s, { routineId: 'sess-upper', id: 'wo-x', now: NOW })
    const a = next.activeWorkout
    assert.equal(a.id, 'wo-x')
    assert.equal(a.routineId, 'sess-upper')
    assert.equal(a.performedOn, '2026-09-21')
    assert.equal(a.startedAt, NOW.toISOString())
    assert.deepEqual(a.seedOverrides, {})
    assert.deepEqual([a.sets, a.completedItemIds, a.finishedAt, a.restEndsAt], [[], [], null, null])
    assert.equal(a.snapshot.items.length, 9)
    assert.equal(next.draftWorkouts, s.draftWorkouts, 'drafts never written')
    assert.equal(startedWorkoutState(next, { routineId: 'sess-upper', id: 'wo-y', now: NOW }), next)
    assert.equal(startedWorkoutState(s, { routineId: 'no-such', id: 'wo-z', now: NOW }), s)
  })
  it('the active-set reducers: log, update, remove (clears the armed rest), patch, skip, abandon; no active → same state', () => {
    const started = startedWorkoutState(base(), { routineId: 'sess-upper', id: 'wo-x', now: NOW })
    const item = started.activeWorkout.snapshot.items[1]
    const set = { exerciseId: item.exerciseId, routineItemId: item.routineItemId, setType: 'wu', weight: 10, reps: '12', rpe: null, note: '' }
    let s = setLoggedState({ ...started, activeWorkout: { ...started.activeWorkout, setDraft: { key: 'k' } } }, set, { restEndsAt: 't' }, 'k')
    assert.deepEqual(s.activeWorkout.sets, [set])
    assert.equal(s.activeWorkout.restEndsAt, 't')
    assert.equal(s.activeWorkout.setDraft, undefined, 'the draft for that set is dropped in the same update')
    s = activeSetUpdatedState(s, 0, { weight: 12 })
    assert.equal(s.activeWorkout.sets[0].weight, 12)
    s = activeSetRemovedState({ ...s, activeWorkout: { ...s.activeWorkout, restPausedRemaining: 5 } }, 0)
    assert.deepEqual([s.activeWorkout.sets, s.activeWorkout.restEndsAt, s.activeWorkout.restPausedRemaining], [[], null, null])
    s = activePatchedState(s, { overallNote: 'n' })
    assert.equal(s.activeWorkout.overallNote, 'n')
    s = itemSkippedState(s, item.routineItemId)
    assert.ok(s.activeWorkout.sets.length > 0 && s.activeWorkout.sets.every((x) => x.reps === 'skipped'))
    assert.ok(s.activeWorkout.completedItemIds.includes(item.routineItemId))
    assert.equal(workoutAbandonedState(s).activeWorkout, null)
    const idle = { ...s, activeWorkout: null }
    for (const same of [setLoggedState(idle, set), activeSetUpdatedState(idle, 0, {}), activeSetRemovedState(idle, 0), activePatchedState(idle, {}), itemSkippedState(idle, 'x')]) {
      assert.equal(same, idle)
    }
  })
  it('routines: add, patch, item add/update/remove/move (move out of range → same routine)', () => {
    let s = routineAddedState(base(), { id: 'r-new', name: 'New', focus: 'Machines', exercises: [] })
    assert.equal(s.routines.at(-1).id, 'r-new')
    s = routinePatchedState(s, 'r-new', (r) => routineItemAdded(r, { exerciseId: 'ex-a', targets: ['8', '8'] }, 'si-1'))
    s = routinePatchedState(s, 'r-new', (r) => routineItemAdded(r, { exerciseId: 'ex-b' }, 'si-2'))
    const r = () => s.routines.find((x) => x.id === 'r-new')
    assert.deepEqual(r().exercises[0], { id: 'si-1', exerciseId: 'ex-a', role: 'main', restSec: 0, notes: '', warmup: null, sets: 2, targets: ['8', '8'], suggestedWeights: [], durations: [] })
    s = routinePatchedState(s, 'r-new', (x) => routineItemUpdated(x, 0, { sets: '0', restSec: 60, warmup: null }))
    assert.deepEqual([r().exercises[0].sets, r().exercises[0].restSec], [1, 60])
    s = routinePatchedState(s, 'r-new', (x) => routineItemMoved(x, 0, 1))
    assert.deepEqual(r().exercises.map((e) => e.id), ['si-2', 'si-1'])
    const routine = r()
    assert.equal(routineItemMoved(routine, 0, -1), routine)
    s = routinePatchedState(s, 'r-new', (x) => routineItemRemoved(x, 0))
    assert.deepEqual(r().exercises.map((e) => e.id), ['si-1'])
  })
  it('schedule: loop weeks drop slots beyond them; add slot (a duplicate → same state); remove slot', () => {
    const s = base()
    const two = loopWeeksState(slotAddedState(s, { id: 'sl-w1', week: 1, weekday: 2, routineId: 'sess-upper' }), 2)
    assert.equal(two.schedule.loopWeeks, 2)
    assert.equal(two.schedule.slots.length, s.schedule.slots.length + 1)
    assert.equal(loopWeeksState(two, 1).schedule.slots.length, s.schedule.slots.length, 'week-1 slot dropped')
    assert.equal(slotAddedState(two, { id: 'dup', week: 1, weekday: 2, routineId: 'sess-upper' }), two)
    assert.equal(slotRemovedState(two, 'sl-w1').schedule.slots.length, s.schedule.slots.length)
  })
  it('exercises, workouts and legacy drafts', () => {
    const s = base()
    const added = exerciseAddedState(s, { id: 'ex-new', name: 'New' })
    assert.equal(added.exercises.at(-1).id, 'ex-new')
    assert.equal(exerciseUpdatedState(added, 'ex-new', { name: 'Renamed' }).exercises.at(-1).name, 'Renamed')
    const w = s.workouts[0]
    assert.equal(workoutUpdatedState(s, w.id, { overallNote: 'x' }).workouts[0].overallNote, 'x')
    assert.equal(workoutRemovedState(s, w.id).workouts.length, s.workouts.length - 1)
    const withDraft = { ...s, draftWorkouts: [{ id: 'd1', routineId: 'sess-upper' }] }
    const continued = draftContinuedState(withDraft, 'd1')
    assert.deepEqual([continued.activeWorkout.id, continued.draftWorkouts], ['d1', []])
    assert.equal(draftContinuedState(withDraft, 'nope'), withDraft)
    assert.deepEqual(draftAbandonedState(withDraft, 'd1').draftWorkouts, [])
  })
})
