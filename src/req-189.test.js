// req-189 — first-workout fixes from the Lena run, and Swap copies sets/rest (DEC-106).
// Pure: swapNoHistoryItem / swapPicks (mid-workout-pick.js), kgLabelFor (kg-label.js),
// doneRowSuffix (views/workout/row-label.js). Rendered: the set form's blank-Reps note (no
// `required`), select-on-focus, the kg label; the overview's "· swapped" vs "· skipped".
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { needsSetup, noHistoryItem, swapNoHistoryItem, swapPicks } from './mid-workout-pick.js'
import { isDumbbellEquipment, kgLabelFor } from './kg-label.js'
import { doneRowSuffix, itemSwappedAway } from './views/workout/row-label.js'
import { itemKey, skipItemPatch } from './workout-log.js'
import { act, importJsx, render } from './test-support/render.js'

const h = React.createElement

describe('req-189 / DEC-106 — Swap with no history copies the original sets and rest', () => {
  const original = { id: 'ri-a', sets: 4, restSec: 120, targets: ['10', '8', '6', '6'], suggestedWeights: [40, 45, 50, 50], durations: [], warmup: { reps: 10 } }
  it('no-history pick → sets / restSec = original, targets / kg / durations blank', () => {
    const item = swapNoHistoryItem(original)
    assert.deepEqual(item, { role: 'main', warmup: null, notes: '', sets: 4, targets: [], suggestedWeights: [], durations: [], restSec: 120 })
  })
  it('history pick → unchanged (history plan); no-history pick → the copy; never a step', () => {
    const historyItem = { sets: 3, targets: ['8', '8', '6'], suggestedWeights: [50, 50, 55], durations: [], restSec: 75 }
    const picks = [{ kind: 'mine', exerciseId: 'ex-h', source: 'history', item: historyItem }]
    assert.equal(swapPicks(picks, original)[0].item, historyItem)
    const lib = [{ kind: 'library', name: 'Pec Fly', source: 'starting', item: { sets: 3, targets: ['10', '10', '10'], restSec: 90 } }]
    const out = swapPicks(lib, original)[0].item
    assert.deepEqual([out.sets, out.restSec, out.targets, out.suggestedWeights], [4, 120, [], []])
  })
  it('a rest-less original (0) → 0; a missing set count reads 1', () => {
    assert.equal(swapNoHistoryItem({ sets: 2, restSec: 0 }).restSec, 0)
    assert.equal(swapNoHistoryItem({}).sets, 1)
  })
  it('Add exercise unchanged: a no-history pick still needs the step (DEC-104)', () => {
    assert.equal(needsSetup({ kind: 'library', source: 'starting' }), true)
    assert.equal(needsSetup({ kind: 'mine', source: 'history' }), false)
    assert.ok(noHistoryItem({ sets: '', rest: '' }).errors.sets)
  })
})

describe('req-189 — "kg per dumbbell" from the stored equipment', () => {
  it('library "Dumbbell", seed "Dumbbells", any case → per dumbbell; machines / barbell / blank → kg', () => {
    for (const eq of ['Dumbbell', 'Dumbbells', 'dumbbell', 'DUMBBELLS', 'Adjustable dumbbells']) assert.equal(kgLabelFor({ equipment: eq }), 'kg per dumbbell', eq)
    for (const eq of ['Machine', 'Chest Press (Star Trac)', 'Barbell', 'Kettlebells', '', null, undefined]) assert.equal(kgLabelFor({ equipment: eq }), 'kg', String(eq))
    assert.equal(kgLabelFor(null), 'kg')
    assert.equal(isDumbbellEquipment('Dumbbellish'), false)
  })
})

describe('req-189 — the done row says "swapped" for a Swap, "skipped" for a Skip (derived)', () => {
  const skipped = (key) => ({ routineItemId: key, setType: 'work', reps: 'skipped', weight: 0 })
  const active = {
    snapshot: { items: [{ id: 'a', routineItemId: 'a' }, { id: 'm1', routineItemId: 'm1', addedMidWorkout: true, replacesItemId: 'a' }, { id: 'b', routineItemId: 'b' }, { id: 'c', routineItemId: 'c' }] },
    sets: [skipped('a'), skipped('b'), { routineItemId: 'c', setType: 'work', reps: '10', weight: 40 }],
    completedItemIds: ['a', 'b', 'c'],
  }
  const it3 = active.snapshot.items
  it('swapped away → " · swapped"; skipped → " · skipped"; any set logged → " · done"', () => {
    assert.equal(itemSwappedAway(active, it3[0]), true)
    assert.equal(doneRowSuffix(active, it3[0]), ' · swapped')
    assert.equal(itemSwappedAway(active, it3[2]), false)
    assert.equal(doneRowSuffix(active, it3[2]), ' · skipped')
    assert.equal(doneRowSuffix(active, it3[3]), ' · done')
  })
})

