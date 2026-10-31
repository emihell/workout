// req-261 — "Ex N" is the open exercise (DEC-155 §2); one tap on Add commits once; Sets has a
// ceiling (MAX_SETS = 20, DEC-155 §4). Pure helpers first, then the two pickers rendered against
// the real store (one StoreProvider per test, L-051).
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, importJsx, render } from './test-support/render.js'
import { addWorkingSetToState, markItemDonePatch, reopenItemPatch, replaceItemPatch, replacementItem } from './workout-items.js'
import { workoutPillState, workoutPosition } from './workout-log.js'
import { noHistoryItem } from './mid-workout-pick.js'
import { MAX_SETS, parseRoutineItem } from './routine-item-parse.js'

const h = React.createElement
const NOW = 1_000_000
const item = (id) => ({ routineItemId: id, exerciseId: `ex-${id}`, sets: 3, targets: ['8', '8', '8'] })
const set = (id) => ({ routineItemId: id, exerciseId: `ex-${id}`, setType: 'work', weight: 20, reps: '8' })
const three = (id) => [set(id), set(id), set(id)]
const nine = () => [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => item(`i${i}`))
const workout = (items, sets = []) => ({ routineId: 'r', snapshot: { items }, sets, completedItemIds: [] })

describe('AC1 — N is the exercise the pill is on (repro A)', () => {
  it('9 items, one set on item 2 → { current: 2, total: 9, done: 0 }, "GO · set 2/3 · 2/9"', () => {
    const w = workout(nine(), [set('i2')])
    assert.deepEqual(workoutPosition(w), { current: 2, total: 9, done: 0 })
    const pill = workoutPillState(w, NOW)
    assert.equal(pill.item.routineItemId, 'i2')
    assert.equal(pill.label, 'GO · set 2/3 · 2/9')
  })
})

describe('AC2 — the open row\'s place, not done + 1', () => {
  it('items 1–3 done, a set on item 7 → N = 7 (done + 1 would be 4)', () => {
    const w = workout(nine(), [...three('i1'), ...three('i2'), ...three('i3'), set('i7')])
    assert.deepEqual(workoutPosition(w), { current: 7, total: 9, done: 3 })
    assert.equal(workoutPillState(w, NOW).countText, '7/9')
  })
  it('all done → the pill is null, workoutPosition current = M', () => {
    const items = nine()
    const w = workout(items, items.flatMap((it) => three(it.routineItemId)))
    assert.equal(workoutPillState(w, NOW), null)
    assert.deepEqual(workoutPosition(w), { current: 9, total: 9, done: 9 })
  })
  it('a Swap (req-222 AC3): the replacement\'s place among the counted, ≤ total', () => {
    let w = workout(nine(), three('i1'))
    const repl = replacementItem({ id: 'i2-new', original: w.snapshot.items[1], exercise: { id: 'ex-new', name: 'New' }, restSec: 0 })
    w = { ...w, ...replaceItemPatch(w, 'i2', repl) }
    const pos = workoutPosition(w)
    assert.deepEqual(pos, { current: 2, total: 9, done: 1 })
    assert.equal(pos.current <= pos.total, true)
  })
  it('a reopened swapped-away item (req-227): its own place, ≤ total', () => {
    let w = workout(nine(), three('i1'))
    const repl = replacementItem({ id: 'i2-new', original: w.snapshot.items[1], exercise: { id: 'ex-new', name: 'New' }, restSec: 0 })
    w = { ...w, ...replaceItemPatch(w, 'i2', repl) }
    w = { ...w, ...reopenItemPatch(w, w.snapshot.items.find((it) => it.routineItemId === 'i2')) }
    w = addWorkingSetToState({ activeWorkout: w }, 'i2').activeWorkout
    for (const key of ['i3', 'i4', 'i5', 'i6', 'i7', 'i8', 'i9', 'i2-new']) {
      w = { ...w, ...markItemDonePatch(w, w.snapshot.items.find((it) => it.routineItemId === key)) }
    }
    const pos = workoutPosition(w)
    assert.equal(workoutPillState(w, NOW).item.routineItemId, 'i2')
    assert.deepEqual(pos, { current: 2, total: 10, done: 9 })
    assert.equal(pos.current <= pos.total, true)
  })
})

