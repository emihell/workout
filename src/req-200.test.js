// req-200 (DEC-110 §4) — Home shows this week: today's block first, then Mon–Sun with rest
// days; a day opens its ScheduleDay (Start now, an honest loop title, Back to where it came
// from). `weekRows` (schedule.js) is pure and tested directly; the screens are rendered as
// the whole App under happy-dom (test-support/render.js), as in req-198/199.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { act, importJsx, render } from './test-support/render.js'
import { addDays, dateKey, mondayOf, weekRows } from './schedule.js'
import { slotAddedState, slotRemovedState } from './state-reducers.js'
import { withFrom } from './route.js'

const here = dirname(fileURLToPath(import.meta.url))
const read = (path) => readFileSync(join(here, path), 'utf8')
const h = React.createElement
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

// ── weekRows (pure) ──────────────────────────────────────────────────────────────────
// A 2-week loop anchored on Mon 2026-10-12: that week is loop week 0 ("week 1"), so Sat
// 10-17 is week 0 and Sat 10-10 is week 1 ("week 2"). Week 1's Saturday holds A, week 2's
// holds B (the review B1 probe's shape). Monday of week 1 holds two slots.
const TWO_WEEK = {
  loopWeeks: 2,
  anchor: '2026-10-12',
  slots: [
    { id: 's-a', week: 0, weekday: 6, routineId: 'A' },
    { id: 's-b', week: 1, weekday: 6, routineId: 'B' },
    { id: 's-m1', week: 0, weekday: 1, routineId: 'A' },
    { id: 's-m2', week: 0, weekday: 1, routineId: 'B' },
  ],
}

describe('weekRows', () => {
  it('returns 7 rows Mon–Sun of the given date\'s calendar week, rest days included', () => {
    const rows = weekRows(TWO_WEEK, [], new Date(2026, 9, 8, 12)) // Thu 2026-10-08
    assert.deepEqual(rows.map((r) => r.dateKey), ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'])
    assert.deepEqual(rows.map((r) => r.weekday), [1, 2, 3, 4, 5, 6, 0])
    assert.deepEqual(rows[1].slots, [], 'Tuesday is a rest day: a row with no slots')
  })

  it('AC1: a Sunday today still gets the Mon–Sun week it ends', () => {
    const rows = weekRows(TWO_WEEK, [], new Date(2026, 9, 11, 9)) // Sun 2026-10-11
    assert.equal(rows[0].dateKey, '2026-10-05')
    assert.equal(rows[6].dateKey, '2026-10-11')
  })

  it('AC1: 2-week loop (Sat A in week 1, Sat B in week 2) → B on Sat 2026-10-10, A on 2026-10-17', () => {
    // anchor 2026-10-12 → 10-05's week is loop week 1 (week 2 of 2), 10-12's is week 0.
    const first = weekRows(TWO_WEEK, [], new Date(2026, 9, 10, 12))
    const sat1 = first.find((r) => r.dateKey === '2026-10-10')
    assert.equal(sat1.week, 1)
    assert.deepEqual(sat1.slots.map((s) => s.routineId), ['B'])
    const second = weekRows(TWO_WEEK, [], new Date(2026, 9, 17, 12))
    const sat2 = second.find((r) => r.dateKey === '2026-10-17')
    assert.equal(sat2.week, 0)
    assert.deepEqual(sat2.slots.map((s) => s.routineId), ['A'])
  })

  it('AC1: a day with 2 slots returns both, in schedule order', () => {
    const rows = weekRows(TWO_WEEK, [], new Date(2026, 9, 14, 12)) // week of 10-12 = loop week 0
    assert.deepEqual(rows[0].slots.map((s) => s.id), ['s-m1', 's-m2'])
  })

  it('done is by finish date: any workout finished that day, a rest day included', () => {
    const workouts = [
      { id: 'w1', routineId: 'Z', finishedAt: new Date(2026, 9, 6, 18).toISOString() }, // Tue, unscheduled
      { id: 'w2', routineId: 'A', startedAt: new Date(2026, 9, 7, 9).toISOString() }, // not finished
    ]
    const rows = weekRows(TWO_WEEK, workouts, new Date(2026, 9, 8, 12))
    assert.deepEqual(rows.map((r) => r.done), [false, true, false, false, false, false, false])
  })

  it('AC2: Monday done, then Monday\'s slot removed and re-added → Monday is still done (by date)', () => {
    const today = new Date(2026, 9, 14, 12) // Wed; Monday 10-12 is loop week 0
    let state = { schedule: TWO_WEEK, workouts: [
      { id: 'w1', routineId: 'A', scheduleSlotId: 's-m1', scheduledFor: '2026-10-12', finishedAt: new Date(2026, 9, 12, 19).toISOString() },
    ] }
    assert.equal(weekRows(state.schedule, state.workouts, today)[0].done, true)
    state = slotRemovedState(state, 's-m1')
    state = slotAddedState(state, { id: 's-new', week: 0, weekday: 1, routineId: 'A' })
    const monday = weekRows(state.schedule, state.workouts, today)[0]
    assert.ok(monday.slots.some((s) => s.id === 's-new') && !monday.slots.some((s) => s.id === 's-m1'), 'the slot has a new id')
    assert.equal(monday.done, true, 'still Done after the slot id changed')
  })
})

// ── Screens (the whole App) ──────────────────────────────────────────────────────────
const seed = JSON.parse(read('db.json'))
const NOW = new Date()
const TODAY = dateKey(NOW)
// the seed's 1-week loop; the anchor's Monday makes this week loop week 0
const WEEK = Array.from({ length: 7 }, (_, i) => addDays(mondayOf(NOW), i))
const OTHER = WEEK.find((d) => dateKey(d) !== TODAY) // a day of this week that is not today

let view = null
afterEach(async () => {
  if (view) await view.unmount()
  view = null
})

async function open(hash, data = seed) {
  localStorage.clear()
  localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
  localStorage.setItem('workout-mvp-v8', JSON.stringify(data))
  window.location.hash = `#${hash}`
  const { default: App } = await importJsx('./App.jsx', import.meta.url)
  view = await render(h(App))
  await flush()
}
const squash = (text) => text.replace(/\s+/g, '')
const link = (text) => view.all('a').find((a) => squash(a.textContent) === squash(text)) ?? null
const backHref = () => link('‹ Back')?.getAttribute('href') ?? null
const buttons = (label) => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === label)
async function tap(node) {
  await view.click(node)
  await flush()
}
const stored = () => JSON.parse(localStorage.getItem('workout-mvp-v9'))
const weekLinks = () => view.all('.ui-section + .ui-list a.ui-row__link')

