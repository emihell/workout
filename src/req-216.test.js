// req-216 (DEC-119 §5) — the picker's "Added: …" strip and "In this workout" mark; Your
// exercises split into "In your workouts" / "Not in a workout". Pure helpers, then the real
// picker and the real Exercises screen against the real store.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { act, importJsx, render } from './test-support/render.js'
import { addedStrip, exerciseUseSplit, idsInActiveRoutines } from './exercise-use.js'
import { loadExerciseCatalog } from './exerciseCatalog.js'

// Warm the catalog so the picker's library is there on first render (as req-180.test.js).
await loadExerciseCatalog()

const h = React.createElement
const ids = (list) => list.map((ex) => ex.id)

describe('req-216 AC4 — exerciseUseSplit (active / archived-only / none)', () => {
  const exercises = [
    { id: 'row', name: 'Row' },
    { id: 'press', name: 'Incline press' },
    { id: 'curl', name: 'Curl' },
    { id: 'gone', name: 'Archived one', archivedAt: '2026-09-01T00:00:00.000Z' },
  ]
  it('in an active routine → In your workouts; only in an archived routine → Not in a workout', () => {
    const routines = [
      { id: 'a', exercises: [{ id: 'i1', exerciseId: 'row' }, { id: 'i2', exerciseId: 'gone' }] },
      { id: 'old', archivedAt: '2026-09-02T00:00:00.000Z', exercises: [{ id: 'i3', exerciseId: 'press' }] },
    ]
    const split = exerciseUseSplit(exercises, routines)
    console.log('split', JSON.stringify({ in: ids(split.inWorkouts), not: ids(split.notInWorkout) }))
    assert.deepEqual(ids(split.inWorkouts), ['row'])
    assert.deepEqual(ids(split.notInWorkout), ['press', 'curl'], 'archived-routine-only press is not in a workout')
    assert.deepEqual([...idsInActiveRoutines(routines)], ['row', 'gone'])
  })
  it('no routines → every live exercise is Not in a workout; archived exercises are in neither', () => {
    for (const routines of [[], undefined]) {
      const split = exerciseUseSplit(exercises, routines)
      assert.deepEqual(ids(split.inWorkouts), [])
      assert.deepEqual(ids(split.notInWorkout), ['row', 'press', 'curl'])
    }
  })
})

describe('req-216 — addedStrip', () => {
  const picks = ['a', 'b', 'c', 'd'].map((key) => ({ key }))
  it('≤3 all shown; 4 → first 2 and +2; expanded → all', () => {
    assert.deepEqual(addedStrip(picks.slice(0, 3)), { shown: picks.slice(0, 3), more: 0 })
    assert.deepEqual(addedStrip(picks), { shown: picks.slice(0, 2), more: 2 })
    assert.deepEqual(addedStrip(picks, true), { shown: picks, more: 0 })
  })
})

describe('req-216 — CSS', () => {
  it('the picker dock (strip + bar) is stuck to the bottom on the page background', () => {
    const css = readFileSync(new URL('./ui/ui.css', import.meta.url), 'utf8')
    const rule = css.slice(css.indexOf('.ui-picker-dock {'), css.indexOf('}', css.indexOf('.ui-picker-dock {')))
    assert.match(rule, /position: sticky/)
    assert.match(rule, /background: var\(--ui-bg\)/)
  })
})

// ---- rendered, real store ----

let view
afterEach(async () => {
  await view?.unmount()
  view = null
})
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

async function harness(payload = null) {
  localStorage.clear()
  if (payload) localStorage.setItem('workout-mvp-v9', JSON.stringify(payload))
  const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
  const { useStore } = await import('./store-context.js')
  const captured = {}
  function Grab({ children }) {
    // A test harness reading the live store out of the tree (as req-180.test.js).
    // oxlint-disable-next-line react/immutability
    captured.store = useStore()
    return children ?? null
  }
  const mount = async (child) => {
    await view?.unmount()
    view = await render(h(StoreProvider, null, h(Grab, null, child)))
    await flush()
  }
  await mount(null)
  return { captured, mount }
}
const box = (prefix) =>
  view.all('label.ui-check').find((node) => node.textContent.trim().startsWith(prefix))?.querySelector('input') ?? null
