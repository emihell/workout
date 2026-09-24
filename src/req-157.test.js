// req-157 (audit F-RISK-5, DEC-085 §2, refines DEC-032) — Import from the "unreadable data"
// state downloads the raw stored string first (exactly), then lifts the write lock and
// really saves the import. Cancel / a bad file: nothing downloaded, nothing saved, lock kept.
// Runs the real storage.js (loadState / saveState / the lock) against an in-memory
// localStorage, and a store stand-in that saves the way store.jsx's setState does.
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { importWithBackup, downloadText, REPLACE_MESSAGE, REPLACE_UNREADABLE_MESSAGE } from './import-backup.js'
import { commitBackup } from './exchange.js'
import { getLoadUnreadable, loadState, readUnreadableRaw, saveState } from './storage.js'

const KEY = 'workout-mvp-v9'
const CORRUPT = '{"exercises":[{"id":"ex-1","name":"Bänkpress"}], "workouts": [ truncated…'
const fixture = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))

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

// store.jsx: setState(updater) → next = updater(prev); saveState(next). applyBackup is
// commitBackup(payload, setState).
function makeStore(state) {
  const store = { ...state }
  store.applyBackup = (payload) =>
    commitBackup(payload, (updater) => {
      const next = updater(store)
      saveState(next)
      Object.assign(store, next)
    })
  return store
}

function run({ answer, payload = fixture }) {
  const store = makeStore(loadState())
  const calls = { asked: [], raw: [], json: [] }
  const done = importWithBackup({
    store,
    payload,
    ask: (message) => {
      calls.asked.push(message)
      return answer
    },
    download: (name, data) => calls.json.push({ name, data }),
    downloadRaw: (name, text) => calls.raw.push({ name, text, lockedAtDownload: getLoadUnreadable() }),
  })
  return { store, calls, done }
}

describe('unreadable state + valid import', () => {
  it('confirm → one raw download (byte-exact), then the lock lifts and the import is saved; a reload loads it', async () => {
    disk.set(KEY, CORRUPT)
    const { calls, done } = run({ answer: true })
    assert.equal(getLoadUnreadable(), true, 'the corrupt load latched the lock')
    const result = await done
    assert.deepEqual(calls.asked, [REPLACE_UNREADABLE_MESSAGE])
    assert.equal(calls.raw.length, 1)
    assert.equal(calls.raw[0].text, CORRUPT, 'exactly the stored string')
    assert.match(calls.raw[0].name, /^workout-unreadable-\d{4}-\d{2}-\d{2}\.txt$/)
    assert.equal(calls.raw[0].lockedAtDownload, true, 'downloaded BEFORE the lock was lifted')
    assert.equal(calls.json.length, 0, 'no empty-state backup in its place')
    assert.equal(getLoadUnreadable(), false)
    assert.equal(result.summary.workouts, 13)
    const stored = JSON.parse(disk.get(KEY))
    assert.equal(stored.workouts.length, 13)
    const reloaded = loadState()
    assert.equal(getLoadUnreadable(), false)
    assert.equal(reloaded.workouts.length, 13)
  })
  it('cancel → no download, no save, lock kept, the stored value untouched', async () => {
    disk.set(KEY, CORRUPT)
    const { calls, done } = run({ answer: false })
    assert.equal(await done, null)
    assert.deepEqual(calls.asked, [REPLACE_UNREADABLE_MESSAGE])
    assert.equal(calls.raw.length + calls.json.length, 0)
    assert.equal(getLoadUnreadable(), true)
    assert.equal(disk.get(KEY), CORRUPT)
    assert.equal(saveState({ exercises: [] }), false, 'writes are still refused')
  })
  it('invalid file → error, nothing asked or downloaded, lock kept', async () => {
    disk.set(KEY, CORRUPT)
    const { calls, done } = run({ answer: true, payload: { kind: 'workout-analytics', events: [] } })
    await assert.rejects(done, /Not a workout database backup/)
    assert.equal(calls.asked.length + calls.raw.length + calls.json.length, 0)
    assert.equal(getLoadUnreadable(), true)
    assert.equal(disk.get(KEY), CORRUPT)
  })
  it('a corrupt LEGACY key (no v9 yet) is the one downloaded', async () => {
    disk.set('workout-mvp-v8', CORRUPT)
    const { calls, done } = run({ answer: true })
    await done
    assert.equal(calls.raw[0].text, CORRUPT)
    assert.equal(JSON.parse(disk.get(KEY)).workouts.length, 13)
  })
})

describe('outside the unreadable state Import is unchanged', () => {
  it('readable data → the usual question and JSON backup, no raw download', async () => {
    disk.set(KEY, JSON.stringify({ ...fixture, schemaVersion: 9 }))
    loadState()
    assert.equal(getLoadUnreadable(), false)
    assert.equal(readUnreadableRaw(), null)
    const { calls, done } = run({ answer: true })
    await done
    assert.deepEqual(calls.asked, [REPLACE_MESSAGE])
    assert.equal(calls.raw.length, 0)
    assert.equal(calls.json.length, 1)
  })
})

describe('downloadText keeps the string exactly', () => {
  it('the Blob it downloads reads back as the same string (non-ASCII included)', async () => {
    const saved = { document: globalThis.document, create: URL.createObjectURL, revoke: URL.revokeObjectURL }
    let blob = null
    let clicked = null
    globalThis.document = { createElement: () => ({ click() { clicked = this.download } }) }
    URL.createObjectURL = (b) => {
      blob = b
      return 'blob:x'
    }
    URL.revokeObjectURL = () => {}
    try {
      downloadText('workout-unreadable-2026-09-24.txt', CORRUPT)
    } finally {
      globalThis.document = saved.document
      URL.createObjectURL = saved.create
      URL.revokeObjectURL = saved.revoke
    }
    assert.equal(clicked, 'workout-unreadable-2026-09-24.txt')
    assert.equal(blob.type, 'text/plain')
    assert.equal(await blob.text(), CORRUPT)
  })
})
