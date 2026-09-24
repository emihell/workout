// req-157 (audit F-RISK-5, DEC-085 §2, refines DEC-032) — Import from the "unreadable data"
// state never loses the raw value: after the confirm it keeps an on-device copy (read back
// ===), downloads the raw string, and only then lifts the write lock and saves the import.
// Any failure before that point keeps the lock with nothing saved. Runs the real storage.js
// (loadState / saveState / the lock / the copy) against an in-memory localStorage, and a
// store stand-in that saves the way store.jsx's setState does.
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { importWithBackup, downloadText, KEEP_FAILED_MESSAGE, REPLACE_MESSAGE, REPLACE_UNREADABLE_MESSAGE } from './import-backup.js'
import { commitBackup } from './exchange.js'
import { getLoadUnreadable, loadState, readUnreadableRaw, saveState, UNREADABLE_COPY_PREFIX } from './storage.js'

const KEY = 'workout-mvp-v9'
// Cut mid-emoji: ends in an unpaired high surrogate, the shape a truncated value has.
const CORRUPT = '{"exercises":[{"id":"ex-1","name":"Bänkpress 💪"}], "workouts": [ trunc\uD83D'
const fixture = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))

let previous
let disk
let failSetItemFor = null // a key prefix whose setItem throws (quota)
let failGetItem = false
beforeEach(() => {
  previous = globalThis.localStorage
  disk = new Map()
  failSetItemFor = null
  failGetItem = false
  globalThis.localStorage = {
    getItem: (key) => {
      if (failGetItem) throw new Error('SecurityError')
      return disk.has(key) ? disk.get(key) : null
    },
    setItem: (key, value) => {
      if (failSetItemFor && key.startsWith(failSetItemFor)) throw new Error('QuotaExceededError')
      disk.set(key, String(value))
    },
    removeItem: (key) => disk.delete(key),
  }
})
afterEach(() => {
  globalThis.localStorage = previous
})

const copies = () => [...disk.keys()].filter((key) => key.startsWith(UNREADABLE_COPY_PREFIX))

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

function run({ answer, payload = fixture, downloadRaw, before }) {
  const store = makeStore(loadState())
  before?.()
  const calls = { asked: [], raw: [], json: [] }
  const done = importWithBackup({
    store,
    payload,
    ask: (message) => {
      calls.asked.push(message)
      return answer
    },
    download: (name, data) => calls.json.push({ name, data }),
    downloadRaw:
      downloadRaw ??
      ((name, text) => calls.raw.push({ name, text, lockedAtDownload: getLoadUnreadable(), copiesAtDownload: copies() })),
  })
  return { store, calls, done }
}

