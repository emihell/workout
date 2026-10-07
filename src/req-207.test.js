// req-207 (DEC-116) — first setup: pick your days, the name last ("New workout #N"); the same
// default for any workout made without a typed name; a day screen's "Change day". Pure:
// machinesPlan with chosen days and names, planToState not shifting chosen days, the N rule,
// the Change-day sheet and landing path. Rendered: the days/name step (Plan.jsx against the
// real store) and Blank workout / Change day (the whole App), as in req-190 / req-204.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { act, importJsx, render } from './test-support/render.js'
import { loadExerciseCatalog } from './exerciseCatalog.js'
import { emptyState } from './persistence.js'
import { SPLIT_AB, SPLIT_SAME, machinesPlan, mondayFirst, nextWorkoutName, nextWorkoutNames, planIds, planToState } from './plan-templates.js'
import { pickerItem } from './routine-picker.js'
// req-211 test edit: the schedule.js import went with the dated landing assertion (AC4 below).
import { changeDaySheet, changedDayPath } from './views/schedule-day.js'
import { answerConfirm, getPendingConfirm } from './ui/confirm.js'

const here = dirname(fileURLToPath(import.meta.url))
const h = React.createElement
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
await loadExerciseCatalog()

const WED = new Date(2026, 9, 7, 10) // Wed 2026-10-07
let counter = 0
const uid = (prefix) => `${prefix}-${++counter}`
const own = (id) => ({ kind: 'own', exerciseId: id, item: pickerItem([], { type: 'free' }).item, name: id })

describe('AC1 machinesPlan — chosen days and names', () => {
  it('2 days, Tue + Fri, A/B, today Tue → week [[2,0],[5,1]] and the provided names', () => {
    const plan = machinesPlan({ days: 2, split: SPLIT_AB, picks: ['a', 'b'], names: ['Legs', 'New workout #2'], weekdays: [5, 2], today: 2 })
    assert.deepEqual(plan.week, [[2, 0], [5, 1]])
    assert.deepEqual(plan.routines.map((r) => r.name), ['Legs', 'New workout #2'])
    assert.equal(plan.fixedDays, true)
  })
  it('DEC-105 §2: A is the first chosen day on or after today, then wrap (today not first in Mon–Sun)', () => {
    const ab = (weekdays, today) => machinesPlan({ days: weekdays.length, split: SPLIT_AB, picks: ['a', 'b'], weekdays, today }).week
    assert.deepEqual(ab([6, 2], 3), [[6, 0], [2, 1]], 'Sat + Tue, today Wed → Sat = A, Tue = B')
    assert.deepEqual(ab([2, 5], 3), [[5, 0], [2, 1]], 'Tue + Fri, today Wed → Fri = A')
    assert.deepEqual(ab([2, 5], 5), [[5, 0], [2, 1]], 'today chosen → today is A')
    assert.deepEqual(ab([1, 3, 5], 0), [[1, 0], [3, 1], [5, 0]], 'today Sun → Mon first')
  })
  it('Mon–Sun order (Sunday last); A/B alternates over that order; Same → one workout', () => {
    assert.deepEqual(mondayFirst([0, 3, 1, 3]), [1, 3, 0])
    assert.deepEqual(machinesPlan({ days: 3, split: SPLIT_AB, picks: ['a', 'b'], weekdays: [0, 6, 2] }).week, [[2, 0], [6, 1], [0, 0]])
    assert.deepEqual(machinesPlan({ days: 2, split: SPLIT_SAME, picks: ['a'], names: ['Mine'], weekdays: [4, 1] }), {
      routines: [{ name: 'Mine', picks: ['a'] }],
      week: [[1, 0], [4, 0]],
      fixedDays: true,
    })
  })
  it('an empty name falls back; no names/weekdays → the old shape (unchanged for the template callers)', () => {
    assert.deepEqual(machinesPlan({ days: 2, split: SPLIT_AB, picks: ['a', 'b'], names: ['  ', 'B'] }).routines.map((r) => r.name), ['Workout A', 'B'])
    assert.equal('fixedDays' in machinesPlan({ days: 2, split: SPLIT_SAME, picks: ['a'] }), false)
  })
  it('planToState puts chosen days on as given (no start-today shift); the template days still shift', () => {
    const picks = [own('ex-a'), own('ex-b')]
    const chosen = { days: 2, split: SPLIT_AB, picks, names: ['Legs', 'New workout #2'], weekdays: [2, 5] }
    const { state } = planToState(emptyState(), chosen, planIds(chosen, uid, WED)())
    const name = Object.fromEntries(state.routines.map((r) => [r.id, r.name]))
    assert.deepEqual(state.schedule.slots.map((s) => [s.week, s.weekday, name[s.routineId]]), [[0, 2, 'Legs'], [0, 5, 'New workout #2']])
    // Today (Wed) chosen → today has a slot (DEC-105: it starts today).
    const today = { days: 2, split: SPLIT_SAME, picks, names: ['X'], weekdays: [3, 6] }
    assert.deepEqual(planToState(emptyState(), today, planIds(today, uid, WED)()).state.schedule.slots.map((s) => s.weekday), [3, 6])
    // Today (Wed) in `choices` orders A/B from today: Sat + Tue → Sat is A; the days stay as chosen.
    const wed = { days: 2, split: SPLIT_AB, picks, names: ['A1', 'B1'], weekdays: [2, 6], today: 3 }
    const ws = planToState(emptyState(), wed, planIds(wed, uid, WED)()).state
    const wn = Object.fromEntries(ws.routines.map((x) => [x.id, x.name]))
    assert.deepEqual(ws.schedule.slots.map((s) => [s.weekday, wn[s.routineId]]), [[6, 'A1'], [2, 'B1']])
    const old = { days: 2, split: SPLIT_SAME, picks }
    assert.deepEqual(planToState(emptyState(), old, planIds(old, uid, WED)()).state.schedule.slots.map((s) => s.weekday), [3, 6], 'Mon/Thu shifted to Wed/Sat')
  })
})

