// req-180 (DEC-097) — add exercises to a routine: own first (recent on top), the whole
// library (staples by muscle when the search is empty), multi-select "Add N", values from
// history or a shown starting plan (never a kg), a near-duplicate guard, and the
// catalogItemToExercise logAs fix. Pure helpers, then the real picker against the real store.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, importJsx, render } from './test-support/render.js'
import { catalogItemToExercise, loadExerciseCatalog, shownName } from './exerciseCatalog.js'
import { MUSCLE_GROUPS } from './exerciseLibrary.js'
import { historyPrescription } from './history-queries.js'
import { looseOwnMatch, ownRecentFirst, pickerItem, staplesByMuscle } from './routine-picker.js'

const h = React.createElement
const catalog = await loadExerciseCatalog()
const entry = (name) => catalog.find((item) => shownName(item) === name)

const day = (n) => new Date(Date.UTC(2026, 8, 20 - n, 10)).toISOString()
function workout(id, daysAgo, sets, items = []) {
  return { id, routineId: 'r', finishedAt: day(daysAgo), sets, snapshot: { routineId: 'r', items } }
}
const work = (exerciseId, weight, reps) => ({ exerciseId, setType: 'work', weight, reps: String(reps), rpe: null, note: '' })

describe('req-180 AC1 — catalogItemToExercise reads logAs (fails on main)', () => {
  it('Plank (time) → hasDuration; Battle Ropes (cardio) → type cardio; Bench Press (weight-reps) → untimed', () => {
    const plank = catalogItemToExercise(entry('Plank'))
    const ropes = catalogItemToExercise(entry('Battle Ropes'))
    const bench = catalogItemToExercise(entry('Bench Press'))
    console.log('plank', JSON.stringify({ type: plank.type, hasDuration: plank.hasDuration }))
    console.log('ropes', JSON.stringify({ type: ropes.type, hasDuration: ropes.hasDuration }))
    console.log('bench', JSON.stringify({ type: bench.type, hasDuration: bench.hasDuration }))
    assert.equal(entry('Plank').logAs, 'time')
    assert.equal(plank.hasDuration, true)
    assert.equal(entry('Battle Ropes').logAs, 'cardio')
    assert.equal(ropes.type, 'cardio')
    assert.equal(entry('Bench Press').logAs, 'weight-reps')
    assert.equal(bench.hasDuration, undefined)
  })
})

