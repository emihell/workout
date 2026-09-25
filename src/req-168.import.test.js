// req-168 item 3 — req-161's nits, made permanent (they pin existing behaviour; teeth:
// planted mutations, reports/req-168.md): (a) one Import's NEW copies share one timestamp,
// even when a reused copy sits between them; (b) quota → free space → retry → released.
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { importWithBackup, KEEP_NO_SPACE_MESSAGE } from './import-backup.js'
import { commitBackup } from './exchange.js'
import { getLoadUnreadable, loadState, saveState, UNREADABLE_COPY_PREFIX } from './storage.js'

const V9 = 'workout-mvp-v9'
const V8 = 'workout-mvp-v8'
const V7 = 'workout-mvp-v7'
const CORRUPT = '{"exercises": [ trunc'
const fixture = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
const quota = () => Object.assign(new Error('full'), { name: 'QuotaExceededError' })

let previous
let disk
let full = false // setItem of a copy key throws a quota error while true
beforeEach(() => {
  previous = globalThis.localStorage
  disk = new Map()
  full = false
  globalThis.localStorage = {
    getItem: (k) => (disk.has(k) ? disk.get(k) : null),
    setItem: (k, v) => {
      if (full && k.startsWith(UNREADABLE_COPY_PREFIX)) throw quota()
      disk.set(k, String(v))
    },
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

function importNow() {
  const store = { ...loadState() }
  store.applyBackup = (payload) =>
    commitBackup(payload, (updater) => {
      const next = updater(store)
      saveState(next)
      Object.assign(store, next)
    })
  return importWithBackup({ store, payload: fixture, ask: () => true, download: () => {}, downloadRaw: () => {} })
}
const copies = () => [...disk.keys()].filter((k) => k.startsWith(UNREADABLE_COPY_PREFIX)).sort()
const isoOf = (key) => key.slice(UNREADABLE_COPY_PREFIX.length).replace(/(~\d+)?-v\d+$/, '')

describe('req-168 item 3 — the unreadable-state copies (req-161 nits)', () => {
  it("(a) one Import's new copies share ONE timestamp, even with a reused copy between them", async () => {
    disk.set(V9, CORRUPT)
    disk.set(V8, 'v8 value')
    disk.set(V7, 'v7 value')
    // an earlier Import already kept v8 (same content) → this Import reuses it
    const reusedKey = `${UNREADABLE_COPY_PREFIX}2026-01-01T00:00:00.000Z-v8`
    disk.set(reusedKey, 'v8 value')
    await importNow()
    const fresh = copies().filter((k) => k !== reusedKey)
    assert.deepEqual(fresh.map((k) => k.slice(-3)), ['-v7', '-v9'], 'v9 and v7 written, v8 reused')
    assert.equal(new Set(fresh.map(isoOf)).size, 1, `one ISO for this Import's copies: ${fresh.join(', ')}`)
    assert.equal(disk.get(reusedKey), 'v8 value', 'the reused copy is untouched')
  })

  it('(b) quota → the storage-full message, lock kept → free space → retry → copies kept, lock released, import saved', async () => {
    disk.set(V9, CORRUPT)
    disk.set(V8, 'v8 value')
    full = true
    await assert.rejects(importNow(), { message: KEEP_NO_SPACE_MESSAGE })
    assert.equal(getLoadUnreadable(), true, 'lock kept')
    assert.equal(disk.get(V9), CORRUPT)
    assert.equal(saveState({ exercises: [] }), false, 'writes still refused')
    full = false // the user freed browser storage
    await importNow()
    assert.equal(getLoadUnreadable(), false, 'released')
    assert.deepEqual(copies().map((k) => k.slice(-3)), ['-v8', '-v9'])
    assert.equal(disk.get(copies().find((k) => k.endsWith('-v9'))), CORRUPT)
    assert.equal(JSON.parse(disk.get(V9)).workouts.length, 13, 'the import is really saved')
    loadState()
    assert.equal(disk.has(V8), false, 'and the next load cleans up v8, the copies stay')
    assert.equal(copies().length, 2)
  })
})
