// req-200 (DEC-110 §4) — Home shows this week: today's block first, then Mon–Sun with rest
// days; a day opens its ScheduleDay (Start now, an honest loop title, Back to where it came
// from). The screens are rendered as the whole App under happy-dom (test-support/render.js),
// as in req-198/199. req-204 (DEC-113) replaced Home's week list; what remains here is the
// stale Continue row and the day screen.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { act, importJsx, render } from './test-support/render.js'
import { dateKey } from './schedule.js'
import { withFrom } from './route.js'

const here = dirname(fileURLToPath(import.meta.url))
const read = (path) => readFileSync(join(here, path), 'utf8')
const h = React.createElement
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

// req-204 test edit: the weekRows describe (6 tests) is deleted with weekRows itself —
// req-204 §3 removed Home's "This week" and its only caller. Its successor,
// upcomingWorkouts, was tested in req-204.test.js; req-205 replaced it with comingDays (req-205.test.js).

// ── Screens (the whole App) ──────────────────────────────────────────────────────────
const seed = JSON.parse(read('db.json'))

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
const comingUpLinks = () => view.all('.ui-home-bottom > p + .ui-list a.ui-row__link') // req-206 test edit: no "Coming up" header; the rows' list follows the "Workouts ›" paragraph

// req-204 test edit (DEC-113): three Home tests are deleted with the "This week" list they
// tested — "order … This week (7 rows)", "each row: date · names or Rest; today marked"
// and "Done ✓ on that row (by date)". Home's new order, rows and links are tested in
// req-204.test.js. The F6 test below is kept; only its anchor changed (see there).
describe('req-200 — Home', () => {
  it('review F6: a stale in-progress workout keeps its Continue row on Home, under today\'s block', async () => {
    // older than every seeded workout: the old 2-row recent peek (merged by date) dropped it
    const old = '2026-01-05T10:00:00.000Z'
    const active = { ...seed.workouts[0], id: 'w-stale', finishedAt: null, startedAt: old, performedOn: dateKey(old), scheduleSlotId: null, scheduledFor: null }
    await open('/', { ...seed, activeWorkout: active })
    const cont = buttons('Continue')
    assert.equal(cont.length, 1, 'the Continue row is there')
    // req-204 test edit: was "above the week" (the "This week" header is gone). The row
    // keeps its place: after today's block, before the History link.
    const block = view.container.querySelector('.ui-today-workout')
    assert.ok(block.compareDocumentPosition(cont[0]) & 4, 'Continue follows today\'s block')
    // req-205 test edit (DEC-115): Home's last row is "Schedule ›" (was "History ›").
    assert.ok(cont[0].compareDocumentPosition(link('Schedule›')) & 4, 'and sits above Schedule')
  })
})

describe('req-200 — the day screen', () => {
  it('from Home: Back → "/", no Today link; 1-week loop title is the bare weekday; no "Whole plan"', async () => {
    // req-204 test edit: Home has no week row to tap any more, so this opens the link the
    // Saturday row had (`/schedule/0/6?from=/`) directly. Assertions unchanged.
    await open('/schedule/0/6?from=%2F')
    assert.equal(window.location.hash, '#/schedule/0/6?from=%2F')
    assert.equal(backHref(), '#/')
    assert.equal(link('Today'), null, 'Back already goes home')
    // req-203 test edit (§1/§3): from Home the title carries the date ("Saturday, Oct 10"),
    // and the 1-week loop shows in the sub line ("Every Saturday"), not in the title.
    assert.match(view.container.querySelector('.ui-title')?.textContent, /^Saturday, /)
    assert.equal(view.container.querySelector('.ui-title + .ui-sub')?.textContent, 'Every Saturday')
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
    // req-203 test edit: Start now no longer shows on a past date, so the seed's Friday is
    // not usable on a Saturday or Sunday. Push / Pull on every day, and Sunday's row (index
    // 6: today or later on any day of the week) is the one tapped. Same assertions.
    // req-204 test edit: the tapped row is now the nearest "Coming up" row (tomorrow, the
    // last row: furthest first), always a future date, so Start now shows. Same assertions.
    const slots = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ id: `s-pp-${weekday}`, week: 0, weekday, routineId: 'sess-push-pull' }))
    await open('/', { ...seed, schedule: { ...seed.schedule, loopWeeks: 1, slots } })
    const nearest = comingUpLinks().at(-1) // Push / Pull, tomorrow
    await tap(nearest)
    assert.equal(stored().activeWorkout, null)
    await tap(buttons('Start now')[0])
    assert.equal(stored().activeWorkout?.routineId, 'sess-push-pull')
    assert.equal(window.location.hash, '#/workout/sess-push-pull')
  })

  it('Add workout from Home\'s day keeps the way back: day → add → day (?from=/) → Home', async () => {
    await open('/schedule/0/2?from=%2F')
    assert.equal(link('Add workout ›')?.getAttribute('href'), `#${withFrom('/schedule/0/2/add', withFrom('/schedule/0/2', '/'))}`)
    await tap(link('Add workout ›'))
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
    // req-203 test edit (§3): "week 2 of 2" moved from the title to the sub line. The title
    // is "Saturday" or, in the weeks when loop week 2 is this week, "Saturday, <date>".
    assert.match(view.container.querySelector('.ui-title')?.textContent, /^Saturday/)
    assert.equal(view.container.querySelector('.ui-title + .ui-sub')?.textContent, 'Every Saturday in week 2 of 2')
    assert.equal(link('Whole plan ›')?.getAttribute('href'), '#/schedule', 'B1: the other weeks are one tap away')
    // req-208 test edit: Remove sits behind the slot row's "⋯" — open it, pick Remove, then
    // the confirm sheet's Remove as before. Assertion unchanged.
    await tap(buttons('⋯')[0])
    await tap(buttons('Remove')[0])
    await tap(buttons('Remove').at(-1)) // the confirm sheet's Remove
    assert.deepEqual(stored().schedule.slots.map((s) => s.id), ['slot-w1-sat'])
  })
})