describe('unreadable state + valid import + confirm', () => {
  it('keeps an exact on-device copy, downloads the raw string, then lifts the lock and saves; a reload loads it', async () => {
    disk.set(KEY, CORRUPT)
    const { calls, done } = run({ answer: true })
    assert.equal(getLoadUnreadable(), true, 'the corrupt load latched the lock')
    const result = await done
    assert.deepEqual(calls.asked, [REPLACE_UNREADABLE_MESSAGE])
    // the copy: one key, exactly the stored string (unpaired surrogate included)
    const kept = copies()
    assert.equal(kept.length, 1)
    assert.match(kept[0], /^workout-mvp-unreadable-\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    assert.equal(disk.get(kept[0]), CORRUPT)
    assert.equal(disk.get(kept[0]).at(-1), '\uD83D')
    // the download: after the copy, before the lock lifts
    assert.equal(calls.raw.length, 1)
    assert.equal(calls.raw[0].text, CORRUPT)
    assert.match(calls.raw[0].name, /^workout-unreadable-\d{4}-\d{2}-\d{2}\.txt$/)
    assert.deepEqual(calls.raw[0].copiesAtDownload, kept, 'the copy existed before the download')
    assert.equal(calls.raw[0].lockedAtDownload, true)
    assert.equal(calls.json.length, 0, 'no empty-state backup in its place')
    // the import is really saved, and survives a reload; the copy stays
    assert.equal(getLoadUnreadable(), false)
    assert.equal(result.summary.workouts, 13)
    assert.equal(JSON.parse(disk.get(KEY)).workouts.length, 13)
    assert.equal(loadState().workouts.length, 13)
    assert.equal(getLoadUnreadable(), false)
    assert.equal(disk.get(kept[0]), CORRUPT, 'never deleted')
  })
  it('a corrupt LEGACY v8 key: it is the one kept and downloaded, and the copy outlives the reload that removes v8', async () => {
    disk.set('workout-mvp-v8', CORRUPT)
    const { calls, done } = run({ answer: true })
    await done
    assert.equal(calls.raw[0].text, CORRUPT)
    assert.equal(JSON.parse(disk.get(KEY)).workouts.length, 13)
    loadState() // the existing legacy cleanup runs here
    assert.equal(disk.has('workout-mvp-v8'), false, 'v8 removed by the existing cleanup')
    assert.equal(copies().length, 1)
    assert.equal(disk.get(copies()[0]), CORRUPT, 'the copy is still there')
  })
})

describe('any failure before the lock lifts: lock kept, nothing saved', () => {
  it('the copy cannot be written (quota) → inline error, no download, stored value untouched', async () => {
    disk.set(KEY, CORRUPT)
    failSetItemFor = UNREADABLE_COPY_PREFIX
    const { calls, done } = run({ answer: true })
    await assert.rejects(done, { message: KEEP_FAILED_MESSAGE })
    assert.equal(calls.raw.length + calls.json.length, 0)
    assert.equal(getLoadUnreadable(), true)
    assert.equal(disk.get(KEY), CORRUPT)
    assert.equal(saveState({ exercises: [] }), false, 'writes still refused')
  })
  it('the copy reads back different → same abort', async () => {
    disk.set(KEY, CORRUPT)
    const { done } = run({
      answer: true,
      before: () => {
        const real = globalThis.localStorage.setItem
        globalThis.localStorage.setItem = (key, value) => real(key, key.startsWith(UNREADABLE_COPY_PREFIX) ? value.slice(0, 10) : value)
      },
    })
    await assert.rejects(done, { message: KEEP_FAILED_MESSAGE })
    assert.equal(getLoadUnreadable(), true)
    assert.equal(disk.get(KEY), CORRUPT)
  })
  it('the download throws → lock kept, nothing saved (the copy stays)', async () => {
    disk.set(KEY, CORRUPT)
    const { done } = run({
      answer: true,
      downloadRaw: () => {
        throw new Error('download blocked')
      },
    })
    await assert.rejects(done, /download blocked/)
    assert.equal(getLoadUnreadable(), true)
    assert.equal(disk.get(KEY), CORRUPT)
    assert.equal(disk.get(copies()[0]), CORRUPT)
  })
  it('getItem throws after the confirm → inline error, lock kept, nothing written', async () => {
    disk.set(KEY, CORRUPT)
    const { calls, done } = run({ answer: true, before: () => (failGetItem = true) })
    await assert.rejects(done, { message: KEEP_FAILED_MESSAGE })
    failGetItem = false
    assert.equal(calls.raw.length + calls.json.length, 0)
    assert.equal(getLoadUnreadable(), true)
    assert.equal(disk.get(KEY), CORRUPT)
    assert.equal(copies().length, 0)
  })
  it('the value is read AFTER the confirm (not before)', async () => {
    disk.set(KEY, CORRUPT)
    const { calls, done } = run({ answer: true, before: () => disk.set(KEY, CORRUPT + ' changed') })
    await done
    assert.equal(calls.raw[0].text, CORRUPT + ' changed')
  })
})

describe('cancel, bad file, value gone, readable state', () => {
  it('cancel → nothing read, kept, downloaded or saved; lock kept', async () => {
    disk.set(KEY, CORRUPT)
    const { calls, done } = run({ answer: false })
    assert.equal(await done, null)
    assert.deepEqual(calls.asked, [REPLACE_UNREADABLE_MESSAGE])
    assert.equal(calls.raw.length + calls.json.length, 0)
    assert.equal(copies().length, 0)
    assert.equal(getLoadUnreadable(), true)
    assert.equal(disk.get(KEY), CORRUPT)
  })
  it('invalid file → error, nothing asked, kept or downloaded; lock kept', async () => {
    disk.set(KEY, CORRUPT)
    const { calls, done } = run({ answer: true, payload: { kind: 'workout-analytics', events: [] } })
    await assert.rejects(done, /Not a workout database backup/)
    assert.equal(calls.asked.length + calls.raw.length + calls.json.length, 0)
    assert.equal(copies().length, 0)
    assert.equal(getLoadUnreadable(), true)
    assert.equal(disk.get(KEY), CORRUPT)
  })
  it('value gone from disk (getItem answered null) → the usual backup, then the lock lifts and the import saves', async () => {
    disk.set(KEY, CORRUPT)
    const { calls, done } = run({ answer: true, before: () => disk.delete(KEY) })
    await done
    assert.equal(calls.raw.length, 0)
    assert.equal(calls.json.length, 1)
    assert.equal(copies().length, 0)
    assert.equal(getLoadUnreadable(), false)
    assert.equal(JSON.parse(disk.get(KEY)).workouts.length, 13)
  })
  it('readable data → the usual question and JSON backup; no copy, no raw download', async () => {
    disk.set(KEY, JSON.stringify({ ...fixture, schemaVersion: 9 }))
    loadState()
    assert.deepEqual(readUnreadableRaw(), { unlocked: true })
    const { calls, done } = run({ answer: true })
    await done
    assert.deepEqual(calls.asked, [REPLACE_MESSAGE])
    assert.equal(calls.raw.length, 0)
    assert.equal(calls.json.length, 1)
    assert.equal(copies().length, 0)
  })
})

describe('downloadText', () => {
  it('a text/plain Blob of the string; the URL is revoked later, not synchronously', async () => {
    const saved = { document: globalThis.document, create: URL.createObjectURL, revoke: URL.revokeObjectURL, setTimeout: globalThis.setTimeout }
    let blob = null
    let clicked = null
    let revokedSync = false
    let timer = null
    globalThis.document = { createElement: () => ({ click() { clicked = this.download } }) }
    URL.createObjectURL = (b) => {
      blob = b
      return 'blob:x'
    }
    URL.revokeObjectURL = () => {
      revokedSync = true
    }
    globalThis.setTimeout = (fn, ms) => {
      timer = { fn, ms }
    }
    try {
      downloadText('workout-unreadable-2026-09-24.txt', 'Bänkpress 💪')
      assert.equal(revokedSync, false, 'not revoked straight after click')
      assert.ok(timer.ms >= 1000)
      timer.fn()
      assert.equal(revokedSync, true, 'revoked when the timer fires')
    } finally {
      Object.assign(globalThis, { document: saved.document, setTimeout: saved.setTimeout })
      URL.createObjectURL = saved.create
      URL.revokeObjectURL = saved.revoke
    }
    assert.equal(clicked, 'workout-unreadable-2026-09-24.txt')
    assert.equal(blob.type, 'text/plain')
    assert.equal(await blob.text(), 'Bänkpress 💪')
  })
  it('[measured] a Blob cannot carry an unpaired surrogate — why the on-device copy comes first', async () => {
    assert.equal(await new Blob(['ab\uD83D']).text(), 'ab�')
  })
})