describe('AC1 the N rule', () => {
  const r = (name, archivedAt = null) => ({ id: name, name, archivedAt })
  it('existing "New workout #1" and "#3" → 2', () => {
    assert.equal(nextWorkoutName([r('New workout #1'), r('New workout #3')]), 'New workout #2')
  })
  it('none → #1; an archived one does not count; A/B takes the next free after N', () => {
    assert.equal(nextWorkoutName([]), 'New workout #1')
    assert.equal(nextWorkoutName(undefined), 'New workout #1')
    assert.equal(nextWorkoutName([r('New workout #1', '2026-10-01T00:00:00.000Z')]), 'New workout #1')
    assert.deepEqual(nextWorkoutNames([r('New workout #1'), r('New workout #3')], 2), ['New workout #2', 'New workout #4'])
    assert.deepEqual(nextWorkoutNames([r('Legs')], 2), ['New workout #1', 'New workout #2'])
  })
})

describe('§4 Change day — the sheet and where it lands (pure)', () => {
  it('7 weekdays Mon–Sun, the current one marked; a day already holding this workout is left out', () => {
    const sheet = changeDaySheet('Upper Body', 1, 0, 1, [1, 4])
    assert.equal(sheet.title, 'Move Upper Body to which day?')
    assert.equal(sheet.message, 'It moves for every week. Your history is kept.')
    assert.deepEqual(sheet.choices.map((c) => c.label), ['Monday (now)', 'Tuesday', 'Wednesday', 'Friday', 'Saturday', 'Sunday'])
    assert.deepEqual(changeDaySheet('X', 3, 0, 1).choices.map((c) => c.value), ['1', '2', '3', '4', '5', '6', '0'])
    assert.equal(changeDaySheet('X', 6, 1, 2).message, 'It moves in week 2 of 2. Your history is kept.')
  })
  it('lands on the new day in the same loop week; a dated screen keeps the same Mon–Sun week', () => {
    assert.equal(changedDayPath(0, 6, null), '/schedule/0/6')
    assert.equal(changedDayPath(1, 6, '2026-10-07'), '/schedule/1/6?date=2026-10-10')
    assert.equal(changedDayPath(0, 0, '2026-10-05'), '/schedule/0/0?date=2026-10-11', 'Sunday is the end of the week')
  })
})