// --- rendered ---
const fixture = () => JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
let view
afterEach(async () => {
  await view?.unmount()
  view = null
})

async function harness() {
  localStorage.clear()
  localStorage.setItem('workout-mvp-v8', JSON.stringify({ ...fixture(), activeWorkout: null }))
  const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
  const { useStore } = await import('./store-context.js')
  const captured = {}
  function Grab({ children }) {
    // oxlint-disable-next-line react/immutability
    captured.store = useStore()
    return children ?? null
  }
  const mount = async (child) => {
    await view?.unmount()
    view = await render(h(StoreProvider, null, h(Grab, null, child)))
  }
  await mount(null)
  return { captured, mount }
}

describe('req-189 rendered — the set form', () => {
  it('failure case: Reps blank → Complete → inline "Enter reps", nothing logged; the box is not `required`', async () => {
    const { SetLogForm } = await importJsx('./ui/index.jsx', import.meta.url)
    const completed = []
    view = await render(h(SetLogForm, { initialWeight: '40', initialReps: '', onComplete: (v) => completed.push(v) }))
    const reps = view.input('Reps')
    assert.equal(reps.hasAttribute('required'), false, 'no native validation bubble')
    await view.click(view.button('Complete'))
    assert.equal(completed.length, 0)
    assert.match(view.text(), /Enter reps/)
    await view.type(reps, '10')
    assert.doesNotMatch(view.text(), /Enter reps/, 'cleared by the next reps edit')
    await view.click(view.button('Complete'))
    assert.equal(completed.length, 1)
    assert.equal(completed[0].reps, '10')
  })

  it('focusing kg / Reps selects the content', async () => {
    const { SetLogForm } = await importJsx('./ui/index.jsx', import.meta.url)
    view = await render(h(SetLogForm, { initialWeight: '40', initialReps: '10', onComplete: () => {} }))
    for (const label of ['kg', 'Reps']) {
      const input = view.input(label)
      await act(async () => input.focus())
      assert.equal(input.selectionStart, 0, label)
      assert.equal(input.selectionEnd, input.value.length, label)
    }
  })

  it('a dumbbell exercise reads "kg per dumbbell"', async () => {
    const { captured, mount } = await harness()
    const { WorkoutItemLog } = await importJsx('./views/workout/item.jsx', import.meta.url)
    await act(async () => captured.store.startWorkout('sess-push-pull'))
    const items = captured.store.activeWorkout.snapshot.items
    const db = items.find((item) => item.exerciseId === 'ex-incline-db-press')
    await mount(h(WorkoutItemLog, { routineId: 'sess-push-pull', itemId: itemKey(db) }))
    assert.ok(view.all('.ui-field__label').some((n) => n.textContent === 'kg per dumbbell'))
  })

  it('a machine exercise reads "kg"', async () => {
    const { captured, mount } = await harness()
    const { WorkoutItemLog } = await importJsx('./views/workout/item.jsx', import.meta.url)
    await act(async () => captured.store.startWorkout('sess-upper'))
    const machine = captured.store.activeWorkout.snapshot.items.find((item) => item.exerciseId === 'ex-chest-press')
    await mount(h(WorkoutItemLog, { routineId: 'sess-upper', itemId: itemKey(machine) }))
    const labels = view.all('.ui-field__label').map((n) => n.textContent)
    assert.ok(labels.includes('kg'), labels.join())
    assert.equal(labels.includes('kg per dumbbell'), false)
  })
})

describe('req-189 rendered — overview "· swapped" vs "· skipped"', () => {
  it('Swap A (no history) → A reads swapped, the new item has A’s sets and rest; Skip B → skipped', async () => {
    const { captured, mount } = await harness()
    const { Workout } = await importJsx('./views/workout/overview.jsx', import.meta.url)
    await act(async () => captured.store.startWorkout('sess-upper'))
    const [, a, b] = captured.store.activeWorkout.snapshot.items
    await act(async () => captured.store.replaceItem(itemKey(a), 'ex-leg-press', swapNoHistoryItem(a)))
    const items = captured.store.activeWorkout.snapshot.items
    const rep = items.find((item) => item.replacesItemId === itemKey(a))
    assert.deepEqual([rep.sets, rep.restSec, rep.targets, rep.suggestedWeights], [a.sets, a.restSec, [], []])
    await mount(h(Workout, { routineId: 'sess-upper' }))
    const rowOf = (name) => view.all('li').find((li) => li.textContent.includes(name))?.textContent || ''
    assert.match(rowOf(a.exerciseName), / · swapped/)
    await act(async () => captured.store.patchActive(skipItemPatch(captured.store.activeWorkout, itemKey(b))))
    assert.match(rowOf(b.exerciseName), / · skipped/)
  })
})
