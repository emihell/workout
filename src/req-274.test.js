// req-274 — four latent workout-data bugs from the req-261/262/263 reviews: (a) "Add set" and
// history-built items stop at MAX_SETS; (b) a key-less snapshot item keeps its sets after
// migrateState re-keys them to `history-…`; (c) Apply on a bodyweight item writes the item's own
// kg, never an invented [0]; (d) the History add-set form's Back drops a `from` at a deleted workout.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { act, importJsx, render } from './test-support/render.js'
import { addWorkingSetToState, setsForItem } from './workout-items.js'
import { historyPrescription } from './history-queries.js'
import { migrateState, progressionForItem, recalculatedState, exerciseById } from './model.js'
import { isWeightedType } from './ids.js'
import { MAX_SETS } from './routine-item-parse.js'
import { historyAddSetBack } from './views/history/return-paths.js'
import { parseRoute, withFrom } from './route.js'

const h = React.createElement
const seed = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))

// ---- (a) the Sets ceiling ----------------------------------------------------------------
const activeWith = (item) => ({ activeWorkout: { id: 'aw', routineId: 'R', snapshot: { items: [item] }, sets: [] } })
const item = (sets) => ({
  routineItemId: 'i1',
  exerciseId: 'ex',
  ...(sets == null ? {} : { sets }),
  targets: Array.from({ length: sets ?? 1 }, () => '8'),
  suggestedWeights: Array.from({ length: sets ?? 1 }, () => 40),
})

describe('req-274 AC1 — (a) Add set stops at MAX_SETS; history prescriptions keep the first 20', () => {
  it('Add set on a 20-set item → 20, the same state', () => {
    const state = activeWith(item(MAX_SETS))
    const next = addWorkingSetToState(state, 'i1')
    console.log('AC1 sets after Add set on a 20-set item:', next.activeWorkout.snapshot.items[0].sets)
    assert.equal(next, state)
    assert.equal(next.activeWorkout.snapshot.items[0].sets, 20)
  })
  it('historyPrescription over 21 logged sets → sets 20, the first 20 targets/weights', () => {
    const sets = Array.from({ length: 21 }, (_, n) => ({ routineItemId: 'i1', exerciseId: 'ex', setType: 'work', weight: n + 1, reps: String(n + 1) }))
    const workouts = [{ id: 'w', finishedAt: '2026-10-26T17:00:00.000Z', snapshot: { items: [item(21)] }, sets }]
    const p = historyPrescription(workouts, 'ex')
    console.log('AC1 historyPrescription sets:', p.sets, 'targets:', p.targets.length, 'last:', p.targets.at(-1), 'weights:', p.suggestedWeights.length, 'last:', p.suggestedWeights.at(-1))
    assert.equal(p.sets, 20)
    assert.deepEqual(p.targets, sets.slice(0, 20).map((set) => set.reps))
    assert.deepEqual(p.suggestedWeights, sets.slice(0, 20).map((set) => set.weight))
  })
})

describe('req-274 AC2 — (a) failure case: under the cap Add set still adds', () => {
  it('a 19-set item gets its 20th set', () => {
    const next = addWorkingSetToState(activeWith(item(19)), 'i1')
    const bumped = next.activeWorkout.snapshot.items[0]
    console.log('AC2 19 → sets:', bumped.sets, 'targets:', bumped.targets.length, 'addedSets:', bumped.addedSets)
    assert.equal(bumped.sets, 20)
    assert.equal(bumped.targets.length, 20)
  })
  it('an item with no `sets` adds (counts as 1)', () => {
    const next = addWorkingSetToState(activeWith(item(null)), 'i1')
    console.log('AC2 no sets → sets:', next.activeWorkout.snapshot.items[0].sets)
    assert.equal(next.activeWorkout.snapshot.items[0].sets, 2)
  })
  it('a history prescription under the cap is unchanged (3 logged → 3)', () => {
    const sets = [40, 45, 50].map((weight) => ({ routineItemId: 'i1', exerciseId: 'ex', setType: 'work', weight, reps: '8' }))
    const p = historyPrescription([{ id: 'w', finishedAt: '2026-10-26T17:00:00.000Z', snapshot: { items: [item(3)] }, sets }], 'ex')
    assert.equal(p.sets, 3)
    assert.deepEqual(p.suggestedWeights, [40, 45, 50])
  })
})