describe('req-200 — Home', () => {
  it('order: Workouts › → today\'s block → "This week" (7 rows) → History; no upcoming rows', async () => {
    await open('/')
    const text = view.text()
    const at = (needle) => text.indexOf(needle)
    assert.ok(at('Workouts') < at('This week'))
    const block = view.container.querySelector('.ui-today-workout')
    const header = [...view.all('.ui-section')].find((n) => n.textContent === 'This week')
    assert.ok(block && header, 'today block and the week header both render')
    assert.ok(block.compareDocumentPosition(header) & 4, 'the week follows today\'s block')
    assert.equal(weekLinks().length, 7)
    // only today's block carries Start: no Start button outside it
    const outside = view.all('button').filter((b) => b.textContent.trim() === 'Start' && !block.contains(b))
    assert.equal(outside.length, 0, 'no Start on week rows (the upcoming rows are gone)')
    assert.ok(at('This week') < text.lastIndexOf('History'))
  })

  it('each row: date · routine names or "Rest"; today marked; tapping opens that day with ?from=/', async () => {
    await open('/')
    const rows = weekLinks()
    const names = { 1: 'Upper Body', 4: 'Lower Body', 5: 'Push / Pull' }
    rows.forEach((a, i) => {
      const weekday = WEEK[i].getDay()
      assert.match(a.textContent, new RegExp(names[weekday] ? names[weekday].replace('/', '\\/') : 'Rest'))
      assert.equal(a.getAttribute('href'), `#/schedule/0/${weekday}?from=%2F`)
    })
    const todayRow = rows[WEEK.findIndex((d) => dateKey(d) === TODAY)]
    assert.match(todayRow.textContent, /Today/)
    assert.ok(todayRow.closest('li').classList.contains('ui-row--today'))
    assert.equal(view.all('.ui-row--today').length, 1)
  })

  it('a workout finished on a day of this week shows "Done ✓" on that row (by date)', async () => {
    const finishedAt = new Date(OTHER.getFullYear(), OTHER.getMonth(), OTHER.getDate(), 12).toISOString()
    const w = { ...seed.workouts[0], id: 'w-this-week', finishedAt, startedAt: finishedAt, performedOn: dateKey(OTHER), scheduleSlotId: 'gone', scheduledFor: null }
    await open('/', { ...seed, workouts: [...seed.workouts, w] })
    const row = weekLinks()[WEEK.indexOf(OTHER)]
    assert.match(row.textContent, /Done ✓/)
  })

  it('review F6: a stale in-progress workout keeps its Continue row on Home, above the week', async () => {
    // older than every seeded workout: the old 2-row recent peek (merged by date) dropped it
    const old = '2026-01-05T10:00:00.000Z'
    const active = { ...seed.workouts[0], id: 'w-stale', finishedAt: null, startedAt: old, performedOn: dateKey(old), scheduleSlotId: null, scheduledFor: null }
    await open('/', { ...seed, activeWorkout: active })
    const cont = buttons('Continue')
    assert.equal(cont.length, 1, 'the Continue row is there')
    const header = [...view.all('.ui-section')].find((n) => n.textContent === 'This week')
    assert.ok(cont[0].compareDocumentPosition(header) & 4, 'Continue sits above the week')
  })
})

