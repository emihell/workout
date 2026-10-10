// req-212 (DEC-119 §1) — the set flow: one Done per set (rpe null, `loggedAt`), an edit sheet in
// place of Previous / Next, and the exercise review with one optional effort written to every
// logged, non-skipped work set of the item. Pure checks on the store action and the progression
// chain, render checks against the real store (happy-dom), and the backup round trip.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { act, importJsx, render } from './test-support/render.js'
import { EFFORT_OPTIONS, RPE_OPTIONS, formatSetLine, rpeLabel } from './ids.js'
import { itemEffort, itemEffortSets, itemKey, nextNotDoneItem, withItemEffort } from './workout-log.js'
import { itemEffortState } from './state-reducers.js'
import { progressionForItem } from './model.js'
import { moveToValidWeight } from './progress.js'
import { applyBackup, buildBackup } from './exchange.js'
import { answerConfirm, getPendingConfirm, navigationCancels } from './ui/confirm.js'

const h = React.createElement
const DB = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
const CHEST = 'si-sess-upper-1-ex-chest-press' // machine, step 5: a warm-up + 3 work sets (12 / 11 / 9)
const ROWING = 'si-sess-upper-0-ex-rowing' // cardio
const doneHash = (itemId) => `#/workout/sess-upper/item/${itemId}/done`

let view = null
afterEach(async () => {
  if (getPendingConfirm()) answerConfirm(false)
  await view?.unmount()
  view = null
})

async function harness(payload = DB) {
  const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
  const { useStore } = await import('./store-context.js')
  const { ConfirmSheet } = await importJsx('./ui/index.jsx', import.meta.url)
  localStorage.clear()
  localStorage.setItem('workout-mvp-v8', JSON.stringify({ ...payload, activeWorkout: null }))
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
  const { WorkoutItemLog, WorkoutItemDone } = await importJsx('./views/workout/item.jsx', import.meta.url)
  return {
    captured,
    mount,
    start: () => act(async () => captured.store.startWorkout('sess-upper')),
    log: (itemId) => h(WorkoutItemLog, { routineId: 'sess-upper', itemId }),
    review: (itemId) => h(WorkoutItemDone, { routineId: 'sess-upper', itemId }),
    active: () => captured.store.activeWorkout,
  }
}

// Log the warm-up and every work set of Chest Press with Done, as prefilled (reps = target).
async function logChest(t) {
  window.location.hash = `#/workout/sess-upper/item/${CHEST}/log`
  await t.mount(t.log(CHEST))
  for (let i = 0; i < 4; i++) await view.click(view.button('Done'))
  if (getPendingConfirm()) answerConfirm(false) // the routine-kg sheet, when the kg differs
}

const sheetOf = () => view.container.querySelector('[role="dialog"]')
const inSheet = (label) => [...sheetOf().querySelectorAll('label')].find((l) => l.textContent.trim().startsWith(label))?.querySelector('input')
const sheetButton = (label) => [...sheetOf().querySelectorAll('button')].find((b) => b.textContent.trim() === label)
const radio = (label) => view.all('[role="radio"]').find((b) => b.textContent.trim() === label)

