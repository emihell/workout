// req-242 — a workout's exercise row opens its editor (the whole row, meta line included); the
// item editor's "Change exercise" swaps the item's exercise through the routine's single-pick
// picker: history → history's prescription; no history → sets/reps/rest kept, kg blank.
// Pure mutator first, then the real screens against the real store (fullState fixture).
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, importJsx, render } from './test-support/render.js'
import { fullState } from './test-support/full-state.js'
import { loadExerciseCatalog } from './exerciseCatalog.js'
import { changedRoutineItem, routineItemExerciseChanged } from './routine-item-change.js'
import { parseRoute } from './route.js'

await loadExerciseCatalog()

const h = React.createElement
const KEY = 'workout-mvp-v9'
const stored = () => JSON.parse(localStorage.getItem(KEY))
const itemOf = (state, itemId) => state.routines.find((r) => r.id === 'rtn-a').exercises.find((i) => i.id === itemId)

describe('req-242 — routineItemExerciseChanged (pure)', () => {
  const s = fullState()
  const routine = s.routines.find((r) => r.id === 'rtn-a')
  it('history → its sets/reps/rest/kg; id, note, role, warm-up switch kept', () => {
    const plank = itemOf(s, 'si-plank')
    const out = changedRoutineItem({ ...plank, notes: 'mine' }, 'ex-press', s.workouts)
    console.log('history', JSON.stringify(out))
    assert.deepEqual(
      { id: out.id, exerciseId: out.exerciseId, sets: out.sets, targets: out.targets, kg: out.suggestedWeights, rest: out.restSec },
      { id: 'si-plank', exerciseId: 'ex-press', sets: 2, targets: ['10', '9'], kg: [20, 20], rest: 90 },
    )
    assert.equal(out.notes, 'mine')
    assert.equal(out.role, 'finisher')
    assert.equal(out.warmup, plank.warmup)
  })
  it('no history → sets/reps/rest kept, kg blank (no number carried from the old exercise)', () => {
    const press = itemOf(s, 'si-press')
    const out = changedRoutineItem(press, 'ex-row', s.workouts)
    console.log('no history', JSON.stringify(out))
    assert.deepEqual(out, { ...press, exerciseId: 'ex-row', suggestedWeights: [] })
  })
  it('unknown item / no exercise / same exercise → the routine object unchanged', () => {
    assert.equal(routineItemExerciseChanged(routine, 'nope', 'ex-row', s.workouts), routine)
    assert.equal(routineItemExerciseChanged(routine, 'si-press', null, s.workouts), routine)
    assert.equal(routineItemExerciseChanged(routine, 'si-press', 'ex-press', s.workouts), routine)
  })
  it('only the target item changes; order and the others are the same objects', () => {
    const out = routineItemExerciseChanged(routine, 'si-press', 'ex-row', s.workouts)
    assert.deepEqual(out.exercises.map((i) => i.id), ['si-bike', 'si-press', 'si-plank'])
    assert.equal(out.exercises[0], routine.exercises[0])
    assert.equal(out.exercises[2], routine.exercises[2])
  })
})

describe('req-242 — routes', () => {
  it('/change under the routine and the nested flows', () => {
    assert.deepEqual(parseRoute('/routines/rtn-a/exercise/si-press/change'), { name: 'routine-exercise-change', routineId: 'rtn-a', itemId: 'si-press' })
    const slot = parseRoute('/schedule/0/1/slot-a/exercise/si-press/change')
    assert.equal(slot.name, 'schedule-slot')
    assert.equal(slot.screen, 'exercise-change')
    assert.equal(slot.itemId, 'si-press')
    assert.deepEqual(parseRoute('/routines/rtn-a/exercise/si-press'), { name: 'routine-exercise', routineId: 'rtn-a', itemId: 'si-press' })
  })
})

// ---- rendered, real store ----

let view
afterEach(async () => {
  await view?.unmount()
  view = null
})
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

async function harness(payload) {
  localStorage.clear()
  localStorage.setItem(KEY, JSON.stringify(payload))
  const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
  const host = {}
  function Host() {
    const [screen, setScreen] = React.useState({ n: 0, child: null })
    // oxlint-disable-next-line react/immutability
    host.swap = setScreen
    return h(StoreProvider, null, h(React.Fragment, { key: screen.n }, screen.child))
  }
  view = await render(h(Host))
  return async (child) => {
    await act(async () => host.swap((screen) => ({ n: screen.n + 1, child })))
    await flush()
  }
}
const box = (prefix) =>
  view.all('label.ui-check').find((node) => node.textContent.trim().startsWith(prefix))?.querySelector('input') ?? null

