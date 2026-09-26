// req-179 (DEC-099) — routine form cleanup: no Focus anywhere on screen (stored values
// untouched), Role → one "Warm-up exercise" switch that never silently rewrites a stored
// finisher/cardio, no warm-up set offered (an existing one kept byte-for-byte or removed),
// and "Different … per set" fields in place of slash input. Rendered against the real store.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { importJsx, render } from './test-support/render.js'
import { perSetCount, perSetStart, perSetText, perSetValues, savedRole } from './routine-form.js'

const h = React.createElement
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const fixture = () => JSON.parse(read('./db.json'))
const stored = () => JSON.parse(localStorage.getItem('workout-mvp-v9'))
const storedRoutine = (id) => stored().routines.find((r) => r.id === id)

let view
afterEach(async () => {
  await view?.unmount()
  view = null
})

async function harness(payload = fixture()) {
  localStorage.clear()
  localStorage.setItem('workout-mvp-v8', JSON.stringify({ ...payload, activeWorkout: null }))
  const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
  const { useStore } = await import('./store-context.js')
  const captured = {}
  function Grab({ children }) {
    // A test harness reading the live store out of the tree (as req-175.test.js).
    // oxlint-disable-next-line react/immutability
    captured.store = useStore()
    return children ?? null
  }
  const mount = async (child) => {
    await view?.unmount()
    view = await render(h(StoreProvider, null, h(Grab, null, child)))
  }
  await mount(null)
  return { captured, mount }
}

// The input labelled `label` inside the per-set group `group` ("Reps", "Kg", "Duration (s)").
function inGroup(group, label) {
  const root = view.container.querySelector(`[role="group"][aria-label="${group}"]`)
  return [...(root?.querySelectorAll('label') || [])]
    .find((node) => node.textContent.trim().startsWith(label))
    ?.querySelector('input') ?? null
}

const Routine = () => importJsx('./views/Routine.jsx', import.meta.url)

describe('req-179 — pure helpers', () => {
  it('savedRole: on → warmup; off → main, except a stored finisher/cardio is kept', () => {
    assert.equal(savedRole('finisher', true), 'warmup')
    assert.equal(savedRole('finisher', false), 'finisher')
    assert.equal(savedRole('cardio', false), 'cardio')
    assert.equal(savedRole('warmup', false), 'main')
    assert.equal(savedRole('main', false), 'main')
    assert.equal(savedRole(undefined, false), 'main')
  })
  it('perSet*: the switch starts on only when stored values differ; text feeds the parser', () => {
    assert.deepEqual(perSetStart(['12', '10', '8']), { different: true, single: '12', perSet: ['12', '10', '8'] })
    assert.deepEqual(perSetStart([20, 20, 20]), { different: false, single: '20', perSet: ['20', '20', '20'] })
    assert.deepEqual(perSetStart([]), { different: false, single: '', perSet: [] })
    assert.equal(perSetCount('3'), 3)
    assert.equal(perSetCount('', 2), 2)
    assert.equal(perSetCount('abc'), 1)
    assert.deepEqual(perSetValues(['12', '10'], 4), ['12', '10', '10', '10'])
    assert.equal(perSetText({ different: false, single: '10', perSet: ['12'] }, 3), '10')
    assert.equal(perSetText({ different: true, single: '', perSet: ['12', '', '8'] }, 3), '12//8')
    assert.equal(perSetText({ different: true, single: '', perSet: ['', '', ''] }, 3), '')
  })
})

