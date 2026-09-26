// req-181 (DEC-098) — "Start from a plan": days per week → slots filled from the req-180
// picker filtered to the slot's pattern → one Save (planToState in one state write). Pure
// reducer tests, the library's dip re-tag, then the real flow against the real store.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { act, importJsx, render } from './test-support/render.js'
import { catalogItemToExercise, loadExerciseCatalog, shownName } from './exerciseCatalog.js'
import { libraryProblems } from './exerciseLibrary.js'
import { emptyState } from './persistence.js'
import { PLAN_DAYS, PLAN_TEMPLATES, SLOTS, planIds, planToState, slotCandidates } from './plan-templates.js'
import { pickerItem } from './routine-picker.js'

const h = React.createElement
const library = await loadExerciseCatalog()
const visible = library.filter((entry) => !entry.hidden)

let counter = 0
const uid = (prefix) => `${prefix}-${++counter}`
const NOW = new Date(2026, 8, 26)
const idsFor = (choices) => planIds(choices, uid, NOW)()

const WEEKDAYS = { 1: [[1, 'Full body']], 2: [[1, 'Full body A'], [4, 'Full body B']], 3: [[1, 'Full body A'], [3, 'Full body B'], [5, 'Full body C']], 4: [[1, 'Upper'], [2, 'Lower'], [4, 'Upper'], [5, 'Lower']] }

// Every slot filled with an own exercise named after the slot (exerciseId = `own-<slot>`).
function fullChoices(days) {
  const fills = PLAN_TEMPLATES[days].routines.map((routine) =>
    routine.slots.map((key) => ({ kind: 'own', exerciseId: `own-${key}`, item: pickerItem([], { type: 'free' }).item })),
  )
  return { days, fills }
}
const base = () => ({ ...emptyState(), schedule: { loopWeeks: 3, anchor: '2026-09-21', slots: [] } })

describe('req-181 AC1 — planToState on an empty state, every slot filled', () => {
  for (const days of PLAN_DAYS) {
    it(`${days} day(s): the table's routines in slot order, the week on its weekdays, loopWeeks 1`, () => {
      const choices = fullChoices(days)
      const { state, scheduled } = planToState(base(), choices, idsFor(choices))
      assert.equal(scheduled, true)
      const template = PLAN_TEMPLATES[days]
      assert.deepEqual(state.routines.map((r) => r.name), template.routines.map((r) => r.name))
      state.routines.forEach((routine, r) =>
        assert.deepEqual(routine.exercises.map((item) => item.exerciseId), template.routines[r].slots.map((key) => `own-${key}`)),
      )
      const byId = Object.fromEntries(state.routines.map((r) => [r.id, r.name]))
      assert.deepEqual(state.schedule.slots.map((slot) => [slot.weekday, byId[slot.routineId]]), WEEKDAYS[days])
      assert.ok(state.schedule.slots.every((slot) => slot.week === 0))
      assert.equal(state.schedule.loopWeeks, 1)
      assert.equal(state.schedule.anchor, '2026-09-21', 'anchor kept')
    })
  }

  it('slot names and patterns are the table\'s (Core = the three core patterns)', () => {
    assert.deepEqual(
      Object.values(SLOTS).map((slot) => slot.label),
      ['Squat', 'Deadlift', 'Chest press', 'Row', 'Overhead press', 'Pull-down', 'Lunge', 'Core'],
    )
    assert.deepEqual(SLOTS.core.patterns, ['core-flexion', 'core-stability', 'core-rotation'])
    assert.deepEqual(SLOTS.overhead.patterns, ['vertical-push'])
  })
})

describe('req-181 AC2 — slot candidates come from the library by pattern', () => {
  it('vertical-push: no dip; staples equal the library filter (not a hand list)', () => {
    const { staples, rest } = slotCandidates('vertical-push', [], library)
    const expected = visible.filter((e) => e.staple && e.pattern === 'vertical-push').map((e) => e.id).sort()
    assert.deepEqual(staples.map((e) => e.id).sort(), expected)
    assert.equal([...staples, ...rest].some((e) => /dip/i.test(e.id)), false, 'no dip')
    assert.deepEqual(rest.map((e) => e.id).sort(), visible.filter((e) => !e.staple && e.pattern === 'vertical-push').map((e) => e.id).sort())
  })

  it('an own exercise from a squat staple leads the Squat slot; a manual own exercise is in no slot list', () => {
    const squat = visible.find((e) => e.staple && e.pattern === 'squat')
    const exercises = [
      { id: 'manual', name: 'My Squat Thing', type: 'free' },
      { id: 'from-lib', name: shownName(squat), type: 'free', libraryId: squat.id },
    ]
    assert.deepEqual(slotCandidates('squat', exercises, library).own.map((ex) => ex.id), ['from-lib'])
    for (const slot of Object.values(SLOTS)) {
      assert.equal(slotCandidates(slot.patterns, exercises, library).own.some((ex) => ex.id === 'manual'), false, slot.label)
    }
  })
})

