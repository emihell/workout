// req-187 (DEC-103 §1) — the routine-kg offer is a confirm sheet on the Complete that
// finishes an exercise, not a row in the overview list or the auto-complete summary.
import { describe, it, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, importJsx, render } from './test-support/render.js'
import { emptyState } from './persistence.js'
import { DEVICE_FILL_KEY } from './routine-kg-fill.js'
import { offerOnFinishingSet, offerSheetText, routineUpdateOffer } from './routine-update-offer.js'
import { answerConfirm, askConfirm, getPendingConfirm, navigationCancels } from './ui/confirm.js'

const h = React.createElement
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

// ---- The call site's decision (pure): sheet or no sheet ----
describe('req-187 — offerOnFinishingSet: sheet vs no sheet on the finishing set', () => {
  const routines = [{ id: 'up', name: 'Upper body', exercises: [{ id: 'ia', exerciseId: 'ex', sets: 3, suggestedWeights: [20, 20, 20] }] }]
  const item = { id: 'ia', routineItemId: 'ia', exerciseId: 'ex', exerciseType: 'free', sets: 3 }
  const set = (kg, extra = {}) => ({ routineItemId: 'ia', exerciseId: 'ex', setType: 'work', weight: kg, reps: '8', rpe: 3, note: '', ...extra })
  const skipped = () => set(0, { reps: 'skipped', note: 'skipped' })
  const active = (sets, items = [item]) => ({ routineId: 'up', snapshot: { routineId: 'up', items }, sets })

  it('kg 25 on every set vs routine 20 → an offer, computed WITH the finishing set included', () => {
    const offer = offerOnFinishingSet(active([set(25), set(25)]), routines, item, set(25), true)
    assert.deepEqual(offer, { routineId: 'up', routineName: 'Upper body', itemId: 'ia', from: [20, 20, 20], to: [25, 25, 25] })
    // Only the finishing set differs: the store's own append (withLoggedSet) is what counts.
    const lastOnly = offerOnFinishingSet(active([set(20), set(20)]), routines, item, set(22.5), true)
    assert.deepEqual(lastOnly.to, [20, 20, 22.5])
    // Without the finishing set the same workout has no offer — so it must be included.
    assert.equal(routineUpdateOffer(active([set(20), set(20)]), routines, item), null)
  })

  it('not the finishing set → no sheet, whatever the kg', () => {
    assert.equal(offerOnFinishingSet(active([set(25)]), routines, item, set(25), false), null)
  })

  it('failure case: kg equal to the routine → no sheet', () => {
    assert.equal(offerOnFinishingSet(active([set(20), set(20)]), routines, item, set(20), true), null)
  })

  it('failure case: a mid-workout replacement → no sheet', () => {
    const replaced = { ...item, id: 'rep', routineItemId: 'rep', addedMidWorkout: true }
    const sets = [set(25, { routineItemId: 'rep' }), set(25, { routineItemId: 'rep' })]
    assert.equal(offerOnFinishingSet(active(sets, [replaced]), routines, replaced, set(25, { routineItemId: 'rep' }), true), null)
  })

  it('failure case: a bodyweight exercise → no sheet', () => {
    const bw = { ...item, exerciseType: 'bodyweight' }
    assert.equal(offerOnFinishingSet(active([set(25), set(25)], [bw]), routines, bw, set(25), true), null)
  })

  it('failure case: all sets skipped (the finishing one too) → no sheet', () => {
    assert.equal(offerOnFinishingSet(active([skipped(), skipped()]), routines, item, skipped(), true), null)
  })

  it('a skipped finishing set after logged 25s → the offer carries the logged sets only', () => {
    assert.deepEqual(offerOnFinishingSet(active([set(25), set(25)]), routines, item, skipped(), true).to, [25, 25, 20])
  })

  it('failure case: routine deleted or archived mid-workout → no sheet', () => {
    assert.equal(offerOnFinishingSet(active([set(25), set(25)]), [], item, set(25), true), null)
    assert.equal(offerOnFinishingSet(active([set(25), set(25)]), [{ ...routines[0], archivedAt: '2026-10-05' }], item, set(25), true), null)
  })
})