describe('req-180 — pure helpers', () => {
  it('AC2 ownRecentFirst: done yesterday, last week, never → that order; archived excluded', () => {
    const exercises = [
      { id: 'c', name: 'C never' },
      { id: 'b', name: 'B last week' },
      { id: 'z', name: 'Archived', archivedAt: '2026-09-01' },
      { id: 'a', name: 'A yesterday' },
      { id: 'd', name: 'Aa never' },
    ]
    const workouts = [workout('w1', 7, [work('b', 20, 8), work('z', 10, 8)]), workout('w2', 1, [work('a', 30, 8)])]
    assert.deepEqual(ownRecentFirst(exercises, workouts).map((ex) => ex.id), ['a', 'b', 'd', 'c'])
  })

  it('AC3 staplesByMuscle: 6 groups in MUSCLE_GROUPS order, 194 rows, no staple twice', () => {
    const groups = staplesByMuscle(catalog)
    const rows = groups.flatMap((g) => g.items)
    console.log('groups', JSON.stringify(groups.map((g) => [g.group, g.items.length])), 'total', rows.length)
    assert.deepEqual(groups.map((g) => g.group), Object.keys(MUSCLE_GROUPS))
    assert.equal(rows.length, 194)
    assert.equal(new Set(rows.map((item) => item.id)).size, rows.length)
    assert.ok(rows.every((item) => item.staple))
  })

  it('AC4 pickerItem with history: the whole historyPrescription (not a hand copy); absent rest stays absent', () => {
    const sets = [1, 2, 3, 4].map(() => work('ex-sq', 80, 6))
    const withRest = [workout('w', 2, sets, [{ exerciseId: 'ex-sq', restSec: 120, notes: 'deep' }])]
    const picked = pickerItem(withRest, { id: 'ex-sq', type: 'free' })
    const { warmup: _drop, ...prescription } = historyPrescription(withRest, 'ex-sq')
    assert.equal(picked.source, 'history')
    for (const [key, value] of Object.entries(prescription)) assert.deepEqual(picked.item[key], value, key)
    assert.equal(picked.item.restSec, 120)
    assert.equal(picked.item.warmup, null, 'DEC-099: no warm-up set on a new item')
    assert.equal(picked.label, 'Last time: 4 × 6 · 80 kg')

    const noRest = [workout('w', 2, sets, [{ exerciseId: 'ex-sq' }])]
    const bare = pickerItem(noRest, { id: 'ex-sq', type: 'free' })
    assert.equal(bare.source, 'history')
    assert.equal('restSec' in bare.item, false, 'no 90 injected')
  })

  it('AC5 no history → a starting plan by kind, never a kg', () => {
    const reps = pickerItem([], { id: 'x', type: 'free' })
    assert.equal(reps.source, 'starting')
    assert.deepEqual(
      { sets: reps.item.sets, targets: reps.item.targets, restSec: reps.item.restSec, suggestedWeights: reps.item.suggestedWeights },
      { sets: 3, targets: ['10', '10', '10'], restSec: 90, suggestedWeights: [] },
    )
    assert.equal(reps.label, 'Starting plan: 3 × 10, 90 s rest — change any time')
    const timed = pickerItem([], { id: 'y', type: 'bodyweight', hasDuration: true, durationSec: 45 })
    assert.deepEqual([timed.item.sets, timed.item.durations, timed.item.restSec], [3, [45, 45, 45], 90])
    assert.deepEqual(pickerItem([], { type: 'bodyweight', hasDuration: true }).item.durations, [30, 30, 30])
    const cardio = pickerItem([], { id: 'z', type: 'cardio' })
    assert.deepEqual([cardio.item.sets, cardio.item.targets, cardio.item.restSec], [1, [], 0])
    for (const plan of [reps, timed, cardio]) assert.deepEqual(plan.item.suggestedWeights, [], 'no kg')
  })

  it('AC6 looseOwnMatch: word subset, archived, none, live beats archived', () => {
    const bench = entry('Bench Press')
    assert.equal(looseOwnMatch([{ id: 'b', name: 'Bench' }], bench)?.exercise.id, 'b')
    assert.deepEqual(looseOwnMatch([{ id: 'b', name: 'Bench Press', archivedAt: '2026-09-01' }], bench)?.kind, 'archived')
    assert.equal(looseOwnMatch([{ id: 'r', name: 'Row' }], bench), null)
    const both = [
      { id: 'old', name: 'Bench Press', archivedAt: '2026-09-01' },
      { id: 'new', name: 'bench' },
    ]
    assert.deepEqual(looseOwnMatch(both, bench), { kind: 'live', exercise: both[1] })
    // Among several live, the most recently done.
    const two = [{ id: 'p1', name: 'Bench' }, { id: 'p2', name: 'Press' }]
    assert.equal(looseOwnMatch(two, bench, [workout('w', 1, [work('p2', 40, 8)])]).exercise.id, 'p2')
  })
})

// ---- the real picker against the real store ----

let view
afterEach(async () => {
  await view?.unmount()
  view = null
})

