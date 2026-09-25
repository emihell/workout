// req-163 — "last time" comparisons and History set bugs (DEC-087). One describe per item.
// Items 2 and 4 were already correct on main (req-128, req-152): their tests pin that and
// pass on main; every other item's test fails on main (report: reports/req-163.md).
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { importJsx, render } from './test-support/render.js'
import { StoreContext } from './store-context.js'
import {
  historyHasSetAt,
  historyPrescription,
  historySetPrefill,
  lastSetsForExercise,
  previousSameRoutineWorkouts,
  summaryPriorWorkout,
} from './storage.js'
import { setLogSeed } from './workout-log.js'
import { formatSetLine } from './ids.js'

const { HistorySet, HistorySetAdd } = await importJsx('./views/history/edit.jsx', import.meta.url)
const { HistoryWorkoutExercise } = await importJsx('./views/history/detail.jsx', import.meta.url)

const h = React.createElement
let view
afterEach(async () => {
  await view?.unmount()
  view = null
})

const day = (d) => `2026-09-${String(d).padStart(2, '0')}T10:00:00.000Z`
const workout = (id, d, sets, items = [{ id: 'pi-a', routineItemId: 'si-a', exerciseId: 'ex-a', restSec: 90 }]) => ({
  id,
  routineId: 'r',
  startedAt: day(d),
  finishedAt: day(d),
  snapshot: { routineId: 'r', routineName: 'Upper', items },
  sets,
})
const work = (weight, reps = '8', extra = {}) => ({ exerciseId: 'ex-a', routineItemId: 'si-a', setType: 'work', weight, reps, rpe: 3, ...extra })
const wu = (weight, extra = {}) => ({ exerciseId: 'ex-a', routineItemId: 'si-a', setType: 'wu', weight, reps: '12', rpe: null, ...extra })
const skipped = () => work(0, 'skipped', { rpe: null, note: 'skipped' })
const active = { id: 'live', routineId: 'r', snapshot: { routineId: 'r', routineName: 'Upper', items: [] }, sets: [] }

describe('1 — F-CODE-3: one "previous/last" order, by finishedAt, never array order', () => {
  // An import that isn't newest-first: oldest first.
  const oldestFirst = [workout('w-old', 1, [work(30)]), workout('w-mid', 10, [work(35)]), workout('w-new', 20, [work(40)])]

  it("an oldest-first array → Finish's comparison and the prefill pick the same, newest workout", () => {
    const finishPrior = previousSameRoutineWorkouts(active, oldestFirst, [])[0]
    const prefill = lastSetsForExercise(oldestFirst, 'ex-a').workout
    assert.equal(finishPrior.id, 'w-new', 'was w-old on main')
    assert.equal(prefill.id, 'w-new')
    assert.deepEqual(previousSameRoutineWorkouts(active, oldestFirst, []).map((w) => w.id), ['w-new', 'w-mid', 'w-old'])
  })
  it('the same answer whatever the stored order', () => {
    for (const order of [oldestFirst, [...oldestFirst].reverse(), [oldestFirst[1], oldestFirst[2], oldestFirst[0]]]) {
      assert.equal(previousSameRoutineWorkouts(active, order, [])[0].id, 'w-new')
    }
  })
  it('equal finishedAt → a stable tie-break (id), identical for both pickers and both array orders', () => {
    const a = workout('wo-a', 5, [work(30)])
    const b = workout('wo-b', 5, [work(35)])
    for (const order of [[a, b], [b, a]]) {
      assert.equal(previousSameRoutineWorkouts(active, order, [])[0].id, 'wo-b')
      assert.equal(lastSetsForExercise(order, 'ex-a').workout.id, 'wo-b')
    }
  })
  it('the auto-complete prior (summaryPriorWorkout) follows the same order', () => {
    assert.equal(summaryPriorWorkout(active, oldestFirst, []).id, 'w-new')
  })
})

describe('2 — req-109 b: after Replace, "last time" reads the routine item, not the replacement (pinned; fixed on main by req-128)', () => {
  it('a replacement item BEFORE the own item → the own item rest and notes', () => {
    const items = [
      { id: 'mid-1', routineItemId: 'mid-1', exerciseId: 'ex-a', restSec: 0, notes: '', addedMidWorkout: true },
      { id: 'pi-a', routineItemId: 'si-a', exerciseId: 'ex-a', restSec: 120, notes: 'seat 4' },
    ]
    const p = historyPrescription([workout('w', 3, [work(40)], items)], 'ex-a')
    assert.deepEqual([p.restSec, p.notes], [120, 'seat 4'])
  })
})