describe('req-187 — the sheet words (req-189: plain words, [No] [Yes])', () => {
  // req-189 edit: the req-187 wording ("Update Bench Press?" / "You lifted … says …" / [Keep 20 kg]
  // [Update routine]) was replaced by req-189 scope 4; the same inputs now assert the new words.
  it('"Use 25 kg next time?" · "Upper body will start Bench Press at 25 kg." · [No] [Yes]', () => {
    assert.deepEqual(offerSheetText({ routineName: 'Upper body', from: [20, 20, 20], to: [25, 25, 25] }, 'Bench Press'), {
      title: 'Use 25 kg next time?',
      body: 'Upper body will start Bench Press at 25 kg.',
      keepLabel: 'No',
      updateLabel: 'Yes',
    })
  })
  it('per-set lists when the sets differ; a blank routine reads the same way', () => {
    const mixed = offerSheetText({ routineName: 'Day A', from: [20, 20, 17.5], to: [25, 25, 17.5] }, 'Row')
    assert.equal(mixed.title, 'Use 25/25/17.5 kg next time?')
    assert.equal(mixed.body, 'Day A will start Row at 25/25/17.5 kg.')
    const blank = offerSheetText({ routineName: 'Full body A', from: [], to: [40, 40] }, 'Leg Press')
    assert.equal(blank.title, 'Use 40 kg next time?')
    assert.equal(blank.body, 'Full body A will start Leg Press at 40 kg.')
    assert.equal(blank.keepLabel, 'No')
  })
})

describe('req-187 — the sheet survives the navigation it was opened with (stayOn)', () => {
  it('navigationCancels: stayOn path → stays; any other path → cancels; no stayOn → any navigation cancels', () => {
    assert.equal(navigationCancels({ stayOn: '/workout/up' }, '#/workout/up'), false)
    assert.equal(navigationCancels({ stayOn: '/workout/up' }, '#/workout/up?from=x'), false)
    assert.equal(navigationCancels({ stayOn: '/workout/up' }, '#/'), true)
    assert.equal(navigationCancels({ stayOn: '/workout/up' }, '#/workout/up/item/ia'), true)
    assert.equal(navigationCancels({}, '#/workout/up'), true)
    assert.equal(navigationCancels(null, '#/'), false)
  })
  it('askConfirm keeps title / cancelLabel / stayOn on the pending question; defaults unchanged', async () => {
    const p = askConfirm('Body', { title: 'T', confirmLabel: 'Update routine', cancelLabel: 'Keep 20 kg', stayOn: '/workout/up' })
    const open = getPendingConfirm()
    assert.equal(open.title, 'T')
    assert.equal(open.cancelLabel, 'Keep 20 kg')
    assert.equal(open.stayOn, '/workout/up')
    answerConfirm(false)
    assert.equal(await p, false)
    const q = askConfirm('Remove?', { confirmLabel: 'Remove' })
    assert.equal(getPendingConfirm().cancelLabel, 'Cancel')
    assert.equal(getPendingConfirm().stayOn, null)
    answerConfirm(true)
    assert.equal(await q, true)
  })
})