// ---- the store action (AC3) ----
describe('AC3 — the exercise effort writes rpe on the item’s logged work sets only', () => {
  const A = { id: 'pa', routineItemId: 'ia', exerciseId: 'ex-a', sets: 3 }
  const B = { id: 'pb', routineItemId: 'ib', exerciseId: 'ex-b', sets: 1 }
  const set = (item, setType, reps, extra = {}) => ({ routineItemId: item.routineItemId, exerciseId: item.exerciseId, setType, weight: 20, reps, rpe: null, note: '', loggedAt: '2026-10-10T10:00:00.000Z', ...extra })
  const state = () => ({
    activeWorkout: {
      routineId: 'r',
      snapshot: { items: [A, B] },
      sets: [set(A, 'wu', '12'), set(A, 'work', '10'), set(B, 'work', '8'), set(A, 'work', 'skipped', { note: 'skipped' }), set(A, 'work', '9')],
    },
  })

  it('Medium → rpe 3 on A’s two logged work sets; not its warm-up, its skipped set, or B’s set', () => {
    const next = itemEffortState(state(), 'ia', 3)
    assert.deepEqual(next.activeWorkout.sets.map((s) => [s.routineItemId, s.setType, s.reps, s.rpe]), [
      ['ia', 'wu', '12', null],
      ['ia', 'work', '10', 3],
      ['ib', 'work', '8', null],
      ['ia', 'work', 'skipped', null],
      ['ia', 'work', '9', 3],
    ])
    // nothing else on a set changes — loggedAt included
    assert.deepEqual(next.activeWorkout.sets.map((s) => s.loggedAt), state().activeWorkout.sets.map((s) => s.loggedAt))
  })

  it('changing it rewrites them; null clears; itemEffort reads it back (2/3/4 only)', () => {
    let s = itemEffortState(state(), 'ia', 3)
    s = itemEffortState(s, 'ia', 2)
    assert.equal(itemEffort(s.activeWorkout, A), 2)
    assert.deepEqual(itemEffortSets(s.activeWorkout, A).map((x) => x.rpe), [2, 2])
    s = itemEffortState(s, 'ia', null)
    assert.equal(itemEffort(s.activeWorkout, A), '')
    assert.deepEqual(itemEffortSets(s.activeWorkout, A).map((x) => x.rpe), [null, null])
    // an old Failure (5) is not one the review offers → nothing shown picked
    assert.equal(itemEffort(withItemEffort(state().activeWorkout, A, 5), A), '')
  })

  it('failure case: an unknown item, or one with no logged work set, leaves the state as it was', () => {
    const s = state()
    assert.equal(itemEffortState(s, 'nope', 3), s)
    const wuOnly = { activeWorkout: { routineId: 'r', snapshot: { items: [A] }, sets: [set(A, 'wu', '12')] } }
    assert.equal(itemEffortState(wuOnly, 'ia', 3), wuOnly)
  })

  it('effort values: Easy 2 · Medium 3 · Hard 4; Failure 5 still reads "Failure" on an old set', () => {
    assert.deepEqual(EFFORT_OPTIONS.map((o) => [o.label, o.value]), [['Easy', 2], ['Medium', 3], ['Hard', 4]])
    assert.deepEqual(RPE_OPTIONS.map((o) => o.value), [2, 3, 4, 5])
    assert.equal(rpeLabel(5), 'Failure')
  })

  it('nextNotDoneItem: the next not-done item in list order, wrapping; null when none is left', () => {
    const C = { id: 'pc', routineItemId: 'ic', exerciseId: 'ex-c', sets: 1 }
    const w = { snapshot: { items: [A, B, C] }, sets: [], completedItemIds: ['ia'] }
    assert.equal(nextNotDoneItem(w, A), B)
    assert.equal(nextNotDoneItem({ ...w, completedItemIds: ['ia', 'ib'] }, A), C)
    assert.equal(nextNotDoneItem({ ...w, completedItemIds: ['ib', 'ic'] }, C), A, 'wraps to one skipped earlier')
    assert.equal(nextNotDoneItem({ ...w, completedItemIds: ['ia', 'ib', 'ic'] }, C), null)
  })
})

