// req-192 (DEC-108 §1–3, §6) — the set screen: four effort buttons LOG the set (no Complete, no
// preselection), "Done" where effort is hidden, Medium / Failure labels, a viewed logged set
// shows its effort selected, the pill skips the rest on its own exercise (opens it elsewhere),
// the set list sits above kg, and the routine's exercise note shows. Rendered against the real
// store (happy-dom), as req-186/191.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { importJsx, render, act } from './test-support/render.js'
import { RPE_OPTIONS, formatSetLine, rpeLabel } from './ids.js'

const h = React.createElement
const DB = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
const CHEST = 'si-sess-upper-1-ex-chest-press' // machine: a warm-up + 3 work sets, 90 s rest
const ROWING = 'si-sess-upper-0-ex-rowing' // cardio: no effort

let view = null
afterEach(async () => {
  await view?.unmount()
  view = null
})

async function harness() {
  const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
  const { useStore } = await import('./store-context.js')
  localStorage.clear()
  localStorage.setItem('workout-mvp-v8', JSON.stringify({ ...DB, activeWorkout: null }))
  const captured = {}
  function Screen({ child }) {
    // oxlint-disable-next-line react/immutability
    captured.store = useStore()
    return child
  }
  const mount = async (child) => {
    await view?.unmount()
    view = await render(h(StoreProvider, null, h(Screen, { child })))
  }
  await mount(null)
  await act(async () => captured.store.startWorkout('sess-upper'))
  const { WorkoutItemLog } = await importJsx('./views/workout/item.jsx', import.meta.url)
  const item = (itemId) => h(WorkoutItemLog, { routineId: 'sess-upper', itemId })
  return { captured, mount, item, active: () => captured.store.activeWorkout }
}

describe('labels (DEC-108 §2) — values unchanged', () => {
  it('Easy 2 · Medium 3 · Hard 4 · Failure 5; stored 3 / 5 read Medium / Failure', () => {
    assert.deepEqual(RPE_OPTIONS.map((o) => [o.label, o.value]), [['Easy', 2], ['Medium', 3], ['Hard', 4], ['Failure', 5]])
    assert.equal(rpeLabel(3), 'Medium')
    assert.equal(rpeLabel(5), 'Failure')
    assert.equal(formatSetLine({ setType: 'work', weight: 40, reps: '8', rpe: 5 }), '40 kg × 8 · Failure') // req-209 test edit: one set format "{kg} kg × {reps}" (§3), was " · "
  })
})

// req-212 test edit (DEC-119 §1, supersedes DEC-108 §1–2) — the four effort buttons are gone from
// the set screen: one Done logs every set (Enter too), and no effort is submitted. The kg
// failure case is unchanged (Done in place of Medium).
describe('SetLogForm — one Done logs the set (req-212; was: effort buttons log it)', () => {
  it('no effort buttons, no caption; Done logs { weight, reps, durationSec }; Enter logs too', async () => {
    const { SetLogForm } = await importJsx('./ui/index.jsx', import.meta.url)
    const got = []
    view = await render(h(SetLogForm, { initialWeight: '40', initialReps: '8', onComplete: (v) => got.push(v) }))
    for (const label of ['Easy', 'Medium', 'Hard', 'Failure', 'Complete', 'Previous', 'Next']) assert.equal(view.button(label), null, label)
    assert.doesNotMatch(view.text(), /how did it feel/)
    assert.match(view.button('Done').className, /ui-btn--primary/)
    assert.match(view.button('Skip set').className, /ui-btn--quiet/)
    await view.click(view.button('Done'))
    await act(async () => view.container.querySelector('form').requestSubmit())
    assert.deepEqual(got, [
      { weight: '40', reps: '8', durationSec: undefined },
      { weight: '40', reps: '8', durationSec: undefined },
    ])
  })

  it('failure case: kg "2,5,5" → Done → inline kg error, nothing logged', async () => {
    const { SetLogForm } = await importJsx('./ui/index.jsx', import.meta.url)
    const got = []
    view = await render(h(SetLogForm, { initialWeight: '2,5,5', initialReps: '8', onComplete: (v) => got.push(v) }))
    await view.click(view.button('Done'))
    assert.equal(got.length, 0)
    assert.ok(view.container.querySelector('.ui-field-error'), 'inline kg error shown')
  })
})

