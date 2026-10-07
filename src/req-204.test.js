// req-204 (DEC-113) — Home: the next 3 workouts above ("Coming up", furthest first), today's
// block below, then History; the week list and the past rows are gone. `upcomingWorkouts`
// (schedule.js), the day screen's date (schedule-day.js) and the `?date=` route are pure and
// tested directly; Home and the day screen render as the whole App under happy-dom, as in
// req-200/203.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { act, importJsx, render } from './test-support/render.js'
import * as schedule from './schedule.js'
import { addDays, dateKey, upcomingWorkouts } from './schedule.js'
import { childLink, parseRoute, withFrom } from './route.js'
import { dayScreenDate, longWeekdayDate } from './views/schedule-day.js'
import { weekdayDate } from './views/history/helpers.js'

const here = dirname(fileURLToPath(import.meta.url))
const read = (path) => readFileSync(join(here, path), 'utf8')
const h = React.createElement
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

const R = (id, extra = {}) => ({ id, name: id, ...extra })
const ROUTINES = [R('A'), R('B'), R('C')]
const WED = new Date(2026, 9, 7, 12) // Wed 2026-10-07
const keys = (rows) => rows.map((row) => row.dateKey)
const ids = (row) => row.slots.map((slot) => slot.routineId)

// ── AC1: upcomingWorkouts (pure) ──────────────────────────────────────────────────────
describe('AC1 upcomingWorkouts', () => {
  const MON_THU = {
    loopWeeks: 1,
    anchor: '2026-08-24',
    slots: [
      { id: 's-mon', week: 0, weekday: 1, routineId: 'A' },
      { id: 's-thu', week: 0, weekday: 4, routineId: 'B' },
    ],
  }

  it('Mon/Thu plan, today Wed → Thu, Mon, Thu (nearest first; rest days skipped)', () => {
    const rows = upcomingWorkouts(MON_THU, ROUTINES, WED)
    assert.deepEqual(keys(rows), ['2026-10-08', '2026-10-12', '2026-10-15'])
    assert.deepEqual(rows.map(ids), [['B'], ['A'], ['B']])
    assert.deepEqual(rows.map((row) => [row.week, row.weekday]), [[0, 4], [0, 1], [0, 4]])
  })

  it('2-week loop, Sat A in week 1 and Sat B in week 2 → the right name for each date', () => {
    // anchor Mon 2026-10-12 = loop week 0 ("week 1"): Sat 10-10 is week 2, 10-17 week 1, 10-24 week 2.
    const loop = {
      loopWeeks: 2,
      anchor: '2026-10-12',
      slots: [
        { id: 's-a', week: 0, weekday: 6, routineId: 'A' },
        { id: 's-b', week: 1, weekday: 6, routineId: 'B' },
      ],
    }
    const rows = upcomingWorkouts(loop, ROUTINES, WED)
    assert.deepEqual(keys(rows), ['2026-10-10', '2026-10-17', '2026-10-24'])
    assert.deepEqual(rows.map(ids), [['B'], ['A'], ['B']])
    assert.deepEqual(rows.map((row) => row.week), [1, 0, 1])
  })

  it('an empty schedule → [] (no slots, no schedule at all, or only archived/missing workouts)', () => {
    assert.deepEqual(upcomingWorkouts({ loopWeeks: 4, anchor: '2026-08-24', slots: [] }, ROUTINES, WED), [])
    assert.deepEqual(upcomingWorkouts(null, ROUTINES, WED), [])
    const dead = { loopWeeks: 1, anchor: '2026-08-24', slots: [
      { id: 's1', week: 0, weekday: 4, routineId: 'gone' },
      { id: 's2', week: 0, weekday: 5, routineId: 'old' },
    ] }
    assert.deepEqual(upcomingWorkouts(dead, [R('old', { archivedAt: '2026-01-01' })], WED), [])
  })

  it('a day with 2 slots → one row with both (an archived one dropped from it)', () => {
    const two = { loopWeeks: 1, anchor: '2026-08-24', slots: [
      { id: 's1', week: 0, weekday: 5, routineId: 'A' },
      { id: 's2', week: 0, weekday: 5, routineId: 'B' },
      { id: 's3', week: 0, weekday: 5, routineId: 'C' },
    ] }
    const routines = [R('A'), R('B'), R('C', { archivedAt: '2026-01-01' })]
    const rows = upcomingWorkouts(two, routines, WED)
    assert.deepEqual(keys(rows), ['2026-10-09', '2026-10-16', '2026-10-23'])
    assert.deepEqual(ids(rows[0]), ['A', 'B'])
  })

  it('today is excluded: a Wednesday slot, today Wed → next Wednesday first', () => {
    const wed = { loopWeeks: 1, anchor: '2026-08-24', slots: [{ id: 's', week: 0, weekday: 3, routineId: 'A' }] }
    assert.deepEqual(keys(upcomingWorkouts(wed, ROUTINES, WED)), ['2026-10-14', '2026-10-21', '2026-10-28'])
  })

  it('n rows even when the only workout sits in week 4 of a 4-week loop (the scan spans n loops)', () => {
    const sparse = { loopWeeks: 4, anchor: '2026-10-05', slots: [{ id: 's', week: 3, weekday: 2, routineId: 'A' }] }
    const rows = upcomingWorkouts(sparse, ROUTINES, WED)
    assert.deepEqual(keys(rows), ['2026-10-27', '2026-11-24', '2026-12-22'])
    assert.equal(upcomingWorkouts(sparse, ROUTINES, WED, 1).length, 1)
  })

  it('weekRows is gone with "This week" (req-204 §3)', () => {
    assert.equal(schedule.weekRows, undefined)
  })
})

