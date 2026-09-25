// req-173 (DEC-093) — a weighted set with an empty kg box shows a quiet "No weight
// entered" note under it; Complete still logs it in one tap, exactly as before (weight 0).
// Render tests: the real SetLogForm, and the real live log screen over the real store.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { act, importJsx, render } from './test-support/render.js'

const { SetLogForm } = await importJsx('./ui/index.jsx', import.meta.url)
const { RPE_OPTIONS } = await import('./ids.js')

const h = React.createElement
const NOTE = 'No weight entered'
let view
afterEach(async () => {
  await view?.unmount()
  view = null
})

function form(props) {
  return h(SetLogForm, { showEffort: true, effortOptions: RPE_OPTIONS, initialReps: '10', ...props })
}

describe('SetLogForm — the "No weight entered" note', () => {
  it('weighted + blank kg → the note shows; typing a kg hides it; clearing brings it back', async () => {
    view = await render(form({ weighted: true, initialWeight: '' }))
    assert.equal(view.text().includes(NOTE), true)
    await view.type(view.input('kg'), '22,5')
    assert.equal(view.text().includes(NOTE), false)
    await view.type(view.input('kg'), '  ')
    assert.equal(view.text().includes(NOTE), true, 'whitespace is blank')
  })
  it('weighted with a prefilled kg → no note', async () => {
    view = await render(form({ weighted: true, initialWeight: '20' }))
    assert.equal(view.text().includes(NOTE), false)
  })
  it('unreadable kg shows the error, not the note', async () => {
    view = await render(form({ weighted: true, initialWeight: 'abc' }))
    assert.equal(view.text().includes(NOTE), false)
  })
  it('bodyweight / cardio (unweighted) + blank → no note', async () => {
    view = await render(form({ weighted: false, initialWeight: '' }))
    assert.equal(view.text().includes(NOTE), false)
    await view.unmount()
    view = await render(form({ weighted: false, showEffort: false, initialWeight: '' }))
    assert.equal(view.text().includes(NOTE), false)
  })
  it('Complete with blank kg still submits in one tap, with the blank kg', async () => {
    let submitted = null
    view = await render(form({ weighted: true, initialWeight: '', onComplete: (v) => (submitted = v) }))
    await view.click(view.button('Complete'))
    assert.deepEqual(submitted, { weight: '', reps: '10', effort: 3, durationSec: undefined })
  })
})

describe('live log screen — the stored set after Complete with blank kg (unchanged: weight 0)', () => {
  it('Leg Extension work set, kg cleared → stores exactly what main stores', async () => {
    const fixture = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
    localStorage.clear()
    localStorage.setItem('workout-mvp-v8', JSON.stringify({ ...fixture, activeWorkout: null }))
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { useStore } = await import('./store-context.js')
    const { WorkoutItemLog } = await importJsx('./views/workout/item.jsx', import.meta.url)
    const captured = {}
    function Screen({ started }) {
      // A test harness reading the live store out of the tree (as req-156.test.js).
      // oxlint-disable-next-line react/immutability
      captured.store = useStore()
      return started ? h(WorkoutItemLog, { routineId: 'sess-lower', itemId: 'si-sess-lower-2-ex-leg-extension' }) : null
    }
    view = await render(h(StoreProvider, null, h(Screen, { started: false })))
    await act(async () => captured.store.startWorkout('sess-lower'))
    await view.unmount()
    view = await render(h(StoreProvider, null, h(Screen, { started: true })))
    // WU set first: log it as prefilled, then clear the work set's kg.
    await view.click(view.button('Complete'))
    await view.type(view.input('kg'), '')
    assert.equal(view.text().includes(NOTE), true)
    await view.click(view.button('Complete'))
    assert.equal(captured.store.activeWorkout.sets.length, 2, 'one tap logged it')
    // Pinned from main (7e1de43) by running these same steps there — the note changes
    // nothing underneath: a blank kg on a weighted set is still stored as 0.
    assert.deepEqual(captured.store.activeWorkout.sets[1], EXPECTED_WORK_SET)
  })
})

const EXPECTED_WORK_SET = {
  routineItemId: 'si-sess-lower-2-ex-leg-extension',
  exerciseId: 'ex-leg-extension',
  setType: 'work',
  weight: 0,
  reps: '12',
  rpe: 3,
  note: '',
  targetReps: '12',
  targetWeight: 20,
}