// ---- the set screen (AC1, AC2) ----
describe('AC1 / AC2 — the set screen (render, real store)', () => {
  it('AC1: one Done logs a work set: rpe null and a parseable loggedAt; Skip set records loggedAt too', async () => {
    const t = await harness()
    await t.start()
    await t.mount(t.log(CHEST))
    const before = Date.now()
    await view.click(view.button('Done')) // warm-up
    await view.click(view.button('Done')) // set 1 — one tap
    await view.click(view.button('Skip set')) // set 2
    const sets = t.active().sets
    assert.equal(sets.length, 3)
    assert.deepEqual(sets.map((s) => [s.setType, s.rpe]), [['wu', null], ['work', null], ['work', null]])
    for (const s of sets) {
      const at = Date.parse(s.loggedAt)
      assert.ok(Number.isFinite(at) && at >= before - 1000 && at <= Date.now(), `loggedAt ${s.loggedAt}`)
      assert.equal(new Date(at).toISOString(), s.loggedAt, 'an ISO string')
    }
    assert.equal(sets[2].reps, 'skipped')
  })

  it('AC2: no Previous / Next; a done row opens the sheet; Save changes only that set’s kg/reps; rest unchanged', async () => {
    const t = await harness()
    await t.start()
    await t.mount(t.log(CHEST))
    await view.click(view.button('Done'))
    await view.click(view.button('Done'))
    await view.click(view.button('Done'))
    assert.equal(view.button('Previous'), null)
    assert.equal(view.button('Next'), null)
    const restEndsAt = t.active().restEndsAt
    const before = structuredClone(t.active().sets)
    // upcoming rows are inert; set 1's row opens the sheet
    assert.deepEqual(view.all('.ui-setpreview li').map((li) => Boolean(li.querySelector('button'))), [true, true, true, false])
    await view.click(view.all('.ui-setpreview__tap')[1])
    assert.ok(sheetOf(), 'the edit sheet')
    assert.equal(sheetOf().textContent.includes('Effort'), false, 'no effort in the sheet')
    await view.type(inSheet('kg'), '42,5')
    await view.type(inSheet('Reps'), '7')
    await view.click(sheetButton('Save'))
    const after = t.active().sets
    assert.deepEqual(after[1], { ...before[1], weight: 42.5, reps: '7' }, 'only kg / reps changed (loggedAt kept)')
    assert.deepEqual([after[0], after[2]], [before[0], before[2]], 'other sets untouched')
    assert.equal(t.active().restEndsAt, restEndsAt, 'the rest countdown is the same')
  })

  it('failure case: unreadable kg in the sheet → an inline error, nothing written; Cancel writes nothing', async () => {
    const t = await harness()
    await t.start()
    await t.mount(t.log(CHEST))
    await view.click(view.button('Done'))
    await view.click(view.button('Done'))
    const before = JSON.stringify(t.active().sets)
    await view.click(view.all('.ui-setpreview__tap')[1])
    await view.type(inSheet('kg'), '2,5,5')
    await view.click(sheetButton('Save'))
    assert.ok(sheetOf().querySelector('.ui-field-error'), 'inline kg error')
    assert.equal(JSON.stringify(t.active().sets), before)
    await view.click(sheetButton('Cancel'))
    assert.equal(sheetOf(), null)
    assert.equal(JSON.stringify(t.active().sets), before)
  })
})