// ── §4: the day screen's date comes from the link ─────────────────────────────────────
describe('§4 the dated link', () => {
  it('route: `?date=` is read on a day screen only, in YYYY-MM-DD shape; `from` still parses', () => {
    assert.deepEqual(parseRoute('/schedule/0/1?date=2026-10-12&from=%2F'), { name: 'schedule-day', week: 0, weekday: 1, date: '2026-10-12', from: '/' })
    assert.equal(parseRoute('/schedule/0/1?date=12-10-2026&from=%2F').date, undefined)
    assert.equal(parseRoute('/schedule/0/1/add?date=2026-10-12').date, undefined)
  })

  it('withFrom on a path with a query appends `&from=`; the chain from a dated day unwinds', () => {
    const day = withFrom('/schedule/0/1?date=2026-10-12', '/')
    assert.equal(day, '/schedule/0/1?date=2026-10-12&from=%2F')
    const add = childLink('/schedule/0/1/add', '/schedule/0/1?date=2026-10-12', '/')
    const back = parseRoute(add).from
    assert.equal(back, day, 'the child\'s Back is the dated day screen')
    assert.deepEqual(parseRoute(back), { name: 'schedule-day', week: 0, weekday: 1, date: '2026-10-12', from: '/' })
    assert.equal(withFrom('/history/x', '/'), '/history/x?from=%2F', 'a plain path is unchanged')
  })

  it('dayScreenDate: a date that fits the path is used even next week; one that does not falls back', () => {
    const one = { loopWeeks: 1, anchor: '2026-08-24', slots: [] }
    assert.equal(dayScreenDate(one, 0, 1, '/', '2026-10-12', WED), '2026-10-12') // next Monday
    assert.equal(dayScreenDate(one, 0, 2, '/', '2026-10-12', WED), '2026-10-06', 'weekday mismatch → this week\'s Tuesday (homeDayDate)')
    assert.equal(dayScreenDate(one, 0, 1, null, '2026-02-30', WED), null, 'an impossible date, no from → no date')
    assert.equal(dayScreenDate(one, 0, 1, '/', null, WED), '2026-10-05', 'no date → as before (this week)')
    const two = { loopWeeks: 2, anchor: '2026-10-12', slots: [] }
    assert.equal(dayScreenDate(two, 1, 6, '/', '2026-10-17', WED), '2026-10-10', 'Sat 10-17 is loop week 0, not 1 → fallback')
    assert.equal(dayScreenDate(two, 0, 6, '/', '2026-10-17', WED), '2026-10-17')
  })
})

