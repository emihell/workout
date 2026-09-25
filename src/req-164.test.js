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
      assert.deepEqual({ state: plain(loaded), disk: snapshotDisk() }, golden[name].load)
      saveState(loaded)
      const reloaded = loadState()
      assert.deepEqual({ state: plain(reloaded), disk: snapshotDisk() }, golden[name].roundTrip)
      const finish = loaded.activeWorkout ? plain(finishedState(loaded, { overallFeel: 'Good' }, FINISHED_AT)) : null
      assert.deepEqual(finish, golden[name].finish)
    })
  }
  it('the golden has teeth: db.json migrated (13 workouts, v8 key removed after the round-trip) and both finishes wrote sets', () => {
    assert.equal(golden.db_v8.load.state.workouts.length, 13)
    assert.equal('workout-mvp-v8' in golden.db_v8.roundTrip.disk, false)
    assert.equal(golden.old_v8.finish.workouts[0].sets.length, 15)
    assert.equal(golden.old_v9.finish.workouts[0].sets.length, 15)
  })
})