async function harness(payload = null) {
  localStorage.clear()
  if (payload) localStorage.setItem('workout-mvp-v9', JSON.stringify(payload))
  const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
  const { useStore } = await import('./store-context.js')
  const captured = {}
  function Grab({ children }) {
    // A test harness reading the live store out of the tree (as req-175.test.js).
    // oxlint-disable-next-line react/immutability
    captured.store = useStore()
    return children ?? null
  }
  const mount = async (child) => {
    await view?.unmount()
    view = await render(h(StoreProvider, null, h(Grab, null, child)))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
  await mount(null)
  return { captured, mount }
}

const stored = () => JSON.parse(localStorage.getItem('workout-mvp-v9'))
const box = (prefix) =>
  view.all('label.ui-check').find((node) => node.textContent.trim().startsWith(prefix))?.querySelector('input') ?? null

async function pickerFor(captured, mount) {
  let routineId
  await act(async () => {
    routineId = captured.store.addRoutine({ name: 'Day A' })
  })
  const { RoutineExercisePick } = await importJsx('./views/Routine.jsx', import.meta.url)
  await mount(h(RoutineExercisePick, { routineId }))
  return routineId
}

describe('req-180 — the picker (rendered, real store)', () => {
  it('AC8 fresh store: staples by muscle; Bench Press + Plank + Rowing Machine → Add 3 → records + plans, no kg', async () => {
    const { captured, mount } = await harness()
    const routineId = await pickerFor(captured, mount)
    const headers = view.all('h2').map((node) => node.textContent.trim())
    assert.deepEqual(headers, Object.keys(MUSCLE_GROUPS), 'empty search: staples grouped by muscle')
    assert.equal(view.button('Add 0').disabled, true)
    for (const name of ['Bench Press — ', 'Plank — ', 'Rowing Machine — ']) await view.click(box(name))
    assert.match(view.text(), /Starting plan: 3 × 10, 90 s rest — change any time/)
    assert.match(view.text(), /Starting plan: 3 × 30 s, 90 s rest — change any time/)
    assert.match(view.text(), /Starting plan: 1 set — change any time/)
    await view.click(view.button('Add 3'))
    const state = stored()
    assert.deepEqual(state.exercises.map((ex) => ex.name), ['Bench Press', 'Plank', 'Rowing Machine'])
    assert.ok(state.exercises.every((ex) => ex.libraryId))
    const byId = Object.fromEntries(state.exercises.map((ex) => [ex.id, ex]))
    assert.equal(state.exercises[1].hasDuration, true)
    assert.equal(state.exercises[2].type, 'cardio')
    const items = state.routines.find((r) => r.id === routineId).exercises
    assert.deepEqual(items.map((item) => byId[item.exerciseId].name), ['Bench Press', 'Plank', 'Rowing Machine'], 'tap order')
    assert.deepEqual(items.map((item) => [item.sets, item.targets, item.durations, item.restSec]), [
      [3, ['10', '10', '10'], [], 90],
      [3, [], [30, 30, 30], 90],
      [1, [], [], 0],
    ])
    assert.ok(items.every((item) => !item.suggestedWeights.some((kg) => Number(kg) > 0)), 'no kg')
    assert.ok(items.every((item) => item.role === 'main' && item.warmup === null))
  })

  it('AC9 own "Bench" → tap library Bench Press → "Use your \'Bench\'?" → Use mine → no new record', async () => {
    const { captured, mount } = await harness()
    let benchId
    await act(async () => {
      benchId = captured.store.addExercise({ name: 'Bench', type: 'free', equipment: 'Barbell' })
    })
    const routineId = await pickerFor(captured, mount)
    assert.ok(box('Bench — '), 'own list on top')
    await view.click(box('Bench Press — '))
    assert.match(view.text(), /Use your ‘Bench’\?/)
    assert.equal(view.button('Add 0').disabled, true, 'the question selects nothing yet')
    await view.click(view.button('Use mine'))
    assert.equal(box('Bench — ').checked, true)
    await view.click(view.button('Add 1'))
    const state = stored()
    assert.equal(state.exercises.length, 1)
    assert.deepEqual(state.routines.find((r) => r.id === routineId).exercises.map((i) => i.exerciseId), [benchId])
  })

  it('guard: "Add as new" creates the library record; an archived match is Restored (same id) on "Use mine"', async () => {
    const first = await harness()
    let benchId
    let pressId
    await act(async () => {
      benchId = first.captured.store.addExercise({ name: 'Bench', type: 'free' })
      pressId = first.captured.store.addExercise({ name: 'Overhead Press', type: 'free' })
    })
    const state = stored()
    state.exercises.find((ex) => ex.id === pressId).archivedAt = '2026-09-01T10:00:00.000Z'
    const { captured, mount } = await harness(state)
    const routineId = await pickerFor(captured, mount)
    await view.click(box('Bench Press — '))
    await view.click(view.button('Add as new'))
    await view.type(view.input('Search'), 'overhead press')
    const row = view.all('label.ui-check').find((node) => /^Overhead Press — /.test(node.textContent.trim()))
    assert.ok(row, 'library Overhead Press listed (the own one is archived)')
    await view.click(row.querySelector('input'))
    assert.match(view.text(), /archived; using it restores it/)
    await view.click(view.button('Use mine'))
    await view.click(view.button('Add 2'))
    const after = stored()
    const items = after.routines.find((r) => r.id === routineId).exercises
    assert.equal(after.exercises.length, 3, 'Bench, Overhead Press (restored), + new Bench Press')
    assert.equal(items[1].exerciseId, pressId)
    assert.equal(after.exercises.find((ex) => ex.id === pressId).archivedAt ?? null, null, 'restored')
    assert.notEqual(items[0].exerciseId, benchId)
  })

  it('AC10 back out with 2 selected → no exercise or routine item created', async () => {
    const { captured, mount } = await harness()
    const routineId = await pickerFor(captured, mount)
    const before = localStorage.getItem('workout-mvp-v9')
    await view.click(box('Bench Press — '))
    await view.click(box('Plank — '))
    assert.ok(view.button('Add 2'))
    await view.click(view.all('a').find((a) => a.textContent.trim() === 'Cancel'))
    await view.unmount()
    view = null
    assert.equal(localStorage.getItem('workout-mvp-v9'), before)
    assert.equal(stored().exercises.length, 0)
    assert.equal(stored().routines.find((r) => r.id === routineId).exercises.length, 0)
  })

  it('own history: an exercise done before is added with its history, shown as "Last time"', async () => {
    const first = await harness()
    let id
    await act(async () => {
      id = first.captured.store.addExercise({ name: 'Squat', type: 'free' })
    })
    const state = stored()
    state.workouts = [workout('w', 1, [1, 2, 3, 4].map(() => work(id, 80, 6)), [{ exerciseId: id, restSec: 120 }])]
    const { captured, mount } = await harness(state)
    const routineId = await pickerFor(captured, mount)
    await view.click(box('Squat — '))
    assert.match(view.text(), /Last time: 4 × 6 · 80 kg/)
    await view.click(view.button('Add 1'))
    const item = stored().routines.find((r) => r.id === routineId).exercises[0]
    assert.deepEqual([item.sets, item.targets, item.suggestedWeights, item.restSec], [4, ['6', '6', '6', '6'], [80, 80, 80, 80], 120])
  })
})

describe('req-180 AC7 — remove a dependency: the catalog fails to load', () => {
  it('own list, selection and Add N still work; the library part says "Could not load."', async () => {
    const { captured, mount } = await harness()
    await act(async () => {
      captured.store.addExercise({ name: 'Leg Press', type: 'machine', equipment: 'Machine' })
    })
    const { ExercisePicker } = await importJsx('./views/ExercisePicker.jsx', import.meta.url)
    const added = []
    await mount(
      h(ExercisePicker, {
        cancelTo: '/routines',
        loadCatalog: () => Promise.reject(new Error('Could not load.')),
        onAdd: (list) => added.push(...list),
      }),
    )
    assert.match(view.text(), /Could not load\./)
    await view.click(box('Leg Press — '))
    await view.click(view.button('Add 1'))
    assert.equal(added.length, 1)
    assert.equal(added[0].item.sets, 3)
  })
})
