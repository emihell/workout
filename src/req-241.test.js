// req-241 (DEC-137) — the log screen names what's next ("Next: {name}" under the set list, not
// while the Up next bar shows), and a done set's sheet offers "Skip set": the set becomes a skip
// record through the same writes as Save, with the session carry re-run (DEC-052).
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { act, importJsx, render } from './test-support/render.js'
import { skippedSetSave } from './views/set-values.js'
import { seedOverrideKey } from './workout-log.js'
import { clearArrival, markArrival } from './up-next.js'

const h = React.createElement
const DB = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
const R = 'sess-upper'
const KEYS = ['si-sess-upper-1-ex-chest-press', 'si-sess-upper-2-ex-lat-pulldown', 'si-sess-upper-3-ex-shoulder-press', 'si-sess-upper-4-ex-biceps-curl']
const CHEST = 'ex-chest-press::work'

// Upper Body trimmed to 4 weighted items, no warm-ups; Chest Press is 2 × 12 at the routine's 30 kg.
function fourItems() {
  const data = structuredClone(DB)
  const r = data.routines.find((x) => x.id === R)
  const [, chest, lat, shoulder, biceps] = r.exercises
  r.exercises = [{ ...chest, sets: 2, targets: ['12', '12'], suggestedWeights: [30, 30] }, lat, shoulder, biceps].map((i) => ({ ...i, warmup: null }))
  return data
}

describe('req-241 — skippedSetSave: the skip record and the carry re-run (pure)', () => {
  const work = (weight, extra = {}) => ({ routineItemId: 'a', exerciseId: 'ex', setType: 'work', weight, reps: '12', rpe: 3, note: '', loggedAt: 'T', ...extra })
  const key = seedOverrideKey('ex', 'work')
  it('the patch is the skip record; loggedAt / targets are not in it (kept); a timed / cardio value goes', () => {
    const { setPatch } = skippedSetSave({ weighted: true, set: work(40), seedOverrides: {}, sets: [work(40)], setIndex: 0 })
    assert.deepEqual(setPatch, { weight: 0, reps: 'skipped', note: 'skipped', rpe: null })
    const timed = skippedSetSave({ weighted: false, set: work(0, { reps: '', durationSec: 30 }), sets: [], setIndex: 0 }).setPatch
    assert.ok('durationSec' in timed && timed.durationSec === undefined)
  })
  it('set 1 carried 40 and is skipped → the carry goes (set 2 seeds from the routine again)', () => {
    const map = { [key]: { weight: '40' }, 'other::work': { weight: '9' } }
    const out = skippedSetSave({ weighted: true, set: work(40), seedOverrides: map, sets: [work(40)], setIndex: 0 }).seedOverrides
    assert.deepEqual(out, { 'other::work': { weight: '9' } })
  })
  it('right mechanism: set 1 at 40 and set 2 at 40, set 2 skipped → the carry stays 40 (set 1 is still its source)', () => {
    const map = { [key]: { weight: '40' } }
    const sets = [work(40), work(40)]
    assert.equal(skippedSetSave({ weighted: true, set: sets[1], seedOverrides: map, sets, setIndex: 1 }).seedOverrides, map)
  })
  it('set 1 at 30, set 2 changed to 40 then skipped → the carry falls back to set 1’s 30', () => {
    const sets = [work(30), work(40)]
    const out = skippedSetSave({ weighted: true, set: sets[1], seedOverrides: { [key]: { weight: '40' } }, sets, setIndex: 1 }).seedOverrides
    assert.deepEqual(out, { [key]: { weight: '30' } })
  })
  it('an earlier set, a set that is not the carry’s kg, or no carry → the SAME map', () => {
    const map = { [key]: { weight: '40' } }
    const sets = [work(40), work(45)]
    assert.equal(skippedSetSave({ weighted: true, set: sets[0], seedOverrides: map, sets, setIndex: 0 }).seedOverrides, map)
    assert.equal(skippedSetSave({ weighted: true, set: work(35), seedOverrides: map, sets: [work(35)], setIndex: 0 }).seedOverrides, map)
    assert.equal(skippedSetSave({ weighted: true, set: work(35), seedOverrides: undefined, sets: [work(35)], setIndex: 0 }).seedOverrides, undefined)
  })
  it('a stale reps override on the key is passed through (DEC-052), only the weight goes', () => {
    const out = skippedSetSave({ weighted: true, set: work(40), seedOverrides: { [key]: { weight: '40', reps: '8' } }, sets: [work(40)], setIndex: 0 }).seedOverrides
    assert.deepEqual(out, { [key]: { reps: '8' } })
  })
})

// ---- Rendered against the real store (one StoreProvider, screens swapped inside — L-051) ----
let view = null
afterEach(async () => {
  await view?.unmount()
  view = null
  clearArrival()
})
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