const label = (prefix) => view.all('label.ui-check').find((node) => node.textContent.trim().startsWith(prefix)) ?? null
const strip = () => document.querySelector('.ui-picker-strip')

describe('req-216 — the routine picker (rendered, real store)', () => {
  it('AC1 tick 3 → strip lists 3 in tap order; tap one → unticked, "Add 2"; nothing stored', async () => {
    const { captured, mount } = await harness()
    let routineId
    await act(async () => {
      routineId = captured.store.addRoutine({ name: 'Day A' })
    })
    const { RoutineExercisePick } = await importJsx('./views/Routine.jsx', import.meta.url)
    await mount(h(RoutineExercisePick, { routineId }))
    assert.equal(strip(), null, 'no strip with nothing ticked')
    const before = localStorage.getItem('workout-mvp-v9')
    for (const name of ['Plank — ', 'Bench Press — ', 'Rowing Machine — ']) await view.click(box(name))
    console.log('strip', JSON.stringify(strip().textContent))
    assert.equal(strip().textContent, 'Added: Plank, Bench Press, Rowing Machine')
    assert.ok(strip().closest('.ui-picker-dock').querySelector('.ui-picker-bar'), 'strip sits in the stuck block with the bar')
    await view.click(view.button('Bench Press'))
    assert.equal(box('Bench Press — ').checked, false, 'unticked')
    assert.equal(strip().textContent, 'Added: Plank, Rowing Machine')
    assert.ok(view.button('Add 2'))
    assert.equal(localStorage.getItem('workout-mvp-v9'), before, 'ticking and unticking write nothing')
  })

  it('4 picks → "+2"; tapping it shows all four', async () => {
    const { captured, mount } = await harness()
    let routineId
    await act(async () => {
      routineId = captured.store.addRoutine({ name: 'Day A' })
    })
    const { RoutineExercisePick } = await importJsx('./views/Routine.jsx', import.meta.url)
    await mount(h(RoutineExercisePick, { routineId }))
    for (const name of ['Plank — ', 'Bench Press — ', 'Rowing Machine — ', 'Arnold Press — ']) await view.click(box(name))
    assert.equal(strip().textContent, 'Added: Plank, Bench Press, +2')
    await view.click(view.button('+2'))
    assert.equal(strip().textContent, 'Added: Plank, Bench Press, Rowing Machine, Arnold Press')
  })

  it('AC2 a routine with Row → Row\'s row says "In this workout", still pickable (Add 1 adds it again)', async () => {
    const { captured, mount } = await harness()
    let routineId
    let rowId
    await act(async () => {
      rowId = captured.store.addExercise({ name: 'Row', type: 'machine', equipment: '' })
      captured.store.addExercise({ name: 'Curl', type: 'free', equipment: '' })
      routineId = captured.store.addRoutine({ name: 'Day A' })
    })
    await act(async () => {
      captured.store.addRoutineExercise(routineId, { exerciseId: rowId, sets: 3, targets: ['10', '10', '10'] })
    })
    const { RoutineExercisePick } = await importJsx('./views/Routine.jsx', import.meta.url)
    await mount(h(RoutineExercisePick, { routineId }))
    console.log('row', JSON.stringify(label('Row').textContent), 'curl', JSON.stringify(label('Curl').textContent))
    assert.match(label('Row').textContent, /In this workout/)
    assert.doesNotMatch(label('Curl').textContent, /In this workout/)
    await view.click(box('Row'))
    await view.click(view.button('Add 1'))
    const items = JSON.parse(localStorage.getItem('workout-mvp-v9')).routines.find((r) => r.id === routineId).exercises
    assert.deepEqual(items.map((item) => item.exerciseId), [rowId, rowId])
  })

  it('the mid-workout picker (same component) gets the strip but no "In this workout" mark', async () => {
    const { captured, mount } = await harness()
    await act(async () => {
      captured.store.addExercise({ name: 'Row', type: 'machine', equipment: '' })
    })
    const { MidWorkoutPicker } = await importJsx('./views/workout/mid-workout-picker.jsx', import.meta.url)
    await mount(h(MidWorkoutPicker, { cancelTo: '/', addLabel: (n) => `Add ${n}`, onDone: () => {} }))
    await view.click(box('Row'))
    assert.equal(strip().textContent, 'Added: Row')
    assert.doesNotMatch(label('Row').textContent, /In this workout/)
  })
})