// ---- Rendered against the real store, with the real ConfirmSheet mounted beside the screen ----
describe('req-187 (rendered) — last Complete → the sheet; Update / Keep; no inline offer; summary after', () => {
  let view
  afterEach(async () => {
    mock.timers.reset()
    if (getPendingConfirm()) answerConfirm(false)
    await view?.unmount()
    view = null
  })

  const ex = (id, name) => ({ id, name, type: 'machine', equipment: 'Machine', weightStep: 'n/a', muscles: '', cues: '' })
  const routineItem = (id, exerciseId, sets, kg) => ({ id, exerciseId, role: 'main', restSec: 90, notes: '', warmup: null, sets, targets: Array(sets).fill('8'), suggestedWeights: kg, durations: [] })

  async function harness(items) {
    const state = {
      ...emptyState(),
      exercises: [ex('ex-bp', 'Bench Press'), ex('ex-row', 'Seated Row')],
      routines: [{ id: 'up', name: 'Upper body', focus: 'Machines', exercises: items }],
    }
    localStorage.clear()
    localStorage.setItem(DEVICE_FILL_KEY, '2026-09-26T00:00:00.000Z')
    localStorage.setItem('workout-mvp-v9', JSON.stringify(state))
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { useStore } = await import('./store-context.js')
    const { WorkoutItemLog } = await importJsx('./views/workout/item.jsx', import.meta.url)
    const { Workout } = await importJsx('./views/workout/overview.jsx', import.meta.url)
    const { ConfirmSheet } = await importJsx('./ui/index.jsx', import.meta.url)
    const captured = {}
    function Screen({ child }) {
      // oxlint-disable-next-line react/immutability
      captured.store = useStore()
      return child
    }
    const mount = async (child) => {
      await view?.unmount()
      view = await render(h(StoreProvider, null, h(Screen, { child }), h(ConfirmSheet)))
    }
    await mount(null)
    await act(async () => captured.store.startWorkout('up'))
    const stored = () => JSON.parse(localStorage.getItem('workout-mvp-v9'))
    return { mount, stored, captured, item: (id) => h(WorkoutItemLog, { routineId: 'up', itemId: id }), overview: () => h(Workout, { routineId: 'up' }) }
  }

  async function logAll(t, itemId, kgs) {
    await t.mount(t.item(itemId))
    for (const kg of kgs) {
      await view.type(view.input('kg'), kg)
      assert.equal(view.all('[role="alertdialog"]').length, 0, 'no sheet before the last Complete')
      await view.click(view.button('Complete'))
    }
  }

  it('AC1: routine 20, log 25 ×3 → sheet names the routine; Update → stored [25,25,25]; overview has no offer row; rest armed', async () => {
    const t = await harness([routineItem('ia', 'ex-bp', 3, [20, 20, 20]), routineItem('ib', 'ex-row', 1, [30])])
    await logAll(t, 'ia', ['25', '25', '25'])
    const sheet = view.all('[role="alertdialog"]')[0]
    assert.ok(sheet, 'the sheet is open')
    // req-189 edit: the sheet's words are now "Use 25 kg next time?" / [No] [Yes] (req-189 scope 4).
    assert.equal(sheet.querySelector('.ui-sheet__title').textContent, 'Use 25 kg next time?')
    assert.equal(sheet.querySelector('.ui-sheet__message').textContent, 'Upper body will start Bench Press at 25 kg.')
    assert.deepEqual([...sheet.querySelectorAll('button')].map((b) => b.textContent), ['No', 'Yes'])
    assert.ok(t.stored().activeWorkout.restEndsAt, 'rest armed by the Complete, sheet or not (AC6)')
    await t.mount(t.overview())
    assert.ok(view.button('Yes'), 'the sheet is still open over the overview')
    await view.click(view.button('Yes'))
    await flush()
    assert.deepEqual(t.stored().routines[0].exercises[0].suggestedWeights, [25, 25, 25])
    assert.equal(getPendingConfirm(), null)
    assert.equal(view.text().includes('You lifted'), false, 'no inline offer row')
    assert.equal(view.all('button').some((b) => b.textContent.startsWith('Save to')), false)
  })

  it('AC2: Keep → the routine item unchanged, nothing else written to it', async () => {
    const t = await harness([routineItem('ia', 'ex-bp', 3, [20, 20, 20]), routineItem('ib', 'ex-row', 1, [30])])
    const before = JSON.stringify(t.stored().routines)
    await logAll(t, 'ia', ['25', '25', '25'])
    await t.mount(t.overview())
    await view.click(view.button('No'))
    await flush()
    assert.equal(JSON.stringify(t.stored().routines), before)
    assert.equal(getPendingConfirm(), null)
    assert.equal(view.text().includes('You lifted'), false)
  })

  it('AC3 (rendered): kg equal to the routine → no sheet', async () => {
    const t = await harness([routineItem('ia', 'ex-bp', 2, [20, 20]), routineItem('ib', 'ex-row', 1, [30])])
    await logAll(t, 'ia', ['20', '20'])
    await flush()
    assert.equal(getPendingConfirm(), null)
    assert.equal(view.all('[role="alertdialog"]').length, 0)
  })

  it('AC5: the last exercise → sheet first (summary waits); after the answer → summary with its countdown, no offer section', async () => {
    mock.timers.enable({ apis: ['setInterval', 'Date'], now: new Date(2026, 9, 5, 10, 0) })
    const t = await harness([routineItem('ia', 'ex-bp', 1, [20])])
    await logAll(t, 'ia', ['25'])
    await t.mount(t.overview())
    assert.ok(view.button('Yes'))
    assert.equal(view.text().includes('Great job!'), false, 'the summary waits for the sheet')
    await act(async () => mock.timers.tick(15000))
    assert.equal(t.stored().activeWorkout != null, true, 'nothing auto-finished under the sheet')
    await view.click(view.button('Yes'))
    await flush()
    assert.match(view.text(), /Great job!/)
    assert.match(view.text(), /Finishing in 10s…/)
    assert.equal(view.text().includes('Update your routine?'), false)
    assert.deepEqual(t.stored().routines[0].exercises[0].suggestedWeights, [25])
  })
})