describe('req-179 AC1/AC2 — Focus is gone from every screen, stored focus untouched', () => {
  it('Add routine and Edit routine render no Focus; Save then Edit→Save leave routines[i].focus as stored', async () => {
    const { captured, mount } = await harness()
    const { RoutineNew, RoutineEdit } = await Routine()
    await mount(h(RoutineNew))
    assert.equal(view.text().includes('Focus'), false)
    assert.equal(view.container.querySelector('select'), null)
    await view.type(view.input('Name'), 'Arms')
    await view.click(view.button('Next'))
    const added = captured.store.routines.find((r) => r.name === 'Arms')
    const focusAtAdd = storedRoutine(added.id).focus // store.addRoutine's own default, out of scope
    await mount(h(RoutineEdit, { routineId: added.id }))
    assert.equal(view.text().includes('Focus'), false)
    await view.type(view.input('Name'), 'Arms day')
    await view.click(view.button('Save'))
    assert.equal(storedRoutine(added.id).name, 'Arms day')
    assert.equal(storedRoutine(added.id).focus, focusAtAdd)

    await mount(h(RoutineEdit, { routineId: 'sess-push-pull' }))
    await view.click(view.button('Save'))
    assert.equal(storedRoutine('sess-push-pull').focus, 'Mixed', 'a stored focus survives Edit→Save')
  })

  it('a v8 routine with focus "Machines" shows no "Machines" on Routines, detail, Schedule add, Today, preview', async () => {
    const data = fixture()
    assert.equal(data.routines[0].focus, 'Machines')
    assert.ok(data.workouts.some((w) => w.snapshot?.focus === 'Machines'), 'fixture has a snapshot focus')
    const { mount } = await harness(data)
    const { Routines, RoutineDetail } = await Routine()
    const { ScheduleDayAdd } = await importJsx('./views/Schedule.jsx', import.meta.url)
    const { Today } = await importJsx('./views/Today.jsx', import.meta.url)
    const { Workout } = await importJsx('./views/workout/overview.jsx', import.meta.url)
    const { HistoryDetail } = await importJsx('./views/history/index.jsx', import.meta.url)
    const screens = [
      ['Routines', h(Routines), 'Upper Body'],
      ['routine detail', h(RoutineDetail, { routineId: 'sess-upper' }), 'Upper Body'],
      ['Schedule "Add routine"', h(ScheduleDayAdd, { week: 0, weekday: 2 }), 'Upper Body'],
      ['Today', h(Today), 'Body'],
      ['workout preview', h(Workout, { routineId: 'sess-upper' }), 'Upper Body'],
      ['finished workout', h(HistoryDetail, { workoutId: data.workouts[0].id }), ''],
    ]
    for (const [name, element, expect] of screens) {
      await mount(element)
      const text = view.text()
      assert.ok(text.includes(expect), `${name} rendered (${expect})`)
      for (const focus of ['Machines', 'Mixed']) assert.equal(text.includes(focus), false, `${name} shows "${focus}"`)
    }
    assert.equal(stored().routines[0].focus, 'Machines', 'stored value unchanged')
  })
})

describe('req-179 AC3 — failure case: no silent rewrite of role or warm-up set', () => {
  it('finisher + { reps: 12 } saved untouched stays; untick Keep → null; switch on → warmup; off → main', async () => {
    const data = fixture()
    const item = data.routines[0].exercises.find((i) => i.id === 'si-sess-upper-8-ex-push-ups')
    item.warmup = { reps: 12 }
    const { mount } = await harness(data)
    const { RoutineExerciseEdit } = await Routine()
    const edit = () => mount(h(RoutineExerciseEdit, { routineId: 'sess-upper', itemId: item.id }))
    const saved = () => storedRoutine('sess-upper').exercises.find((i) => i.id === item.id)

    await edit()
    assert.equal(view.input('Warm-up exercise').checked, false)
    assert.equal(view.input('Keep warm-up set (12 reps)').checked, true)
    await view.click(view.button('Save'))
    assert.equal(saved().role, 'finisher')
    assert.deepEqual(saved().warmup, { reps: 12 })

    await edit()
    await view.click(view.input('Keep warm-up set'))
    await view.click(view.button('Save'))
    assert.equal(saved().warmup, null)
    assert.equal(saved().role, 'finisher')

    await edit()
    assert.equal(view.text().includes('Keep warm-up set'), false, 'a removed warm-up set cannot be re-added')
    await view.click(view.input('Warm-up exercise'))
    await view.click(view.button('Save'))
    assert.equal(saved().role, 'warmup')

    await edit()
    assert.equal(view.input('Warm-up exercise').checked, true)
    await view.click(view.input('Warm-up exercise'))
    await view.click(view.button('Save'))
    assert.equal(saved().role, 'main')
  })

  it('toggling the switch on and back off in one visit keeps a stored finisher', async () => {
    const { mount } = await harness()
    const { RoutineExerciseEdit } = await Routine()
    await mount(h(RoutineExerciseEdit, { routineId: 'sess-upper', itemId: 'si-sess-upper-8-ex-push-ups' }))
    await view.click(view.input('Warm-up exercise'))
    await view.click(view.input('Warm-up exercise'))
    await view.click(view.button('Save'))
    assert.equal(storedRoutine('sess-upper').exercises.find((i) => i.id === 'si-sess-upper-8-ex-push-ups').role, 'finisher')
  })
})

describe('req-179 AC4 — new items: no warm-up set from history, Main for every type', () => {
  it('an exercise whose history has a warm-up set → saved warmup null, no warm-up set control', async () => {
    const { captured, mount } = await harness()
    const { historyPrescription } = await import('./history-queries.js')
    assert.deepEqual(historyPrescription(captured.store.workouts, 'ex-leg-press')?.warmup, { reps: '12' }, 'history has one')
    const { RoutineExerciseNew } = await Routine()
    await mount(h(RoutineExerciseNew, { routineId: 'sess-upper', exerciseId: 'ex-leg-press' }))
    const text = view.text()
    for (const word of ['Keep warm-up set', 'Warmup reps', 'WU set']) assert.equal(text.includes(word), false, word)
    assert.equal(view.input('Warm-up exercise').checked, false)
    await view.click(view.button('Save'))
    const added = storedRoutine('sess-upper').exercises.at(-1)
    assert.equal(added.exerciseId, 'ex-leg-press')
    assert.equal(added.warmup, null)
    assert.equal(added.role, 'main')
  })

  it('a cardio exercise → switch off, saved role main', async () => {
    const { mount } = await harness()
    const { RoutineExerciseNew } = await Routine()
    await mount(h(RoutineExerciseNew, { routineId: 'sess-upper', exerciseId: 'ex-stairs' }))
    assert.equal(view.input('Warm-up exercise').checked, false)
    await view.click(view.button('Save'))
    const added = storedRoutine('sess-upper').exercises.at(-1)
    assert.equal(added.exerciseId, 'ex-stairs')
    assert.equal(added.role, 'main')
  })
})

