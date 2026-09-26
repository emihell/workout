// req-182 (Sam run, findings 1 and 6) — the update-routine offer names the exercise, says it
// plainly and confirms the tap; the auto-finish summary waits while an offer is open; the plan's
// fill rows lead with the pick, and a slot carries the same slot's pick from an earlier day.
import { describe, it, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, importJsx, render } from './test-support/render.js'
import { emptyState } from './persistence.js'
import { DEVICE_FILL_KEY } from './routine-kg-fill.js'
import { offerText } from './routine-update-offer.js'
import { PLAN_SKIP, carriedFills } from './plan-templates.js'
import { loadExerciseCatalog } from './exerciseCatalog.js'

const h = React.createElement
const work = (itemId, exerciseId, weight) => ({ routineItemId: itemId, exerciseId, setType: 'work', weight, reps: '8', rpe: 3, note: '' })
const snapItem = (id, exerciseId, exerciseName) => ({ id, routineItemId: id, exerciseId, exerciseName, exerciseType: 'machine', sets: 1, targets: ['8'] })
const routineItem = (id, exerciseId, kg) => ({ id, exerciseId, role: 'main', restSec: 0, notes: '', warmup: null, sets: 1, targets: ['8'], suggestedWeights: kg, durations: [] })

let view
afterEach(async () => {
  mock.timers.reset()
  await view?.unmount()
  view = null
})

describe('req-182 §1 — the offer text', () => {
  it('AC1/AC2 wording: routine has kg → "routine says"; blank → "not in the routine yet"', () => {
    assert.equal(offerText({ from: [30], to: [32.5] }), 'You lifted 32.5 kg · routine says 30 kg')
    assert.equal(offerText({ from: [], to: [30, 35, 35] }), 'You lifted 30/35/35 kg · not in the routine yet')
    assert.equal(offerText({ from: [0, 0], to: [20, 20] }), 'You lifted 20/20 kg · not in the routine yet')
  })
})

describe('req-182 AC1 — the overview offer, rendered against the real store', () => {
  it('Chest Press, routine [30], logged [32.5] → named, plain words, "Save to Full body A" → "Saved to Full body A.", v9 [32.5]', async () => {
    const ex = (id, name) => ({ id, name, type: 'machine', equipment: 'Machine', weightStep: 'n/a', muscles: '', cues: '' })
    const state = {
      ...emptyState(),
      exercises: [ex('ex-cp', 'Chest Press'), ex('ex-row', 'Seated Row')],
      routines: [{ id: 'fba', name: 'Full body A', focus: 'Machines', exercises: [routineItem('ia', 'ex-cp', [30]), routineItem('ib', 'ex-row', [])] }],
    }
    localStorage.clear()
    localStorage.setItem(DEVICE_FILL_KEY, '2026-09-26T00:00:00.000Z')
    localStorage.setItem('workout-mvp-v9', JSON.stringify(state))
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { useStore } = await import('./store-context.js')
    const { WorkoutItemLog } = await importJsx('./views/workout/item.jsx', import.meta.url)
    const { Workout } = await importJsx('./views/workout/overview.jsx', import.meta.url)
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
    await act(async () => captured.store.startWorkout('fba'))
    await mount(h(WorkoutItemLog, { routineId: 'fba', itemId: 'ia' }))
    await view.type(view.input('kg'), '32,5')
    await view.click(view.button('Complete'))
    await mount(h(Workout, { routineId: 'fba' }))
    const offer = view.all('li').find((li) => li.textContent.includes('You lifted'))
    assert.ok(offer, 'an offer row')
    assert.equal(offer.querySelector('.ui-row__stack > span').textContent, 'Chest Press', 'names the exercise first')
    assert.match(offer.textContent, /You lifted 32\.5 kg · routine says 30 kg/)
    await view.click(view.button('Save to Full body A'))
    assert.match(view.text(), /Saved to Full body A\./)
    assert.equal(view.button('Save to Full body A'), null)
    assert.deepEqual(JSON.parse(localStorage.getItem('workout-mvp-v9')).routines[0].exercises[0].suggestedWeights, [32.5])
  })
})

