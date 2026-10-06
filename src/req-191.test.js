// req-191 — Lena run 2 fixes: body-part search, no instant finish after a skip, tap a done set,
// plain days, the Add step's 3 / 90 prefill (DEC-107 §1), reps carry with no target (DEC-107 §2),
// small wording. Pure helpers first, then rendered checks against the real components.
import { describe, it, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { act, importJsx, render } from './test-support/render.js'
import { GROUP_LEADS, groupStaples, inferExerciseType, loadExerciseCatalog, muscleGroupForQuery, searchCommonFirst, shownName } from './exerciseCatalog.js'
import { MUSCLE_GROUPS } from './exerciseLibrary.js'
import { machinesPlan, planDaysText, SPLIT_AB, SPLIT_SAME } from './plan-templates.js'
import { resolvePicks, setupDefaults } from './mid-workout-pick.js'
import { pickerItem } from './routine-picker.js'
import {
  autoCompleteArmed,
  carryForSet,
  endedOnSkip,
  initialSetFields,
  setListRows,
  setPreview,
  skipItemPatch,
  withLoggedSet,
} from './workout-log.js'

const h = React.createElement
const catalog = await loadExerciseCatalog()
const DB = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
const names = (list) => list.map((item) => shownName(item))

describe('AC1 — body-part search', () => {
  it('every group word maps to a real MUSCLE_GROUPS name; plain synonyms too; other words → null', () => {
    for (const group of Object.keys(MUSCLE_GROUPS)) assert.equal(muscleGroupForQuery(group.toLowerCase()), group)
    assert.equal(muscleGroupForQuery(' Back '), 'Back')
    assert.equal(muscleGroupForQuery('abs'), 'Core')
    assert.equal(muscleGroupForQuery('leg'), 'Legs')
    assert.equal(muscleGroupForQuery('arm'), 'Arms')
    assert.equal(muscleGroupForQuery('shoulder'), 'Shoulders')
    for (const word of ['kickback', 'bench', 'lats', 'press', '']) assert.equal(muscleGroupForQuery(word), null)
  })

  it('"back" → Back staples first, machines first with the obvious ones leading (Lat Pulldown, Seated Cable Row, Machine Row), then free weights', () => {
    const { common } = searchCommonFirst(catalog, 'back')
    const lead = groupStaples(catalog, 'Back')
    console.log('back first 12:', names(common.slice(0, 12)).join(', '))
    assert.deepEqual(common, lead.slice(0, 25), 'the first section is the Back group, capped at 25')
    for (const item of lead) assert.ok(item.muscleGroups.includes('Back') && item.staple)
    assert.deepEqual(names(common.slice(0, 3)), ['Lat Pulldown', 'Seated Cable Row', 'Machine Row'])
    // machines (machine/cable) before free weights
    const kinds = lead.map((item) => inferExerciseType(item.equipment, item.category))
    assert.ok(kinds.lastIndexOf('machine') < kinds.indexOf('free'), 'machines before free weights')
    assert.ok(!names(common.slice(0, 5)).includes('Glute Kickback'))
  })

  it('"kickback" (not a group word) still finds Kickbacks first — unchanged', () => {
    assert.deepEqual(names(searchCommonFirst(catalog, 'kickback').common).slice(0, 4), [
      'Cable Glute Kickback',
      'Cable Triceps Kickback',
      'Glute Kickback',
      'Triceps Kickback',
    ])
  })

  // Review fix 1 — the group path is capped like any search, the overflow behind "Show N more",
  // and a group word is a strength search: no cardio anywhere.
  it('group path: ≤ 25 in the first section, the overflow counted in restCount; no cardio for "legs" or "back"', () => {
    const cardio = (item) => item.logAs === 'cardio' || inferExerciseType(item.equipment, item.category) === 'cardio'
    for (const word of ['legs', 'back', 'chest', 'shoulders', 'arms', 'core', 'abs']) {
      const found = searchCommonFirst(catalog, word)
      assert.ok(found.common.length <= 25, `${word}: ${found.common.length}`)
      assert.ok(found.rest.length <= 25)
      assert.ok(found.restCount >= found.rest.length)
    }
    const legs = searchCommonFirst(catalog, 'legs')
    const back = searchCommonFirst(catalog, 'back')
    for (const found of [legs, back]) assert.deepEqual([...found.common, ...found.rest].filter(cardio).map(shownName), [])
    assert.equal(names(back.common).includes('Rowing Machine'), false)
    assert.equal(groupStaples(catalog, 'Legs').some(cardio), false)
    // the Legs staples that don't fit lead "Show more"
    const legsGroup = groupStaples(catalog, 'Legs')
    assert.ok(legsGroup.length > 25)
    assert.deepEqual(legs.rest.slice(0, legsGroup.length - 25), legsGroup.slice(25, 50))
    assert.ok(legs.restCount >= legsGroup.length - 25)
  })

  it('"legs" leads with Leg Press; each group leads with its obvious machine', () => {
    const first = (word) => shownName(searchCommonFirst(catalog, word).common[0])
    assert.equal(first('legs'), 'Leg Press')
    assert.equal(first('chest'), 'Machine Chest Press')
    assert.equal(first('shoulders'), 'Machine Shoulder Press')
    assert.equal(first('arms'), 'Machine Bicep Curl')
    assert.equal(first('abs'), 'Ab Crunch Machine')
    // every GROUP_LEADS id exists, is a listable staple, a machine, and in its group
    for (const [group, ids] of Object.entries(GROUP_LEADS)) {
      for (const id of ids) {
        const entry = catalog.find((item) => item.id === id)
        assert.ok(entry && entry.staple && !entry.hidden, id)
        assert.equal(inferExerciseType(entry.equipment, entry.category), 'machine', id)
        assert.ok(entry.muscleGroups.includes(group), `${id} in ${group}`)
      }
    }
  })
})

// ---- AC2 — no countdown after a skip ----
const item = (id, extra = {}) => ({ routineItemId: id, exerciseId: `ex-${id}`, sets: 2, targets: ['8', '8'], ...extra })
const logged = (id, extra = {}) => ({ routineItemId: id, exerciseId: `ex-${id}`, setType: 'work', weight: 20, reps: '8', ...extra })
const active = (items, sets = [], extra = {}) => ({ routineId: 'r', snapshot: { routineName: 'Day', items }, sets, completedItemIds: [], startedAt: new Date().toISOString(), ...extra })

describe('AC2 — endedOnSkip (derived from the set records)', () => {
  it('Skip exercise on the last not-done exercise → all done, endedOnSkip true', () => {
    const w = active([item('a'), item('b')], [logged('a'), logged('a')], { completedItemIds: ['a'] })
    const after = { ...w, ...skipItemPatch(w, 'b') }
    assert.equal(autoCompleteArmed(after), true)
    assert.equal(endedOnSkip(after), true)
  })
  it('completing the last set normally → endedOnSkip false (countdown as before)', () => {
    const w = active([item('a'), item('b')], [logged('a'), logged('a'), logged('b'), logged('b')])
    assert.equal(autoCompleteArmed(w), true)
    assert.equal(endedOnSkip(w), false)
  })
  it('a skip earlier in the workout, then a real last set → countdown', () => {
    const w0 = active([item('a'), item('b')])
    const skipped = { ...w0, ...skipItemPatch(w0, 'a') }
    const w = { ...skipped, sets: [...skipped.sets, logged('b'), logged('b')] }
    assert.equal(endedOnSkip(w), false)
  })
  it('empty workout / no sets → false', () => {
    assert.equal(endedOnSkip(null), false)
    assert.equal(endedOnSkip(active([item('a')])), false)
  })
})

describe('AC2 — the summary (rendered)', () => {
  let view
  afterEach(async () => {
    await view?.unmount()
    view = null
    mock.timers.reset()
  })
  // review fix 2 — count beeps: defaultBeep builds oscillators on window.AudioContext.
  let oscillators = 0
  class FakeAudio {
    constructor() {
      this.state = 'running'
      this.currentTime = 0
      this.destination = {}
    }
    createOscillator() {
      oscillators++
      return { frequency: {}, connect: () => {}, start: () => {}, stop: () => {} }
    }
    createGain() {
      return { gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {} }
    }
  }
  window.AudioContext = FakeAudio
  const fakeStore = () => {
    const calls = { finish: 0, patch: [] }
    return { calls, store: { workouts: [], routines: [], finishWorkout: () => calls.finish++, patchActive: (p) => calls.patch.push(p) } }
  }

  it('countdown off: no "Finishing in", no auto-finish after 12 s; [Finish] primary commits, [Keep going] dismisses', async () => {
    mock.timers.enable({ apis: ['setInterval', 'Date'], now: new Date(2026, 9, 6, 10, 0) })
    const { AutoCompleteSummary } = await importJsx('./views/workout/auto-complete.jsx', import.meta.url)
    const { calls, store } = fakeStore()
    let cancelled = 0
    const w = active([item('a')], [logged('a'), logged('a', { reps: 'skipped' })])
    view = await render(h(AutoCompleteSummary, { routineId: 'r', active: w, store, countdown: false, onCancel: () => cancelled++ }))
    assert.equal(view.text().includes('Finishing in'), false)
    assert.match(view.text(), /Total lifted \(all sets added up\)/)
    await act(async () => mock.timers.tick(12000))
    assert.equal(calls.finish, 0, 'nothing finished after 12 s')
    assert.deepEqual(view.all('button').map((b) => b.textContent.trim()), ['Finish', 'Keep going'])
    assert.match(view.button('Finish').className, /ui-btn--primary/)
    await view.click(view.button('Keep going'))
    assert.equal(cancelled, 1)
    // review fix 2 — the manual tap: its own analytics id, no beep
    const { exportAnalytics } = await import('./analytics.js')
    const before = { ...exportAnalytics().buttons }
    await view.click(view.button('Finish'))
    assert.equal(calls.finish, 1)
    const after = exportAnalytics().buttons
    assert.equal((after['summary-finish-workout'] || 0) - (before['summary-finish-workout'] || 0), 1)
    assert.equal(after['auto-finish-workout'] || 0, before['auto-finish-workout'] || 0, 'not the auto-finish event')
    assert.equal(oscillators, 0, 'no beep on the manual Finish')
  })

  it('countdown on (default): "Finishing in 10s…", commits at 10 s, Edit + Keep going as before', async () => {
    mock.timers.enable({ apis: ['setInterval', 'Date'], now: new Date(2026, 9, 6, 10, 0) })
    const { AutoCompleteSummary } = await importJsx('./views/workout/auto-complete.jsx', import.meta.url)
    const { calls, store } = fakeStore()
    const w = active([item('a')], [logged('a'), logged('a')])
    view = await render(h(AutoCompleteSummary, { routineId: 'r', active: w, store, onCancel: () => {} }))
    assert.match(view.text(), /Finishing in 10s…/)
    assert.deepEqual(view.all('button').map((b) => b.textContent.trim()), ['Edit', 'Keep going'])
    const autoBefore = (await import('./analytics.js')).exportAnalytics().buttons['auto-finish-workout'] || 0
    const oscBefore = oscillators
    await act(async () => mock.timers.tick(10500))
    assert.equal(calls.finish, 1)
    assert.equal((await import('./analytics.js')).exportAnalytics().buttons['auto-finish-workout'], autoBefore + 1)
    assert.ok(oscillators > oscBefore, 'the auto-finish still beeps')
  })
})

// ---- AC3 — tap a done set row ----
describe('AC3 — a done row opens the logged set (render, real store)', () => {
  let view
  afterEach(async () => {
    await view?.unmount()
    view = null
  })
  it('tap row 1 → "Set 1 · logged" view; sets.length and restEndsAt unchanged; upcoming rows are not buttons', async () => {
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { useStore } = await import('./store-context.js')
    const { WorkoutItemLog } = await importJsx('./views/workout/item.jsx', import.meta.url)
    localStorage.clear()
    localStorage.setItem('workout-mvp-v8', JSON.stringify({ ...DB, activeWorkout: null }))
    const captured = {}
    function Screen({ open }) {
      // oxlint-disable-next-line react/immutability
      captured.store = useStore()
      return open ? h(WorkoutItemLog, { routineId: 'sess-upper', itemId: 'si-sess-upper-1-ex-chest-press' }) : null
    }
    view = await render(h(StoreProvider, null, h(Screen, { open: false })))
    await act(async () => captured.store.startWorkout('sess-upper'))
    await view.unmount()
    view = await render(h(StoreProvider, null, h(Screen, { open: true })))
    const a = () => captured.store.activeWorkout
    await view.click(view.button('Complete')) // warm-up
    await view.type(view.input('kg'), '27.5')
    await view.click(view.button('Complete')) // set 1
    const restEndsAt = a().restEndsAt
    const length = a().sets.length
    const taps = view.all('.ui-setpreview li').map((li) => Boolean(li.querySelector('button.ui-setpreview__tap')))
    assert.deepEqual(taps, [true, true, false, false], 'done rows tappable, current/upcoming inert')
    const row1 = view.all('.ui-setpreview li')[1].querySelector('button')
    await view.click(row1)
    assert.match(view.text(), /Set 1 · logged/)
    assert.equal(view.input('kg').value, '27.5')
    assert.ok(view.button('Next'))
    assert.equal(view.button('Complete'), null)
    assert.equal(a().sets.length, length, 'sets.length unchanged')
    assert.equal(a().restEndsAt, restEndsAt, 'restEndsAt unchanged')
    assert.equal(view.all('.ui-setpreview li')[1].getAttribute('aria-current'), 'step')
    // the warm-up row too
    await view.click(view.all('.ui-setpreview li')[0].querySelector('button'))
    assert.match(view.text(), /Warm-up set · logged/)
    await view.click(view.button('Next'))
    assert.ok(view.button('Complete'), 'back on the current set')
    assert.equal(a().restEndsAt, restEndsAt)
  })
})

// ---- AC4 — plain days ----
describe('AC4 — the days step in plain words', () => {
  it('2 days on a Tuesday → "Starts today (Tue), then every Tue and Fri"', () => {
    assert.equal(planDaysText([2, 5], 2), 'Starts today (Tue), then every Tue and Fri')
    assert.equal(planDaysText([2], 2), 'Starts today (Tue), then every Tue')
    assert.equal(planDaysText([5], 2), 'Every Fri')
    assert.equal(planDaysText([6, 1, 3], 6), 'Starts today (Sat), then every Sat, Mon and Wed')
    assert.equal(planDaysText([], 2), '')
  })
  it('routine names "My workout" / "My workout A/B"', () => {
    assert.deepEqual(machinesPlan({ days: 2, split: SPLIT_SAME, picks: ['a'] }).routines.map((r) => r.name), ['My workout'])
    assert.deepEqual(machinesPlan({ days: 2, split: SPLIT_AB, picks: ['a', 'b'] }).routines.map((r) => r.name), ['My workout A', 'My workout B'])
  })
})

// ---- AC5 — Add exercise's no-history step: 3 and 90 ----
describe('AC5 — setupDefaults (DEC-107 §1)', () => {
  const pick = (exercise) => ({ kind: 'library', source: 'starting', item: pickerItem([], exercise).item })
  it('a never-done reps exercise → "3" and "90"; accepting → sets 3, restSec 90, kg [] and no reps', () => {
    const p = pick({ type: 'machine' })
    const values = setupDefaults(p)
    assert.deepEqual(values, { sets: '3', rest: '90' })
    const { picks } = resolvePicks([p], [values])
    assert.equal(picks[0].item.sets, 3)
    assert.equal(picks[0].item.restSec, 90)
    assert.deepEqual(picks[0].item.suggestedWeights, [])
    assert.deepEqual(picks[0].item.targets, [])
  })
  it('a timed one → 3 / 90; a cardio one → its plan, 1 set, rest blank; no item → 3 / 90', () => {
    assert.deepEqual(setupDefaults(pick({ type: 'bodyweight', hasDuration: true })), { sets: '3', rest: '90' })
    assert.deepEqual(setupDefaults(pick({ type: 'cardio' })), { sets: '1', rest: '' })
    assert.deepEqual(setupDefaults({ source: 'starting' }), { sets: '3', rest: '90' })
  })
})

// ---- AC6 — reps carry with no target ----
describe('AC6 — reps carry to the next set when there is no target (DEC-107 §2)', () => {
  const base = { weighted: true, fromRestore: false, restore: null, hasHistory: false, history: { weight: '' }, override: undefined }
  const seedFor = (workLogged, target) =>
    initialSetFields({ ...base, carry: carryForSet('work', workLogged), target, routineKg: '' })
  it('no target: set 1 logged 10 reps → set 2 seed reps "10"; kg carries too', () => {
    const s1 = { setType: 'work', weight: 40, reps: '10' }
    assert.deepEqual([seedFor([s1], '').reps, seedFor([s1], '').weight], ['10', '40'])
  })
  it('a target "8" → set 2 seed "8" regardless of the 10 logged', () => {
    assert.equal(seedFor([{ setType: 'work', weight: 40, reps: '10' }], '8').reps, '8')
  })
  it('FAILURE CASE: set 1 skipped → set 2 reps stay blank (a skip carries nothing)', () => {
    assert.equal(seedFor([{ setType: 'work', weight: 0, reps: 'skipped', note: 'skipped' }], '').reps, '')
  })
  it('the warm-up is unaffected (no carry for a warm-up)', () => {
    assert.equal(carryForSet('wu', [{ setType: 'work', weight: 40, reps: '10' }]), null)
  })
  it('the set list shows the carried reps on upcoming no-target rows; target rows keep their target', () => {
    const it0 = { routineItemId: 'x', exerciseId: 'ex-x', sets: 3, targets: ['', '', '12'], suggestedWeights: [] }
    const w = withLoggedSet({ routineId: 'r', snapshot: { items: [it0] }, sets: [], completedItemIds: [] }, { routineItemId: 'x', exerciseId: 'ex-x', setType: 'work', weight: 30, reps: '9' })
    const rows = setListRows({ workout: w, item: it0, ex: { type: 'machine' }, weighted: true, hasHistory: false, historyFor: () => ({ weight: '' }) })
    assert.deepEqual(rows.map((r) => r.text), ['1 · 30 kg × 9', '2 · 30 kg × 9', '3 · 30 kg × 12'])
    // req-106 start-of-exercise preview (nothing logged) is unchanged: no carry
    const start = setPreview({ item: it0, ex: { type: 'machine' }, weighted: true, hasHistory: false, historyFor: () => ({ weight: '' }) })
    assert.deepEqual(start.map((r) => r.text), ['1 · — × —', '2 · — × —', '3 · — × 12'])
  })
})

// ---- AC7 — picker: "Add" disabled at 0; × clears ----
describe('AC7 — the picker (rendered, real store)', () => {
  let view
  afterEach(async () => {
    await view?.unmount()
    view = null
  })
  it('FAILURE CASE: "Add" disabled with nothing ticked; × clears the query → the empty-search view', async () => {
    localStorage.clear()
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { ExercisePicker } = await importJsx('./views/ExercisePicker.jsx', import.meta.url)
    view = await render(h(StoreProvider, null, h(ExercisePicker, { onAdd: () => {}, cancelTo: '/' })))
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
    const headers = () => view.all('h2').map((node) => node.textContent.trim())
    assert.equal(view.button('Add').disabled, true)
    assert.equal(view.button('Add 0'), null)
    assert.equal(view.container.querySelector('.ui-search__clear'), null, 'no × while empty')
    assert.deepEqual(headers(), Object.keys(MUSCLE_GROUPS))
    await view.type(view.input('Search'), 'back')
    assert.deepEqual(headers(), ['Library'])
    const first = view.all('label.ui-check')[0].textContent
    assert.match(first, /^(Assisted Pull-Up|Chest-Supported T-Bar Row|Close-Grip Lat Pulldown|Lat Pulldown)/)
    await view.click(view.all('label.ui-check input')[0])
    assert.ok(view.button('Add 1'))
    await view.click(view.container.querySelector('.ui-search__clear'))
    assert.equal(view.input('Search').value, '')
    assert.deepEqual(headers(), Object.keys(MUSCLE_GROUPS), 'back to the empty-search view')
    assert.ok(view.button('Add 1'), 'the tick survives the clear')
  })
})
