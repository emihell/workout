// req-265 — the log screen / review / Details editor read the generated hint list
// (src/library/hints.json) instead of the full exercise library chunk. Same values for every
// entry (criterion 2), the committed file is the generator's output (criterion 3), and a failed
// hints chunk leaves the screen as it is without a library, with a later mount retrying (criterion 4).
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { act, importJsx, render } from './test-support/render.js'
import { catalogNameKey, lazyChunk, loadExerciseLibrary, loadLibraryHints } from './exerciseLibrary.js'
import { isEachSide, libraryEachSide, libraryHintEntries, libraryHintsText, restNotesFor } from './library-hints.js'

const h = React.createElement
const LIBRARY_TEXT = readFileSync(new URL('./library/exercises.json', import.meta.url), 'utf8')
const HINTS_TEXT = readFileSync(new URL('./library/hints.json', import.meta.url), 'utf8')
const library = JSON.parse(LIBRARY_TEXT)

// ---- criterion 4 first: the hook's module cache (`loaded`) must still be empty here ----
let view = null
afterEach(async () => {
  await view?.unmount()
  view = null
})
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

describe('req-265 criterion 4 — the hints chunk fails to load', () => {
  it('lazyChunk: a rejected import is not cached; the next call retries and then caches', async () => {
    let calls = 0
    const load = lazyChunk(() => {
      calls += 1
      return calls === 1 ? Promise.reject(new Error('chunk failed')) : Promise.resolve({ default: ['ok'] })
    })
    await assert.rejects(load(), /chunk failed/)
    assert.deepEqual(await load(), ['ok'])
    assert.deepEqual(await load(), ['ok'])
    assert.equal(calls, 2, 'one retry, then cached')
  })

  it('the hook: rejected → null (screen as without a library: plain reps, note alone), no error; a later mount retries', async () => {
    const { useExerciseLibrary } = await importJsx('./views/workout/use-library.js', import.meta.url)
    let calls = 0
    const load = lazyChunk(() => {
      calls += 1
      return calls === 1 ? Promise.reject(new Error('chunk failed')) : import('./library/hints.json', { with: { type: 'json' } })
    })
    const row = { name: 'One-Arm DB Row' }
    const item = { id: 'x', notes: 'Pull to ribs' }
    function Probe() {
      const lib = useExerciseLibrary(load)
      const notes = restNotesFor(item, row, lib)
      return h('p', null, `${lib ? 'lib' : 'none'}|${isEachSide(row, lib)}|${notes.note}|${notes.cues.length}`)
    }
    view = await render(h(Probe))
    await settle()
    assert.equal(view.text(), 'none|false|Pull to ribs|0', 'absent library: plain reps, the routine note alone')
    await view.unmount()
    view = await render(h(Probe))
    for (let i = 0; i < 50 && !view.text().startsWith('lib'); i += 1) await settle() // the JSON import's ticks
    assert.equal(calls, 2, 'the later mount retried')
    assert.equal(view.text(), 'lib|true|Pull to ribs|3')
  })
})

describe('req-265 criterion 3 — the committed hints.json is fresh', () => {
  it('equals the generator output on the committed exercises.json', () => {
    assert.equal(HINTS_TEXT, libraryHintsText(library))
  })

  it('loadLibraryHints returns that list; it carries only the resolution + hint fields', async () => {
    const hints = await loadLibraryHints()
    assert.deepEqual(hints, libraryHintEntries(library))
    const fields = new Set(hints.flatMap((entry) => Object.keys(entry)))
    assert.deepEqual([...fields].sort(), ['aliases', 'displayName', 'formCues', 'id', 'name', 'unilateral'])
    assert.ok((await loadExerciseLibrary()).length === hints.length)
  })
})

describe('req-265 criterion 2 — same values from the hint list and the full list, every entry', () => {
  it('libraryId / name / displayName / alias / cardio exercises over all 944 entries', () => {
    const hints = JSON.parse(HINTS_TEXT)
    assert.equal(library.length, 944)
    assert.equal(hints.length, library.length)
    const items = [{ id: 'i', notes: '' }, { id: 'i', notes: 'Routine note' }]
    let compared = 0
    let eachSideTrue = 0
    let withCues = 0
    for (const entry of library) {
      const names = [entry.name, entry.displayName, ...(entry.aliases || [])].filter((name) => catalogNameKey(name))
      const exercises = [
        { libraryId: entry.id, name: 'Not a library name' },
        ...names.map((name) => ({ name })),
        { name: entry.name, type: 'cardio' },
        { libraryId: entry.id, name: entry.name, type: 'cardio' },
      ]
      for (const ex of exercises) {
        const full = isEachSide(ex, library)
        assert.equal(isEachSide(ex, hints), full, `isEachSide ${entry.id} ${JSON.stringify(ex)}`)
        assert.equal(libraryEachSide(ex, hints), libraryEachSide(ex, library), `libraryEachSide ${entry.id}`)
        for (const item of items) {
          const fullNotes = restNotesFor(item, ex, library)
          assert.deepEqual(restNotesFor(item, ex, hints), fullNotes, `restNotesFor ${entry.id} ${JSON.stringify(ex)}`)
          if (fullNotes?.cues.length) withCues += 1
        }
        if (full) eachSideTrue += 1
        compared += 1
      }
    }
    // Not a loop over nothing: thousands of exercises, and both hints actually fire.
    assert.ok(compared > 944 * 3, `compared ${compared}`)
    assert.ok(eachSideTrue > 0, `each side true ${eachSideTrue}`)
    assert.ok(withCues > 0, `with cues ${withCues}`)
    console.log(`req-265: ${library.length} entries, ${compared} exercises compared, eachSide true ${eachSideTrue}, restNotes with cues ${withCues}`)
  })
})