// ---- the review (AC3 rendered, AC8) ----
describe('AC3 / AC8 — the exercise review (render, real store)', () => {
  it('last Done → the review (not the overview); Medium → rpe 3 on the work sets only; Next names the next exercise', async () => {
    const t = await harness()
    await t.start()
    await logChest(t)
    assert.equal(window.location.hash, doneHash(CHEST), 'the last Done lands on the review')
    await t.mount(t.review(CHEST))
    assert.match(view.text(), /Chest Press/)
    assert.equal(view.all('[role="radio"]').map((b) => b.textContent).join('|'), 'Easy|Medium|Hard')
    assert.equal(view.all('[role="radio"][aria-checked="true"]').length, 0, 'nothing preselected')
    await view.click(radio('Medium'))
    const chest = t.active().sets.filter((s) => s.routineItemId === CHEST)
    assert.deepEqual(chest.map((s) => [s.setType, s.rpe]), [['wu', null], ['work', 3], ['work', 3], ['work', 3]])
    assert.equal(radio('Medium').getAttribute('aria-checked'), 'true')
    // primary Next: the next not-done exercise after Chest Press in list order
    const next = view.all('a').find((a) => a.textContent.startsWith('Next: '))
    assert.equal(next.textContent, 'Next: Lat Pulldown')
    assert.match(next.className, /primary/)
    assert.ok(view.all('a').find((a) => a.textContent === 'Choose exercise'))
    assert.ok(view.button('Add set'))
  })

  it('a set line on the review opens the same sheet; Save keeps the picked effort on an un-skipped set', async () => {
    const t = await harness()
    await t.start()
    await t.mount(t.log(CHEST))
    await view.click(view.button('Done'))
    await view.click(view.button('Done'))
    await view.click(view.button('Done'))
    await view.click(view.button('Skip set'))
    if (getPendingConfirm()) answerConfirm(false)
    await t.mount(t.review(CHEST))
    await view.click(radio('Easy'))
    assert.deepEqual(t.active().sets.filter((s) => s.routineItemId === CHEST).map((s) => s.rpe), [null, 2, 2, null])
    await view.click(view.all('.ui-setpreview__tap')[3]) // the skipped set 3
    await view.type(inSheet('Reps'), '9')
    await view.click(sheetButton('Save'))
    assert.deepEqual(t.active().sets.filter((s) => s.routineItemId === CHEST).map((s) => [s.reps, s.rpe]), [['12', null], ['12', 2], ['11', 2], ['9', 2]])
  })

  it('effort hidden on a cardio exercise; with no exercise left the primary is Finish', async () => {
    const t = await harness()
    await t.start()
    await act(async () => {
      const items = t.active().snapshot.items
      t.captured.store.patchActive({ completedItemIds: items.map(itemKey).filter((k) => k !== ROWING) })
    })
    await act(async () =>
      t.captured.store.completeSet({ routineItemId: ROWING, exerciseId: 'ex-rowing', setType: 'work', weight: 0, reps: '', durationSec: 420, rpe: null, note: '' }),
    )
    await t.mount(t.review(ROWING))
    assert.equal(view.all('[role="radio"]').length, 0, 'no effort on cardio')
    const finish = view.all('a').find((a) => a.textContent === 'Finish')
    assert.ok(finish, 'Finish when nothing is left')
    assert.equal(view.all('a').some((a) => a.textContent.startsWith('Next: ')), false)
  })

  it('AC8: the routine-kg confirm opens over the review (stayOn = the review path), same words', async () => {
    const t = await harness()
    await t.start()
    window.location.hash = `#/workout/sess-upper/item/${CHEST}/log`
    await t.mount(t.log(CHEST))
    await view.click(view.button('Done')) // warm-up
    for (let i = 0; i < 3; i++) {
      await view.type(view.input('kg'), '50')
      await view.click(view.button('Done'))
    }
    const pending = getPendingConfirm()
    assert.ok(pending, 'the sheet is open')
    assert.equal(pending.title, 'Use 50 kg next time?')
    assert.equal(pending.stayOn, `/workout/sess-upper/item/${CHEST}/done`)
    assert.equal(window.location.hash, doneHash(CHEST))
    assert.equal(navigationCancels(pending, window.location.hash), false, 'landing on the review keeps it open')
    assert.equal(navigationCancels(pending, '#/workout/sess-upper'), true, 'any other screen answers it')
    await act(async () => answerConfirm(false))
  })
})

