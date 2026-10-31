// req-276 — split from workout-log.test.js: the tests of set-display.js setPreview.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  initialSetFields,
  seedOverrideKey,
  setTargetFor,
  routineKgFor,
} from './set-seed.js'
import { setPreview } from './set-display.js'
import { historySetPrefill, lastSetsForExercise } from './history-queries.js'

// req-106 — the start-of-exercise preview. Uses the REAL history path
// (lastSetsForExercise + historySetPrefill from history-queries.js), the same the view binds.
describe('req-106 setPreview (start-of-exercise set preview)', () => {
  const finished = (sets, finishedAt = '2026-09-20T10:00:00Z') => ({ finishedAt, sets })
  const hist = (exerciseId, rows) =>
    rows.map(([setType, weight, reps]) => ({ exerciseId, setType, weight, reps }))
  const odp = {
    exerciseId: 'odp',
    routineItemId: 'ri-odp',
    sets: 3,
    warmup: { reps: 10 },
    targets: ['8', '8', '6'],
    // req-178 (sanctioned edit) — the work-set kg now comes from the routine (DEC-096 §1),
    // so the item carries it; history still seeds the warm-up. Lines are unchanged.
    suggestedWeights: [20, 22, 24],
  }
  const workouts = [
    finished(hist('odp', [['wu', 10, '10'], ['work', 20, '8'], ['work', 22, '8'], ['work', 24, '6']])),
  ]
  function previewFor(item, { workouts: ws = workouts, ex = {}, weighted = true, seedOverrides } = {}) {
    const last = lastSetsForExercise(ws, item.exerciseId)
    return setPreview({
      item,
      ex,
      weighted,
      hasHistory: Boolean(last),
      historyFor: (at) => historySetPrefill(last, at),
      seedOverrides,
    })
  }

  it('fixed numbers: WU 10×10, work 20×8 / 22×8 / 24×6 → exact lines', () => {
    assert.deepEqual(
      previewFor(odp).map((line) => line.text),
      ['Warm-up · 10 kg × 10', '1 · 20 kg × 8', '2 · 22 kg × 8', '3 · 24 kg × 6'],
    )
  })

  it('right mechanism: each line equals initialSetFields for that set', () => {
    const last = lastSetsForExercise(workouts, 'odp')
    const lines = previewFor(odp)
    const slots = [['wu', 0], ['work', 0], ['work', 1], ['work', 2]]
    assert.equal(lines.length, slots.length)
    slots.forEach(([setType, workIndex], i) => {
      const form = initialSetFields({
        weighted: true,
        fromRestore: false,
        restore: null,
        hasHistory: true,
        history: historySetPrefill(last, { setType, workIndex }),
        carry: null,
        target: setTargetFor(odp, setType, workIndex),
        override: undefined,
        routineKg: routineKgFor(odp, setType, workIndex), // req-178 (sanctioned edit)
      })
      assert.equal(lines[i].setType, setType)
      assert.equal(lines[i].weight, form.weight)
      assert.equal(lines[i].reps, form.reps)
    })
  })

  // req-178 (sanctioned edit, these two) — the work kg is the routine's now, so "no kg" needs
  // a routine without kg too (`bare`); the routine-kg case itself is pinned in req-178.test.js.
  const bare = { ...odp, suggestedWeights: [] }
  it('failure case — no finished history: no kg on any line, reps from targets', () => {
    const lines = previewFor(bare, { workouts: [] })
    assert.deepEqual(lines.map((line) => line.weight), ['', '', '', ''])
    assert.deepEqual(lines.map((line) => line.reps), ['10', '8', '8', '6'])
    assert.deepEqual(
      lines.map((line) => line.text),
      ['Warm-up · — × 10', '1 · — × 8', '2 · — × 8', '3 · — × 6'],
    )
  })

  it('an unfinished workout is not history (no kg)', () => {
    const lines = previewFor(bare, { workouts: [{ sets: workouts[0].sets }] })
    assert.ok(lines.every((line) => line.weight === ''))
  })

  it('a set beyond the history has no kg — never copied from an earlier set', () => {
    const lines = previewFor({ ...odp, sets: 4, targets: ['8', '8', '6', '6'] })
    assert.equal(lines[4].text, '4 · — × 6')
  })

  it('a session seed override from an earlier item of the same exercise shows, as the form would', () => {
    const lines = previewFor(odp, { seedOverrides: { 'odp::work': { weight: '26' }, 'other::work': { weight: '99' } } })
    assert.deepEqual(
      lines.map((line) => line.text),
      ['Warm-up · 10 kg × 10', '1 · 26 kg × 8', '2 · 26 kg × 8', '3 · 26 kg × 6'],
    )
  })

  // req-108 acceptance — "Preview consistent": with a weight override (and a stale reps
  // one), each line still equals initialSetFields for that set — weight from the
  // override, reps from the set's own target.
  it('req-108: with seedOverrides[k].weight (+ a stale reps), each line equals initialSetFields', () => {
    const seedOverrides = { 'odp::work': { weight: '26', reps: '3' } }
    const last = lastSetsForExercise(workouts, 'odp')
    const lines = previewFor(odp, { seedOverrides })
    const slots = [['wu', 0], ['work', 0], ['work', 1], ['work', 2]]
    slots.forEach(([setType, workIndex], i) => {
      const form = initialSetFields({
        weighted: true,
        fromRestore: false,
        restore: null,
        hasHistory: true,
        history: historySetPrefill(last, { setType, workIndex }),
        carry: null,
        target: setTargetFor(odp, setType, workIndex),
        override: seedOverrides[seedOverrideKey('odp', setType)],
      })
      assert.equal(lines[i].weight, form.weight)
      assert.equal(lines[i].reps, form.reps)
    })
    assert.deepEqual(lines.map((line) => line.text), ['Warm-up · 10 kg × 10', '1 · 26 kg × 8', '2 · 26 kg × 8', '3 · 26 kg × 6'])
  })

  it('no warm-up → work lines only', () => {
    const lines = previewFor({ ...odp, warmup: null })
    assert.deepEqual(lines.map((line) => line.label), ['1', '2', '3'])
  })

  it('bodyweight: reps only, never a kg (even with a weight in history)', () => {
    const pushups = { exerciseId: 'pu', sets: 2, targets: ['12', '10'] }
    const ws = [finished(hist('pu', [['work', 5, '12'], ['work', 5, '10']]))]
    const lines = previewFor(pushups, { workouts: ws, weighted: false })
    assert.deepEqual(lines.map((line) => line.text), ['1 · 12', '2 · 10'])
    assert.ok(lines.every((line) => line.weight === ''))
  })

  it('timed: work sets show the duration (per-set, then last in list); the WU stays reps', () => {
    const plank = { exerciseId: 'pl', sets: 3, warmup: { reps: 5 }, targets: ['', '', ''], durations: [45, 60] }
    const lines = previewFor(plank, { workouts: [], weighted: false, ex: { hasDuration: true, durationSec: 20 } })
    assert.deepEqual(lines.map((line) => line.text), ['Warm-up · 5', '1 · 45s', '2 · 60s', '3 · 60s'])
    assert.deepEqual(lines.map((line) => line.durationSec), [null, 45, 60, 60])
  })
})