describe('req-181 AC3 — item values through req-180 pickerItem', () => {
  it('with a finished workout: its prescription and kg; without: the starting plan, no kg', () => {
    const workouts = [
      {
        id: 'w', routineId: 'r', finishedAt: '2026-09-20T10:00:00Z', snapshot: { items: [{ exerciseId: 'ex-a', restSec: 120 }] },
        sets: [1, 2, 3].map(() => ({ exerciseId: 'ex-a', setType: 'work', weight: 60, reps: '8', rpe: null, note: '' })),
      },
    ]
    const had = pickerItem(workouts, { id: 'ex-a', type: 'free' })
    const fresh = pickerItem(workouts, { id: 'ex-b', type: 'free' })
    const choices = { days: 1, fills: [[{ kind: 'own', exerciseId: 'ex-a', item: had.item }, { kind: 'own', exerciseId: 'ex-b', item: fresh.item }]] }
    const { state } = planToState({ ...base(), workouts }, choices, idsFor(choices))
    const [a, b] = state.routines[0].exercises
    assert.equal(had.source, 'history')
    assert.deepEqual([a.sets, a.targets, a.suggestedWeights, a.restSec], [had.item.sets, had.item.targets, had.item.suggestedWeights, 120])
    assert.deepEqual(a.suggestedWeights, [60, 60, 60])
    assert.equal(fresh.source, 'starting')
    assert.deepEqual([b.sets, b.targets, b.restSec, b.suggestedWeights], [3, ['10', '10', '10'], 90, []])
  })

  it('a library entry picked in two slots becomes one exercise record; an archived own pick is restored', () => {
    const squat = visible.find((e) => e.staple && e.pattern === 'squat')
    const data = catalogItemToExercise(squat)
    const item = pickerItem([], data).item
    const state0 = { ...base(), exercises: [{ id: 'old', name: 'Old', type: 'free', archivedAt: '2026-09-01' }] }
    const choices = {
      days: 3,
      fills: [[{ kind: 'library', data, item }, { kind: 'own', exerciseId: 'old', restore: true, item }], [], [{ kind: 'library', data, item }]],
    }
    const { state } = planToState(state0, choices, idsFor(choices))
    assert.equal(state.exercises.length, 2)
    const created = state.exercises.find((ex) => ex.libraryId === squat.id)
    assert.equal(state.routines[0].exercises[0].exerciseId, created.id)
    assert.equal(state.routines[1].exercises[0].exerciseId, created.id, 'Full body C reuses it')
    assert.equal(state.exercises.find((ex) => ex.id === 'old').archivedAt, null)
    assert.deepEqual(state.routines.map((r) => r.name), ['Full body A', 'Full body C'], 'B (all skipped) not made')
    assert.deepEqual(state.schedule.slots.map((slot) => slot.weekday), [1, 5], 'nor its Wednesday')
  })

  it('planIds: the updater and the result draw the same ids (StrictMode-safe)', () => {
    const choices = fullChoices(2)
    const ids = planIds(choices, uid, NOW)
    assert.deepEqual(planToState(base(), choices, ids()).state, planToState(base(), choices, ids()).state)
  })
})

describe('req-181 AC4 — failure case and empty input', () => {
  it('schedule already has slots: routines added, schedule deep-equal to before', () => {
    const before = { ...base(), routines: [{ id: 'r0', name: 'Mine', exercises: [] }], schedule: { loopWeeks: 2, anchor: '2026-09-07', slots: [{ id: 's0', week: 1, weekday: 2, routineId: 'r0' }] } }
    const choices = fullChoices(3)
    const { state, scheduled } = planToState(before, choices, idsFor(choices))
    assert.equal(scheduled, false)
    assert.deepEqual(state.schedule, before.schedule)
    assert.equal(state.routines.length, 4)
  })

  it('every slot skipped → state deep-equal to before (no empty routine, no slot)', () => {
    const before = base()
    const choices = { days: 4, fills: [[null, null, null, null], [null, null]] }
    const { state, scheduled } = planToState(before, choices, idsFor(choices))
    assert.equal(scheduled, false)
    assert.deepEqual(state, before)
  })
})

