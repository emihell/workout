// req-229 §5 — the three-way merge, as a pure function.
import './test-helpers.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeStates } from './merge.mjs'

const r = (id, name) => ({ id, name })

test('a record changed on one side only takes that side', () => {
  const base = { routines: [r('a', 'A'), r('b', 'B')] }
  const mine = { routines: [r('a', 'A2'), r('b', 'B')] }
  const theirs = { routines: [r('a', 'A'), r('b', 'B3')] }
  const { state, conflicts } = mergeStates(base, mine, theirs)
  assert.deepEqual(state.routines, [r('a', 'A2'), r('b', 'B3')])
  assert.deepEqual(conflicts, [])
})

test('additions on both sides are all kept, in a stable order', () => {
  const base = { workouts: [r('w1', 1)] }
  const mine = { workouts: [r('w1', 1), r('m', 'mine')] }
  const theirs = { workouts: [r('t', 'theirs'), r('w1', 1)] }
  const { state, conflicts } = mergeStates(base, mine, theirs)
  assert.deepEqual(state.workouts, [r('t', 'theirs'), r('w1', 1), r('m', 'mine')])
  assert.deepEqual(conflicts, [])
})

test('deleted on one side, untouched on the other → deleted (either side)', () => {
  const base = { exercises: [r('x', 'X'), r('y', 'Y')] }
  const mine = { exercises: [r('y', 'Y')] }
  const theirs = { exercises: [r('x', 'X')] }
  const { state, conflicts } = mergeStates(base, mine, theirs)
  assert.deepEqual(state.exercises, [])
  assert.deepEqual(conflicts, [])
})

test('changed on both sides → incoming wins, the current version is listed as lost', () => {
  const base = { routines: [r('a', 'A')] }
  const mine = { routines: [r('a', 'mine')] }
  const theirs = { routines: [r('a', 'theirs')] }
  const { state, conflicts } = mergeStates(base, mine, theirs)
  assert.deepEqual(state.routines, [r('a', 'mine')])
  assert.deepEqual(conflicts, [{ field: 'routines', id: 'a', kind: 'edited-on-both', lost: r('a', 'theirs') }])
})

test('incoming edit vs current deletion → the edit wins, the deletion is a conflict (lost: null)', () => {
  const base = { exercises: [r('x', 'X')] }
  const { state, conflicts } = mergeStates(base, { exercises: [r('x', 'X2')] }, { exercises: [] })
  assert.deepEqual(state.exercises, [r('x', 'X2')])
  assert.deepEqual(conflicts, [{ field: 'exercises', id: 'x', kind: 'edited-vs-deleted', lost: null }])
})

test('incoming deletion vs current edit → deleted, the edit kept in conflicts', () => {
  const base = { exercises: [r('x', 'X')] }
  const { state, conflicts } = mergeStates(base, { exercises: [] }, { exercises: [r('x', 'X3')] })
  assert.deepEqual(state.exercises, [])
  assert.deepEqual(conflicts, [{ field: 'exercises', id: 'x', kind: 'deleted-vs-edited', lost: r('x', 'X3') }])
})

test('the same change on both sides is not a conflict', () => {
  const base = { routines: [r('a', 'A')], schedule: { slots: [] } }
  const both = { routines: [r('a', 'same')], schedule: { slots: [{ id: 's' }] } }
  const { state, conflicts } = mergeStates(base, structuredClone(both), structuredClone(both))
  assert.deepEqual(state, both)
  assert.deepEqual(conflicts, [])
})

test('schedule, activeWorkout and legacyRecommendations are each one record', () => {
  const base = { schedule: { loopWeeks: 1, slots: [] }, activeWorkout: null, legacyRecommendations: {} }
  const mine = { schedule: { loopWeeks: 2, slots: [] }, activeWorkout: { id: 'w' }, legacyRecommendations: {} }
  const theirs = { schedule: { loopWeeks: 1, slots: [{ id: 's' }] }, activeWorkout: null, legacyRecommendations: { i: 1 } }
  const { state, conflicts } = mergeStates(base, mine, theirs)
  // Both sides changed the schedule (different parts) → one record: incoming wins whole.
  assert.deepEqual(state.schedule, mine.schedule)
  assert.deepEqual(state.activeWorkout, { id: 'w' })
  assert.deepEqual(state.legacyRecommendations, { i: 1 })
  assert.deepEqual(conflicts, [{ field: 'schedule', id: null, kind: 'edited-on-both', lost: theirs.schedule }])
})

