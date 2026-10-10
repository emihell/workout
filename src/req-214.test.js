// req-214 (DEC-119 §3) — Home: a done workout is one Row "{name}  Done ✓ ›"; 2+ startable
// workouts today share ONE Start that asks which (the in-app sheet, askChoice); the
// scheduled-workout screen (`/schedule/:week/:weekday/:slotId`) gets a primary Start at the
// top — today's spot tagged with its slot/date/occurrence, any other date off-schedule.
// The screens render as the whole App under happy-dom with the clock mocked (the browser
// criteria, in a test); slotScreenDate / slotStart are pure and tested directly.
import { describe, it, afterEach } from 'node:test'
import { mock } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { act, importJsx, render } from './test-support/render.js'
import { spotStartOptions } from './schedule.js'
import { slotScreenDate, slotStart } from './views/schedule-day.js'

const here = dirname(fileURLToPath(import.meta.url))
const h = React.createElement

// Oct 2026: Tue 6, Wed 7, Thu 8 (today in every screen test), Fri 9.
const THU = '2026-10-08'
const NOW = new Date(2026, 9, 8, 12)
const seed = JSON.parse(readFileSync(join(here, 'db.json'), 'utf8'))
const slot = (id, weekday, routineId, week = 0) => ({ id, week, weekday, routineId })
const EMPTY = { id: 'r-empty', name: 'Empty one', focus: '', archivedAt: null, exercises: [] }
// each fixture copies a seed workout OF THAT ROUTINE (its snapshot carries the routine name)
const templateOf = (routineId) => seed.workouts.find((w) => w.routineId === routineId)
const finishedToday = (id, routineId, slotId) => ({
  ...templateOf(routineId),
  id,
  routineId,
  startedAt: new Date(2026, 9, 8, 9).toISOString(),
  finishedAt: new Date(2026, 9, 8, 10).toISOString(),
  performedOn: THU,
  scheduledFor: slotId ? THU : null,
  scheduleSlotId: slotId || null,
  occurrenceId: slotId ? `${slotId}@${THU}` : `adhoc-${routineId}@${THU}`,
})
const data = ({ slots, workouts = [], activeWorkout = null, routines = seed.routines } = {}) => ({
  ...seed,
  routines,
  schedule: { loopWeeks: 1, anchor: seed.schedule.anchor, slots },
  workouts: [...seed.workouts, ...workouts],
  activeWorkout,
  draftWorkouts: [],
})
const TWO_THU = [slot('s-up', 4, 'sess-upper'), slot('s-low', 4, 'sess-lower'), slot('s-fri', 5, 'sess-push-pull')]

let view = null
afterEach(async () => {
  if (view) await view.unmount()
  view = null
  mock.timers.reset()
})

async function open(hash, stored, now = NOW) {
  mock.timers.enable({ apis: ['setInterval', 'Date'], now })
  localStorage.clear()
  localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
  localStorage.setItem('workout-mvp-v8', JSON.stringify(stored))
  window.location.hash = `#${hash}`
  const { default: App } = await importJsx('./App.jsx', import.meta.url)
  view = await render(h(App))
  await settle()
}
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
const tap = async (node) => {
  await view.click(node)
  await settle()
}
const squash = (text) => text.replace(/\s+/g, '')
const block = () => view.container.querySelector('.ui-today-workout')
const buttons = (label) => [...document.body.querySelectorAll('button')].filter((b) => b.textContent.trim() === label)
const sheet = () => document.body.querySelector('.ui-sheet')
const saved = () => JSON.parse(localStorage.getItem('workout-mvp-v9'))
const encode = (path) => encodeURIComponent(path)