// ---- (b) key-less snapshot items after migrateState ----------------------------------------
const keylessState = () => ({
  exercises: [
    { id: 'ex-x', name: 'X', type: 'machine' },
    { id: 'ex-y', name: 'Y', type: 'machine' },
  ],
  routines: [],
  workouts: [
    {
      id: 'wk',
      routineId: 'gone',
      finishedAt: '2026-10-26T17:00:00.000Z',
      snapshot: {
        routineId: 'gone',
        items: [
          { exerciseId: 'ex-x', sets: 2, targets: ['8', '8'], suggestedWeights: [40, 40] },
          { exerciseId: 'ex-y', sets: 1, targets: ['8'], suggestedWeights: [20] },
        ],
      },
      sets: [
        { exerciseId: 'ex-x', setType: 'work', weight: 40, reps: '8' },
        { exerciseId: 'ex-x', setType: 'work', weight: 40, reps: '8' },
        { exerciseId: 'ex-y', setType: 'work', weight: 20, reps: '8' },
      ],
    },
  ],
})

describe('req-274 AC3 — (b) a key-less item keeps its sets after migrateState', () => {
  it('the probe: [2, 1] before and after migrateState, no stored key added', () => {
    const raw = keylessState()
    const before = raw.workouts[0].snapshot.items.map((i) => setsForItem(raw.workouts[0].sets, i).length)
    const w = migrateState(raw).workouts[0]
    const after = w.snapshot.items.map((i) => setsForItem(w.sets, i).length)
    console.log('AC3 set keys:', JSON.stringify(w.sets.map((s) => s.routineItemId)), '| item keys:', JSON.stringify(w.snapshot.items.map((i) => [i.id, i.routineItemId])), '| before:', JSON.stringify(before), 'after:', JSON.stringify(after))
    assert.deepEqual(before, [2, 1])
    assert.deepEqual(after, [2, 1])
    assert.deepEqual(w.snapshot.items.map((i) => [i.id, i.routineItemId]), [[undefined, undefined], [undefined, undefined]])
  })
  it('Apply/progression reads the same sets for a key-less item (progressionForItem)', () => {
    const s = migrateState(keylessState())
    const w = s.workouts[0]
    const counts = w.snapshot.items.map((i) => progressionForItem(s.exercises, w, i).sets.length)
    console.log('AC3 progressionForItem sets:', JSON.stringify(counts))
    assert.deepEqual(counts, [2, 1])
  })
  it('failure case: a keyed item never takes a history-… set of another exercise, nor its own', () => {
    const sets = [
      { routineItemId: 'history-wk-ex-y', exerciseId: 'ex-y', setType: 'work', weight: 20, reps: '8' },
      { routineItemId: 'history-wk-ex-x', exerciseId: 'ex-x', setType: 'work', weight: 20, reps: '8' },
    ]
    assert.equal(setsForItem(sets, { routineItemId: 'i1', exerciseId: 'ex-x' }).length, 0)
    assert.equal(setsForItem(sets, { id: 'i1', exerciseId: 'ex-x' }).length, 0)
    // A key-less item only takes its own exercise's history-… sets.
    assert.deepEqual(setsForItem(sets, { exerciseId: 'ex-x' }).map((s) => s.exerciseId), ['ex-x'])
  })
  it("failure case: db.json's finished workouts keep exactly main's counts", () => {
    const s = migrateState(structuredClone(seed))
    const counts = s.workouts.filter((w) => w.finishedAt).map((w) => [w.id, w.snapshot.items.map((i) => setsForItem(w.sets, i).length)])
    // Recorded on main c28291b with this same fixture (setsForItem over migrateState(db.json)).
    const main = [['wo-w42-sess-upper', [1, 4, 4, 4, 4, 4, 4, 1, 2]], ['wo-w41-sess-push-pull', [1, 4, 4, 4, 3, 3, 3, 2]], ['wo-w41-sess-lower', [1, 4, 4, 4, 4, 4, 4]], ['wo-w41-sess-upper', [1, 4, 4, 4, 4, 4, 4, 1, 2]], ['wo-w40-sess-push-pull', [1, 4, 4, 4, 3, 4, 4, 2]], ['wo-w40-sess-lower', [1, 4, 4, 4, 4, 4, 4]], ['wo-w40-sess-upper', [1, 4, 4, 4, 4, 4, 4, 1, 2]], ['wo-w39-sess-push-pull', [1, 4, 4, 4, 4, 4, 4, 2]], ['wo-w39-sess-lower', [1, 4, 4, 4, 4, 4, 4]], ['wo-w39-sess-upper', [1, 4, 4, 4, 4, 4, 4, 2, 2]], ['wo-w38-sess-push-pull', [1, 4, 3, 3, 3, 3, 3]], ['wo-w38-sess-lower', [1, 4, 3, 3, 3, 3, 3]], ['wo-w38-sess-upper', [1, 4, 3, 3, 3, 3, 3, 1, 1]]]
    assert.deepEqual(counts, main)
  })
})

