// req-205 (DEC-114) — Home: "Coming up" is the next 6 calendar days (rest days included,
// furthest first), no visible "Today" title, and the whole column is one bottom-aligned block.
// `comingDays` (schedule.js) is pure and tested directly; Home and the day screen render as
// the whole App under happy-dom, as in req-204.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { act, importJsx, render } from './test-support/render.js'
import * as schedule from './schedule.js'
import { addDays, comingDays, dateKey } from './schedule.js'
import { withFrom } from './route.js'
import { longWeekdayDate } from './views/schedule-day.js'
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

describe('AC1 comingDays (pure)', () => {
  const MON_THU = {
    loopWeeks: 1,
    anchor: '2026-08-24',
    slots: [
      { id: 's-mon', week: 0, weekday: 1, routineId: 'A' },
      { id: 's-thu', week: 0, weekday: 4, routineId: 'B' },
    ],
  }

  it('Mon/Thu plan, today Wed → Thu, Fri(Rest), Sat(Rest), Sun(Rest), Mon, Tue(Rest), in date order', () => {
    const rows = comingDays(MON_THU, ROUTINES, WED)
    assert.deepEqual(keys(rows), ['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'])
    assert.deepEqual(rows.map(ids), [['B'], [], [], [], ['A'], []])
    assert.deepEqual(rows.map((row) => row.weekday), [4, 5, 6, 0, 1, 2])
    assert.deepEqual(rows.map((row) => row.week), [0, 0, 0, 0, 0, 0])
  })

  it('a 2-week loop gives the right workout per date (Sat A in week 1, Sat B in week 2)', () => {
    // anchor Mon 2026-10-12 = loop week 0: Sat 10-10 is week 2 (index 1); Sun 10-11 too; Mon 10-12 week 1.
    const loop = {
      loopWeeks: 2,
      anchor: '2026-10-12',
      slots: [
        { id: 's-a', week: 0, weekday: 6, routineId: 'A' },
        { id: 's-b', week: 1, weekday: 6, routineId: 'B' },
        { id: 's-m', week: 0, weekday: 1, routineId: 'C' },
        { id: 's-m2', week: 1, weekday: 4, routineId: 'A' },
      ],
    }
    const rows = comingDays(loop, ROUTINES, WED)
    // Thu 10-08 (wk 2: A), Fri, Sat 10-10 (wk 2: B), Sun, Mon 10-12 (wk 1: C), Tue
    assert.deepEqual(rows.map(ids), [['A'], [], ['B'], [], ['C'], []])
    assert.deepEqual(rows.map((row) => row.week), [1, 1, 1, 1, 0, 0])
  })

  it('a day with 2 workouts is one row; archived and missing routines are dropped (a day of only those is Rest)', () => {
    const plan = { loopWeeks: 1, anchor: '2026-08-24', slots: [
      { id: 's1', week: 0, weekday: 5, routineId: 'A' },
      { id: 's2', week: 0, weekday: 5, routineId: 'B' },
      { id: 's3', week: 0, weekday: 5, routineId: 'C' },
      { id: 's4', week: 0, weekday: 6, routineId: 'gone' },
    ] }
    const rows = comingDays(plan, [R('A'), R('B'), R('C', { archivedAt: '2026-01-01' })], WED)
    assert.deepEqual(ids(rows[1]), ['A', 'B'])
    assert.deepEqual(ids(rows[2]), [], 'Sat holds only a missing routine → Rest')
  })

  it('today is excluded; no schedule → 6 rest days; n is honoured', () => {
    const wed = { loopWeeks: 1, anchor: '2026-08-24', slots: [{ id: 's', week: 0, weekday: 3, routineId: 'A' }] }
    assert.ok(comingDays(wed, ROUTINES, WED).every((row) => row.slots.length === 0), 'next Wed is 7 days out')
    const none = comingDays(null, ROUTINES, WED)
    assert.equal(none.length, 6)
    assert.ok(none.every((row) => row.slots.length === 0))
    assert.equal(comingDays(wed, ROUTINES, WED, 7).at(-1).slots.length, 1)
  })

  it('upcomingWorkouts is gone (replaced by comingDays)', () => {
    assert.equal(schedule.upcomingWorkouts, undefined)
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
const comingUp = () => view.all('.ui-section + .ui-list a.ui-row__link')
const label = (a) => a.textContent.replace(/›$/, '')
const withSlots = (slots) => ({ ...seed, schedule: { loopWeeks: 1, anchor: seed.schedule.anchor, slots } })
const slot = (id, weekday, routineId) => ({ id, week: 0, weekday, routineId })
async function tap(node) {
  await view.click(node)
  await flush()
}

describe('AC1/AC2 Home', () => {
  it('6 rows, furthest first, workouts named and rest days "Rest" (muted); no Start on any row', async () => {
    const tomorrow = (TODAY_WD + 1) % 7
    const in4 = (TODAY_WD + 4) % 7
    await open('/', withSlots([slot('s-t', TODAY_WD, 'sess-upper'), slot('s1', tomorrow, 'sess-upper'), slot('s2', tomorrow, 'sess-lower'), slot('s4', in4, 'sess-lower')]))
    const rows = comingUp()
    const name = (n) => (n === 1 ? 'Upper Body, Lower Body' : n === 4 ? 'Lower Body' : 'Rest')
    assert.deepEqual(rows.map(label), [6, 5, 4, 3, 2, 1].map((n) => `${weekdayDate(IN(n))} · ${name(n)}`))
    const rest = rows.map((a) => a.closest('li').classList.contains('ui-row--rest'))
    assert.deepEqual(rest, [true, true, false, true, true, false])
    for (const a of rows) assert.equal(a.closest('li').querySelector('button'), null)
    const block = view.container.querySelector('.ui-today-workout')
    assert.equal(view.all('button').filter((b) => b.textContent.trim() === 'Start' && !block.contains(b)).length, 0)
    assert.match(read('ui/ui.css'), /\.ui-row--rest \.ui-row__label \{\s*color: var\(--ui-ink-2\);/)
  })

  it('no visible "Today" title; a visually hidden h1 stays; order Workouts › → rows → today → History in one block', async () => {
    await open('/', withSlots([slot('s-t', TODAY_WD, 'sess-upper')]))
    assert.equal(view.container.querySelector('.ui-title'), null, 'no visible title')
    const h1 = view.all('h1')
    assert.equal(h1.length, 1)
    assert.ok(h1[0].classList.contains('ui-visually-hidden'))
    assert.equal(h1[0].textContent, 'Today')
    const column = view.container.querySelector('.ui-screen--home > .ui-home-bottom')
    assert.ok(column)
    const workouts = link('Workouts›')
    const rows = comingUp()
    const block = view.container.querySelector('.ui-today-workout')
    const history = link('History›')
    for (const node of [workouts, ...rows, block, history]) assert.ok(column.contains(node))
    const before = (a, b) => Boolean(a.compareDocumentPosition(b) & 4)
    assert.ok(before(workouts, rows[0]) && before(rows.at(-1), block) && before(block, history))
    // the column is the screen's only visible child: no other element to open a gap
    assert.deepEqual([...view.container.querySelector('.ui-screen--home').children].map((n) => n.className), ['ui-visually-hidden', 'ui-home-bottom'])
  })
})

describe('AC4 a Rest row opens its dated day screen', () => {
  it('"None." and "Add workout ›"; Back returns Home', async () => {
    await open('/', withSlots([]))
    const rows = comingUp()
    await tap(rows.at(-1))
    const wd = (TODAY_WD + 1) % 7
    assert.equal(window.location.hash, `#${withFrom(`/schedule/0/${wd}?date=${IN(1)}`, '/')}`)
    assert.equal(view.container.querySelector('.ui-title')?.textContent, longWeekdayDate(IN(1), NOW))
    assert.match(view.text(), /None\./)
    assert.ok(link('Add workout ›'))
    await tap(link('‹ Back'))
    assert.equal(window.location.hash, '#/')
  })
})