describe('scope 1 — a done workout is one Row', () => {
  it('AC1: one done + one pending → "Upper Body  Done ✓ ›" as one row; tapping it opens the session', async () => {
    await open('/', data({ slots: TWO_THU, workouts: [finishedToday('w-up', 'sess-upper', 's-up')] }))
    const rows = [...block().querySelectorAll('a.ui-row__link')]
    assert.equal(rows.length, 1)
    assert.equal(squash(rows[0].textContent), 'UpperBodyDone✓›')
    assert.equal(rows[0].querySelector('.ui-row__value').textContent, 'Done ✓')
    assert.equal(rows[0].getAttribute('href'), '#/history/w-up?from=%2F')
    assert.equal(view.text().includes('see your sets'), false)
    // the pending one keeps the one Start, which starts it directly (no sheet)
    assert.equal(buttons('Start').length, 1)
    await tap(rows[0])
    assert.equal(window.location.hash, '#/history/w-up?from=%2F')
  })

  it('another workout finished today (off-schedule) is a Row too: "Push / Pull  Done ✓ ›"', async () => {
    await open('/', data({ slots: [slot('s-up', 4, 'sess-upper')], workouts: [finishedToday('w-pp', 'sess-push-pull')] }))
    const rows = [...block().querySelectorAll('a.ui-row__link')]
    assert.deepEqual(rows.map((a) => squash(a.textContent)), ['Push/PullDone✓›'])
    assert.equal(rows[0].getAttribute('href'), '#/history/w-pp?from=%2F')
  })

  it('req-213\'s "Done Tue ✓" spot is the same one-line Row, linking that session, with no Start', async () => {
    const tue = { ...finishedToday('w-tue', 'sess-lower'), startedAt: new Date(2026, 9, 6, 9).toISOString(), finishedAt: new Date(2026, 9, 6, 10).toISOString(), performedOn: '2026-10-06', occurrenceId: 'adhoc-sess-lower@2026-10-06' }
    await open('/', data({ slots: [slot('s-low', 4, 'sess-lower')], workouts: [tue] }))
    const rows = [...block().querySelectorAll('a.ui-row__link')]
    assert.deepEqual(rows.map((a) => squash(a.textContent)), ['LowerBodyDoneTue✓›'])
    assert.equal(rows[0].getAttribute('href'), '#/history/w-tue?from=%2F')
    assert.equal(buttons('Start').length, 0)
  })
})

