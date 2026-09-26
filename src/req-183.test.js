// req-183 (DEC-102) — kg hints under a work set's kg box: "Last time: 30 kg" when the routine
// has no kg at that index, and "That's a big change from 50 kg" on a > 50% jump. Neither
// prefills, blocks or asks: Complete logs the typed kg in one tap.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { act, importJsx, render } from './test-support/render.js'
import { kgHints } from './kg-hints.js'
import { DEVICE_FILL_KEY } from './routine-kg-fill.js'
import { historySetPrefill, lastSetsForExercise } from './history-queries.js'

const { SetLogForm } = await importJsx('./ui/index.jsx', import.meta.url)
const { RPE_OPTIONS } = await import('./ids.js')

const h = React.createElement
let view
afterEach(async () => {
  await view?.unmount()
  view = null
})

describe('kgHints — the pure rule', () => {
  const w = (kg, routineKg, lastKg = '') => kgHints({ weighted: true, kg, routineKg, lastKg })
  it('last time: routine blank at this index + history kg → the history kg; routine set → none', () => {
    assert.deepEqual(w('', '', '30'), { lastTime: 30, bigJumpFrom: null })
    assert.deepEqual(w('', 0, '30'), { lastTime: 30, bigJumpFrom: null }, '0 is "no weight" (req-113)')
    assert.deepEqual(w('', 30, '30'), { lastTime: null, bigJumpFrom: null })
    assert.deepEqual(w('', '', ''), { lastTime: null, bigJumpFrom: null }, 'no history → nothing')
  })
  it('big change: > 50% from the routine kg; exactly 50% is not', () => {
    assert.equal(w('500', 50).bigJumpFrom, 50)
    assert.equal(w('60', 50).bigJumpFrom, null)
    assert.equal(w('75', 50).bigJumpFrom, null, 'exactly 50%')
    assert.equal(w('76', 50).bigJumpFrom, 50)
    assert.equal(w('24', 50).bigJumpFrom, 50, 'down counts too')
    assert.equal(w('25', 50).bigJumpFrom, null, 'exactly −50%')
  })
  it('big change: routine blank → reference is last time; routine wins over last time', () => {
    assert.deepEqual(w('50', '', '30'), { lastTime: 30, bigJumpFrom: 30 })
    assert.equal(w('50', 40, '30').bigJumpFrom, null, 'routine 40 is the reference, not last 30')
  })
  it('comma decimals read as DEC-058: 75,5 vs 50 → note; 75,0 → none; unreadable/blank/0 → none', () => {
    assert.equal(w('75,5', 50).bigJumpFrom, 50)
    assert.equal(w('75,0', 50).bigJumpFrom, null)
    assert.equal(w('22,5', '', '15').bigJumpFrom, null, '22.5 vs 15 is exactly 50%')
    for (const kg of ['abc', '', '  ', '0', '2,5,5']) assert.equal(w(kg, 50).bigJumpFrom, null, kg)
  })
  it('unweighted or warm-up (routineKg undefined) → no hints', () => {
    const none = { lastTime: null, bigJumpFrom: null }
    assert.deepEqual(kgHints({ weighted: false, kg: '500', routineKg: 50, lastKg: '30' }), none)
    assert.deepEqual(kgHints({ weighted: true, kg: '500', routineKg: undefined, lastKg: '30' }), none)
  })
})

function form(props) {
  return h(SetLogForm, { showEffort: true, effortOptions: RPE_OPTIONS, initialReps: '10', ...props })
}

