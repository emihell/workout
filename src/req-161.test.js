// req-161 (DEC-086) — the unreadable-state Import copies EVERY present workout key (a
// leftover legacy key beside a corrupt v9 too), names each copy by its source, reuses an
// identical copy instead of piling up retries, and says what to do when storage is full.
// Runs the real storage.js + importWithBackup against an in-memory localStorage that
// enumerates like the real one, and a store stand-in that saves the way store.jsx does.
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { importWithBackup, KEEP_FAILED_MESSAGE, KEEP_NO_SPACE_MESSAGE } from './import-backup.js'
import { commitBackup } from './exchange.js'
import { getLoadUnreadable, keepUnreadableCopy, loadState, saveState, UNREADABLE_COPY_PREFIX } from './storage.js'

const V9 = 'workout-mvp-v9'
const V8 = 'workout-mvp-v8'
const V7 = 'workout-mvp-v7'
const CORRUPT = '{"exercises":[{"id":"ex-1","name":"Bänkpress 💪"}], "workouts": [ trunc\uD83D'
const fixture = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
const LEFTOVER_V8 = JSON.stringify(fixture) // a readable v8 an interrupted cleanup left behind

const quotaError = () => Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' })

let previous
let disk
let setItemFault = null // (key) => an Error to throw, or null
let keyFault = false
beforeEach(() => {
  previous = globalThis.localStorage
  disk = new Map()
  setItemFault = null
  keyFault = false
  globalThis.localStorage = {
    getItem: (key) => (disk.has(key) ? disk.get(key) : null),
    setItem: (key, value) => {
      const fault = setItemFault?.(key)
      if (fault) throw fault
      disk.set(key, String(value))
    },
    removeItem: (key) => disk.delete(key),
    get length() {
      return disk.size
    },
    key: (i) => {
      if (keyFault) throw new Error('SecurityError')
      return [...disk.keys()][i] ?? null
    },
  }
})
afterEach(() => {
  globalThis.localStorage = previous
})

const copies = () => [...disk.keys()].filter((key) => key.startsWith(UNREADABLE_COPY_PREFIX)).sort()
const copiesOf = (tag) => copies().filter((key) => key.endsWith(`-${tag}`))

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

// One Import from the unreadable state, confirmed. `downloadRaw` may throw (a failed attempt).
function importNow({ downloadRaw } = {}) {
  const raw = []
  const done = importWithBackup({
    store: makeStore(loadState()),
    payload: fixture,
    ask: () => true,
    download: () => assert.fail('no JSON backup in the unreadable state'),
    downloadRaw: downloadRaw ?? ((name, text) => raw.push(text)),
  })
  return { done, raw }
}
const failedDownload = () => {
  throw new Error('download blocked')
}

describe('1 — every present workout key is copied', () => {
  it('v9 corrupt + a leftover v8 → both copied (=== each), import, reload → both copies stay, v8 removed', async () => {
    disk.set(V9, CORRUPT)
    disk.set(V8, LEFTOVER_V8)
    const { done, raw } = importNow()
    assert.equal(getLoadUnreadable(), true)
    await done
    assert.equal(copiesOf('v9').length, 1)
    assert.equal(copiesOf('v8').length, 1)
    assert.equal(disk.get(copiesOf('v9')[0]), CORRUPT)
    assert.equal(disk.get(copiesOf('v8')[0]), LEFTOVER_V8)
    assert.match(copiesOf('v8')[0], /^workout-mvp-unreadable-\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z-v8$/)
    assert.deepEqual(raw, [CORRUPT], 'the download is still the one value the load read')
    assert.equal(getLoadUnreadable(), false)
    assert.equal(disk.has(V8), true, 'v8 is still there until the next load')
    const reloaded = loadState() // the existing legacy cleanup runs here
    assert.equal(reloaded.workouts.length, 13)
    assert.equal(disk.has(V8), false, 'v8 removed by the cleanup')
    assert.equal(disk.get(copiesOf('v9')[0]), CORRUPT, 'both copies outlive it')
    assert.equal(disk.get(copiesOf('v8')[0]), LEFTOVER_V8)
    assert.equal(copies().length, 2)
  })
  it('no v9, a corrupt v8 and a leftover v7 → v8 and v7 copied; the download is v8 (what the load read)', async () => {
    disk.set(V8, CORRUPT)
    disk.set(V7, LEFTOVER_V8)
    const { done, raw } = importNow()
    await done
    assert.deepEqual(copies().map((k) => k.slice(-3)), ['-v7', '-v8'])
    assert.equal(disk.get(copiesOf('v7')[0]), LEFTOVER_V8)
    assert.deepEqual(raw, [CORRUPT])
  })
  it('one key present → exactly one copy (the req-157 case, now suffixed)', async () => {
    disk.set(V9, CORRUPT)
    await importNow().done
    assert.deepEqual(copies().map((k) => k.slice(-3)), ['-v9'])
  })
})