// ── Screens (the whole App) ─────────────────────────────────────────────────────────
const seed = JSON.parse(read('db.json'))
const NOW = new Date()
const TODAY_WD = NOW.getDay()
const IN = (n) => dateKey(addDays(NOW, n))

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
const buttons = (label) => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === label)
const section = (name) => [...view.all('.ui-section')].find((n) => n.textContent === name) ?? null
const comingUp = () => view.all('.ui-section + .ui-list a.ui-row__link')
const label = (a) => a.textContent.replace(/›$/, '')
async function tap(node) {
  await view.click(node)
  await flush()
}
const withSlots = (slots) => ({ ...seed, schedule: { loopWeeks: 1, anchor: seed.schedule.anchor, slots } })
const slot = (id, weekday, routineId) => ({ id, week: 0, weekday, routineId })

describe('AC2 Home', () => {
  it('order: Workouts › … Coming up (3 rows, furthest first) … today\'s block … History; no This week, no Rest', async () => {
    // Upper Body every day: today's block has a Start, and the next 3 days come up.
    await open('/', withSlots([0, 1, 2, 3, 4, 5, 6].map((d) => slot(`s-${d}`, d, 'sess-upper'))))
    const header = section('Coming up')
    const block = view.container.querySelector('.ui-today-workout')
    const history = link('History›')
    assert.ok(header && block && history)
    const rows = comingUp()
    assert.equal(rows.length, 3)
    assert.deepEqual(rows.map(label), [3, 2, 1].map((n) => `${weekdayDate(IN(n))} · Upper Body`), 'furthest first')
    const before = (a, b) => Boolean(a.compareDocumentPosition(b) & 4)
    assert.ok(before(link('Workouts›'), header) && before(rows.at(-1), block) && before(block, history))
    assert.equal(section('This week'), null)
    assert.doesNotMatch(view.text(), /This week|\bRest\b/)
    // only today's block carries Start
    assert.equal(view.all('button').filter((b) => b.textContent.trim() === 'Start' && !block.contains(b)).length, 0)
    assert.equal(buttons('Start').length, 1)
  })

  it('each row links its day screen with its date and from=/; a 2-workout day is one row', async () => {
    const tomorrow = (TODAY_WD + 1) % 7
    await open('/', withSlots([slot('s1', tomorrow, 'sess-upper'), slot('s2', tomorrow, 'sess-lower')]))
    const rows = comingUp()
    assert.equal(rows.length, 3)
    const nearest = rows.at(-1)
    assert.equal(label(nearest), `${weekdayDate(IN(1))} · Upper Body, Lower Body`)
    assert.equal(nearest.getAttribute('href'), `#${withFrom(`/schedule/0/${tomorrow}?date=${IN(1)}`, '/')}`)
    assert.equal(rows[0].getAttribute('href'), `#${withFrom(`/schedule/0/${tomorrow}?date=${IN(15)}`, '/')}`)
  })

  it('the done-today line and the stale Continue row stay in today\'s block area', async () => {
    const at = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), 0, 30).toISOString()
    const doneToday = { ...seed.workouts[0], id: 'w-today', routineId: 'sess-upper', finishedAt: at, startedAt: at, performedOn: dateKey(NOW), scheduleSlotId: null, scheduledFor: null, occurrenceId: null }
    const old = '2026-01-05T10:00:00.000Z'
    const stale = { ...seed.workouts[0], id: 'w-stale', finishedAt: null, startedAt: old, performedOn: dateKey(old), scheduleSlotId: null, scheduledFor: null }
    await open('/', { ...withSlots([slot('s-t', TODAY_WD, 'sess-upper'), slot('s-n', (TODAY_WD + 2) % 7, 'sess-lower')]), workouts: [...seed.workouts, doneToday], activeWorkout: stale })
    const block = view.container.querySelector('.ui-today-workout')
    const done = link('Done ✓ — see your sets ›')
    assert.ok(done && block.contains(done))
    assert.equal(done.getAttribute('href'), `#${withFrom('/history/w-today', '/')}`)
    const cont = buttons('Continue')
    assert.equal(cont.length, 1)
    assert.ok(block.compareDocumentPosition(cont[0]) & 4)
    assert.ok(cont[0].compareDocumentPosition(link('History›')) & 4)
    assert.ok(section('Coming up').compareDocumentPosition(block) & 4)
  })

  it('bottom-aligned: Home\'s lower part takes the free space above it (CSS)', async () => {
    await open('/')
    assert.ok(view.container.querySelector('.ui-screen--home > .ui-home-top + .ui-home-bottom'))
    assert.ok(view.container.querySelector('.ui-home-bottom .ui-today-workout'))
    const css = read('ui/ui.css')
    assert.match(css, /\.ui-screen--home \{[^}]*display: flex;[^}]*flex-direction: column;[^}]*min-height: calc\(100dvh/)
    assert.match(css, /\.ui-home-bottom \{\s*margin-top: auto;/)
  })
})