describe('3 — req-111 a: the auto-complete "vs last time" skips a prior with no done working set', () => {
  it('a warm-up-only prior is passed over for the older one with work (was: the warm-up-only one)', () => {
    const workouts = [workout('w-wu-only', 20, [wu(10), skipped(), skipped()]), workout('w-work', 10, [wu(10), work(40)])]
    assert.equal(summaryPriorWorkout(active, workouts, []).id, 'w-work')
  })
  it('only warm-up-only / all-skipped priors → null (no invented deltas)', () => {
    assert.equal(summaryPriorWorkout(active, [workout('a', 2, [wu(10)]), workout('b', 1, [skipped()])], []), null)
  })
})

describe('4 — req-111 b: warm-up-only history counts as no work history (pinned; carry fixed on main by req-152)', () => {
  // Composed exactly as item.jsx composes the live log seed.
  const seedFor = (workouts, workIndex, carry) => {
    const last = lastSetsForExercise(workouts, 'ex-a')
    return setLogSeed({
      weighted: true,
      hasHistory: Boolean(last),
      historyHasSet: historyHasSetAt(last, { setType: 'work', workIndex }),
      history: historySetPrefill(last, { setType: 'work', workIndex }),
      carry,
      target: '8',
    })
  }
  const wuOnly = [workout('w', 20, [wu(10), skipped()])]
  it('the first work set has no invented kg; the warm-up still prefills from its own history', () => {
    assert.equal(seedFor(wuOnly, 0, null).weight, '')
    assert.equal(historySetPrefill(lastSetsForExercise(wuOnly, 'ex-a'), { setType: 'wu' }).weight, '10')
  })
  it('the next work set gets the DEC-002 carry of the kg just logged', () => {
    assert.equal(seedFor(wuOnly, 1, { weight: '40' }).weight, '40')
  })
  it('every path agrees: the prescription (setup / replacement) sees no work history either', () => {
    assert.equal(historyPrescription(wuOnly, 'ex-a'), null)
  })
})

// ---- History screens (items 5, 6) — rendered with a store stand-in that records writes.
function historyStore({ exercise, sets, items }) {
  const store = {
    exercises: [exercise],
    routines: [],
    workouts: [workout('wo-h', 20, sets, items)],
    writes: [],
    updateWorkout(id, patch) {
      store.writes.push({ id, patch })
    },
  }
  return store
}
const mount = (store, el) => render(h(StoreContext.Provider, { value: store }, el))
const PRESS = { id: 'ex-a', name: 'Chest Press', type: 'machine' }
const PLANK = { id: 'ex-a', name: 'Plank', type: 'bodyweight', hasDuration: true }
const ROW = { id: 'ex-a', name: 'Rowing', type: 'cardio' }
const item = (ex) => [{ id: 'pi-a', routineItemId: 'si-a', exerciseId: 'ex-a', exerciseName: ex.name, exerciseType: ex.type, hasDuration: Boolean(ex.hasDuration) }]
const setType = (v, label) => v.all('button').find((b) => b.textContent.trim() === label)

