// req-268 — a workout finished on one device can't come back as in progress after a three-way merge
// (audit 2026-10-30 F-SYNC-1). Real reducers, real merge, the server's own validator.
import './test-helpers.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeStates } from './merge.mjs'
import { validState } from './store.mjs'
import { fullState } from '../src/test-support/full-state.js'
import { setLoggedState } from '../src/state-reducers.js'
import { finishedState } from '../src/workout-log.js'

let n = 0
const withSet = (s) =>
  setLoggedState(s, {
    routineItemId: 'si-press',
    exerciseId: 'ex-press',
    setType: 'work',
    weight: 25,
    reps: '8',
    rpe: null,
    note: `set-268-${++n}`,
    targetReps: '10',
    targetWeight: 25,
    loggedAt: `2026-10-09T17:${String(20 + n).padStart(2, '0')}:00.000Z`,
  })

// base: wo-2 in progress with sets logged (fullState). A finishes it; B (same base, not pulled) logs one more set.
function threeStates() {
  const base = withSet(fullState())
  const id = base.activeWorkout.id
  const A = finishedState(base, { overallNote: '', overallFeel: '' }, '2026-10-09T18:00:00.000Z')
  const B = withSet(base)
  return { base, A, B, id }
}

test('criterion 1+4: finished on A, a set logged on B → merged activeWorkout null, one A record, B’s workout lost verbatim', () => {
  const { base, A, B, id } = threeStates()
  assert.equal(A.activeWorkout, null)
  assert.ok(A.workouts.some((w) => w.id === id), 'A has it in history')
  // putState: mergeStates(base, incoming = B, current = A) (server/store.mjs)
  const { state, conflicts } = mergeStates(base, B, A)
  assert.equal(state.activeWorkout, null, 'not in progress')
  const copies = state.workouts.filter((w) => w.id === id)
  assert.equal(copies.length, 1, 'one history entry')
  assert.equal(copies[0], A.workouts.find((w) => w.id === id), 'A’s finished record, verbatim (same object)')
  const dropped = conflicts.filter((c) => c.kind === 'finished-elsewhere')
  assert.equal(dropped.length, 1)
  assert.equal(dropped[0].field, 'activeWorkout')
  assert.equal(dropped[0].id, null)
  assert.deepEqual(dropped[0].lost, B.activeWorkout, 'the lost value is B’s in-progress workout')
  assert.equal(dropped[0].lost, B.activeWorkout, 'verbatim — the same object, not a rebuilt one')
  // The server re-validates the merged result: it still passes.
  assert.doesNotThrow(() => validState(state))
})

test('criterion 1: the other direction (A’s finish arrives on top of B’s set) gives the same null', () => {
  const { base, A, B, id } = threeStates()
  const { state, conflicts } = mergeStates(base, A, B)
  assert.equal(state.activeWorkout, null)
  assert.equal(state.workouts.filter((w) => w.id === id).length, 1)
  // Here A's `null` already wins the activeWorkout record (incoming); the guard has nothing to drop.
  assert.ok(!conflicts.some((c) => c.kind === 'finished-elsewhere'))
})

test('criterion 2: both devices still mid-workout, one logs a set → unchanged: incoming wins, edited-on-both, not null', () => {
  const base = withSet(fullState())
  const A = withSet(base)
  const B = withSet(base)
  const { state, conflicts } = mergeStates(base, B, A)
  assert.equal(state.activeWorkout, B.activeWorkout, 'incoming wins')
  assert.deepEqual(conflicts, [{ field: 'activeWorkout', id: null, kind: 'edited-on-both', lost: A.activeWorkout }])
})

test('a workout in progress whose id is not in history is never dropped, even when history changed on both sides', () => {
  const { base, A } = threeStates()
  // A finished wo-2; B started nothing new but its workout has another id (a fresh start on B).
  const B = { ...base, activeWorkout: { ...base.activeWorkout, id: 'wo-other' } }
  const { state, conflicts } = mergeStates(base, B, A)
  assert.equal(state.activeWorkout, B.activeWorkout)
  assert.ok(!conflicts.some((c) => c.kind === 'finished-elsewhere'))
})