describe('the log screen (real store)', () => {
  // req-212 test edit — the work set logs with Done (rpe null), was Hard (rpe 4).
  it('warm-up "Done" → rpe null; work "Done" → rpe null and rest armed; set list above kg; routine note shown', async () => {
    const t = await harness()
    await t.mount(t.item(CHEST))
    const c = view.container
    assert.match(view.text(), /Controlled, near failure/, 'the routine note')
    const list = c.querySelector('.ui-setpreview')
    const kg = view.input('kg')
    assert.ok(list.compareDocumentPosition(kg) & 4, 'the set list precedes the kg box')
    await view.click(view.button('Done'))
    await view.click(view.button('Done'))
    const sets = t.active().sets.map(({ setType, rpe }) => ({ setType, rpe }))
    assert.deepEqual(sets, [{ setType: 'wu', rpe: null }, { setType: 'work', rpe: null }])
    assert.ok(t.active().restEndsAt > Date.now(), 'rest armed')
    assert.equal(view.button('Complete'), null)
    assert.equal(view.button('Skip rest'), null)
  })

  it('a cardio set shows "Done" and logs rpe null', async () => {
    const t = await harness()
    await t.mount(t.item(ROWING))
    assert.equal(view.button('Medium'), null)
    // req-194 test edit — a cardio set now logs a Duration (stopwatch or typed), required:
    // Done with it blank logs nothing; with one typed it logs, rpe still null.
    await view.click(view.button('Done'))
    assert.equal((t.active().sets || []).length, 0)
    await view.type(view.input('Duration'), '7:00')
    await view.click(view.button('Done'))
    assert.equal(t.active().sets[0].rpe, null)
  })

  // req-212 test edit (DEC-119 §1) — was "a viewed logged set shows its effort selected; another
  // effort + Save writes it": the logged set now opens in the edit sheet, which has no effort
  // (the exercise review carries the one effort). A stored rpe is kept by a sheet Save.
  it('a logged set opens in the edit sheet with no effort control; Save keeps its stored rpe; rest untouched', async () => {
    const t = await harness()
    await t.mount(t.item(CHEST))
    await view.click(view.button('Done'))
    await view.click(view.button('Done'))
    await act(async () => t.captured.store.updateActiveSet(1, { rpe: 5 }))
    const restEndsAt = t.active().restEndsAt
    await view.click(view.all('.ui-setpreview__tap')[1])
    const sheet = view.container.querySelector('[role="dialog"]')
    assert.ok(sheet)
    for (const label of ['Easy', 'Medium', 'Hard', 'Failure']) {
      assert.equal([...sheet.querySelectorAll('button')].some((b) => b.textContent.trim() === label), false, label)
    }
    await view.click([...sheet.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Save'))
    assert.equal(t.active().sets[1].rpe, 5)
    assert.equal(t.active().sets.length, 2)
    assert.equal(t.active().restEndsAt, restEndsAt)
  })

  it('pill: on its own exercise while resting → "skip", tap clears restEndsAt; from the overview → opens the exercise', async () => {
    const t = await harness()
    await t.mount(t.item(CHEST))
    await view.click(view.button('Done'))
    await view.click(view.button('Done')) // req-212 test edit: one Done (was Medium)
    let pill = view.container.querySelector('.ui-restpill')
    assert.match(pill.textContent, /·skip$/)
    assert.match(pill.getAttribute('aria-label'), /skip the rest/)
    await view.click(pill)
    assert.equal(t.active().restEndsAt, null)
    assert.equal(t.active().restPausedRemaining, null)

    // Rest again, then the same pill from the overview opens the exercise (rest untouched).
    await view.click(view.button('Done')) // req-212 test edit: one Done (was Medium)
    const restEndsAt = t.active().restEndsAt
    assert.ok(restEndsAt > Date.now())
    const { Workout } = await importJsx('./views/workout/overview.jsx', import.meta.url)
    window.location.hash = '#/workout/sess-upper'
    await t.mount(h(Workout, { routineId: 'sess-upper' }))
    pill = view.container.querySelector('.ui-restpill')
    assert.match(pill.textContent, /set \d\/\d$/)
    await view.click(pill)
    assert.equal(window.location.hash, `#/workout/sess-upper/item/${CHEST}/log`)
    assert.equal(t.active().restEndsAt, restEndsAt, 'opening does not skip')
  })
})