describe('5 — req-117 b: History Add/Edit set records a duration for a timed exercise', () => {
  it('Edit: the Duration (s) field shows the stored seconds; "45,5" saves durationSec 46', async () => {
    const store = historyStore({ exercise: PLANK, items: item(PLANK), sets: [work('', '', { durationSec: 30, rpe: null })] })
    view = await mount(store, h(HistorySet, { workoutId: 'wo-h', index: 0 }))
    const duration = view.input('Duration (s)')
    assert.ok(duration, 'no Duration field on main')
    assert.equal(duration.value, '30')
    await view.type(duration, '45,5')
    await view.click(view.button('Save'))
    assert.equal(store.writes.length, 1)
    assert.equal(store.writes[0].patch.sets[0].durationSec, 46)
  })
  it('Add set: a timed exercise gets Duration, and it is saved', async () => {
    const store = historyStore({ exercise: PLANK, items: item(PLANK), sets: [] })
    view = await mount(store, h(HistorySetAdd, { workoutId: 'wo-h', exerciseId: 'ex-a', itemId: 'si-a' }))
    await view.type(view.input('Duration (s)'), '60')
    await view.click(view.button('Save'))
    assert.equal(store.writes[0].patch.sets.at(-1).durationSec, 60)
  })
  it('unreadable seconds are refused inline; nothing written', async () => {
    const store = historyStore({ exercise: PLANK, items: item(PLANK), sets: [work('', '', { durationSec: 30 })] })
    view = await mount(store, h(HistorySet, { workoutId: 'wo-h', index: 0 }))
    await view.type(view.input('Duration (s)'), 'abc')
    await view.click(view.button('Save'))
    assert.equal(store.writes.length, 0)
    assert.match(view.text(), /Can't read 'abc' as seconds/)
  })
  it('a non-timed exercise has no Duration field and writes no durationSec key; a WU set of a timed one neither', async () => {
    const store = historyStore({ exercise: PRESS, items: item(PRESS), sets: [work(40)] })
    view = await mount(store, h(HistorySet, { workoutId: 'wo-h', index: 0 }))
    assert.equal(view.input('Duration (s)'), null)
    await view.click(view.button('Save'))
    assert.equal('durationSec' in store.writes[0].patch.sets[0], false)
    await view.unmount()
    const timed = historyStore({ exercise: PLANK, items: item(PLANK), sets: [wu('')] })
    view = await mount(timed, h(HistorySet, { workoutId: 'wo-h', index: 0 }))
    assert.equal(view.input('Duration (s)'), null)
  })
})

describe('6 — DEC-087 §2: Effort in History', () => {
  it('(a) an OLD warm-up set stored with rpe 3 shows no "Moderate"; its stored rpe is still 3 (no write)', async () => {
    const sets = [wu(10, { rpe: 3 }), work(40, '8', { rpe: 3 })]
    const store = historyStore({ exercise: PRESS, items: item(PRESS), sets })
    view = await mount(store, h(HistoryWorkoutExercise, { workoutId: 'wo-h', exerciseId: 'si-a' }))
    const rows = view.all('a').map((a) => a.textContent)
    const wuRow = rows.find((t) => t.startsWith('Warm-up set'))
    const workRow = rows.find((t) => t.startsWith('40 kg'))
    assert.doesNotMatch(wuRow, /Moderate/, 'was "WU set · 10 kg · 12 · Moderate" on main')
    assert.match(workRow, /Moderate/, 'a work set keeps its effort')
    assert.equal(store.workouts[0].sets[0].rpe, 3, 'display only')
    assert.equal(store.writes.length, 0)
  })
  it('(a) an old cardio work set with rpe 3 shows no "Moderate" either', async () => {
    const store = historyStore({ exercise: ROW, items: item(ROW), sets: [work('', '6 min', { rpe: 3 })] })
    view = await mount(store, h(HistoryWorkoutExercise, { workoutId: 'wo-h', exerciseId: 'si-a' }))
    assert.doesNotMatch(view.text(), /Moderate/)
  })
  it('(a) formatSetLine: WU / cardio never labelled; a work set is', () => {
    assert.equal(formatSetLine({ setType: 'wu', weight: 10, reps: '12', rpe: 3 }), 'Warm-up set · 10 kg · 12')
    assert.equal(formatSetLine({ setType: 'work', reps: '6 min', rpe: 3 }, { cardio: true }), '6 min')
    assert.equal(formatSetLine({ setType: 'work', weight: 40, reps: '8', rpe: 3 }), '40 kg · 8 · Moderate')
  })
  it('(b) editing a WU set: no Effort control, and Save writes rpe null', async () => {
    const store = historyStore({ exercise: PRESS, items: item(PRESS), sets: [wu(10, { rpe: 3 })] })
    view = await mount(store, h(HistorySet, { workoutId: 'wo-h', index: 0 }))
    assert.doesNotMatch(view.text(), /Effort/, 'Effort was shown on main')
    await view.click(view.button('Save'))
    assert.equal(store.writes[0].patch.sets[0].rpe, null)
  })
  it('(b) toggling the type to Work brings Effort back; to WU hides it again', async () => {
    const store = historyStore({ exercise: PRESS, items: item(PRESS), sets: [wu(10)] })
    view = await mount(store, h(HistorySet, { workoutId: 'wo-h', index: 0 }))
    await view.click(setType(view, 'Work'))
    assert.match(view.text(), /Effort/)
    await view.click(setType(view, 'Warm-up set'))
    assert.doesNotMatch(view.text(), /Effort/)
  })
  it('(b) a cardio work set: no Effort, rpe null; a normal work set keeps Effort and its value', async () => {
    const cardio = historyStore({ exercise: ROW, items: item(ROW), sets: [work('', '6 min', { rpe: 3 })] })
    view = await mount(cardio, h(HistorySet, { workoutId: 'wo-h', index: 0 }))
    assert.doesNotMatch(view.text(), /Effort/)
    await view.click(view.button('Save'))
    assert.equal(cardio.writes[0].patch.sets[0].rpe, null)
    await view.unmount()
    const press = historyStore({ exercise: PRESS, items: item(PRESS), sets: [work(40, '8', { rpe: 4 })] })
    view = await mount(press, h(HistorySet, { workoutId: 'wo-h', index: 0 }))
    assert.match(view.text(), /Effort/)
    await view.click(view.button('Save'))
    assert.equal(press.writes[0].patch.sets[0].rpe, 4)
  })
})
