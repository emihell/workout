// req-142 / DEC-069 — RepDB removed completely: no credit, no scripts, no cache folder. Exercises
// added from RepDB before req-139 (repdb-* ids / libraryIds) still load and resolve without errors.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { catalogNameKey, libraryEntryFor } from './exerciseLibrary.js'
import { libraryItemMatch } from './exercise-names.js'
import { migrateState } from './model.js'
import { applyBackup, buildBackup } from './exchange.js'

const here = (path) => fileURLToPath(new URL(path, import.meta.url))
const library = JSON.parse(readFileSync(here('./library/exercises.json'), 'utf8'))
const stored = { id: 'repdb-x', libraryId: 'repdb-x', name: 'Some RepDB Move', equipment: 'Dumbbell', weightStep: '2', muscles: '', cues: '', type: 'free' }

describe('stored repdb-* exercises', () => {
  it('survive migration unchanged in id, libraryId and name', () => {
    const state = migrateState({ exercises: [stored], routines: [], workouts: [] })
    const kept = state.exercises.find((exercise) => exercise.id === 'repdb-x')
    assert.ok(kept)
    assert.equal(kept.libraryId, 'repdb-x')
    assert.equal(kept.name, 'Some RepDB Move')
  })

  it('resolve to null when the name matches nothing (the repdb libraryId is simply not found)', () => {
    assert.equal(libraryEntryFor(stored, library), null)
    assert.equal(libraryEntryFor({ id: 'repdb-y', libraryId: 'repdb-y' }, library), null)
  })

  it('fall through to the name like any unknown libraryId (unchanged behaviour)', () => {
    assert.equal(libraryEntryFor({ ...stored, name: 'Bench Press' }, library).id, 'Barbell_Bench_Press_-_Medium_Grip')
  })

  it('never match a library Search row by libraryId, and round-trip through a backup', () => {
    for (const item of library.slice(0, 50)) assert.equal(libraryItemMatch([stored], item), null)
    const state = migrateState({ exercises: [stored], routines: [], workouts: [] })
    const restored = applyBackup(buildBackup(state))
    assert.ok(restored.state.exercises.some((exercise) => exercise.id === 'repdb-x' && exercise.libraryId === 'repdb-x'))
    assert.ok(catalogNameKey(stored.name))
  })
})

describe('nothing of RepDB left', () => {
  it('no credit component, no RepDB scripts, no cache folder or ignore line', () => {
    assert.equal(existsSync(here('./views/credits.jsx')), false)
    assert.equal(existsSync(here('../scripts/library-gap.mjs')), false)
    assert.equal(existsSync(here('../scripts/originality.mjs')), false)
    assert.equal(existsSync(here('../.vendor-cache')), false)
    assert.doesNotMatch(readFileSync(here('../.gitignore'), 'utf8'), /vendor-cache|repdb/i)
    assert.doesNotMatch(readFileSync(here('../package.json'), 'utf8'), /repdb|originality|library-gap/i)
  })
})
