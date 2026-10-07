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
import { addDays, dateKey } from './schedule.js'
import { childLink, parseRoute, withFrom } from './route.js'
import { dayScreenDate, longWeekdayDate } from './views/schedule-day.js'
import { weekdayDate } from './views/history/helpers.js'

const here = dirname(fileURLToPath(import.meta.url))
const read = (path) => readFileSync(join(here, path), 'utf8')
const h = React.createElement
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

const WED = new Date(2026, 9, 7, 12) // Wed 2026-10-07

// req-205 test edit (DEC-114): the "AC1 upcomingWorkouts" describe (6 tests) is deleted with
// upcomingWorkouts itself — req-205 replaced it with comingDays (the next 6 days, rest days
// included). Its cases that still apply (loop-aware names, a 2-slot day, archived/missing
// routines, today excluded, no schedule) are re-asserted against comingDays in
// req-205.test.js; "rest days skipped" and "n loops for n hits" are reversed by DEC-114.
// The "weekRows is gone" check stays.
describe('AC1 (kept)', () => {
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
  // req-205 test edit (DEC-114): "order … Coming up (3 rows) … no This week, no Rest" is
  // deleted — 3 rows and "no Rest" are reversed by DEC-114. Its successor is req-205.test.js
  // "AC2 order" (6 rows incl. Rest, furthest first, only today's block carries Start).
  it('each row links its day screen with its date and from=/; a 2-workout day is one row', async () => {
    const tomorrow = (TODAY_WD + 1) % 7
    await open('/', withSlots([slot('s1', tomorrow, 'sess-upper'), slot('s2', tomorrow, 'sess-lower')]))
    const rows = comingUp()
    // req-205 test edit: 6 rows (was 3), and the furthest is now 6 days out (was the 3rd
    // workout date, 15 days out). The href and 2-workout assertions are unchanged.
    assert.equal(rows.length, 6)
    const nearest = rows.at(-1)
    assert.equal(label(nearest), `${weekdayDate(IN(1))} · Upper Body, Lower Body`)
    assert.equal(nearest.getAttribute('href'), `#${withFrom(`/schedule/0/${tomorrow}?date=${IN(1)}`, '/')}`)
    assert.equal(rows[0].getAttribute('href'), `#${withFrom(`/schedule/0/${(TODAY_WD + 6) % 7}?date=${IN(6)}`, '/')}`)
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
    // req-205 test edit (DEC-115): Home's last row is "Schedule ›" (was "History ›").
    assert.ok(cont[0].compareDocumentPosition(link('Schedule›')) & 4)
    assert.ok(section('Coming up').compareDocumentPosition(block) & 4)
  })

  it('bottom-aligned: Home\'s lower part takes the free space above it (CSS)', async () => {
    await open('/')
    // req-205 test edit (DEC-114): `.ui-home-top` is gone — the whole column, "Workouts ›"
    // included, is now `.ui-home-bottom`. The CSS assertions are unchanged.
    assert.ok(view.container.querySelector('.ui-screen--home > .ui-home-bottom'))
    assert.equal(view.container.querySelector('.ui-home-top'), null)
    assert.ok(view.container.querySelector('.ui-home-bottom .ui-today-workout'))
    const css = read('ui/ui.css')
    assert.match(css, /\.ui-screen--home \{[^}]*display: flex;[^}]*flex-direction: column;[^}]*min-height: calc\(100dvh/)
    assert.match(css, /\.ui-home-bottom \{\s*margin-top: auto;/)
  })
})

describe('AC3 the nearest row, next week', () => {
  it('opens "{Weekday}, {date}" with Start now; Back → Home; Add workout\'s Back keeps the date', async () => {
    // req-205 test edit (DEC-114): Home shows 6 days, so a slot on today's weekday (7 days
    // out) is no longer on it. The workout is now 6 days out (the furthest row, whatever
    // today is); every day-screen assertion is unchanged.
    const wd = (TODAY_WD + 6) % 7
    await open('/', withSlots([slot('s-t', wd, 'sess-lower')]))
    const rows = comingUp()
    assert.equal(label(rows[0]), `${weekdayDate(IN(6))} · Lower Body`)
    await tap(rows[0])
    const dayPath = withFrom(`/schedule/0/${wd}?date=${IN(6)}`, '/')
    assert.equal(window.location.hash, `#${dayPath}`)
    assert.equal(view.container.querySelector('.ui-title')?.textContent, longWeekdayDate(IN(6), NOW))
    assert.equal(buttons('Start now').length, 1, 'a future date offers Start now')
    // a child keeps the dated screen as its Back (req-202 item 7's chain)
    await tap(link('Add workout ›'))
    assert.equal(link('‹ Back')?.getAttribute('href'), `#${dayPath}`)
    await tap(link('‹ Back'))
    assert.equal(window.location.hash, `#${dayPath}`)
    assert.equal(view.container.querySelector('.ui-title')?.textContent, longWeekdayDate(IN(6), NOW), 'still dated after the round trip')
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
  // req-205 test edit (DEC-114): "Coming up" is always the next 6 days, so with no schedule it
  // is 6 Rest rows (was: hidden). Today's block is unchanged; the last row is Schedule (DEC-115).
  it('"Coming up" is 6 Rest rows; today\'s block and the last row still render', async () => {
    await open('/', withSlots([]))
    assert.ok(section('Coming up'))
    assert.deepEqual(comingUp().map(label), [6, 5, 4, 3, 2, 1].map((n) => `${weekdayDate(IN(n))} · Rest`))
    assert.ok(view.container.querySelector('.ui-today-workout'))
    assert.match(view.text(), /Nothing scheduled today\./)
    assert.ok(link('Schedule›'), 'req-205 test edit (DEC-115): the last row is Schedule (was History)')
  })
})
