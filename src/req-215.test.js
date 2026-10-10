// req-215 (DEC-119 §4) — a later workout is exercises + name (no days step, schedule untouched);
// "Use a plan" only with no workout; the "Days" row on the workout's screen. Pure: schedule-days.js
// (the chip toggle, criteria 4–5) and machinesPlan/planToState with `schedule: false`. Rendered:
// /routines/new, the machines flow and RoutineDetail against the real store.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, importJsx, render } from './test-support/render.js'
import { loadExerciseCatalog } from './exerciseCatalog.js'
import { emptyState } from './persistence.js'
import { SPLIT_SAME, machinesPlan, planIds, planToState } from './plan-templates.js'
import { pickerItem } from './routine-picker.js'
import { slotAddedState, slotRemovedState } from './state-reducers.js'
import { daysRowText, daysToggle, hasActiveWorkout, routineWeekdays } from './schedule-days.js'
import { navForBase } from './views/routine-nav.js'

const h = React.createElement
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
await loadExerciseCatalog()

// Apply a toggle the way DaysRow does (removeSlot / addSlot reducers), ids made here.
let counter = 0
function apply(state, routineId, weekday) {
  const { add, remove } = daysToggle(state.schedule, routineId, weekday)
  let s = state
  for (const id of remove) s = slotRemovedState(s, id)
  for (const slot of add) s = slotAddedState(s, { id: `slot-t${++counter}`, ...slot })
  return s
}
const WED = 3
const MON = 1
const withSlots = (loopWeeks, slots) => ({ ...emptyState(), schedule: { loopWeeks, slots } })

describe('AC4 — the Days chip toggle (schedule-days.js)', () => {
  it('2-week loop: Wed on → 2 slots (this routine, weekday 3, weeks 0 and 1); off → both gone, r2 untouched', () => {
    const before = withSlots(2, [{ id: 'other-wed', week: 0, weekday: WED, routineId: 'r2' }])
    assert.deepEqual(routineWeekdays(before.schedule, 'r1'), [])
    const on = apply(before, 'r1', WED)
    const mine = on.schedule.slots.filter((s) => s.routineId === 'r1')
    assert.deepEqual(mine.map((s) => [s.week, s.weekday]), [[0, WED], [1, WED]])
    assert.equal(on.schedule.slots.length, 3)
    assert.deepEqual(routineWeekdays(on.schedule, 'r1'), [WED])
    const off = apply(on, 'r1', WED)
    assert.deepEqual(off.schedule.slots, [{ id: 'other-wed', week: 0, weekday: WED, routineId: 'r2' }])
  })

  it('days read Mon–Sun (Sunday last); the row reads the days or "Not scheduled"', () => {
    const s = withSlots(1, [
      { id: 'a', week: 0, weekday: 0, routineId: 'r1' },
      { id: 'b', week: 0, weekday: 4, routineId: 'r1' },
    ])
    assert.deepEqual(routineWeekdays(s.schedule, 'r1'), [4, 0])
    assert.equal(daysRowText(s, 'r1'), 'Thu and Sun')
    assert.equal(daysRowText(s, 'r9'), 'Not scheduled')
  })
})

describe('AC5 — failure case: mixed weeks', () => {
  it('Mon in week 1 only reads on; off removes that one slot; on again adds Mon to both weeks', () => {
    const before = withSlots(2, [
      { id: 'mon-w1', week: 0, weekday: MON, routineId: 'r1' },
      { id: 'other', week: 1, weekday: MON, routineId: 'r2' },
    ])
    assert.deepEqual(routineWeekdays(before.schedule, 'r1'), [MON])
    assert.deepEqual(daysToggle(before.schedule, 'r1', MON), { on: false, add: [], remove: ['mon-w1'] })
    const off = apply(before, 'r1', MON)
    assert.deepEqual(off.schedule.slots.map((s) => s.id), ['other'])
    const on = apply(off, 'r1', MON)
    assert.deepEqual(
      on.schedule.slots.filter((s) => s.routineId === 'r1').map((s) => [s.week, s.weekday]),
      [[0, MON], [1, MON]],
    )
  })
})

