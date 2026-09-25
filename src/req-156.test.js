// req-156 — (1) audit F-TRUST-2: a warm-up or cardio set, where the Effort control is
// hidden, saves no effort (rpe null), not the unseen default "Moderate" (rpe 3). (2) audit
// F-TEST-1: these are RENDER tests — the real SetLogForm / SetEditForm mounted in a DOM
// (test-support/render.js) and driven by clicks, not a read of their source text.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { importJsx, render } from './test-support/render.js'
import { activeSetPatch, historySetFields } from './views/set-values.js'
import { historyAddSetDraft, withHistorySet } from './views/history/add-set.js'

const { SetLogForm } = await importJsx('./ui/index.jsx', import.meta.url)
const { SetEditForm } = await importJsx('./views/set-edit.jsx', import.meta.url)
const { RPE_OPTIONS } = await import('./ids.js')

const h = React.createElement
let view
afterEach(async () => {
  await view?.unmount()
  view = null
})

// What the live log screen passes for each kind of set (item.jsx: showEffort =
// currentType === 'work' && ex.type !== 'cardio'; initialEffort defaults to 3).
async function logSet({ showEffort, weighted = true, pick }) {
  let submitted = null
  view = await render(
    h(SetLogForm, {
      weighted,
      showEffort,
      effortOptions: RPE_OPTIONS,
      initialWeight: weighted ? '20' : '',
      initialReps: '10',
      initialEffort: 3,
      onComplete: (values) => {
        submitted = values
      },
    }),
  )
  if (pick) await view.click(view.button(pick))
  await view.click(view.button('Complete'))
  return submitted
}

describe('SetLogForm (render) — the live log', () => {
  it('a warm-up set (Effort hidden) submits no effort', async () => {
    const values = await logSet({ showEffort: false })
    assert.equal(view.text().includes('Effort'), false, 'the control is not shown')
    assert.equal(values.effort, null)
    assert.equal(values.weight, '20')
  })
  it('a cardio set (Effort hidden, unweighted) submits no effort', async () => {
    const values = await logSet({ showEffort: false, weighted: false })
    assert.equal(values.effort, null)
  })
  it('a work set submits the default the user sees, or the one they pick', async () => {
    assert.equal((await logSet({ showEffort: true })).effort, 3)
    await view.unmount()
    view = null
    assert.equal((await logSet({ showEffort: true, pick: 'Hard' })).effort, 4)
  })
})

describe('SetEditForm (render) — active set edit and History', () => {
  async function editSet({ set, showEffort, setTypeOptions }) {
    let saved = null
    view = await render(
      h(SetEditForm, {
        set,
        showLoad: true,
        showEffort,
        setTypeOptions,
        cancelTo: '/',
        onSave: (values) => {
          saved = values
        },
      }),
    )
    await view.click(view.button('Save'))
    return saved
  }
  it('active edit of a warm-up that already has rpe 3 (Effort hidden) → rpe null', async () => {
    const values = await editSet({ set: { setType: 'wu', weight: 10, reps: '12', rpe: 3 }, showEffort: false })
    assert.equal(values.rpe, '')
    assert.equal(activeSetPatch(values).rpe, null)
  })
  it('active edit of a work set keeps the effort it shows', async () => {
    const values = await editSet({ set: { setType: 'work', weight: 20, reps: '8', rpe: 4 }, showEffort: true })
    assert.equal(activeSetPatch(values).rpe, 4)
  })
  it('History add set: the draft has no effort, so a warm-up saved as-is stores rpe null', async () => {
    const workout = { id: 'w1', sets: [], snapshot: { items: [] } }
    const draft = historyAddSetDraft(workout, 'ex-a', 'ri-a')
    const values = await editSet({
      set: { ...draft, setType: 'wu' },
      showEffort: true,
      setTypeOptions: [{ value: 'wu', label: 'WU set' }, { value: 'work', label: 'Work' }],
    })
    assert.equal(values.setType, 'wu')
    const patch = withHistorySet(workout, { exerciseId: 'ex-a', itemId: 'ri-a', exercise: null, values })
    assert.equal(patch.sets[0].rpe, null)
  })
})

describe('live log screen (render) — WorkoutItemLog + the real store', () => {
  it('Complete on a warm-up stores rpe null; the next work set stores the effort shown', async () => {
    const { readFileSync } = await import('node:fs')
    const fixture = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
    localStorage.clear()
    localStorage.setItem('workout-mvp-v8', JSON.stringify({ ...fixture, activeWorkout: null }))
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { useStore } = await import('./store-context.js')
    const { WorkoutItemLog } = await importJsx('./views/workout/item.jsx', import.meta.url)
    const captured = {} // the live store, read by the test (a holder, not a reassigned outer variable)
    function Screen({ started }) {
      // Kept (req-165, F-LINT-1): a test harness reading the live store out of the tree.
      // oxlint-disable-next-line react/immutability
      captured.store = useStore()
      return started ? h(WorkoutItemLog, { routineId: 'sess-lower', itemId: 'si-sess-lower-2-ex-leg-extension' }) : null
    }
    view = await render(h(StoreProvider, null, h(Screen, { started: false })))
    const { act } = await import('./test-support/render.js')
    await act(async () => captured.store.startWorkout('sess-lower'))
    await view.unmount()
    view = await render(h(StoreProvider, null, h(Screen, { started: true })))
    assert.match(view.text(), /WU set/)
    assert.equal(view.text().includes('Effort'), false)
    await view.click(view.button('Complete'))
    assert.equal(view.text().includes('Effort'), true, 'the work set shows Effort')
    await view.click(view.button('Complete'))
    const sets = captured.store.activeWorkout.sets.map(({ setType, rpe }) => ({ setType, rpe }))
    assert.deepEqual(sets, [
      { setType: 'wu', rpe: null },
      { setType: 'work', rpe: 3 },
    ])
  })
})

describe('save paths — a hidden / blank effort is rpe null', () => {
  it('active set edit: activeSetPatch', () => {
    assert.equal(activeSetPatch({ weight: '10', reps: '12', rpe: '', note: '' }).rpe, null)
    assert.equal(activeSetPatch({ weight: '', reps: '20 min', rpe: '', note: '' }, { showLoad: false }).rpe, null)
  })
  it('History edit: historySetFields', () => {
    assert.equal(historySetFields({ weight: '10', reps: '12', rpe: '', note: '', setType: 'wu' }).rpe, null)
  })
  it('History add: withHistorySet', () => {
    const patch = withHistorySet(
      { id: 'w', sets: [], snapshot: null },
      { exerciseId: 'e', itemId: 'i', exercise: null, values: { weight: '10', reps: '12', rpe: '', note: '', setType: 'wu' } },
    )
    assert.equal(patch.sets[0].rpe, null)
  })
})
