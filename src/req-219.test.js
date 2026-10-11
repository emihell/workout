// req-219 (DEC-122 §2) — "Last time: X kg" shows whenever history's kg at this set differs from
// the routine kg (blank included); same kg → no note. A unilateral library entry shows
// "One side at a time — …" under the exercise head on the log screen and the review.
// Display only: nothing here writes stored data.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { act, importJsx, render } from './test-support/render.js'
import { kgHints } from './kg-hints.js'
import { ONE_SIDE_LINE } from './library-hints.js'

const h = React.createElement
const DB = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))

describe('req-219 — kgHints.lastTime (criteria 1–2)', () => {
  const w = (routineKg, lastKg, kg = '') => kgHints({ weighted: true, kg, routineKg, lastKg })
  it('routine 30, last 35 → 35; routine 35, last 35 → null; routine blank, last 35 → 35; no history → null', () => {
    assert.equal(w(30, '35').lastTime, 35)
    assert.equal(w(35, '35').lastTime, null)
    assert.equal(w('', '35').lastTime, 35)
    assert.equal(w(0, '35').lastTime, 35, '0 = no weight (req-113)')
    assert.equal(w(30, '').lastTime, null)
    assert.equal(w('', '').lastTime, null)
  })
  it('failure case: equal routine kg hides the note although history exists — the comparison answers, not presence', () => {
    assert.equal(w(35, '35').lastTime, null)
    assert.equal(w('35', '35,0').lastTime, null, 'string / comma forms compare as numbers')
    assert.equal(w(22.5, '22.5').lastTime, null)
    // The typed kg does not drive it: typing the last-time number keeps the note (routine 30).
    assert.equal(w(30, '35', '35').lastTime, 35)
    assert.equal(w(35, '35', '50').lastTime, null)
  })
  it('bigJumpFrom unchanged: reference stays the routine kg when set', () => {
    assert.equal(w(30, '35', '50').bigJumpFrom, 30)
    assert.equal(w(30, '35', '40').bigJumpFrom, null)
  })
  it('unweighted / warm-up → no hints (as before)', () => {
    assert.equal(kgHints({ weighted: false, kg: '', routineKg: 30, lastKg: '35' }).lastTime, null)
    assert.equal(kgHints({ weighted: true, kg: '', routineKg: undefined, lastKg: '35' }).lastTime, null)
  })
})

// ---- Rendered against the real store (one StoreProvider, screens swapped inside — L-051) ----
let view = null
afterEach(async () => {
  await view?.unmount()
  view = null
})
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

async function harness(routineId, payload = DB) {
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
  await act(async () => captured.store.startWorkout(routineId))
  const show = async (child) => {
    await act(async () => captured.setChild(child))
    await settle()
  }
  return {
    captured,
    log: (itemId) => show(h(WorkoutItemLog, { routineId, itemId })),
    review: (itemId) => show(h(WorkoutItemDone, { routineId, itemId })),
  }
}

const notes = () => view.all('.ui-field-note').map((n) => n.textContent)

describe('req-219 — the last-time note on the log screen (criterion 3)', () => {
  // Fixture: Leg Curl routine kg [30, 30, 25], last workout [30, 30, 30].
  const CURL = 'si-sess-lower-3-ex-leg-curl'
  it('set 1 routine 30 = last 30 → no note; set 3 routine 25 ≠ last 30 → "Last time: 30 kg" under the box', async () => {
    const t = await harness('sess-lower')
    await t.log(CURL)
    if (view.text().includes('Warm-up set')) await view.click(view.button('Done'))
    assert.equal(view.input('kg').value, '30')
    assert.equal(/last time/i.test(view.text()), false, 'same kg → no note')
    await view.click(view.button('Done')) // set 1
    const skip = view.container.querySelector('.ui-restpill')
    if (skip) await view.click(skip)
    await view.click(view.button('Done')) // set 2
    const skip2 = view.container.querySelector('.ui-restpill')
    if (skip2) await view.click(skip2)
    assert.equal(view.input('kg').value, '25', 'box keeps the routine kg — no prefill change')
    assert.deepEqual(notes(), ['Last time: 30 kg'])
    const sets = t.captured.store.activeWorkout.sets.filter((s) => s.setType === 'work')
    assert.deepEqual(sets.map((s) => Number(s.weight)), [30, 30])
  })
})

describe('req-219 — one side at a time (criterion 4)', () => {
  const ROW = 'si-sess-push-pull-2-ex-one-arm-db-row'
  const PRESS = 'si-sess-push-pull-3-ex-overhead-db-press'
  const lineNodes = () => view.all('.ui-sub').filter((n) => n.textContent === ONE_SIDE_LINE)

  it('One-Arm DB Row: the line on the log screen and the review, kg label stays "kg per dumbbell"; Overhead DB Press: none', async () => {
    const t = await harness('sess-push-pull')
    await t.log(ROW)
    assert.equal(lineNodes().length, 1, 'log screen')
    const head = view.container.querySelector('.ui-exercise-head')
    assert.ok(head.compareDocumentPosition(lineNodes()[0]) & 4, 'under the exercise head')
    assert.ok(view.all('label').some((n) => n.textContent.trim().startsWith('kg per dumbbell')))
    await t.review(ROW)
    assert.equal(lineNodes().length, 1, 'review')
    await t.log(PRESS)
    assert.equal(view.text().includes(ONE_SIDE_LINE), false)
    await t.review(PRESS)
    assert.equal(view.text().includes(ONE_SIDE_LINE), false)
  })

  it('no library entry (renamed, no libraryId) → no line', async () => {
    const payload = structuredClone(DB)
    const ex = payload.exercises.find((x) => x.id === 'ex-one-arm-db-row')
    ex.name = 'Mystery Lever'
    delete ex.libraryId
    const t = await harness('sess-push-pull', payload)
    await t.log(ROW)
    assert.equal(view.text().includes(ONE_SIDE_LINE), false)
    await t.review(ROW)
    assert.equal(view.text().includes(ONE_SIDE_LINE), false)
  })
})