describe('§1 — a later workout never touches the schedule', () => {
  const own = (id) => ({ kind: 'own', exerciseId: id, item: pickerItem([], { type: 'free' }).item, name: id })
  const choices = { days: 1, split: SPLIT_SAME, picks: [own('ex-a'), own('ex-b')], names: ['Legs'], schedule: false }
  it('machinesPlan with schedule: false has one routine and no week', () => {
    const plan = machinesPlan(choices)
    assert.equal(plan.routines.length, 1)
    assert.deepEqual(plan.week, [])
  })
  it('planToState on an EMPTY schedule: one routine made, schedule deep-equal to before, scheduled false', () => {
    let n = 0
    const state = { ...emptyState(), exercises: [{ id: 'ex-a', name: 'A', type: 'free' }, { id: 'ex-b', name: 'B', type: 'free' }] }
    const ids = planIds(choices, (p) => `${p}-${++n}`, new Date(2026, 9, 7))
    const out = planToState(state, choices, ids())
    assert.equal(out.scheduled, false)
    assert.deepEqual(out.state.schedule, state.schedule)
    assert.deepEqual(out.state.routines.map((r) => [r.name, r.exercises.map((i) => i.exerciseId)]), [['Legs', ['ex-a', 'ex-b']]])
  })
  it('without schedule: false the first-time plan still schedules an empty schedule (unchanged)', () => {
    let n = 0
    const first = { ...choices, schedule: undefined, weekdays: [2], today: 2 }
    const state = { ...emptyState(), exercises: [{ id: 'ex-a', name: 'A', type: 'free' }, { id: 'ex-b', name: 'B', type: 'free' }] }
    const out = planToState(state, first, planIds(first, (p) => `${p}-${++n}`, new Date(2026, 9, 7))())
    assert.equal(out.scheduled, true)
    assert.deepEqual(out.state.schedule.slots.map((s) => s.weekday), [2])
  })
  it('hasActiveWorkout: an archived workout does not count', () => {
    assert.equal(hasActiveWorkout([]), false)
    assert.equal(hasActiveWorkout([{ id: 'r', archivedAt: '2026-01-01' }]), false)
    assert.equal(hasActiveWorkout([{ id: 'r' }]), true)
  })
})

