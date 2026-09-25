// req-165 — the cleanup changes no loaded state. `req-165.golden.json.gz` is MAIN's
// output (recorded at the sha inside it, before any req-165 change) for two old stored
// docs (req-165.old-docs.js): a legacy v8 doc with `session*` keys at every level and a
// stale planned workout, and a v9 doc with a stale plan. The branch must produce the
// deep-equal state through migrateState AND through loadState (what's then on disk too).
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { migrateState } from './model.js'
import { loadState } from './storage.js'
import { OLD_V8, OLD_V9_WITH_PLAN } from './req-165.old-docs.js'

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

describe(`req-165 — old docs load to the same v9 state as main (${golden.mainSha})`, () => {
  it('legacy v8 with session* keys + a stale plan: migrateState deep-equals main', () => {
    assert.deepEqual(plain(migrateState(structuredClone(OLD_V8), { legacy: true })), golden.migrate_v8)
  })
  it('v9 with a stale plan: migrateState deep-equals main', () => {
    assert.deepEqual(plain(migrateState(structuredClone(OLD_V9_WITH_PLAN))), golden.migrate_v9)
  })
  it('loadState of each (the state AND what is left on disk) deep-equals main', () => {
    assert.deepEqual(load('workout-mvp-v8', OLD_V8), golden.load_v8)
    disk.clear()
    assert.deepEqual(load('workout-mvp-v9', OLD_V9_WITH_PLAN), golden.load_v9)
  })
  it('the fixtures really carry what they claim, and main kept the stale plan and stripped every session* key', () => {
    assert.match(JSON.stringify(OLD_V8), /"sessionId"/)
    assert.match(JSON.stringify(OLD_V8), /"sessionItemId"/)
    assert.match(JSON.stringify(OLD_V8), /completedSessionItemIds/)
    assert.equal(golden.migrate_v8.plannedWorkouts.length, 1)
    assert.equal(golden.load_v9.disk['workout-mvp-v9'].plannedWorkouts.length, 1, 'the key survives a save')
    assert.doesNotMatch(JSON.stringify(golden.migrate_v8), /"session(Id|ItemId|Name)"|completedSessionItemIds/)
  })
})