// ── rendered ───────────────────────────────────────────────────────────────────────────
let view = null
afterEach(async () => {
  if (view) await view.unmount()
  view = null
  if (getPendingConfirm()) answerConfirm(null)
})
const stored = () => JSON.parse(localStorage.getItem('workout-mvp-v9'))
const squash = (text) => text.replace(/\s+/g, '')
async function tap(node) {
  await view.click(node)
  await flush()
}
const button = (label) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === label) ?? null
const chip = (label) => view.all('[aria-label="Days"] button').find((b) => b.textContent.trim() === label)
const pressed = () => view.all('[aria-label="Days"] button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent.trim())
const field = (label) => view.all('label.ui-field').find((l) => l.querySelector('.ui-field__label')?.textContent === label)?.querySelector('input') ?? null
async function type(input, value) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, value)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  await flush()
}
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const seeded = (routines = []) => ({
  ...emptyState(),
  exercises: [
    { id: 'ex-lp', name: 'Leg Press', type: 'machine', equipment: 'Machine', libraryId: 'Leg_Press' },
    { id: 'ex-cp', name: 'Chest Press', type: 'machine', equipment: 'Machine' },
  ],
  routines,
})
async function setup(state = seeded()) {
  localStorage.clear()
  localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
  localStorage.setItem('workout-mvp-v9', JSON.stringify(state))
  const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
  const views = await importJsx('./views/Plan.jsx', import.meta.url)
  window.location.hash = '#/routines/new/machines'
  view = await render(h(StoreProvider, null, h(views.RoutineMachines)))
  await flush()
  const box = (prefix) => view.all('label.ui-check').find((n) => n.textContent.trim().startsWith(prefix)).querySelector('input')
  await view.click(box('Leg Press — '))
  await view.click(box('Chest Press — '))
  await tap(button('Next (2)'))
  await tap(view.all('.ui-seg__item').find((n) => n.textContent.trim() === '2'))
}

describe('AC2/AC3 the days and name step (rendered)', () => {
  // req-210 test edit: was "2 days preselect today and +3" — no day is pre-picked now (DEC-117 §6).
  it('2 days pick nothing; A/B names prefilled #1/#2; Tue/Fri + "Legs" saves as picked', async () => {
    await setup()
    const today = new Date().getDay()
    assert.deepEqual(pressed(), [])
    await tap(view.all('label.ui-check').find((n) => n.textContent.trim() === 'Two workouts, A and B').querySelector('input'))
    assert.equal(field('Name A').value, 'New workout #1')
    assert.equal(field('Name B').value, 'New workout #2')
    // The name boxes are the last thing above Save.
    const order = squash(view.text())
    assert.ok(order.indexOf('NameA') > order.indexOf('LegPress') && order.indexOf('NameB') > order.indexOf('NameA'))
    for (const label of pressed()) await tap(chip(label))
    await tap(chip('Tue'))
    await tap(chip('Fri'))
    await type(field('Name A'), 'Legs')
    assert.match(view.text(), /every Tue/i, 'the preview follows the picked days')
    await tap(button('Save'))
    const after = stored()
    const name = Object.fromEntries(after.routines.map((r) => [r.id, r.name]))
    assert.deepEqual(after.routines.map((r) => r.name), ['Legs', 'New workout #2'])
    // A ("Legs") is the first of Tue/Fri on or after today (DEC-105 §2).
    const firstA = (5 - today + 7) % 7 < (2 - today + 7) % 7 ? 5 : 2
    assert.deepEqual(
      after.schedule.slots.map((s) => [s.weekday, name[s.routineId]]).sort((x, y) => x[0] - y[0]),
      [[2, firstA === 2 ? 'Legs' : 'New workout #2'], [5, firstA === 5 ? 'Legs' : 'New workout #2']],
    )
  })

  // req-210 test edit: the chips start empty (DEC-117 §6), so the test ticks its own 2 first;
  // the 3-ticked / 1-ticked failure half is unchanged.
  it('failure case: 3 days ticked for a 2-day plan → Save disabled + "Pick 2 days"; 1 ticked → the same', async () => {
    await setup()
    assert.equal(button('Save').disabled, true)
    assert.match(view.text(), /Pick 2 days/)
    await tap(chip('Mon'))
    await tap(chip('Thu'))
    const extra = SHORT.find((label) => !pressed().includes(label))
    await tap(chip(extra))
    assert.equal(pressed().length, 3)
    assert.equal(button('Save').disabled, true)
    assert.match(view.text(), /Pick 2 days/)
    await tap(chip(extra))
    await tap(chip(pressed()[0]))
    assert.equal(pressed().length, 1)
    assert.equal(button('Save').disabled, true)
    assert.match(view.text(), /Pick 2 days/)
    await tap(chip(extra))
    assert.equal(button('Save').disabled, false)
    assert.doesNotMatch(view.text(), /Pick 2 days/)
  })

  it('an emptied name box saves its prefill; the prefill skips an existing "New workout #1"', async () => {
    await setup(seeded([{ id: 'r1', name: 'New workout #1', focus: 'Machines', exercises: [] }]))
    assert.equal(field('Name').value, 'New workout #2')
    await type(field('Name'), '')
    // req-210 test edit: tick the 2 days first — nothing is pre-picked any more (DEC-117 §6).
    await tap(chip('Tue'))
    await tap(chip('Fri'))
    await tap(button('Save'))
    assert.deepEqual(stored().routines.map((r) => r.name), ['New workout #1', 'New workout #2'])
  })
})