// ── rendered ───────────────────────────────────────────────────────────────────────────
let view = null
afterEach(async () => {
  await view?.unmount()
  view = null
})
const stored = () => JSON.parse(localStorage.getItem('workout-mvp-v9'))
const link = (text) => view.all('a').find((a) => a.textContent.trim() === text) ?? null
const button = (label) => view.all('button').find((b) => b.textContent.trim() === label) ?? null
const chip = (label) => view.all('[aria-label="Days"] button').find((b) => b.textContent.trim() === label)
const pressed = () => view.all('[aria-label="Days"] button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent.trim())
const field = (label) => view.all('label.ui-field').find((l) => l.querySelector('.ui-field__label')?.textContent === label)?.querySelector('input') ?? null
async function tap(node) {
  await view.click(node)
  await flush()
}
const routine = (id, name, extra = {}) => ({ id, name, focus: 'Machines', exercises: [], ...extra })
const seeded = (routines = [], schedule = undefined) => ({
  ...emptyState(),
  exercises: [
    { id: 'ex-lp', name: 'Leg Press', type: 'machine', equipment: 'Machine', libraryId: 'Leg_Press' },
    { id: 'ex-cp', name: 'Chest Press', type: 'machine', equipment: 'Machine' },
  ],
  routines,
  ...(schedule ? { schedule: { ...emptyState().schedule, ...schedule } } : {}),
})
async function mount(file, component, props, state, hash = '#/') {
  localStorage.clear()
  localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
  localStorage.setItem('workout-mvp-v9', JSON.stringify(state))
  const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
  const views = await importJsx(file, import.meta.url)
  window.location.hash = hash
  view = await render(h(StoreProvider, null, h(views[component], props)))
  await flush()
}

describe('AC3 — "Use a plan" only with no workout', () => {
  it('no workout (or only an archived one): shown; one active workout: not shown', async () => {
    await mount('./views/Routine.jsx', 'RoutineNew', {}, seeded())
    assert.equal(link('Not sure? Use a plan')?.getAttribute('href'), '#/routines/new/plan')
    await view.unmount()
    await mount('./views/Routine.jsx', 'RoutineNew', {}, seeded([routine('old', 'Old', { archivedAt: '2026-01-01T00:00:00.000Z' })]))
    assert.ok(link('Not sure? Use a plan'))
    await view.unmount()
    await mount('./views/Routine.jsx', 'RoutineNew', {}, seeded([routine('r1', 'Upper')]))
    assert.equal(link('Not sure? Use a plan'), null)
    assert.ok(link('Pick your exercises'), 'the primary start stays')
    assert.ok(link('Blank workout'))
  })
})

async function pickTwo() {
  const box = (prefix) => view.all('label.ui-check').find((n) => n.textContent.trim().startsWith(prefix)).querySelector('input')
  await view.click(box('Leg Press — '))
  await view.click(box('Chest Press — '))
  await tap(button('Next (2)'))
}

describe('AC1 / AC2 — the machines flow', () => {
  it('≥1 workout: pick 2 → name → Save; no days step; slots unchanged; lands on the new workout', async () => {
    const schedule = { loopWeeks: 1, slots: [{ id: 's1', week: 0, weekday: 1, routineId: 'r1' }] }
    await mount('./views/Plan.jsx', 'RoutineMachines', {}, seeded([routine('r1', 'Upper')], schedule), '#/routines/new/machines')
    await pickTwo()
    assert.equal(view.all('.ui-seg__item').length, 0, 'no days count, no chips')
    assert.doesNotMatch(view.text(), /How many days|Two workouts, A and B|Same workout every time/)
    assert.equal(field('Name').value, 'New workout #1')
    const before = stored()
    await tap(button('Save'))
    const after = stored()
    assert.deepEqual(after.schedule, before.schedule, 'schedule untouched')
    assert.equal(after.schedule.slots.length, 1)
    assert.equal(after.routines.length, 2, 'one workout made')
    const made = after.routines[1]
    assert.deepEqual([made.name, made.exercises.map((i) => i.exerciseId)], ['New workout #1', ['ex-lp', 'ex-cp']])
    assert.equal(window.location.hash, `#/routines/${made.id}`)
  })

  it('≥1 workout and an EMPTY schedule: still no days, still no slot written', async () => {
    await mount('./views/Plan.jsx', 'RoutineMachines', {}, seeded([routine('r1', 'Upper')]), '#/routines/new/machines')
    await pickTwo()
    await tap(button('Save'))
    assert.deepEqual(stored().schedule.slots, [])
    assert.equal(stored().routines.length, 2)
  })

  it('fresh store: the first-time flow still shows the day count and the chips', async () => {
    await mount('./views/Plan.jsx', 'RoutineMachines', {}, seeded(), '#/routines/new/machines')
    await pickTwo()
    assert.match(view.text(), /How many days a week\?/)
    await tap(view.all('.ui-seg__item').find((n) => n.textContent.trim() === '1'))
    assert.equal(view.all('[aria-label="Days"] button').length, 7)
    await tap(chip('Wed'))
    await tap(button('Save'))
    assert.deepEqual(stored().schedule.slots.map((s) => s.weekday), [WED], 'still schedules')
  })
})

describe('AC4 / AC6 — the Days row (rendered)', () => {
  it('2-week loop: Not scheduled → Wed on writes 2 slots → off removes both; r2\'s Wed untouched', async () => {
    const schedule = { loopWeeks: 2, slots: [{ id: 'other-wed', week: 0, weekday: WED, routineId: 'r2' }] }
    // r1 has no exercises — an empty workout can still be scheduled (AC6).
    await mount('./views/Routine.jsx', 'RoutineDetail', { routineId: 'r1' }, seeded([routine('r1', 'Upper'), routine('r2', 'Lower')], schedule), '#/routines/r1')
    assert.match(view.text(), /DaysNot scheduled/)
    await tap(button('Change'))
    assert.deepEqual(pressed(), [])
    await tap(chip('Wed'))
    const on = stored().schedule.slots
    assert.deepEqual(on.filter((s) => s.routineId === 'r1').map((s) => [s.week, s.weekday]), [[0, WED], [1, WED]])
    assert.equal(on.length, 3)
    assert.deepEqual(pressed(), ['Wed'])
    assert.match(view.text(), /Wed \(week 1\) and Wed \(week 2\)/)
    await tap(chip('Wed'))
    assert.deepEqual(stored().schedule.slots, [{ id: 'other-wed', week: 0, weekday: WED, routineId: 'r2' }])
    assert.match(view.text(), /DaysNot scheduled/)
  })

  it('mixed weeks: Mon in week 1 only shows on; off removes it; on adds both weeks', async () => {
    const schedule = { loopWeeks: 2, slots: [{ id: 'mon-w1', week: 0, weekday: MON, routineId: 'r1' }] }
    await mount('./views/Routine.jsx', 'RoutineDetail', { routineId: 'r1' }, seeded([routine('r1', 'Upper')], schedule), '#/routines/r1')
    await tap(button('Change'))
    assert.deepEqual(pressed(), ['Mon'])
    await tap(chip('Mon'))
    assert.deepEqual(stored().schedule.slots, [])
    await tap(chip('Mon'))
    assert.deepEqual(stored().schedule.slots.map((s) => [s.week, s.weekday, s.routineId]), [[0, MON, 'r1'], [1, MON, 'r1']])
  })

  it('hidden on an archived workout, and in the setup / recalc flows (showDays: false)', async () => {
    await mount('./views/Routine.jsx', 'RoutineDetail', { routineId: 'r1' }, seeded([routine('r1', 'Upper', { archivedAt: '2026-01-01T00:00:00.000Z' })]), '#/routines/r1')
    assert.doesNotMatch(view.text(), /Not scheduled/)
    assert.equal(button('Change'), null)
    await view.unmount()
    const paths = navForBase('/workout/r1/setup', '/workout/r1', { showDelete: false, showDays: false })
    await mount('./views/Routine.jsx', 'RoutineDetail', { routineId: 'r1', paths }, seeded([routine('r1', 'Upper')]), '#/workout/r1/setup')
    assert.doesNotMatch(view.text(), /Not scheduled/)
  })

  it('shows on the scheduled-workout screen (ScheduleSlot renders RoutineDetail)', async () => {
    const schedule = { loopWeeks: 1, slots: [{ id: 's1', week: 0, weekday: MON, routineId: 'r1' }] }
    await mount('./views/Schedule.jsx', 'ScheduleSlot', { week: 0, weekday: MON, slotId: 's1' }, seeded([routine('r1', 'Upper')], schedule), '#/schedule/0/1/s1')
    assert.match(view.text(), /DaysMon/)
    await tap(button('Change'))
    await tap(chip('Thu'))
    assert.deepEqual(stored().schedule.slots.map((s) => s.weekday).sort(), [1, 4])
  })
})
