// req-107 — the active-workout note helpers (workout-note.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activeFeel, activeNote, autoFinishArgs } from './workout-note.js'
import { migrateState } from './model.js'
import { emptyState } from './storage.js'

test('auto-finish saves the overview note, not an empty string', () => {
  const args = autoFinishArgs({ overallNote: 'Shoulder felt tight' })
  assert.deepEqual(args, { overallNote: 'Shoulder felt tight', overallFeel: '' })
})

// req-116 — Feel lives on the active workout; auto-complete saves the chosen one.
test('auto-finish saves the Feel chosen on Finish (active overallFeel)', () => {
  const args = autoFinishArgs({ overallNote: '', overallFeel: 'Hard' })
  assert.equal(args.overallFeel, 'Hard')
})

test('auto-finish with no Feel chosen still saves an empty Feel (never invented)', () => {
  assert.equal(autoFinishArgs({ overallFeel: '' }).overallFeel, '')
  assert.equal(autoFinishArgs({}).overallFeel, '')
  assert.equal(autoFinishArgs(null).overallFeel, '')
  assert.equal(activeFeel({ overallFeel: null }), '')
})

test('auto-finish with no note saves an empty note, as before', () => {
  assert.equal(autoFinishArgs({ overallNote: '' }).overallNote, '')
  assert.equal(autoFinishArgs({}).overallNote, '')
  assert.equal(autoFinishArgs(null).overallNote, '')
})

test('an active workout without overallNote reads as an empty note (never undefined)', () => {
  assert.equal(activeNote({ id: 'wo-legacy' }), '')
  assert.equal(activeNote({ id: 'wo-legacy', overallNote: null }), '')
  assert.equal(activeNote(undefined), '')
  assert.equal(activeNote({ overallNote: 'kept' }), 'kept')
})

test('a legacy active workout without overallNote survives migration and reads as empty', () => {
  // A draft promoted by continueDraft, or an active workout saved before startWorkout
  // wrote overallNote: the stored doc simply lacks the field. migrateState must load it
  // (no crash) and the note helper must read ''.
  const legacyActive = {
    id: 'wo-legacy',
    routineId: 'r1',
    startedAt: '2026-09-20T10:00:00.000Z',
    finishedAt: null,
    snapshot: { routineName: 'Push', items: [] },
    sets: [],
  }
  const state = migrateState({ ...emptyState(), activeWorkout: legacyActive })
  assert.ok(state.activeWorkout, 'active workout kept')
  assert.equal(state.activeWorkout.id, 'wo-legacy')
  assert.equal(activeNote(state.activeWorkout), '')
})