async function harness(payload) {
  const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
  const { useStore } = await import('./store-context.js')
  const { WorkoutItemLog, WorkoutItemDone } = await importJsx('./views/workout/item.jsx', import.meta.url)
  const { DEVICE_FILL_KEY } = await import('./routine-kg-fill.js')
  localStorage.clear()
  localStorage.setItem(DEVICE_FILL_KEY, '2026-09-26T00:00:00.000Z')
  localStorage.setItem('workout-mvp-v8', JSON.stringify({ ...payload, activeWorkout: null }))
  const captured = {}
  function Host() {
    const [child, setChild] = React.useState(null)
    // oxlint-disable-next-line react/immutability
    captured.setChild = setChild
    return h(StoreProvider, null, h(Screen, { child }))
  }
  function Screen({ child }) {
    // oxlint-disable-next-line react/immutability
    captured.store = useStore()
    return child
  }
  view = await render(h(Host))
  const show = async (child) => {
    await act(async () => captured.setChild(child))
    await settle()
  }
  return {
    captured,
    stored: () => JSON.parse(localStorage.getItem('workout-mvp-v9')).activeWorkout,
    start: () => act(async () => captured.store.startWorkout(R)),
    log: (itemId) => show(h(WorkoutItemLog, { key: `log-${itemId}`, routineId: R, itemId })),
    review: (itemId) => show(h(WorkoutItemDone, { key: `done-${itemId}`, routineId: R, itemId })),
  }
}
const nextLine = () => view.all('p.ui-sub').find((p) => p.textContent.startsWith('Next: '))?.textContent ?? null
const button = (label) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === label) ?? null
// DOM nodes are asserted as booleans: a failing assert.equal on a happy-dom node hangs printing it.
// The sheet's own buttons: on the log screen the form underneath has its own Skip set.
const sheetButton = (label) => [...(view.container.querySelector('.ui-sheet')?.querySelectorAll('button') || [])].find((b) => b.textContent.trim() === label) ?? null
const rowTaps = () => view.all('.ui-setpreview__tap')
const kgInput = () => view.input('kg')

describe('req-241 — the Next line on the log screen (criteria 1–2)', () => {
  it('exercise 2 of 4, a set logged → "Next: Shoulder Press"; the last not-done exercise → no line', async () => {
    const t = await harness(fourItems())
    await t.start()
    await t.log(KEYS[1])
    await view.click(button('Done'))
    await settle()
    assert.equal(nextLine(), 'Next: Shoulder Press')
    for (const k of [KEYS[0], KEYS[2], KEYS[3]]) await act(async () => t.captured.store.skipItem(k))
    await settle()
    assert.ok(button('Done'), 'still on Lat Pulldown’s log screen')
    assert.equal(nextLine(), null)
  })
  it('arriving from Start (the Up next bar showing) → no Next line until the bar goes', async () => {
    const t = await harness(fourItems())
    markArrival(R, { routineItemId: KEYS[0] })
    await t.start()
    await t.log(KEYS[0])
    assert.ok(view.container.querySelector('.ui-up-next'), 'the bar shows')
    assert.equal(nextLine(), null)
    await view.click(button('Start now'))
    await settle()
    assert.equal(Boolean(view.container.querySelector('.ui-up-next')), false)
    assert.equal(nextLine(), 'Next: Lat Pulldown')
  })
})

describe('req-241 — Skip set in a done set’s sheet (criteria 3–5)', () => {
  it('review → tap set 1 → Skip set → the row reads "· skipped"; stored reps "skipped", loggedAt kept; its sheet has no Skip set', async () => {
    const t = await harness(fourItems())
    await t.start()
    await t.log(KEYS[0])
    await view.click(button('Done'))
    await view.click(button('Done'))
    await settle()
    await t.review(KEYS[0])
    const before = t.stored().sets[0]
    assert.equal(before.reps, '12')
    await view.click(rowTaps()[0])
    assert.ok(sheetButton('Skip set'), 'a done set offers Skip set')
    await view.click(sheetButton('Skip set'))
    await settle()
    assert.equal(Boolean(view.container.querySelector('.ui-sheet')), false, 'the sheet closed')
    const after = t.stored().sets[0]
    assert.equal(after.reps, 'skipped')
    assert.equal(after.note, 'skipped')
    assert.equal(after.weight, 0)
    assert.equal(after.rpe, null)
    assert.equal(after.loggedAt, before.loggedAt, 'loggedAt unchanged')
    assert.equal(t.stored().sets[1].reps, '12', 'set 2 untouched')
    assert.match(view.all('.ui-setpreview li')[0].textContent, /· skipped/)
    // Criterion 5 — the skipped set's sheet: no Skip set (fill in + Save un-skips, as before).
    await view.click(rowTaps()[0])
    assert.ok(view.container.querySelector('.ui-sheet'), 'the sheet is open')
    assert.equal(Boolean(sheetButton('Skip set')), false, 'no Skip set on a skipped set')
    assert.ok(sheetButton('Save'))
  })

  it('failure / right mechanism: set 1 logged at 40 (routine 30) then skipped on the log screen → set 2 prefills the routine’s 30, not 40', async () => {
    const t = await harness(fourItems())
    await t.start()
    await t.log(KEYS[0])
    assert.equal(kgInput().value, '30', 'set 1 from the routine')
    await view.type(kgInput(), '40')
    await view.click(button('Done'))
    await settle()
    assert.deepEqual(t.stored().seedOverrides[CHEST], { weight: '40' }, 'the carry: set 1’s 40')
    assert.equal(kgInput().value, '40', 'control: set 2 seeds from the carry')
    await view.click(rowTaps()[0])
    await view.click(sheetButton('Skip set'))
    await settle()
    assert.equal(t.stored().sets[0].reps, 'skipped')
    assert.equal(CHEST in (t.stored().seedOverrides || {}), false, 'the carry is gone (seed source: the routine kg)')
    assert.equal(kgInput().value, '30', 'set 2: the routine’s 30')
  })

  it('kg typed into set 2 (not yet logged) survives the re-seed: the draft is written before the sheet opens', async () => {
    const t = await harness(fourItems())
    await t.start()
    await t.log(KEYS[0])
    await view.type(kgInput(), '40')
    await view.click(button('Done'))
    await settle()
    await view.type(kgInput(), '45') // set 2, inside the 300 ms draft debounce
    await view.click(rowTaps()[0])
    await view.click(sheetButton('Skip set'))
    await settle()
    assert.equal(CHEST in (t.stored().seedOverrides || {}), false)
    assert.equal(kgInput().value, '45', 'the typing is kept')
  })
})
