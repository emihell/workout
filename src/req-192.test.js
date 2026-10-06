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
    assert.equal(formatSetLine({ setType: 'work', weight: 40, reps: '8', rpe: 5 }), '40 kg · 8 · Failure')
  })
})

describe('SetLogForm — effort buttons log the set', () => {
  it('each button logs with its value; none preselected; no Complete; Enter logs nothing', async () => {
    const { SetLogForm } = await importJsx('./ui/index.jsx', import.meta.url)
    for (const [label, value] of [['Easy', 2], ['Medium', 3], ['Hard', 4], ['Failure', 5]]) {
      const got = []
      view = await render(h(SetLogForm, { initialWeight: '40', initialReps: '8', effortOptions: RPE_OPTIONS, onComplete: (v) => got.push(v) }))
      assert.equal(view.button('Complete'), null)
      assert.equal(view.button('Done'), null)
      assert.equal(view.all('[aria-pressed]').length, 0, 'no selection state on the current set')
      assert.match(view.text(), /Log set — how did it feel\?/)
      // Enter (form submit) has no effort to log with.
      await act(async () => view.container.querySelector('form').requestSubmit())
      assert.equal(got.length, 0)
      await view.click(view.button(label))
      assert.deepEqual(got, [{ weight: '40', reps: '8', effort: value, durationSec: undefined }])
      await view.unmount()
      view = null
    }
  })

  it('failure case: kg "2,5,5" → Medium → inline kg error, nothing logged', async () => {
    const { SetLogForm } = await importJsx('./ui/index.jsx', import.meta.url)
    const got = []
    view = await render(h(SetLogForm, { initialWeight: '2,5,5', initialReps: '8', effortOptions: RPE_OPTIONS, onComplete: (v) => got.push(v) }))
    await view.click(view.button('Medium'))
    assert.equal(got.length, 0)
    assert.ok(view.container.querySelector('.ui-field-error'), 'inline kg error shown')
  })

  it('effort hidden → one "Done", logs effort null; Enter logs too', async () => {
    const { SetLogForm } = await importJsx('./ui/index.jsx', import.meta.url)
    const got = []
    view = await render(h(SetLogForm, { showEffort: false, initialWeight: '10', initialReps: '12', onComplete: (v) => got.push(v) }))
    assert.equal(view.button('Medium'), null)
    await view.click(view.button('Done'))
    await act(async () => view.container.querySelector('form').requestSubmit())
    assert.deepEqual(got.map((v) => v.effort), [null, null])
  })
})

describe('the log screen (real store)', () => {
  it('warm-up "Done" → rpe null; Hard → rpe 4 and rest armed; set list above kg; routine note shown', async () => {
    const t = await harness()
    await t.mount(t.item(CHEST))
    const c = view.container
    assert.match(view.text(), /Controlled, near failure/, 'the routine note')
    const list = c.querySelector('.ui-setpreview')
    const kg = view.input('kg')
    assert.ok(list.compareDocumentPosition(kg) & 4, 'the set list precedes the kg box')
    await view.click(view.button('Done'))
    await view.click(view.button('Hard'))
    const sets = t.active().sets.map(({ setType, rpe }) => ({ setType, rpe }))
    assert.deepEqual(sets, [{ setType: 'wu', rpe: null }, { setType: 'work', rpe: 4 }])
    assert.ok(t.active().restEndsAt > Date.now(), 'rest armed')
    assert.equal(view.button('Complete'), null)
    assert.equal(view.button('Skip rest'), null)
  })

  it('a cardio set shows "Done" and logs rpe null', async () => {
    const t = await harness()
    await t.mount(t.item(ROWING))
    assert.equal(view.button('Medium'), null)
    await view.click(view.button('Done'))
    assert.equal(t.active().sets[0].rpe, null)
  })

  it('a viewed logged set shows its effort selected; another effort + Save writes it; rest untouched', async () => {
    const t = await harness()
    await t.mount(t.item(CHEST))
    await view.click(view.button('Done'))
    await view.click(view.button('Failure'))
    const restEndsAt = t.active().restEndsAt
    await view.click(view.button('Previous'))
    assert.equal(view.button('Failure').getAttribute('aria-pressed'), 'true')
    assert.equal(view.all('[aria-pressed="true"]').length, 1)
    assert.equal(t.active().sets.length, 2, 'selecting does not log')
    await view.click(view.button('Easy'))
    assert.equal(t.active().sets[1].rpe, 5, 'not written until Save')
    await view.click(view.button('Save'))
    assert.equal(t.active().sets[1].rpe, 2)
    assert.equal(t.active().sets.length, 2)
    assert.equal(t.active().restEndsAt, restEndsAt)
  })

  it('pill: on its own exercise while resting → "skip", tap clears restEndsAt; from the overview → opens the exercise', async () => {
    const t = await harness()
    await t.mount(t.item(CHEST))
    await view.click(view.button('Done'))
    await view.click(view.button('Medium'))
    let pill = view.container.querySelector('.ui-restpill')
    assert.match(pill.textContent, /·skip$/)
    assert.match(pill.getAttribute('aria-label'), /skip the rest/)
    await view.click(pill)
    assert.equal(t.active().restEndsAt, null)
    assert.equal(t.active().restPausedRemaining, null)

    // Rest again, then the same pill from the overview opens the exercise (rest untouched).
    await view.click(view.button('Medium'))
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