// ---- the progression chain (AC4, AC5) ----
describe('AC4 / AC5 — the review effort through the real progressionForItem', () => {
  async function finished(effortLabel) {
    const t = await harness()
    await t.start()
    await logChest(t)
    await t.mount(t.review(CHEST))
    if (effortLabel) await view.click(radio(effortLabel))
    // "Next" from the review is navigation only: nothing more is written.
    await act(async () => t.captured.store.finishWorkout({}))
    const workout = t.captured.store.workouts.find((w) => w.routineId === 'sess-upper' && w.sets.some((s) => s.loggedAt))
    const item = workout.snapshot.items.find((i) => itemKey(i) === CHEST)
    return { t, workout, item }
  }

  it('AC4 failure case — no effort picked: the sets keep rpe null and recalc says Same load (kg unchanged)', async () => {
    const { t, workout, item } = await finished(null)
    const work = workout.sets.filter((s) => s.routineItemId === CHEST && s.setType === 'work')
    assert.deepEqual(work.map((s) => s.rpe), [null, null, null])
    const core = progressionForItem(t.captured.store.exercises, workout, item)
    assert.equal(core.recommendation.action, 'keep')
    assert.equal(core.recommendation.reason, 'Same load.')
    assert.deepEqual(core.to, work.map((s) => s.weight))
  })

  it('AC5 — Easy on the review: recalc moves each set one valid step up (real chain, no stubbed rpe), and writes it to the routine', async () => {
    const { t, workout, item } = await finished('Easy')
    const work = workout.sets.filter((s) => s.routineItemId === CHEST && s.setType === 'work')
    assert.deepEqual(work.map((s) => s.rpe), [2, 2, 2], 'the review wrote Easy (2) on each work set')
    const exercise = t.captured.store.exercises.find((e) => e.id === 'ex-chest-press')
    const up = work.map((s) => moveToValidWeight(Number(s.weight), exercise, 1))
    assert.ok(up.every((kg, i) => kg > work[i].weight), `one step up: ${work.map((s) => s.weight)} → ${up}`)
    const core = progressionForItem(t.captured.store.exercises, workout, item)
    assert.equal(core.recommendation.action, 'up')
    assert.deepEqual(core.to, up)
    await act(async () => t.captured.store.recalculateFuturePlans(workout.id))
    const routineItem = t.captured.store.routines.find((r) => r.id === 'sess-upper').exercises.find((e) => e.id === CHEST)
    assert.deepEqual(routineItem.suggestedWeights, up)
  })
})

// ---- old data (AC6) and the backup round trip (AC7) ----
describe('AC6 — an old workout with per-set rpe 5', () => {
  it('loads unchanged, reads "Failure" in History, and recalc still moves it down', async () => {
    const old = structuredClone(DB)
    const w = old.workouts.find((x) => x.id === 'wo-w42-sess-upper')
    for (const s of w.sets) if (s.exerciseId === 'ex-chest-press' && s.setType === 'work') s.rpe = 5
    const t = await harness(old)
    const loaded = t.captured.store.workouts.find((x) => x.id === 'wo-w42-sess-upper')
    const work = loaded.sets.filter((s) => s.exerciseId === 'ex-chest-press' && s.setType === 'work')
    assert.ok(work.length > 0)
    assert.deepEqual(work.map((s) => s.rpe), work.map(() => 5), 'rpe 5 survives load')
    assert.equal(work.some((s) => 'loggedAt' in s), false, 'no loggedAt invented on old sets')
    for (const s of work) assert.match(formatSetLine(s), /· Failure$/)
    const item = loaded.snapshot.items.find((i) => i.exerciseId === 'ex-chest-press')
    const core = progressionForItem(t.captured.store.exercises, loaded, item)
    assert.equal(core.recommendation.action, 'down')
  })
})

describe('AC7 — Export → Import keeps loggedAt and the review-written rpe', () => {
  it('a finished and an active workout round-trip through buildBackup / applyBackup', async () => {
    const t = await harness()
    await t.start()
    await logChest(t)
    await t.mount(t.review(CHEST))
    await view.click(radio('Hard'))
    await act(async () => t.captured.store.finishWorkout({}))
    await t.start()
    await t.mount(t.log(CHEST))
    await view.click(view.button('Done'))
    await view.click(view.button('Done'))
    await act(async () => t.captured.store.setItemEffort(CHEST, 3))
    const state = { ...t.captured.store }
    const pick = (sets) => sets.filter((s) => s.loggedAt).map(({ loggedAt, rpe, setType }) => ({ loggedAt, rpe, setType }))
    const finishedBefore = pick(state.workouts.find((w) => w.sets.some((s) => s.loggedAt)).sets)
    const activeBefore = pick(state.activeWorkout.sets)
    assert.equal(finishedBefore.filter((s) => s.rpe === 4).length, 3)
    const file = JSON.parse(JSON.stringify(buildBackup(state)))
    const restored = applyBackup(file).state
    assert.deepEqual(pick(restored.workouts.find((w) => w.sets.some((s) => s.loggedAt)).sets), finishedBefore)
    assert.deepEqual(pick(restored.activeWorkout.sets), activeBefore)
    assert.deepEqual(activeBefore.map((s) => s.rpe), [null, 3])
  })
})