describe('scope 2 — one Start for several', () => {
  it('AC2: two pending → exactly one Start; it shows both names; picking the second starts it with its own slot', async () => {
    await open('/', data({ slots: TWO_THU }))
    assert.equal(buttons('Start').length, 1)
    assert.ok(block().textContent.includes('Upper Body') && block().textContent.includes('Lower Body'))
    await tap(buttons('Start')[0])
    assert.ok(sheet(), 'the sheet is open')
    assert.equal(sheet().querySelector('.ui-sheet__title').textContent, 'Start which workout?')
    const choices = [...sheet().querySelectorAll('.ui-sheet__choices button')].map((b) => b.textContent)
    assert.deepEqual(choices, ['Upper Body', 'Lower Body'])
    await tap(buttons('Lower Body')[0])
    const active = saved().activeWorkout
    assert.equal(active.routineId, 'sess-lower')
    assert.equal(active.scheduleSlotId, 's-low')
    assert.equal(active.scheduledFor, THU)
    assert.equal(active.occurrenceId, `s-low@${THU}`)
    assert.match(window.location.hash, /^#\/workout\/sess-lower/)
  })

  it('AC3 failure case: dismissing the sheet starts nothing (Cancel, and the backdrop)', async () => {
    await open('/', data({ slots: TWO_THU }))
    await tap(buttons('Start')[0])
    await tap(buttons('Cancel')[0])
    assert.equal(sheet(), null)
    assert.equal(saved().activeWorkout, null)
    assert.equal(window.location.hash, '#/')
    await tap(buttons('Start')[0])
    await tap(document.body.querySelector('.ui-sheet-backdrop'))
    assert.equal(sheet(), null)
    assert.equal(saved().activeWorkout, null)
    assert.equal(window.location.hash, '#/')
  })

  it('one startable + one empty workout → the one Start starts the startable one directly', async () => {
    const routines = [...seed.routines, EMPTY]
    await open('/', data({ routines, slots: [slot('s-empty', 4, 'r-empty'), slot('s-up', 4, 'sess-upper')] }))
    assert.ok(block().textContent.includes('Empty one'), 'its name still lists')
    await tap(buttons('Start')[0])
    assert.equal(sheet(), null, 'no sheet')
    assert.equal(saved().activeWorkout.scheduleSlotId, 's-up')
  })

  it('in progress: the hero keeps Continue; the 2 others share one Start (abandon confirm as before)', async () => {
    const running = { ...finishedToday('w-run', 'sess-push-pull'), finishedAt: null, startedAt: new Date(2026, 9, 8, 11).toISOString() }
    await open('/', data({ slots: TWO_THU.slice(0, 2), activeWorkout: running }))
    assert.equal(buttons('Continue').length, 1)
    assert.equal(buttons('Start').length, 1)
    await tap(buttons('Start')[0])
    await tap(buttons('Upper Body')[0])
    // startOrContinue's one-active rule (DEC-038) — unchanged: it asks before abandoning
    assert.ok(buttons('Abandon').length, 'abandon-on-new confirm')
    await tap(buttons('Cancel')[0])
    assert.equal(saved().activeWorkout.id, 'w-run')
  })
})

describe('scope 3 — Start on the scheduled-workout screen', () => {
  const fromDay = (weekday, date) => encode(`/schedule/0/${weekday}?date=${date}&from=/`)

  it('AC4: tomorrow\'s screen → Start makes an off-schedule workout (no scheduledFor)', async () => {
    await open(`/schedule/0/5/s-fri?from=${fromDay(5, '2026-10-09')}`, data({ slots: TWO_THU }))
    const start = buttons('Start')
    assert.equal(start.length, 1)
    assert.ok(start[0].classList.contains('ui-btn--primary'))
    await tap(start[0])
    const active = saved().activeWorkout
    assert.equal(active.routineId, 'sess-push-pull')
    assert.equal(active.scheduledFor, null)
    assert.equal(active.scheduleSlotId, null)
  })

  it('AC4: today\'s screen → Start is tagged with today (slot / date / occurrence, as Home)', async () => {
    await open(`/schedule/0/4/s-low?from=${fromDay(4, THU)}`, data({ slots: TWO_THU }))
    await tap(buttons('Start')[0])
    const active = saved().activeWorkout
    assert.equal(active.scheduledFor, THU)
    assert.equal(active.scheduleSlotId, 's-low')
    assert.equal(active.occurrenceId, `s-low@${THU}`)
  })

  it('the Start sits at the top, above the Days row', async () => {
    await open(`/schedule/0/4/s-low?from=${fromDay(4, THU)}`, data({ slots: TWO_THU }))
    const start = buttons('Start')[0]
    const days = [...view.container.querySelectorAll('.ui-row')].find((row) => row.textContent.includes('Days'))
    assert.ok(days, 'Days row present')
    assert.ok(start.compareDocumentPosition(days) & 4, 'Start before Days')
  })

  it('AC5: an empty workout → no Start on that screen', async () => {
    const routines = [...seed.routines, EMPTY]
    await open(`/schedule/0/4/s-empty?from=${fromDay(4, THU)}`, data({ routines, slots: [slot('s-empty', 4, 'r-empty')] }))
    assert.equal(buttons('Start').length, 0)
    assert.equal(buttons('Continue').length, 0)
  })

  it('in progress (this workout) → it reads Continue and resumes it', async () => {
    const running = { ...finishedToday('w-run', 'sess-lower', 's-low'), finishedAt: null, startedAt: new Date(2026, 9, 8, 11).toISOString() }
    await open(`/schedule/0/4/s-low?from=${fromDay(4, THU)}`, data({ slots: TWO_THU, activeWorkout: running }))
    assert.equal(buttons('Start').length, 0)
    await tap(buttons('Continue')[0])
    assert.equal(saved().activeWorkout.id, 'w-run')
    assert.match(window.location.hash, /^#\/workout\/sess-lower/)
  })

  it('today\'s spot already done → no Start (as the day screen\'s Start now)', async () => {
    await open(`/schedule/0/4/s-low?from=${fromDay(4, THU)}`, data({ slots: TWO_THU, workouts: [finishedToday('w-low', 'sess-lower', 's-low')] }))
    assert.equal(buttons('Start').length, 0)
  })
})

describe('slotScreenDate / slotStart (pure)', () => {
  const schedule = { loopWeeks: 1, anchor: seed.schedule.anchor, slots: TWO_THU }
  const upper = seed.routines.find((r) => r.id === 'sess-upper')

  it('the date comes from the day screen it was opened from; undated → today only when the slot is on today', () => {
    assert.equal(slotScreenDate(schedule, 0, 5, 's-fri', '/schedule/0/5?date=2026-10-09&from=/', NOW), '2026-10-09')
    assert.equal(slotScreenDate(schedule, 0, 4, 's-up', '/schedule/0/4', NOW), THU)
    assert.equal(slotScreenDate(schedule, 0, 4, 's-up', null, NOW), THU)
    assert.equal(slotScreenDate(schedule, 0, 5, 's-fri', '/schedule/0/5', NOW), null)
  })

  it('today → tagged with spotStartOptions; another date → off-schedule; a past date → none', () => {
    const store = { workouts: [], schedule, activeWorkout: null }
    assert.deepEqual(slotStart(store, upper, 's-up', THU, NOW), { label: 'Start', continueWorkout: null, options: spotStartOptions('s-up', THU) })
    assert.deepEqual(slotStart(store, upper, 's-up', '2026-10-15', NOW), { label: 'Start', continueWorkout: null, options: null })
    assert.deepEqual(slotStart(store, upper, 's-up', null, NOW), { label: 'Start', continueWorkout: null, options: null })
    assert.equal(slotStart(store, upper, 's-up', '2026-10-01', NOW), null)
    assert.equal(slotStart(store, EMPTY, 's-up', THU, NOW), null)
  })

  it('another workout in progress → still Start (startOrContinue asks before abandoning)', () => {
    const running = { id: 'w', routineId: 'sess-lower', startedAt: new Date(2026, 9, 8, 11).toISOString(), occurrenceId: `s-low@${THU}` }
    assert.equal(slotStart({ workouts: [], schedule, activeWorkout: running }, upper, 's-up', THU, NOW).label, 'Start')
  })
})