// The summary against a stub store: finishWorkout counts commits, applyRoutineUpdate records.
function summaryProps({ offers }) {
  const items = [snapItem('ia', 'ex-cp', 'Chest Press'), snapItem('ib', 'ex-row', 'Seated Row')]
  const active = {
    id: 'act',
    routineId: 'fba',
    startedAt: new Date(Date.now() - 30 * 60000).toISOString(),
    snapshot: { routineId: 'fba', routineName: 'Full body A', items },
    sets: [work('ia', 'ex-cp', offers ? 32.5 : 30), work('ib', 'ex-row', offers ? 40 : 35)],
  }
  const routines = [{ id: 'fba', name: 'Full body A', exercises: [routineItem('ia', 'ex-cp', [30]), routineItem('ib', 'ex-row', offers ? [] : [35])] }]
  const calls = { finish: 0, updates: [] }
  const store = {
    workouts: [],
    routines,
    finishWorkout: () => calls.finish++,
    applyRoutineUpdate: (offer) => calls.updates.push(offer),
    patchActive: () => {},
  }
  return { props: { routineId: 'fba', active, store, onCancel: () => {} }, calls }
}

describe('req-182 AC3/AC4 — auto-finish waits while an offer is open', () => {
  it('with offers: no "Finishing in"; 15 s later nothing committed; Finish commits exactly once; two exercises named', async () => {
    mock.timers.enable({ apis: ['setInterval', 'Date'], now: new Date(2026, 8, 26, 10, 0) })
    const { AutoCompleteSummary } = await importJsx('./views/workout/auto-complete.jsx', import.meta.url)
    const { props, calls } = summaryProps({ offers: true })
    view = await render(h(AutoCompleteSummary, props))
    assert.equal(view.text().includes('Finishing in'), false)
    // AC4 — two offers, two different exercises.
    const offers = view.all('li').filter((li) => li.textContent.includes('You lifted'))
    assert.deepEqual(offers.map((li) => li.querySelector('.ui-row__stack > span').textContent), ['Chest Press', 'Seated Row'])
    assert.match(offers[1].textContent, /not in the routine yet/)
    await act(async () => mock.timers.tick(15000))
    assert.equal(calls.finish, 0, 'nothing committed after 15 s')
    await view.click(view.button('Save to Full body A'))
    assert.equal(calls.updates.length, 1)
    assert.match(view.text(), /Saved to Full body A\./)
    const finish = view.button('Finish')
    await view.click(finish)
    await view.click(finish)
    assert.equal(calls.finish, 1, 'committed exactly once')
  })

  it('failure case — no offers: the countdown still commits at 0 (req-116 unchanged)', async () => {
    mock.timers.enable({ apis: ['setInterval', 'Date'], now: new Date(2026, 8, 26, 10, 0) })
    const { AutoCompleteSummary } = await importJsx('./views/workout/auto-complete.jsx', import.meta.url)
    const { props, calls } = summaryProps({ offers: false })
    view = await render(h(AutoCompleteSummary, props))
    assert.match(view.text(), /Finishing in 10s…/)
    assert.equal(view.button('Finish'), null)
    await act(async () => mock.timers.tick(9000))
    assert.equal(calls.finish, 0)
    await act(async () => mock.timers.tick(1250))
    assert.equal(calls.finish, 1)
  })
})

describe('req-182 §5 — carriedFills (pure)', () => {
  const pick = (name) => ({ kind: 'own', exerciseId: name, name, item: {}, label: '' })
  // 3 days: A [squat, chest, row, core], B [deadlift, overhead, pulldown, lunge], C [squat, chest, pulldown, core].
  it('A\'s Squat carries to C; an explicit C pick or skip is never overwritten; a skip is not carried', () => {
    const legPress = pick('Leg Press')
    assert.equal(carriedFills(3, [[legPress]])[2][0], legPress, 'C Squat carries A')
    assert.equal(carriedFills(3, [[legPress]])[0][0], legPress)
    const hack = pick('Hack Squat')
    assert.equal(carriedFills(3, [[legPress], [], [hack]])[2][0], hack, 'explicit C kept')
    assert.equal(carriedFills(3, [[legPress], [], [PLAN_SKIP]])[2][0], PLAN_SKIP, 'explicit skip kept')
    assert.equal(carriedFills(3, [[PLAN_SKIP]])[2][0], undefined, 'a skip is not carried')
    // B's Pull-down carries to C's Pull-down (index 2 in both).
    const pulldown = pick('Lat Pulldown')
    assert.equal(carriedFills(3, [[], [undefined, undefined, pulldown]])[2][2], pulldown)
    // 4 days: Upper/Lower share no slot → nothing carried.
    assert.deepEqual(carriedFills(4, [[pick('Bench')]])[1], [undefined, undefined, undefined, undefined])
  })
})

