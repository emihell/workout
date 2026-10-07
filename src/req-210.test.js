// req-210 (DEC-117 §1, §3, §4) — the small "↑ N%" per exercise (beat-last-time.js), reps carry
// on a uniform plan (workout-log.js setLogSeed / uniformRepsTargets), and Total lifted gone.
// (§6, setup days start empty, is pinned by the edited req-207 / req-190 rendered tests.)
import { describe, it, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { importJsx, render } from './test-support/render.js'
import { exerciseImprovementPct, improvementList, improvementPct, improvementText } from './beat-last-time.js'
import { carryForSet, setListRows, setLogSeed, setTargetFor, uniformRepsTargets } from './workout-log.js'
import * as historyQueries from './history-queries.js'

const h = React.createElement
const w = (weight, reps) => ({ setType: 'work', weight, reps })

describe('AC1 — improvementPct, on DEC-050\'s axis', () => {
  it('weighted, heavier: 30×12 → 35×11 is ↑17%', () => {
    assert.equal(improvementPct([w(35, 11)], [w(30, 12)], 'free'), 17)
  })
  it('weighted, same top kg: 35×9 → 35×11 is ↑22% (reps)', () => {
    assert.equal(improvementPct([w(35, 11)], [w(35, 9)], 'free'), 22)
  })
  it('bodyweight 10 → 12 reps is ↑20%', () => {
    assert.equal(improvementPct([{ reps: 12 }], [{ reps: 10 }], 'bodyweight'), 20)
  })
  it('timed 30 → 45 s is ↑50%', () => {
    assert.equal(improvementPct([{ durationSec: 45 }], [{ durationSec: 30 }], 'bodyweight'), 50)
  })
  it('worse or equal → null (never a down arrow)', () => {
    assert.equal(improvementPct([w(30, 12)], [w(35, 11)], 'free'), null)
    assert.equal(improvementPct([w(35, 9)], [w(35, 9)], 'free'), null)
    assert.equal(improvementPct([w(35, 8)], [w(35, 9)], 'free'), null)
    assert.equal(improvementPct([{ reps: 10 }], [{ reps: 10 }], 'bodyweight'), null)
    assert.equal(improvementPct([{ durationSec: 30 }], [{ durationSec: 45 }], 'bodyweight'), null)
  })
  it('no prior → null', () => {
    assert.equal(improvementPct([w(35, 11)], [], 'free'), null)
    assert.equal(improvementPct([w(35, 11)], null, 'free'), null)
  })
  it('a last value of 0 has no base → null; a tiny real gain reads 1, never 0', () => {
    assert.equal(improvementPct([{ reps: 5 }], [{ reps: 0 }], 'bodyweight'), null)
    assert.equal(improvementPct([w(201, 5)], [w(200, 5)], 'free'), 1)
  })
  it('the text is "↑ N%"', () => {
    assert.equal(improvementText(17), '↑ 17%')
    assert.equal(improvementText(null), '')
  })
})

// The workout-level helpers: the DEC-050 source (same exercise id, the previous same-routine
// workout(s)), warm-ups and skipped sets out.
const wk = (sets, items) => ({
  snapshot: { items: items || [{ exerciseId: 'bench', exerciseType: 'free', exerciseName: 'Bench press' }, { exerciseId: 'row', exerciseType: 'free', exerciseName: 'Row' }] },
  sets,
})
describe('AC1 — per exercise in a workout', () => {
  const prior = wk([
    { exerciseId: 'bench', setType: 'wu', weight: 60, reps: 5 },
    { exerciseId: 'bench', ...w(30, 12) },
    { exerciseId: 'row', ...w(40, 10) },
  ])
  const cur = wk([
    { exerciseId: 'bench', setType: 'wu', weight: 10, reps: 5 },
    { exerciseId: 'bench', ...w(35, 11) },
    { exerciseId: 'row', ...w(40, 10) },
  ])
  it('only the exercise that beat last time gets a % (the warm-up is not its top set)', () => {
    assert.equal(exerciseImprovementPct(cur, [prior], 'bench'), 17)
    assert.equal(exerciseImprovementPct(cur, [prior], 'row'), null)
    assert.deepEqual(improvementList(cur, [prior]), [{ exerciseId: 'bench', name: 'Bench press', pct: 17 }])
  })
  it('no prior workout → nothing', () => {
    assert.deepEqual(improvementList(cur, []), [])
    assert.equal(exerciseImprovementPct(cur, null, 'bench'), null)
  })
})

// AC2 — the prefill, through the same path the log form and the set list use.
const item = (extra = {}) => ({ routineItemId: 'a', exerciseId: 'ex-a', sets: 3, targets: ['10', '10', '10'], ...extra })
const logged = (extra = {}) => ({ routineItemId: 'a', exerciseId: 'ex-a', setType: 'work', weight: 14, reps: '15', ...extra })
const workout = (it, sets) => ({ routineId: 'r', snapshot: { items: [it] }, sets, completedItemIds: [] })
const seedFor = (it, workLogged, setType = 'work', workIndex = workLogged.length) =>
  setLogSeed({
    weighted: true,
    fromRestore: false,
    hasHistory: false,
    history: { weight: '', reps: '' },
    carry: carryForSet(setType, workLogged),
    target: setTargetFor(it, setType, workIndex),
    routineKg: setType === 'wu' ? undefined : '',
    uniformReps: uniformRepsTargets(it),
  })
const base = { ex: { type: 'machine' }, weighted: true, hasHistory: false, historyFor: () => ({ weight: '', reps: '' }) }

describe('AC2 — reps carry only on a uniform plan', () => {
  it('targets 10/10/10, set 1 logged 14 kg × 15 → set 2 prefills reps 15 (and set 3 in the list)', () => {
    const it = item()
    assert.equal(uniformRepsTargets(it), true)
    assert.deepEqual(seedFor(it, [logged()]), { weight: '14', reps: '15' })
    const rows = setListRows({ ...base, workout: workout(it, [logged()]), item: it })
    assert.deepEqual(rows.map((r) => r.text), ['1 · 14 kg × 15', '2 · 14 kg × 15', '3 · 14 kg × 15'])
  })
  it('targets 12/10/8, set 1 logged × 14 → set 2 prefills its own 10 (DEC-052)', () => {
    const it = item({ targets: ['12', '10', '8'] })
    assert.equal(uniformRepsTargets(it), false)
    assert.equal(seedFor(it, [logged({ reps: '14' })]).reps, '10')
    const rows = setListRows({ ...base, workout: workout(it, [logged({ reps: '14' })]), item: it })
    assert.deepEqual(rows.map((r) => r.text), ['1 · 14 kg × 14', '2 · 14 kg × 10', '3 · 14 kg × 8'])
  })
  it('a uniform plan with nothing logged yet shows its targets', () => {
    assert.equal(seedFor(item(), []).reps, '10')
  })
  it('FAILURE CASE: a warm-up\'s reps are never carried — not to set 1, not to the next warm-up', () => {
    const it = item({ warmup: { reps: 12 } })
    const wu = logged({ setType: 'wu', weight: 5, reps: '20' })
    // Warm-up logged × 20: set 1 still prefills its target 10 (workLogged holds no warm-up).
    const rows = setListRows({ ...base, workout: workout(it, [wu]), item: it })
    assert.deepEqual(rows.map((r) => r.text), ['Warm-up · 5 kg × 20', '1 · — × 10', '2 · — × 10', '3 · — × 10'])
    // A warm-up's own seed has no carry, even after working sets with other reps.
    assert.equal(seedFor(it, [logged()], 'wu', 0).reps, '12')
  })
  it('one set, or targets all empty, is not "uniform" (the no-target carry of DEC-107 §2 stands)', () => {
    assert.equal(uniformRepsTargets(item({ sets: 1, targets: ['10'] })), true)
    assert.equal(uniformRepsTargets(item({ targets: [] })), false)
    assert.equal(seedFor(item({ targets: [] }), [logged()]).reps, '15')
  })
})

describe('AC4 — Total lifted removed', () => {
  it('workoutVolume is gone from history-queries', () => {
    assert.equal('workoutVolume' in historyQueries, false)
  })
})

describe('AC3/AC4 — the auto-complete summary (rendered)', () => {
  let view
  afterEach(async () => {
    await view?.unmount()
    view = null
    mock.timers.reset()
  })
  it('"↑ 17%" beside the improved exercise only; no "lifted" anywhere', async () => {
    mock.timers.enable({ apis: ['setInterval', 'Date'], now: new Date(2026, 9, 7, 10, 0) })
    const items = [
      { routineItemId: 'a', exerciseId: 'ex-a', exerciseName: 'Bench press', exerciseType: 'free', sets: 1, targets: ['10'] },
      { routineItemId: 'b', exerciseId: 'ex-b', exerciseName: 'Row', exerciseType: 'free', sets: 1, targets: ['10'] },
    ]
    const snap = { routineId: 'r', routineName: 'Day', items }
    const prior = {
      id: 'w1', routineId: 'r', snapshot: snap,
      startedAt: '2026-10-01T10:00:00Z', finishedAt: '2026-10-01T11:00:00Z',
      sets: [{ exerciseId: 'ex-a', routineItemId: 'a', ...w(30, 12) }, { exerciseId: 'ex-b', routineItemId: 'b', ...w(40, 10) }],
    }
    const active = {
      routineId: 'r', snapshot: snap, completedItemIds: [], startedAt: new Date().toISOString(),
      sets: [{ exerciseId: 'ex-a', routineItemId: 'a', ...w(35, 11) }, { exerciseId: 'ex-b', routineItemId: 'b', ...w(40, 9) }],
    }
    const { AutoCompleteSummary } = await importJsx('./views/workout/auto-complete.jsx', import.meta.url)
    const store = { workouts: [prior], routines: [], exercises: [], finishWorkout: () => {}, patchActive: () => {} }
    view = await render(h(AutoCompleteSummary, { routineId: 'r', active, store, countdown: false, onCancel: () => {} }))
    const lines = view.all('.ui-improvement').map((p) => p.textContent)
    assert.deepEqual(lines, ['Bench press↑ 17%'])
    assert.equal(/lifted/i.test(view.text()), false)
  })
})
