import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEV_NOTES_KEY,
  FEEDBACK_ENABLED_KEY,
  appendNote,
  buildNote,
  captureContext,
  clearNotes,
  notesJson,
  readEnabled,
  readNotes,
  writeEnabled,
  writeNotes,
} from './dev-notes.js'

// A minimal in-memory localStorage stand-in (node --test has no localStorage).
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  }
}

test('buildNote normalizes fields and trims text', () => {
  const note = buildNote({ route: '/history/abc', text: '  needs a back button  ', context: { a: 1 } }, '2026-09-16T10:00:00.000Z')
  assert.deepEqual(note, {
    route: '/history/abc',
    timestamp: '2026-09-16T10:00:00.000Z',
    text: 'needs a back button',
    context: { a: 1 },
  })
})

test('buildNote defaults are safe on empty input', () => {
  const note = buildNote({}, undefined)
  assert.deepEqual(note, { route: '', timestamp: '', text: '', context: {} })
})

test('captureContext splits route name from params and keeps ids', () => {
  const ctx = captureContext(
    { name: 'workout-item', routineId: 'r1', itemId: 'i9' },
    { hash: '/workout/r1/item/i9', appVersion: 'abc123' },
  )
  assert.deepEqual(ctx, {
    routeName: 'workout-item',
    params: { routineId: 'r1', itemId: 'i9' },
    hash: '/workout/r1/item/i9',
    appVersion: 'abc123',
  })
})

test('append/read round-trips through the dev key only', () => {
  const storage = fakeStorage()
  const note = buildNote({ route: '/', text: 'hi' }, 't1')
  appendNote(storage, note)
  assert.deepEqual(readNotes(storage), [note])
  // The one and only key written is the dev key — never workout-mvp-v9.
  assert.deepEqual([...storage._map.keys()], [DEV_NOTES_KEY])
})

test('appendNote accumulates in order', () => {
  const storage = fakeStorage()
  appendNote(storage, buildNote({ text: 'one' }, 't1'))
  appendNote(storage, buildNote({ text: 'two' }, 't2'))
  const notes = readNotes(storage)
  assert.equal(notes.length, 2)
  assert.deepEqual(notes.map((n) => n.text), ['one', 'two'])
})

test('readNotes tolerates absent, malformed, and non-array values', () => {
  assert.deepEqual(readNotes(fakeStorage()), [])
  assert.deepEqual(readNotes(fakeStorage({ [DEV_NOTES_KEY]: 'not json' })), [])
  assert.deepEqual(readNotes(fakeStorage({ [DEV_NOTES_KEY]: '{"a":1}' })), [])
  assert.deepEqual(readNotes(null), [])
})

test('clearNotes removes the dev key', () => {
  const storage = fakeStorage({ [DEV_NOTES_KEY]: '[]' })
  clearNotes(storage)
  assert.equal(storage.getItem(DEV_NOTES_KEY), null)
})

test('writeNotes/notesJson produce paste-ready JSON', () => {
  const notes = [buildNote({ route: '/', text: 'x' }, 't1')]
  const json = notesJson(notes)
  assert.equal(JSON.parse(json)[0].text, 'x')
  assert.ok(json.includes('\n'), 'pretty-printed')
})

test('storage failures degrade to safe defaults, never throw', () => {
  const throwing = {
    getItem: () => { throw new Error('denied') },
    setItem: () => { throw new Error('denied') },
    removeItem: () => { throw new Error('denied') },
  }
  assert.deepEqual(readNotes(throwing), [])
  assert.equal(writeNotes(throwing, []), false)
  assert.equal(clearNotes(throwing), false)
})

// ---- req-87 enabled flag ----

test('readEnabled defaults OFF when the key is absent', () => {
  assert.equal(readEnabled(fakeStorage()), false)
  assert.equal(readEnabled(null), false)
})

test('readEnabled is true only for the literal "true"', () => {
  assert.equal(readEnabled(fakeStorage({ [FEEDBACK_ENABLED_KEY]: 'true' })), true)
  assert.equal(readEnabled(fakeStorage({ [FEEDBACK_ENABLED_KEY]: 'false' })), false)
  assert.equal(readEnabled(fakeStorage({ [FEEDBACK_ENABLED_KEY]: '1' })), false)
})

test('writeEnabled(true) stores "true"; writeEnabled(false) REMOVES the key (off == absence)', () => {
  const storage = fakeStorage()
  writeEnabled(storage, true)
  assert.equal(storage.getItem(FEEDBACK_ENABLED_KEY), 'true')
  assert.equal(readEnabled(storage), true)
  writeEnabled(storage, false)
  assert.equal(storage.getItem(FEEDBACK_ENABLED_KEY), null) // absence, not 'false'
  assert.equal(readEnabled(storage), false)
})

// Acceptance: the only localStorage keys this feature ever touches are the flag key
// and the notes key — NEVER workout-mvp-v9 (the user's real history).
test('the feature touches only the feedback flag + notes keys, never workout-mvp-v9', () => {
  const storage = fakeStorage()
  writeEnabled(storage, true)
  appendNote(storage, buildNote({ route: '/', text: 'x' }, 't1'))
  writeEnabled(storage, false)
  const touched = [...storage._map.keys()].sort()
  // 'false' removed its key, so only the notes key remains written after the run,
  // and at no point was any key other than these two set.
  assert.deepEqual(touched, [DEV_NOTES_KEY])
  assert.ok(!touched.includes('workout-mvp-v9'))
  // Both allowed keys are distinct from the workout data key.
  assert.notEqual(DEV_NOTES_KEY, 'workout-mvp-v9')
  assert.notEqual(FEEDBACK_ENABLED_KEY, 'workout-mvp-v9')
})

test('storage failures on the flag degrade to OFF, never throw', () => {
  const throwing = {
    getItem: () => { throw new Error('denied') },
    setItem: () => { throw new Error('denied') },
    removeItem: () => { throw new Error('denied') },
  }
  assert.equal(readEnabled(throwing), false)
  assert.equal(writeEnabled(throwing, true), false)
})