describe('SetLogForm — the notes as rendered', () => {
  it('routine blank, last 30 → box empty, one line "No weight entered · last time 30 kg"; typing → "Last time: 30 kg"', async () => {
    view = await render(form({ initialWeight: '', routineKg: '', lastKg: '30' }))
    assert.equal(view.input('kg').value, '', 'no prefill')
    assert.equal(view.text().includes('No weight entered · last time 30 kg'), true)
    await view.type(view.input('kg'), '32,5')
    assert.equal(view.text().includes('Last time: 30 kg'), true)
    assert.equal(view.text().includes('No weight entered'), false)
    assert.equal(view.text().includes('big change'), false)
    await view.type(view.input('kg'), '50')
    assert.equal(view.text().includes("That's a big change from 30 kg"), true)
  })
  it('routine 30 → no last-time hint', async () => {
    view = await render(form({ initialWeight: '30', routineKg: 30, lastKg: '30' }))
    assert.equal(/last time/i.test(view.text()), false)
  })
  it('routine 50: 500 → note; 60 → none; 75 → none; 76 → note (live while typing)', async () => {
    view = await render(form({ initialWeight: '50', routineKg: 50 }))
    const note = () => view.text().includes("That's a big change from 50 kg")
    for (const [kg, want] of [['500', true], ['60', false], ['75', false], ['76', true]]) {
      await view.type(view.input('kg'), kg)
      assert.equal(note(), want, kg)
    }
  })
  it('bodyweight / warm-up → no hints', async () => {
    view = await render(form({ weighted: false, initialWeight: '', routineKg: '', lastKg: '30' }))
    assert.equal(/last time|big change/i.test(view.text()), false)
    await view.unmount()
    view = await render(form({ initialWeight: '500', routineKg: undefined, lastKg: '30' }))
    assert.equal(/last time|big change/i.test(view.text()), false)
  })
  it('Complete with the note showing submits the typed kg in one tap', async () => {
    let submitted = null
    view = await render(form({ initialWeight: '500', routineKg: 50, onComplete: (v) => (submitted = v) }))
    assert.equal(view.text().includes('big change from 50 kg'), true)
    await view.click(view.button('Complete'))
    assert.equal(submitted?.weight, '500')
  })
})

describe('live log screen — real store, routine kg blanked on Leg Extension', () => {
  const ITEM = 'si-sess-lower-2-ex-leg-extension'
  async function start({ blank }) {
    const fixture = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
    if (blank) {
      const routine = fixture.routines.find((r) => r.id === 'sess-lower')
      // 0 = "no weight" (req-113). Not [] — the fixture loads as legacy v8, whose baseline
      // refills an empty list (model.js migrateState, req-120).
      routine.exercises.find((i) => i.id === ITEM).suggestedWeights = [0, 0, 0]
    }
    localStorage.clear()
    // The one-time req-178 fill would refill the blank from history; mark it done.
    localStorage.setItem(DEVICE_FILL_KEY, '2026-09-26T00:00:00.000Z')
    localStorage.setItem('workout-mvp-v8', JSON.stringify({ ...fixture, activeWorkout: null }))
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { useStore } = await import('./store-context.js')
    const { WorkoutItemLog } = await importJsx('./views/workout/item.jsx', import.meta.url)
    const captured = {}
    function Screen({ started }) {
      // oxlint-disable-next-line react/immutability
      captured.store = useStore()
      return started ? h(WorkoutItemLog, { routineId: 'sess-lower', itemId: ITEM }) : null
    }
    view = await render(h(StoreProvider, null, h(Screen, { started: false })))
    await act(async () => captured.store.startWorkout('sess-lower'))
    await view.unmount()
    view = await render(h(StoreProvider, null, h(Screen, { started: true })))
    const last = lastSetsForExercise(captured.store.workouts, 'ex-leg-extension')
    return { captured, lastKg: historySetPrefill(last, { setType: 'work', workIndex: 0 }).weight }
  }

  it('warm-up: no hints; set 1: box empty + last time; 500 → big change; Complete stores weight 500 in one tap', async () => {
    const { captured, lastKg } = await start({ blank: true })
    assert.ok(Number(lastKg) > 0, `history has a set-1 kg (${lastKg})`)
    assert.equal(/last time|big change/i.test(view.text()), false, 'warm-up set')
    await view.click(view.button('Complete'))
    assert.equal(view.input('kg').value, '', 'routine blank → box blank, no prefill')
    assert.equal(view.text().includes(`No weight entered · last time ${Number(lastKg)} kg`), true)
    await view.type(view.input('kg'), '500')
    assert.equal(view.text().includes(`That's a big change from ${Number(lastKg)} kg`), true)
    await view.click(view.button('Complete'))
    const sets = captured.store.activeWorkout.sets
    assert.equal(sets.length, 2, 'one tap logged it, no dialog')
    assert.equal(sets[1].weight, 500)
    console.log('stored set:', JSON.stringify({ weight: sets[1].weight, reps: sets[1].reps, setType: sets[1].setType }))
  })
  it('routine kg present → no last-time hint on set 1', async () => {
    await start({ blank: false })
    await view.click(view.button('Complete'))
    assert.notEqual(view.input('kg').value, '')
    assert.equal(/last time|big change/i.test(view.text()), false)
  })
})