describe('req-216 — Your exercises (rendered, real store)', () => {
  const headers = () => view.all('h2').map((node) => node.textContent.trim())
  // `archive` — routine names to mark archived in the saved state before the screen loads.
  async function exercisesScreen(setup, type = null, archive = []) {
    const first = await harness()
    await act(async () => setup(first.captured.store))
    const state = JSON.parse(localStorage.getItem('workout-mvp-v9'))
    for (const routine of state.routines) if (archive.includes(routine.name)) routine.archivedAt = '2026-09-01T00:00:00.000Z'
    const { captured, mount } = await harness(state)
    const { Exercises } = await importJsx('./views/Exercises.jsx', import.meta.url)
    await mount(h(Exercises, { type }))
    return captured
  }

  it('AC3 an exercise only in an archived routine is under "Not in a workout"; the other is in your workouts', async () => {
    await exercisesScreen((store) => {
      const row = store.addExercise({ name: 'Row', type: 'machine', equipment: '' })
      const press = store.addExercise({ name: 'Incline press', type: 'free', equipment: '' })
      const live = store.addRoutine({ name: 'Day A' })
      const old = store.addRoutine({ name: 'Old day' })
      store.addRoutineExercise(live, { exerciseId: row, sets: 3, targets: [] })
      store.addRoutineExercise(old, { exerciseId: press, sets: 3, targets: [] })
    }, null, ['Old day'])
    const text = view.text()
    console.log('headers', JSON.stringify(headers()), 'text', JSON.stringify(text))
    assert.deepEqual(headers(), ['In your workouts', 'Not in a workout'])
    const [inPart, notPart] = text.split('Not in a workout')
    assert.match(inPart, /Machine/)
    assert.doesNotMatch(inPart, /Free weights/)
    assert.match(notPart, /Free weights/)
  })

  it('AC3 failure case: no routines → every exercise under "Not in a workout", no "In your workouts" header', async () => {
    await exercisesScreen((store) => {
      store.addExercise({ name: 'Row', type: 'machine', equipment: '' })
      store.addExercise({ name: 'Incline press', type: 'free', equipment: '' })
    })
    assert.deepEqual(headers(), ['Not in a workout'])
    assert.doesNotMatch(view.text(), /In your workouts/)
    assert.match(view.text(), /Machine/)
    assert.match(view.text(), /Free weights/)
  })

  it('search results stay one list (no section headers)', async () => {
    const captured = await exercisesScreen((store) => {
      const row = store.addExercise({ name: 'Row', type: 'machine', equipment: '' })
      store.addExercise({ name: 'Rower', type: 'cardio', equipment: '' })
      const day = store.addRoutine({ name: 'Day A' })
      store.addRoutineExercise(day, { exerciseId: row, sets: 3, targets: [] })
    })
    assert.ok(captured.store)
    await view.type(view.input('Search'), 'row')
    assert.deepEqual(headers(), [])
    assert.match(view.text(), /Row/)
    assert.match(view.text(), /Rower/)
  })

  it('a type page splits the same way without a search', async () => {
    await exercisesScreen((store) => {
      const row = store.addExercise({ name: 'Row', type: 'machine', equipment: '' })
      store.addExercise({ name: 'Leg press', type: 'machine', equipment: '' })
      const day = store.addRoutine({ name: 'Day A' })
      store.addRoutineExercise(day, { exerciseId: row, sets: 3, targets: [] })
    }, 'machine')
    assert.deepEqual(headers(), ['In your workouts', 'Not in a workout'])
    const [inPart, notPart] = view.text().split('Not in a workout')
    assert.match(inPart, /Row/)
    assert.match(notPart, /Leg press/)
  })
})