// ---- (c) Apply on a bodyweight item --------------------------------------------------------
const bwState = (type, target) => ({
  exercises: [{ id: 'bw', name: 'Plank', type }, { id: 'press', name: 'Press', type: 'machine', weightStep: 2.5 }],
  routines: [
    {
      id: 'R',
      name: 'R',
      exercises: [
        { id: 'i1', exerciseId: 'bw', sets: 1, targets: [target], suggestedWeights: [] },
        { id: 'i2', exerciseId: 'press', sets: 2, targets: ['8', '8'], suggestedWeights: [40, 40] },
      ],
    },
  ],
  workouts: [
    {
      id: 'wk',
      routineId: 'R',
      finishedAt: '2026-10-26T17:00:00.000Z',
      snapshot: {
        items: [
          { routineItemId: 'i1', exerciseId: 'bw', sets: 1, targets: [target], suggestedWeights: [] },
          { routineItemId: 'i2', exerciseId: 'press', sets: 2, targets: ['8', '8'], suggestedWeights: [40, 40] },
        ],
      },
      sets: [
        type === 'bodyweight' && target === '45s'
          ? { routineItemId: 'i1', exerciseId: 'bw', setType: 'work', weight: 0, reps: '', durationSec: 45, rpe: null }
          : { routineItemId: 'i1', exerciseId: 'bw', setType: 'work', weight: 0, reps: '10', rpe: null },
        { routineItemId: 'i2', exerciseId: 'press', setType: 'work', weight: 40, reps: '8', rpe: null },
        { routineItemId: 'i2', exerciseId: 'press', setType: 'work', weight: 40, reps: '8', rpe: null },
      ],
    },
  ],
})

// Planner's call (req-274, as req-262's cardio rule): Apply on a non-weighted item never writes
// suggestedWeights — the routine item's kg stays exactly as it is; targets still progress.
describe('req-274 AC4 — (c) Apply on a bodyweight item never writes kg', () => {
  for (const [label, target] of [['timed', '45s'], ['plain', '10']]) {
    it(`${label} bodyweight → to null and the routine keeps suggestedWeights []; targets as the recommendation`, () => {
      const s = bwState('bodyweight', target)
      const p = progressionForItem(s.exercises, s.workouts[0], s.workouts[0].snapshot.items[0])
      const routineItem = recalculatedState(s, 'wk').routines[0].exercises[0]
      console.log(`AC4 ${label}: to ${JSON.stringify(p.to)} targetsTo ${JSON.stringify(p.targetsTo)} recommendation.targets ${JSON.stringify(p.recommendation.targets)} → routine ${JSON.stringify(routineItem)}`)
      assert.equal(p.to, null)
      assert.deepEqual(p.targetsTo, p.recommendation.targets)
      assert.deepEqual(routineItem.suggestedWeights, [])
      assert.deepEqual(routineItem.targets, p.recommendation.targets)
      assert.equal(p.writesRoutine, true)
    })
  }
  it('an old snapshot bodyweight item holding [0] → Apply → routine kg byte-identical, targets updated', () => {
    for (const routineKg of [[], [0], undefined]) {
      const s = bwState('bodyweight', '10')
      s.workouts[0].snapshot.items[0].suggestedWeights = [0]
      s.workouts[0].sets[0] = { ...s.workouts[0].sets[0], reps: '12' }
      const own = { id: 'i1', exerciseId: 'bw', sets: 1, targets: ['8'] }
      s.routines[0].exercises[0] = routineKg ? { ...own, suggestedWeights: routineKg } : own
      const before = JSON.stringify(s.routines[0].exercises[0].suggestedWeights)
      const after = recalculatedState(s, 'wk').routines[0].exercises[0]
      const p = progressionForItem(s.exercises, s.workouts[0], s.workouts[0].snapshot.items[0])
      console.log(`AC4 old [0] snapshot, routine kg ${before} → ${JSON.stringify(after.suggestedWeights)}; targets ["8"] → ${JSON.stringify(after.targets)}`)
      assert.equal(JSON.stringify(after.suggestedWeights), before)
      assert.equal('suggestedWeights' in after, routineKg !== undefined)
      assert.deepEqual(after.targets, p.recommendation.targets)
      assert.notDeepEqual(after.targets, ['8'])
    }
  })
  it('a weighted item\'s Apply is unchanged', () => {
    const item = recalculatedState(bwState('bodyweight', '10'), 'wk').routines[0].exercises[1]
    assert.equal(JSON.stringify(item), '{"id":"i2","exerciseId":"press","sets":2,"targets":["8","8"],"suggestedWeights":[40,40]}')
  })
  it("failure case: every weighted item's `to` over db.json is byte-identical to main", () => {
    const s = migrateState(structuredClone(seed))
    const to = s.workouts
      .filter((w) => w.finishedAt)
      .flatMap((w) => w.snapshot.items.filter((i) => isWeightedType(exerciseById(s.exercises, i.exerciseId)?.type)).map((i) => progressionForItem(s.exercises, w, i).to))
    // Recorded on main c28291b with this same fixture.
    const main = '[[30,30,30],[40,35,35],[20,20,20],[10,12,12],[40,45,50],[35,35,30],[18,18,18],[14,14,14],[12,10,8],[60,70,70],[23,22,25],[35,30,30],[36,41,55],[36,32,32],[50,60,50],[30,30,30],[35,35,40],[20,20,20],[10,10,10],[35,40,45],[30,30,30],[20,19,18],[14,14,14],[14,14,14],[63,74,74],[23,24,27],[32,32,30],[32,36,52],[36,36,36],[52,63,63],[26,30,30],[37,37,40],[26,25,25],[10,10,10],[35,40,45],[32,30,32],[16,18,16],[12,14,14],[14,14,14],[60,70,70],[18,23,23],[30,30,25],[32,36,50],[36,32,32],[50,60,50],[25,25,25],[40,35,35],[25,20,20],[5,5,5],[35,40,40],[30,25,30],[16,16,16],[12,14,14],[14,12,12],[60,70,70],[18,23,23],[30,30,25],[27,32,45],[36,32,32],[50,60,50],[25,25,25],[35,35,35],[20,20,20],[5,5,5],[30,35,35],[30,25,25]]'
    assert.equal(to.length, 66)
    assert.equal(JSON.stringify(to), main)
  })
})