describe('req-242 — the routine screen rows (rendered)', () => {
  it('AC1 tapping the meta line (not the name) opens the item editor', async () => {
    const mount = await harness(fullState())
    const { RoutineDetail } = await importJsx('./views/Routine.jsx', import.meta.url)
    await mount(h(RoutineDetail, { routineId: 'rtn-a' }))
    const meta = view.all('.ui-row__meta').find((node) => node.closest('li').textContent.includes('Chest Press'))
    const link = meta.closest('a')
    console.log('meta', JSON.stringify(meta.textContent), 'href', link?.getAttribute('href'))
    assert.ok(link, 'the meta line sits inside the row link')
    assert.match(link.getAttribute('href'), /\/routines\/rtn-a\/exercise\/si-press$/)
    await view.click(meta)
    assert.match(window.location.hash, /\/routines\/rtn-a\/exercise\/si-press$/)
  })

  it('Reorder mode: rows are not links (name still is); Up/Down beside them', async () => {
    const mount = await harness(fullState())
    const { RoutineDetail } = await importJsx('./views/Routine.jsx', import.meta.url)
    await mount(h(RoutineDetail, { routineId: 'rtn-a' }))
    await view.click(view.button('Reorder'))
    assert.equal(view.all('.ui-row__link').length, 0)
    assert.equal(view.all('.ui-row__meta').filter((node) => node.closest('a')).length, 0, 'meta is not a link')
    assert.equal(view.all('button').filter((b) => b.textContent === 'Up').length, 3)
  })
})

describe('req-242 — Change exercise (rendered)', () => {
  it('the item editor shows "Change exercise" above Remove, linking to the picker', async () => {
    const mount = await harness(fullState())
    const { RoutineExerciseEdit } = await importJsx('./views/Routine.jsx', import.meta.url)
    await mount(h(RoutineExerciseEdit, { routineId: 'rtn-a', itemId: 'si-press' }))
    const link = view.all('a').find((a) => a.textContent.trim().startsWith('Change exercise'))
    assert.match(link.getAttribute('href'), /\/routines\/rtn-a\/exercise\/si-press\/change$/)
    const remove = view.button('Remove')
    assert.ok(link.compareDocumentPosition(remove) & Node.DOCUMENT_POSITION_FOLLOWING, 'Change exercise comes before Remove')
  })

  it('AC2 + AC4 pick an exercise WITH history → history\'s sets/reps/rest/kg, same item id; history and the active snapshot untouched', async () => {
    const payload = fullState()
    itemOf(payload, 'si-plank').notes = 'by the window'
    const mount = await harness(payload)
    const before = stored()
    const { RoutineExerciseChange, RoutineExerciseEdit } = await importJsx('./views/Routine.jsx', import.meta.url)
    await mount(h(RoutineExerciseChange, { routineId: 'rtn-a', itemId: 'si-plank' }))
    assert.ok(view.button('Change').disabled, 'nothing picked → disabled')
    await view.click(box('Chest Press'))
    await view.click(view.button('Change'))
    const after = stored()
    const item = itemOf(after, 'si-plank')
    console.log('stored', JSON.stringify(item))
    assert.equal(item.exerciseId, 'ex-press')
    assert.deepEqual([item.sets, item.targets, item.restSec, item.suggestedWeights], [2, ['10', '9'], 90, [20, 20]])
    assert.deepEqual([item.id, item.notes, item.role, item.warmup], ['si-plank', 'by the window', 'finisher', null])
    assert.match(window.location.hash, /\/routines\/rtn-a\/exercise\/si-plank$/, 'back to the item editor')
    // AC4 — finished history and the active workout are the same records.
    assert.deepEqual(after.workouts, before.workouts)
    assert.deepEqual(after.activeWorkout, before.activeWorkout)
    assert.deepEqual(after.exercises, before.exercises, 'an own pick creates nothing')
    // The editor now shows the new exercise and its values.
    await mount(h(RoutineExerciseEdit, { routineId: 'rtn-a', itemId: 'si-plank' }))
    assert.equal(view.container.querySelector('h1')?.textContent, 'Chest Press')
    console.log('editor', JSON.stringify(view.text().slice(0, 300)))
  })

  it('AC3 failure case: pick an exercise with NO history → sets/reps/rest kept, every kg blank', async () => {
    const mount = await harness(fullState())
    const before = stored()
    const old = itemOf(before, 'si-press')
    const { RoutineExerciseChange } = await importJsx('./views/Routine.jsx', import.meta.url)
    await mount(h(RoutineExerciseChange, { routineId: 'rtn-a', itemId: 'si-press' }))
    await view.click(box('Seated Row'))
    await view.click(view.button('Change'))
    const item = itemOf(stored(), 'si-press')
    console.log('old', JSON.stringify(old), 'new', JSON.stringify(item))
    assert.equal(item.exerciseId, 'ex-row')
    assert.deepEqual([item.sets, item.targets, item.restSec], [old.sets, old.targets, old.restSec])
    assert.ok(!item.suggestedWeights.some((kg) => typeof kg === 'number'), 'no kg carried from Chest Press')
    assert.deepEqual(item.suggestedWeights, [])
    assert.deepEqual([item.id, item.notes, item.role, item.warmup], [old.id, old.notes, old.role, old.warmup])
    assert.deepEqual(stored().workouts, before.workouts)
    assert.deepEqual(stored().activeWorkout, before.activeWorkout)
  })

  it('AC4 History still names the old exercise for the finished workout', async () => {
    const mount = await harness(fullState())
    const { RoutineExerciseChange } = await importJsx('./views/Routine.jsx', import.meta.url)
    await mount(h(RoutineExerciseChange, { routineId: 'rtn-a', itemId: 'si-press' }))
    await view.click(box('Seated Row'))
    await view.click(view.button('Change'))
    const { HistoryDetail } = await importJsx('./views/history/detail.jsx', import.meta.url)
    await mount(h(HistoryDetail, { workoutId: 'wo-1' }))
    console.log('history', JSON.stringify(view.text().slice(0, 300)))
    assert.match(view.text(), /Chest Press/)
  })
})