describe('req-182 AC5 — the plan fill screen (rendered, real store)', () => {
  async function harness() {
    localStorage.clear()
    localStorage.setItem(DEVICE_FILL_KEY, '2026-09-26T00:00:00.000Z')
    const state = {
      ...emptyState(),
      exercises: [
        { id: 'ex-lp', name: 'Leg Press', type: 'machine', equipment: 'Machine', libraryId: 'Leg_Press' },
        { id: 'ex-hs', name: 'Hack Squat', type: 'machine', equipment: 'Machine', libraryId: 'Hack_Squat' },
      ],
    }
    localStorage.setItem('workout-mvp-v9', JSON.stringify(state))
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { RoutinePlan } = await importJsx('./views/Plan.jsx', import.meta.url)
    window.location.hash = '#/routines/new/plan/3'
    view = await render(h(StoreProvider, null, h(RoutinePlan)))
    await flush()
  }
  const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
  const box = (prefix) =>
    view.all('label.ui-check').find((node) => node.textContent.trim().startsWith(prefix))?.querySelector('input') ?? null
  // The slot rows of one day's section, as [row text, meta].
  const rows = (day) => {
    const section = view.all('section').find((node) => node.querySelector(':scope > h2')?.textContent === day)
    return [...section.querySelectorAll('.ui-row__stack')].map((node) => [...node.children].map((c) => c.textContent))
  }
  const openSlot = async (day, index) => {
    const section = view.all('section').find((node) => node.querySelector(':scope > h2')?.textContent === day)
    await view.click(section.querySelectorAll('a')[index])
    // The slot screen waits for the library (its filters need it) before the picker shows.
    await act(async () => {
      await loadExerciseCatalog()
    })
    await flush()
  }
  const choose = async (name) => {
    // Own exercises match a slot by libraryId → pattern; type the name to find them either way.
    await view.type(view.input('Search'), name)
    await view.click(box(`${name} — `))
    await view.click(view.button('Use'))
    await flush()
  }

  it('A Squat = Leg Press → A reads "Leg Press"; C carries it; changing or skipping C leaves A; save matches', async () => {
    await harness()
    await openSlot('Full body A', 0)
    await choose('Leg Press')
    assert.equal(rows('Full body A')[0][0], 'Leg Press', 'the pick leads the row')
    assert.match(rows('Full body A')[0][1], /^Squat · /)
    assert.equal(rows('Full body C')[0][0], 'Leg Press', 'C Squat carries A')
    assert.deepEqual(rows('Full body A')[1], ['Chest press', 'Choose'], 'an unpicked slot')
    // Change C → A unchanged.
    await openSlot('Full body C', 0)
    await choose('Hack Squat')
    assert.equal(rows('Full body C')[0][0], 'Hack Squat')
    assert.equal(rows('Full body A')[0][0], 'Leg Press')
    // Skip C → no item there; A still Leg Press.
    await openSlot('Full body C', 0)
    await view.click(view.button('Skip'))
    await flush()
    assert.deepEqual(rows('Full body C')[0], ['Squat', 'Skipped'])
    await view.click(view.button('Save'))
    await flush()
    const saved = JSON.parse(localStorage.getItem('workout-mvp-v9')).routines
    assert.deepEqual(saved.map((r) => r.name), ['Full body A'], 'C had only the skipped Squat')
    assert.deepEqual(saved[0].exercises.map((i) => i.exerciseId), ['ex-lp'])
  })

  it('a C pick made before A\'s is not overwritten', async () => {
    await harness()
    await openSlot('Full body C', 0)
    await choose('Hack Squat')
    await openSlot('Full body A', 0)
    await choose('Leg Press')
    assert.equal(rows('Full body C')[0][0], 'Hack Squat')
    assert.equal(rows('Full body A')[0][0], 'Leg Press')
    await view.click(view.button('Save'))
    await flush()
    const saved = JSON.parse(localStorage.getItem('workout-mvp-v9')).routines
    assert.deepEqual(saved.map((r) => [r.name, r.exercises.map((i) => i.exerciseId)]), [['Full body A', ['ex-lp']], ['Full body C', ['ex-hs']]])
  })
})