describe('req-181 AC5 — library: dips moved to horizontal-push', () => {
  it('libraryProblems empty; 366 visible; vertical-push staples 8, horizontal-push staples 22', () => {
    const count = (pattern) => visible.filter((e) => e.staple && e.pattern === pattern).length
    const dips = visible.filter((e) => /dip/i.test(e.id) && e.family === 'fam-dip')
    console.log('visible', visible.length, 'vertical-push staples', count('vertical-push'), 'horizontal-push staples', count('horizontal-push'), 'dips', dips.map((e) => `${e.id}:${e.pattern}`).join(' '))
    assert.deepEqual(libraryProblems(library), [])
    assert.equal(visible.length, 366)
    assert.equal(count('vertical-push'), 8)
    assert.equal(count('horizontal-push'), 22)
    assert.equal(dips.length, 7)
    assert.ok(dips.every((e) => e.pattern === 'horizontal-push'))
  })
})

// ---- the real flow ----

let view
afterEach(async () => {
  await view?.unmount()
  view = null
})

const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
async function harness(payload) {
  localStorage.clear()
  // req-178 (sanctioned edit) — a device already past the one-time routine-kg fill, so
  // loading writes nothing and "v9 unchanged" still means the flow wrote nothing.
  localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
  localStorage.setItem('workout-mvp-v9', JSON.stringify(payload))
  const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
  const { RoutinePlan } = await importJsx('./views/Plan.jsx', import.meta.url)
  window.location.hash = '#/routines/new/plan'
  view = await render(h(StoreProvider, null, h(RoutinePlan)))
  await flush()
}
const stored = () => JSON.parse(localStorage.getItem('workout-mvp-v9'))
const link = (prefix) => view.all('a').find((a) => a.textContent.trim().startsWith(prefix))
const box = (prefix) =>
  view.all('label.ui-check').find((node) => node.textContent.trim().startsWith(prefix))?.querySelector('input') ?? null
async function visit(node) {
  await view.click(node)
  await flush()
}