describe('req-200 — the day screen', () => {
  it('from Home: Back → "/", no Today link; 1-week loop title is the bare weekday; no "Whole plan"', async () => {
    await open('/')
    await tap(weekLinks()[5]) // Saturday
    assert.equal(window.location.hash, '#/schedule/0/6?from=%2F')
    assert.equal(backHref(), '#/')
    assert.equal(link('Today'), null, 'Back already goes home')
    assert.equal(view.container.querySelector('.ui-title')?.textContent, 'Saturday')
    assert.equal(link('Whole plan ›'), null)
    await tap(link('‹ Back'))
    assert.equal(window.location.hash, '#/')
  })

  it('from /schedule: Back stays /schedule (and the Today link shows)', async () => {
    await open('/schedule')
    await tap(link('Monday — Upper Body›'))
    assert.equal(window.location.hash, '#/schedule/0/1')
    assert.equal(backHref(), '#/schedule')
    assert.equal(link('Today')?.getAttribute('href'), '#/')
  })

  it('AC5: Home → a day row → Start now → a workout starts (activeWorkout.routineId)', async () => {
    await open('/')
    const friday = weekLinks()[4] // Push / Pull
    await tap(friday)
    assert.equal(stored().activeWorkout, null)
    await tap(buttons('Start now')[0])
    assert.equal(stored().activeWorkout?.routineId, 'sess-push-pull')
    assert.equal(window.location.hash, '#/workout/sess-push-pull')
  })

  it('Add routine from Home\'s day keeps the way back: day → add → day (?from=/) → Home', async () => {
    await open('/schedule/0/2?from=%2F')
    assert.equal(link('Add routine ›')?.getAttribute('href'), `#${withFrom('/schedule/0/2/add', withFrom('/schedule/0/2', '/'))}`)
    await tap(link('Add routine ›'))
    assert.equal(backHref(), `#/schedule/0/2?from=%2F`)
    await tap(buttons('Upper Body')[0])
    assert.equal(window.location.hash, '#/schedule/0/2?from=%2F')
    assert.ok(stored().schedule.slots.some((s) => s.week === 0 && s.weekday === 2 && s.routineId === 'sess-upper'))
    assert.equal(backHref(), '#/')
  })

  it('AC4 failure case: in a 2-week loop a week-2 day says "week 2 of 2"; removing its slot keeps week 1\'s', async () => {
    const schedule = {
      loopWeeks: 2,
      anchor: '2026-08-24',
      slots: [
        { id: 'slot-w1-sat', week: 0, weekday: 6, routineId: 'sess-upper' },
        { id: 'slot-w2-sat', week: 1, weekday: 6, routineId: 'sess-lower' },
      ],
    }
    await open('/schedule/1/6?from=%2F', { ...seed, schedule })
    assert.equal(view.container.querySelector('.ui-title')?.textContent, 'Saturday · week 2 of 2')
    assert.equal(link('Whole plan ›')?.getAttribute('href'), '#/schedule', 'B1: the other weeks are one tap away')
    await tap(buttons('Remove')[0])
    await tap(buttons('Remove').at(-1)) // the confirm sheet's Remove
    assert.deepEqual(stored().schedule.slots.map((s) => s.id), ['slot-w1-sat'])
  })
})