// ── the whole App: Blank workout, Change day ─────────────────────────────────────────────
const seed = JSON.parse(readFileSync(join(here, 'db.json'), 'utf8'))
async function open(hash, data = seed) {
  localStorage.clear()
  localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
  localStorage.setItem('workout-mvp-v8', JSON.stringify(data))
  window.location.hash = `#${hash}`
  const { default: App } = await importJsx('./App.jsx', import.meta.url)
  view = await render(h(App))
  await flush()
}

describe('§3 Blank workout uses the same default', () => {
  it('the Name box starts "New workout #1"; emptied, Save still makes "New workout #1"', async () => {
    await open('/routines/new/blank')
    assert.equal(field('Name').value, 'New workout #1')
    await type(field('Name'), '')
    await tap(button('Next'))
    assert.ok(stored().routines.some((r) => r.name === 'New workout #1'))
  })
})

// req-208 test edit: Change day sits behind the slot row's "⋯" — every `tap(button('Change
// day'))` below became `openChangeDay()` (⋯, then the menu's Change day). Assertions unchanged.
async function openChangeDay() {
  await tap(button('⋯'))
  await tap(button('Change day'))
}

// req-211 test edit (DEC-117 §2): a DATED day screen (from Home, `from=/`) now moves one date
// only; the every-week move below lives on the Schedule's undated day, so these two tests open
// `/schedule/0/1` (no `from=/`). The landing is that undated day; the dated landing is
// req-211.test.js's. Every other assertion is unchanged.
describe('AC4 Change day (rendered)', () => {
  it('Monday → Saturday: removeSlot + addSlot, same count, history untouched, lands on Saturday', async () => {
    await open('/schedule/0/1')
    const before = stored()
    await openChangeDay()
    const pending = getPendingConfirm()
    assert.equal(pending.title, 'Move Upper Body to which day?')
    assert.equal(pending.choices[0].label, 'Monday (now)')
    await act(async () => answerConfirm('6'))
    await flush()
    const after = stored()
    assert.equal(after.schedule.slots.length, before.schedule.slots.length)
    assert.deepEqual(after.schedule.slots.filter((s) => s.routineId === 'sess-upper').map((s) => [s.week, s.weekday]), [[0, 6]])
    assert.equal(after.workouts.length, before.workouts.length)
    assert.deepEqual(after.workouts, before.workouts)
    assert.equal(window.location.hash, '#/schedule/0/6')
    assert.match(view.text(), /Every Saturday/)
    assert.match(view.text(), /Upper Body/)
  })

  it('Cancel or the current day writes nothing', async () => {
    await open('/schedule/0/1')
    const before = localStorage.getItem('workout-mvp-v9')
    await openChangeDay()
    await act(async () => answerConfirm(false))
    await flush()
    await openChangeDay()
    await act(async () => answerConfirm('1'))
    await flush()
    assert.equal(localStorage.getItem('workout-mvp-v9'), before)
    assert.equal(window.location.hash, '#/schedule/0/1')
  })

  it('in a 2-week loop it stays in that loop week', async () => {
    const two = { ...seed, schedule: { loopWeeks: 2, anchor: seed.schedule.anchor, slots: [{ id: 's-w2', week: 1, weekday: 3, routineId: 'sess-lower' }] } }
    await open('/schedule/1/3', two)
    await openChangeDay()
    assert.equal(getPendingConfirm().message, 'It moves in week 2 of 2. Your history is kept.')
    await act(async () => answerConfirm('5'))
    await flush()
    assert.deepEqual(stored().schedule.slots.map((s) => [s.week, s.weekday, s.routineId]), [[1, 5, 'sess-lower']])
    assert.equal(window.location.hash, '#/schedule/1/5')
  })
})