describe('AC4 — failure case: the Sets ceiling (MAX_SETS = 20)', () => {
  it('noHistoryItem: 21 → errors.sets with the message; 20 → 20 sets; 0 / blank / 2.5 error as before', () => {
    assert.equal(MAX_SETS, 20)
    assert.equal(noHistoryItem({ sets: '21' }).errors.sets, 'Sets must be a whole number from 1 to 20.')
    assert.equal(noHistoryItem({ sets: '99999' }).errors.sets, 'Sets must be a whole number from 1 to 20.')
    assert.equal(noHistoryItem({ sets: '20' }).item.sets, 20)
    assert.equal(noHistoryItem({ sets: '0' }).errors.sets, 'Sets must be a whole number, 1 or more.')
    assert.equal(noHistoryItem({ sets: '' }).errors.sets, 'Enter the number of sets.')
    assert.equal(noHistoryItem({ sets: '2.5' }).errors.sets, 'Sets must be a whole number, 1 or more.')
  })
  it('parseRoutineItem: 21 → errors.sets with the message; 20 → 20; 0 / 2.5 error as before; blank → counted', () => {
    assert.equal(parseRoutineItem({ sets: '21', reps: '', kg: '' }).errors.sets.message, 'Sets must be a whole number from 1 to 20.')
    const twenty = parseRoutineItem({ sets: '20', reps: '', kg: '' })
    assert.deepEqual(twenty.errors, {})
    assert.equal(twenty.value.sets, 20)
    assert.equal(parseRoutineItem({ sets: '0', reps: '', kg: '' }).errors.sets.message, 'Sets must be a whole number, 1 or more.')
    assert.equal(parseRoutineItem({ sets: '2.5', reps: '', kg: '' }).errors.sets.message, 'Sets must be a whole number, 1 or more.')
    assert.equal(parseRoutineItem({ sets: '', reps: '8/8', kg: '' }).value.sets, 2)
  })
  it('parseRoutineItem: a blank Sets counted from 21 reps is the same ceiling', () => {
    const reps = Array(21).fill('8').join('/')
    assert.equal(parseRoutineItem({ sets: '', reps, kg: '' }).errors.sets.message, 'Sets must be a whole number from 1 to 20.')
  })
})

// ---- AC3 — two taps before React re-renders commit once ----
describe('AC3 — failure case: a double tap on Add / Save commits once (rendered, real store)', () => {
  let view
  afterEach(async () => {
    await view?.unmount()
    view = null
  })
  async function mount(picker) {
    localStorage.clear()
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { useStore } = await import('./store-context.js')
    const captured = {}
    function Probe() {
      // A test harness reading the live store out of the tree (as req-156's).
      // oxlint-disable-next-line react/immutability
      captured.store = useStore()
      return null
    }
    view = await render(h(StoreProvider, null, h(Probe), picker))
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
    return captured
  }
  const tickLibraryRow = async () => {
    await view.type(view.input('Search'), 'back')
    // The library loads async (loadExerciseCatalog): wait for its rows rather than one tick,
    // so a loaded machine doesn't click before they exist.
    for (let i = 0; i < 100 && !view.all('label.ui-check input').length; i++) {
      await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
    }
    await view.click(view.all('label.ui-check input')[0])
  }
  const doubleTap = async (button) => {
    assert.ok(button, 'the button renders')
    await act(async () => {
      button.click()
      button.click()
    })
  }

  it('routine picker: tick one library row, "Add 1" twice → onAdd once, one new exercise', async () => {
    const { ExercisePicker } = await importJsx('./views/ExercisePicker.jsx', import.meta.url)
    const calls = []
    const captured = await mount(h(ExercisePicker, { onAdd: (added) => calls.push(added), cancelTo: '/' }))
    const before = captured.store.exercises.length
    await tickLibraryRow()
    await doubleTap(view.button('Add 1'))
    assert.equal(calls.length, 1)
    assert.equal(captured.store.exercises.length, before + 1)
  })

  it('mid-workout Add exercise: a no-history pick → the step, Save twice → onDone once, one new exercise', async () => {
    const { MidWorkoutPicker } = await importJsx('./views/workout/mid-workout-picker.jsx', import.meta.url)
    const calls = []
    const label = (n) => `Add ${n}`
    const captured = await mount(h(MidWorkoutPicker, { addLabel: label, cancelTo: '/', onDone: (added) => calls.push(added) }))
    const before = captured.store.exercises.length
    await tickLibraryRow()
    await view.click(view.button('Add 1'))
    assert.equal(view.input('Sets').value, '3', 'on the step')
    assert.equal(calls.length, 0)
    await doubleTap(view.button('Add 1'))
    assert.equal(calls.length, 1)
    assert.equal(captured.store.exercises.length, before + 1)
  })

  it('the step\'s Save with an error does not lock it: fix the field, tap again → commits', async () => {
    const { MidWorkoutPicker } = await importJsx('./views/workout/mid-workout-picker.jsx', import.meta.url)
    const calls = []
    await mount(h(MidWorkoutPicker, { addLabel: (n) => `Add ${n}`, cancelTo: '/', onDone: (added) => calls.push(added) }))
    await tickLibraryRow()
    await view.click(view.button('Add 1'))
    await view.type(view.input('Sets'), '21')
    await view.click(view.button('Add 1'))
    assert.equal(calls.length, 0)
    assert.match(view.text(), /Sets must be a whole number from 1 to 20\./)
    await view.type(view.input('Sets'), '4')
    await view.click(view.button('Add 1'))
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0].item.sets, 4)
  })
})