describe('AC3 the nearest row, next week', () => {
  it('opens "{Weekday}, {date}" with Start now; Back → Home; Add workout\'s Back keeps the date', async () => {
    // Only today's weekday is scheduled: today is excluded, so the nearest row is a week out.
    await open('/', withSlots([slot('s-t', TODAY_WD, 'sess-lower')]))
    const rows = comingUp()
    assert.deepEqual(rows.map(label), [21, 14, 7].map((n) => `${weekdayDate(IN(n))} · Lower Body`))
    await tap(rows.at(-1))
    const dayPath = withFrom(`/schedule/0/${TODAY_WD}?date=${IN(7)}`, '/')
    assert.equal(window.location.hash, `#${dayPath}`)
    assert.equal(view.container.querySelector('.ui-title')?.textContent, longWeekdayDate(IN(7), NOW))
    assert.equal(buttons('Start now').length, 1, 'a future date offers Start now')
    // a child keeps the dated screen as its Back (req-202 item 7's chain)
    await tap(link('Add workout ›'))
    assert.equal(link('‹ Back')?.getAttribute('href'), `#${dayPath}`)
    await tap(link('‹ Back'))
    assert.equal(window.location.hash, `#${dayPath}`)
    assert.equal(view.container.querySelector('.ui-title')?.textContent, longWeekdayDate(IN(7), NOW), 'still dated after the round trip')
    await tap(link('‹ Back'))
    assert.equal(window.location.hash, '#/')
  })

  it('the slot page from a dated day returns to the dated day', async () => {
    const dayPath = withFrom(`/schedule/0/${TODAY_WD}?date=${IN(7)}`, '/')
    await open(dayPath, withSlots([slot('s-t', TODAY_WD, 'sess-lower')]))
    await tap(link('Lower Body'))
    assert.equal(link('‹ Back')?.getAttribute('href'), `#${dayPath}`)
  })

  it('without a date the day screen is as before (from Whole plan: the bare weekday)', async () => {
    await open('/schedule/0/1')
    assert.equal(view.container.querySelector('.ui-title')?.textContent, 'Monday')
  })
})

describe('AC5 no schedule at all', () => {
  it('no "Coming up" header; today\'s block and History still render', async () => {
    await open('/', withSlots([]))
    assert.equal(section('Coming up'), null)
    assert.doesNotMatch(view.text(), /Coming up/)
    assert.ok(view.container.querySelector('.ui-today-workout'))
    assert.match(view.text(), /Nothing scheduled today\./)
    assert.ok(link('History›'))
  })
})