test('an array without unique ids merges as one record', () => {
  const base = { workouts: [{ id: 'a' }, { id: 'a' }] }
  const mine = { workouts: [{ id: 'a' }] }
  const theirs = { workouts: [{ id: 'b' }] }
  const { state, conflicts } = mergeStates(base, mine, theirs)
  assert.deepEqual(state.workouts, [{ id: 'a' }])
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].id, null)
})

test('the merge is pure: inputs untouched, every output value is an input value', () => {
  const base = { routines: [r('a', 'A')] }
  const mine = { routines: [r('a', 'A'), r('m', 'M')] }
  const theirs = { routines: [r('a', 'T')] }
  const snapshot = structuredClone([base, mine, theirs])
  const { state } = mergeStates(base, mine, theirs)
  assert.deepEqual([base, mine, theirs], snapshot)
  assert.equal(state.routines[0], theirs.routines[0])
  assert.equal(state.routines[1], mine.routines[1])
})

// Review round 2 — the schedule against an anchor-less base (the rev-0 document).
const base0 = { loopWeeks: 1, slots: [] }
const slot = (id) => ({ id, weekday: 1 })

test('anchor-less base: an anchor alone is not an edit — the other side’s real change wins, no conflict', () => {
  const mine = { schedule: { ...base0, anchor: '2026-10-12' } }
  const theirs = { schedule: { ...base0, anchor: '2026-10-19', slots: [slot('t')] } }
  const { state, conflicts } = mergeStates({ schedule: base0 }, mine, theirs)
  assert.equal(state.schedule, theirs.schedule)
  assert.deepEqual(conflicts, [])
})

test('anchor-less base: neither side really changed → the current side’s schedule (it has an anchor)', () => {
  const mine = { schedule: { ...base0, anchor: '2026-10-12' } }
  const theirs = { schedule: { ...base0, anchor: '2026-10-19' } }
  assert.equal(mergeStates({ schedule: base0 }, mine, theirs).state.schedule, theirs.schedule)
  // …and the incoming one when the current side has none.
  assert.equal(mergeStates({ schedule: base0 }, mine, { schedule: base0 }).state.schedule, mine.schedule)
})

test('anchor-less base: a real change on the incoming side lands verbatim, anchor included', () => {
  const mine = { schedule: { ...base0, anchor: '2026-10-12', slots: [slot('m')] } }
  const theirs = { schedule: { ...base0, anchor: '2026-10-19' } }
  const { state, conflicts } = mergeStates({ schedule: base0 }, mine, theirs)
  assert.equal(state.schedule, mine.schedule)
  assert.deepEqual(conflicts, [])
})

test('anchor-less base: both really changed → incoming wins, conflict listed', () => {
  const mine = { schedule: { ...base0, anchor: '2026-10-12', slots: [slot('m')] } }
  const theirs = { schedule: { ...base0, anchor: '2026-10-19', slots: [slot('t')] } }
  const { state, conflicts } = mergeStates({ schedule: base0 }, mine, theirs)
  assert.equal(state.schedule, mine.schedule)
  assert.deepEqual(conflicts, [{ field: 'schedule', id: null, kind: 'edited-on-both', lost: theirs.schedule }])
})

test('a base WITH an anchor: an anchor change is still an edit (rule unchanged)', () => {
  const base = { schedule: { ...base0, anchor: '2026-10-05' } }
  const mine = { schedule: { ...base0, anchor: '2026-10-12' } }
  const theirs = { schedule: { ...base0, anchor: '2026-10-05', slots: [slot('t')] } }
  assert.equal(mergeStates(base, mine, theirs).conflicts.length, 1)
})