describe('req-181 — the flow (rendered, real store)', () => {
  it('3 days: one own, one library, one skipped in A → Save → A made, Monday only, v9 read back', async () => {
    const chest = visible.find((e) => e.staple && e.pattern === 'horizontal-push' && shownName(e) === 'Bench Press')
    const squat = slotCandidates('squat', [], library).staples[0]
    const state = { ...emptyState(), exercises: [{ id: 'ex-own-bench', name: 'Bench Press', type: 'free', equipment: 'Barbell', libraryId: chest.id }] }
    await harness(state)
    assert.match(view.text(), /How many days a week\?/)
    await visit(link('3 days a week'))
    assert.deepEqual(view.all('h2').map((n) => n.textContent), ['Full body A', 'Full body B', 'Full body C'])

    await visit(link('Squat'))
    assert.ok(box(`${shownName(squat)} — `), 'the squat staples listed')
    assert.equal(box('Bench Press — '), null, 'not a squat')
    await view.click(box(`${shownName(squat)} — `))
    await visit(view.button('Use'))
    // req-182 (sanctioned edit) — a picked row leads with the exercise; the slot + plan is the meta.
    assert.match(view.text(), new RegExp(`${shownName(squat)}Squat · Starting plan: 3 × 10`))

    await visit(view.all('a').filter((a) => a.textContent.trim().startsWith('Chest press'))[0])
    assert.ok(box('Bench Press — Barbell'), 'own exercise from a chest staple leads the slot')
    await view.click(box('Bench Press — Barbell'))
    await visit(view.button('Use'))

    await visit(view.all('a').filter((a) => a.textContent.trim().startsWith('Row'))[0])
    await visit(view.button('Skip'))
    assert.match(view.text(), /Skipped/)

    assert.equal(localStorage.getItem('workout-mvp-v9'), JSON.stringify(state), 'nothing written before Save')
    await visit(view.button('Save'))
    assert.equal(window.location.hash, '#/')
    const after = stored()
    // req-182 (sanctioned edit) — Full body C's Squat and Chest press now carry A's picks
    // (same slots), so C is made too (Monday + Friday); B shares no slot with A and stays empty.
    assert.deepEqual(after.routines.map((r) => r.name), ['Full body A', 'Full body C'], 'B had nothing chosen')
    const items = after.routines[0].exercises
    const created = after.exercises.find((ex) => ex.libraryId === squat.id)
    assert.deepEqual(items.map((i) => i.exerciseId), [created.id, 'ex-own-bench'])
    assert.deepEqual(after.routines[1].exercises.map((i) => i.exerciseId), [created.id, 'ex-own-bench'])
    assert.equal(after.exercises.filter((ex) => ex.libraryId === squat.id).length, 1, 'one record')
    assert.deepEqual(after.schedule.slots.map((s) => [s.week, s.weekday]), [[0, 1], [0, 5]])
    assert.equal(after.schedule.loopWeeks, 1)
    assert.ok(items.every((i) => !i.suggestedWeights.some((kg) => Number(kg) > 0)), 'no kg without history')
  })

  it('a manual own exercise is not in the slot list but is found by typing', async () => {
    const state = { ...emptyState(), exercises: [{ id: 'ex-m', name: 'Goblet Thing', type: 'free', equipment: 'Dumbbell' }] }
    await harness(state)
    await visit(link('1 day a week'))
    await visit(link('Squat'))
    assert.equal(box('Goblet Thing — '), null)
    await view.type(view.input('Search'), 'goblet thing')
    assert.ok(box('Goblet Thing — '))
  })

  it('existing schedule → the routines only, done screen offers the schedule; schedule unchanged', async () => {
    const state = {
      ...emptyState(),
      routines: [{ id: 'r0', name: 'Mine', focus: 'Machines', exercises: [] }],
      schedule: { loopWeeks: 2, anchor: '2026-09-07', slots: [{ id: 's0', week: 0, weekday: 3, routineId: 'r0' }] },
    }
    await harness(state)
    await visit(link('1 day a week'))
    await visit(link('Core'))
    await view.click(view.all('label.ui-check')[0].querySelector('input'))
    await visit(view.button('Use'))
    await visit(view.button('Save'))
    assert.match(view.text(), /Add them to your schedule/)
    const after = stored()
    assert.deepEqual(after.schedule, state.schedule)
    assert.deepEqual(after.routines.map((r) => r.name), ['Mine', 'Full body'])
  })

  it('review: two Save taps in the same tick write one set of routines', async () => {
    const state = emptyState()
    await harness(state)
    await visit(link('2 days a week'))
    await visit(link('Squat'))
    await view.click(view.all('label.ui-check')[0].querySelector('input'))
    await visit(view.button('Use'))
    const save = view.button('Save')
    await act(async () => {
      save.click()
      save.click()
    })
    await flush()
    const after = stored()
    assert.deepEqual(after.routines.map((r) => r.name), ['Full body A'])
    assert.equal(after.exercises.length, 1)
    assert.equal(after.schedule.slots.length, 1)
    assert.equal(window.location.hash, '#/', 'went Home (scheduled), not the Done screen')
  })

  it('QA: the Fill screen\'s Cancel / Save row is pinned above the dock (the picker bar\'s class)', async () => {
    await harness(emptyState())
    await visit(link('1 day a week'))
    const bar = view.button('Save').closest('.ui-actions')
    assert.ok(bar.classList.contains('ui-picker-bar'))
    assert.ok([...bar.querySelectorAll('a')].some((a) => a.textContent.trim() === 'Cancel'))
    const css = readFileSync(new URL('./ui/ui.css', import.meta.url), 'utf8')
    const rule = css.slice(css.indexOf('.ui-picker-bar {'), css.indexOf('}', css.indexOf('.ui-picker-bar {')))
    assert.match(rule, /position: sticky/)
    assert.match(rule, /bottom: calc\(var\(--ui-dock-clear\)/)
  })

  it('abandon mid-flow: v9 unchanged', async () => {
    const state = emptyState()
    await harness(state)
    await visit(link('2 days a week'))
    await visit(link('Squat'))
    await view.click(view.all('label.ui-check')[0].querySelector('input'))
    await visit(view.button('Use'))
    await visit(view.all('a').find((a) => a.textContent.trim() === 'Cancel'))
    assert.equal(localStorage.getItem('workout-mvp-v9'), JSON.stringify(state))
  })
})

describe('req-181 — /routines/new offers two starts', () => {
  it('"Start from a plan" (primary, first) and "Blank routine" links; the blank form still makes a routine', async () => {
    localStorage.clear()
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { RoutineNew, RoutineNewBlank } = await importJsx('./views/Routine.jsx', import.meta.url)
    view = await render(h(StoreProvider, null, h(RoutineNew)))
    const links = view.all('a').map((a) => [a.textContent.trim(), a.getAttribute('href')])
    const plan = links.findIndex(([text]) => text === 'Start from a plan')
    const blank = links.findIndex(([text]) => text === 'Blank routine')
    assert.ok(plan >= 0 && blank > plan, JSON.stringify(links))
    await view.unmount()
    view = await render(h(StoreProvider, null, h(RoutineNewBlank)))
    await view.type(view.input('Name'), 'Legs')
    await view.click(view.button('Next'))
    assert.deepEqual(stored().routines.map((r) => r.name), ['Legs'])
  })
})