describe('2 — retries reuse an identical copy; a differing value gets its own', () => {
  it('same raw twice (the first attempt fails at the download) → one copy per source', async () => {
    disk.set(V9, CORRUPT)
    disk.set(V8, LEFTOVER_V8)
    await assert.rejects(importNow({ downloadRaw: failedDownload }).done, /download blocked/)
    const first = copies()
    assert.equal(first.length, 2)
    await importNow().done
    assert.deepEqual(copies(), first, 'no new keys on the retry')
  })
  it('keepUnreadableCopy on an identical value → the existing key, reused, nothing written', () => {
    const a = keepUnreadableCopy(CORRUPT, V9, new Date('2026-09-25T10:00:00.000Z'))
    setItemFault = () => assert.fail('no write for an identical copy')
    const b = keepUnreadableCopy(CORRUPT, V9, new Date('2026-09-25T11:00:00.000Z'))
    assert.deepEqual(b, { key: a.key, reused: true })
  })
  it('a differing raw on the retry → a second copy; the first is never deleted', async () => {
    disk.set(V9, CORRUPT)
    await assert.rejects(importNow({ downloadRaw: failedDownload }).done, /download blocked/)
    disk.set(V9, CORRUPT + ' changed')
    await importNow().done
    const kept = copiesOf('v9').map((k) => disk.get(k)).sort()
    assert.deepEqual(kept, [CORRUPT, CORRUPT + ' changed'])
  })
  it('a differing value at the SAME timestamp never overwrites the existing copy (~2, ~3 …)', () => {
    const at = new Date('2026-09-25T10:00:00.000Z')
    const a = keepUnreadableCopy('first', V9, at)
    const b = keepUnreadableCopy('second', V9, at)
    const c = keepUnreadableCopy('third', V9, at)
    assert.deepEqual([a.key, b.key, c.key], [
      `${UNREADABLE_COPY_PREFIX}2026-09-25T10:00:00.000Z-v9`,
      `${UNREADABLE_COPY_PREFIX}2026-09-25T10:00:00.000Z~2-v9`,
      `${UNREADABLE_COPY_PREFIX}2026-09-25T10:00:00.000Z~3-v9`,
    ])
    assert.deepEqual([a.key, b.key, c.key].map((k) => disk.get(k)), ['first', 'second', 'third'])
  })
  it('the same content under a DIFFERENT source is not a match (each source keeps its own)', () => {
    keepUnreadableCopy(CORRUPT, V9)
    const v8 = keepUnreadableCopy(CORRUPT, V8)
    assert.equal(v8.reused, undefined)
    assert.equal(copies().length, 2)
  })
  it("a req-157 copy (no source suffix) with the same content doesn't count; it is left as it was", () => {
    const old = `${UNREADABLE_COPY_PREFIX}2026-09-24T10:00:00.000Z`
    disk.set(old, CORRUPT)
    const kept = keepUnreadableCopy(CORRUPT, V9)
    assert.notEqual(kept.key, old)
    assert.equal(disk.get(old), CORRUPT)
    assert.equal(copies().length, 2)
  })
})

describe('3 — any failure keeps the lock, saves nothing, deletes nothing', () => {
  const assertLocked = () => {
    assert.equal(getLoadUnreadable(), true)
    assert.equal(disk.get(V9), CORRUPT)
    assert.equal(disk.get(V8), LEFTOVER_V8)
    assert.equal(saveState({ exercises: [] }), false, 'writes still refused')
  }
  it('the v8 copy does not fit (quota) → the storage-full message; the v9 copy already written stays', async () => {
    disk.set(V9, CORRUPT)
    disk.set(V8, LEFTOVER_V8)
    setItemFault = (key) => (key.startsWith(UNREADABLE_COPY_PREFIX) && key.endsWith('-v8') ? quotaError() : null)
    const { done, raw } = importNow()
    await assert.rejects(done, { message: KEEP_NO_SPACE_MESSAGE })
    assert.deepEqual(raw, [], 'no download')
    assertLocked()
    assert.deepEqual(copies().map((k) => k.slice(-3)), ['-v9'])
  })
  it('a non-quota write failure → the plain message (no storage advice)', async () => {
    disk.set(V9, CORRUPT)
    disk.set(V8, LEFTOVER_V8)
    setItemFault = (key) => (key.startsWith(UNREADABLE_COPY_PREFIX) ? new Error('SecurityError') : null)
    await assert.rejects(importNow().done, { message: KEEP_FAILED_MESSAGE })
    assertLocked()
  })
  it('the v8 copy reads back different → the plain message', async () => {
    disk.set(V9, CORRUPT)
    disk.set(V8, LEFTOVER_V8)
    const real = globalThis.localStorage.setItem
    globalThis.localStorage.setItem = (key, value) => real(key, key.endsWith('-v8') ? value.slice(0, 10) : value)
    await assert.rejects(importNow().done, { message: KEEP_FAILED_MESSAGE })
    assertLocked()
  })
  it('enumerating keys throws (the de-dup scan) → the plain message, nothing copied', async () => {
    disk.set(V9, CORRUPT)
    disk.set(V8, LEFTOVER_V8)
    const { done } = importNow()
    keyFault = true
    await assert.rejects(done, { message: KEEP_FAILED_MESSAGE })
    keyFault = false
    assertLocked()
    assert.equal(copies().length, 0)
  })
  it('[measured] the storage-full message names the next step and warns off clearing this app', () => {
    assert.match(KEEP_NO_SPACE_MESSAGE, /storage is full/)
    assert.match(KEEP_NO_SPACE_MESSAGE, /other sites/)
    assert.match(KEEP_NO_SPACE_MESSAGE, /not this app's/)
    assert.match(KEEP_NO_SPACE_MESSAGE, /still stored as it was/)
  })
})