// ---- (d) the add-set form's Back -----------------------------------------------------------
describe('req-274 AC5 — (d) historyAddSetBack drops a from at a deleted workout', () => {
  const workouts = [{ id: 'w1' }]
  it('stale exercise from → the exercise/detail fallback', () => {
    const stale = '/history/gone/exercise/i9'
    console.log('AC5 parseRoute(from).name =', parseRoute(stale).name)
    const known = historyAddSetBack('w1', 'i1', true, stale, workouts)
    const unknown = historyAddSetBack('w1', 'i1', false, stale, workouts)
    console.log(`AC5 historyAddSetBack("w1","i1",true, "${stale}", [w1]) → ${known}; known=false → ${unknown}`)
    assert.equal(known, '/history/w1/exercise/i1')
    assert.equal(unknown, '/history/w1')
  })
  it('a live from is unchanged; no workouts → as today', () => {
    const live = withFrom('/history/w1/exercise/i1', '/history/w1')
    assert.equal(historyAddSetBack('w1', 'i1', true, live, workouts), live)
    assert.equal(historyAddSetBack('w1', 'i1', true, '/history/gone/exercise/i9'), '/history/gone/exercise/i9')
  })

  let view = null
  afterEach(async () => {
    if (view) await view.unmount()
    view = null
  })
  const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
  async function open(path) {
    localStorage.clear()
    localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
    localStorage.setItem('workout-mvp-v8', JSON.stringify(seed))
    window.location.hash = `#${path}`
    const { default: App } = await importJsx('./App.jsx', import.meta.url)
    view = await render(h(App))
    await flush()
  }
  const backHref = () => {
    const a = view.all('a').find((link) => link.textContent.replace(/[›‹]/g, '').trim() === 'Back')
    return a ? a.getAttribute('href').replace(/^#/, '') : null
  }

  it('rendered: the add-set form opened from a deleted workout\'s exercise → Back to the live exercise, no "Not found."', async () => {
    const w = seed.workouts[0]
    const set = w.sets.find((candidate) => candidate.setType !== 'wu')
    const itemId = set.routineItemId
    const add = `/history/${w.id}/set/new/${encodeURIComponent(set.exerciseId)}/${encodeURIComponent(itemId)}`
    await open(withFrom(add, `/history/deleted-workout/exercise/${itemId}`))
    const back = backHref()
    console.log(`AC5 rendered stale: Back ${back}`)
    assert.equal(back, `/history/${w.id}/exercise/${itemId}`)
    await act(async () => {
      window.location.hash = `#${back}`
    })
    await flush()
    assert.doesNotMatch(view.text(), /Not found\./)
    await view.unmount()
    view = null
    const liveFrom = withFrom(`/history/${w.id}/exercise/${itemId}`, `/history/${w.id}`)
    await open(withFrom(add, liveFrom))
    console.log(`AC5 rendered live: Back ${backHref()}`)
    assert.equal(backHref(), liveFrom)
  })
})