describe('req-179 AC5 — "Different … per set" in place of slash input', () => {
  for (const [group, field, switchLabel, values, one] of [
    ['Reps', 'targets', 'Different reps per set', ['12', '10', '8'], ['10', '10', '10']],
    ['Kg', 'suggestedWeights', 'Different kg per set', [30, 25, 20], [25, 25, 25]],
  ]) {
    it(`${group}: 3 sets 12/10/8-style → stored per set; off keeps Set 1; cleared Set 2 blocks Save`, async () => {
      const { mount } = await harness()
      const { RoutineExerciseNew, RoutineExerciseEdit } = await Routine()
      await mount(h(RoutineExerciseNew, { routineId: 'sess-upper', exerciseId: 'ex-leg-press' }))
      await view.type(view.input('Sets'), '3')
      if (!inGroup(group, 'Set 1')) await view.click(view.input(switchLabel))
      for (let i = 0; i < 3; i++) await view.type(inGroup(group, `Set ${i + 1}`), String(values[i]))
      await view.click(view.button('Save'))
      const itemId = storedRoutine('sess-upper').exercises.at(-1).id
      const saved = () => storedRoutine('sess-upper').exercises.find((i) => i.id === itemId)
      assert.deepEqual(saved()[field], values)

      const edit = () => mount(h(RoutineExerciseEdit, { routineId: 'sess-upper', itemId }))
      await edit()
      assert.equal(view.input(switchLabel).checked, true, 'opens with the switch on')
      await view.type(inGroup(group, 'Set 2'), '')
      await view.click(view.button('Save'))
      assert.match(view.text(), /Set 2 is empty\./)
      assert.deepEqual(saved()[field], values, 'Save blocked')

      await edit()
      await view.click(view.input(switchLabel))
      assert.equal(inGroup(group, 'Set 1'), null, 'back to one field')
      assert.equal(inGroup(group, group).value, String(values[0]), 'Set 1 kept for all')
      await view.type(inGroup(group, group), String(one[0]))
      await view.click(view.button('Save'))
      assert.deepEqual(saved()[field], one)
      await edit()
      assert.equal(view.input(switchLabel).checked, false, 'equal values open with the switch off')
    })
  }

  it('Duration on a timed exercise: the same switch, stored per set', async () => {
    const data = fixture()
    data.exercises.find((e) => e.id === 'ex-leg-press').hasDuration = true
    const { mount } = await harness(data)
    const { RoutineExerciseNew } = await Routine()
    await mount(h(RoutineExerciseNew, { routineId: 'sess-upper', exerciseId: 'ex-leg-press' }))
    await view.type(view.input('Sets'), '2')
    await view.click(view.input('Different duration per set'))
    await view.type(inGroup('Duration (s)', 'Set 1'), '30')
    await view.type(inGroup('Duration (s)', 'Set 2'), '45')
    await view.click(view.button('Save'))
    assert.deepEqual(storedRoutine('sess-upper').exercises.at(-1).durations, [30, 45])
  })
})

describe('req-179 AC6 — no old words or slash input in the form; docs match', () => {
  it('the rendered item form has no WU set / Rest (s) / Role / Finisher option / "/" placeholder', async () => {
    const { mount } = await harness()
    const { RoutineExerciseEdit } = await Routine()
    await mount(h(RoutineExerciseEdit, { routineId: 'sess-upper', itemId: 'si-sess-upper-1-ex-chest-press' }))
    const text = view.text()
    for (const old of ['WU set', 'Rest (s)', 'Role', 'Finisher']) assert.equal(text.includes(old), false, old)
    assert.ok(text.includes('Rest (seconds)'))
    assert.equal(view.container.querySelector('select'), null, 'no role select')
    for (const input of view.all('input')) assert.equal(input.value.includes('/'), false, `"${input.value}"`)
  })

  it('README.md:8 and exchange.js no longer contain "WU"', () => {
    assert.equal(read('../README.md').split('\n')[7].includes('WU'), false)
    assert.equal(read('./exchange.js').includes('WU'), false)
  })
})
