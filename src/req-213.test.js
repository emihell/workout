// req-213 (DEC-119 §2) — a workout done earlier in the week covers its routine's next spot:
// the spot shows "Done Tue ✓" (a link to that session) instead of Start, on Home's today block,
// Home's "Coming up" rows and the day screen. Display only: nothing stored, schedule unchanged.
// `doneEarlier` (schedule.js) is pure and tested directly (AC1–AC5); the screens render as the
// whole App under happy-dom with the clock mocked (AC6's browser check, in a test).
import { describe, it, afterEach } from 'node:test'
import { mock } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { act, importJsx, render } from './test-support/render.js'
import { comingDays, doneEarlier } from './schedule.js'
import { doneEarlierText } from './views/schedule-day.js'

const here = dirname(fileURLToPath(import.meta.url))
const h = React.createElement

// Oct 2026: Mon 5, Tue 6, Wed 7, Thu 8, Fri 9, Sun 4 (previous week), Thu 15 (next week).
const LOWER = 'sess-lower'
const slot = (id, weekday, routineId = LOWER, week = 0) => ({ id, week, weekday, routineId })
const plan = (slots, extra = {}) => ({ loopWeeks: 1, anchor: '2026-08-24', slots, ...extra })
const finished = (id, day, extra = {}) => ({
  id,
  routineId: LOWER,
  startedAt: `${day}T16:00:00`,
  finishedAt: `${day}T17:00:00`,
  scheduledFor: null,
  scheduleSlotId: null,
  occurrenceId: `adhoc-${LOWER}@${day}`,
  sets: [],
  ...extra,
})
const scheduledDone = (id, day, slotId) =>
  finished(id, day, { scheduledFor: day, scheduleSlotId: slotId, occurrenceId: `${slotId}@${day}` })

describe('AC1 a workout that covers its own spot covers nothing later', () => {
  it('Lower Tue + Thu; finished Tue with Tue\'s slot → Thu has no cover', () => {
    const s = plan([slot('s-tue', 2), slot('s-thu', 4)])
    const workouts = [scheduledDone('w-tue', '2026-10-06', 's-tue')]
    assert.equal(doneEarlier(workouts, LOWER, '2026-10-08', 's-thu', s), null)
    assert.equal(doneEarlier(workouts, LOWER, '2026-10-06', 's-tue', s), null, 'Tue is covered the normal way')
  })
  it('the same, finished Tue off-schedule (legacy finish-date cover of Tue) → Thu still none', () => {
    const s = plan([slot('s-tue', 2), slot('s-thu', 4)])
    assert.equal(doneEarlier([finished('w', '2026-10-06')], LOWER, '2026-10-08', 's-thu', s), null)
  })
})

describe('AC2 an off-schedule workout earlier in the week covers the later spot; next week it is back', () => {
  const s = plan([slot('s-thu', 4)])
  const workouts = [finished('w-tue', '2026-10-06')]
  it('Thu returns the Tue workout', () => {
    assert.equal(doneEarlier(workouts, LOWER, '2026-10-08', 's-thu', s)?.id, 'w-tue')
    assert.equal(doneEarlierText(workouts[0]), 'Done Tue ✓')
  })
  it('the following week\'s Thu returns null', () => {
    assert.equal(doneEarlier(workouts, LOWER, '2026-10-15', 's-thu', s), null)
  })
  it('a workout finished AFTER the spot (Fri) does not cover Thu', () => {
    assert.equal(doneEarlier([finished('w-fri', '2026-10-09')], LOWER, '2026-10-08', 's-thu', s), null)
  })
  it('a different routine does not cover it', () => {
    assert.equal(doneEarlier([finished('w', '2026-10-06', { routineId: 'sess-upper' })], LOWER, '2026-10-08', 's-thu', s), null)
  })
  it('a moved spot is judged on its moved date (Thu moved to Tue → a Mon workout covers it; Thu has nothing)', () => {
    const moved = plan([slot('s-thu', 4)], { moves: [{ id: 'm', slotId: 's-thu', from: '2026-10-08', to: '2026-10-06' }] })
    const mon = [finished('w-mon', '2026-10-05')]
    assert.equal(doneEarlier(mon, LOWER, '2026-10-06', 's-thu', moved)?.id, 'w-mon')
    assert.equal(doneEarlier(mon, LOWER, '2026-10-08', 's-thu', moved), null, 'the spot is not on Thu this week')
  })
})

describe('AC3 the week is Mon–Sun', () => {
  it('finished the previous Sunday → Thu returns null', () => {
    const s = plan([slot('s-thu', 4)])
    assert.equal(doneEarlier([finished('w-sun', '2026-10-04')], LOWER, '2026-10-08', 's-thu', s), null)
  })
  it('a workout tagged for a spot outside this week (started early for next week) is not a candidate', () => {
    const s = plan([slot('s-thu', 4)])
    const early = finished('w', '2026-10-06', { scheduledFor: '2026-10-15', scheduleSlotId: 's-thu', occurrenceId: 's-thu@2026-10-15' })
    assert.equal(doneEarlier([early], LOWER, '2026-10-08', 's-thu', s), null)
  })
})

describe('AC4 failure case — one workout, two later spots', () => {
  it('Wed + Fri scheduled, one off-schedule workout Mon → Wed is covered, Fri is not', () => {
    const s = plan([slot('s-wed', 3), slot('s-fri', 5)])
    const workouts = [finished('w-mon', '2026-10-05')]
    assert.equal(doneEarlier(workouts, LOWER, '2026-10-07', 's-wed', s)?.id, 'w-mon')
    assert.equal(doneEarlier(workouts, LOWER, '2026-10-09', 's-fri', s), null)
  })
  it('two off-schedule workouts (Mon, Tue) → Wed takes Mon, Fri takes Tue', () => {
    const s = plan([slot('s-wed', 3), slot('s-fri', 5)])
    const workouts = [finished('w-tue', '2026-10-06'), finished('w-mon', '2026-10-05')]
    assert.equal(doneEarlier(workouts, LOWER, '2026-10-07', 's-wed', s)?.id, 'w-mon')
    assert.equal(doneEarlier(workouts, LOWER, '2026-10-09', 's-fri', s)?.id, 'w-tue')
  })
  it('Wed already covered by its own workout → the Mon workout covers Fri', () => {
    const s = plan([slot('s-wed', 3), slot('s-fri', 5)])
    const workouts = [finished('w-mon', '2026-10-05'), scheduledDone('w-wed', '2026-10-07', 's-wed')]
    assert.equal(doneEarlier(workouts, LOWER, '2026-10-09', 's-fri', s)?.id, 'w-mon')
  })
})

describe('AC5 empty input', () => {
  const s = plan([slot('s-thu', 4)])
  it('no workouts / null workouts / no schedule → null', () => {
    assert.equal(doneEarlier([], LOWER, '2026-10-08', 's-thu', s), null)
    assert.equal(doneEarlier(null, LOWER, '2026-10-08', 's-thu', s), null)
    assert.equal(doneEarlier([finished('w', '2026-10-06')], LOWER, '2026-10-08', 's-thu', null), null)
    assert.equal(doneEarlier([finished('w', '2026-10-06')], LOWER, null, 's-thu', s), null)
  })
  it('an unfinished workout is not a cover', () => {
    assert.equal(doneEarlier([finished('w', '2026-10-06', { finishedAt: null })], LOWER, '2026-10-08', 's-thu', s), null)
  })
  it('an archived routine has no Coming-up slot, so no Done line is asked for', () => {
    const rows = comingDays(s, [{ id: LOWER, name: 'Lower Body', archivedAt: '2026-01-01' }], new Date(2026, 9, 7, 12))
    assert.equal(rows[0].dateKey, '2026-10-08')
    assert.deepEqual(rows[0].slots, [])
  })
})

// ── Screens (the whole App, clock mocked) ───────────────────────────────────────────
const seed = JSON.parse(readFileSync(join(here, 'db.json'), 'utf8'))
const template = seed.workouts.find((workout) => workout.routineId === LOWER)
const TUE_WORKOUT = {
  ...template,
  id: 'w-tue-off',
  startedAt: new Date(2026, 9, 6, 16).toISOString(),
  finishedAt: new Date(2026, 9, 6, 17).toISOString(),
  performedOn: '2026-10-06',
  scheduledFor: null,
  scheduleSlotId: null,
  occurrenceId: `adhoc-${LOWER}@2026-10-06`,
}
const data = (workouts = [TUE_WORKOUT]) => ({
  ...seed,
  schedule: { loopWeeks: 1, anchor: seed.schedule.anchor, slots: [slot('s-thu', 4)] },
  workouts,
  activeWorkout: null,
  draftWorkouts: [],
})

let view = null
afterEach(async () => {
  if (view) await view.unmount()
  view = null
  mock.timers.reset()
})

async function open(hash, now, stored = data()) {
  mock.timers.enable({ apis: ['setInterval', 'Date'], now })
  localStorage.clear()
  localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
  localStorage.setItem('workout-mvp-v8', JSON.stringify(stored))
  window.location.hash = `#${hash}`
  const { default: App } = await importJsx('./App.jsx', import.meta.url)
  view = await render(h(App))
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
}
const squash = (text) => text.replace(/\s+/g, '')
const comingUp = () => view.all('.ui-home-bottom > p + .ui-list a.ui-row__link')
const startButtons = () => view.all('button').filter((b) => /^(Start|Start now)$/.test(b.textContent.trim()))

describe('AC6 screens', () => {
  it('Home on Wed: the Thu row reads "Lower Body · Done Tue ✓"', async () => {
    await open('/', new Date(2026, 9, 7, 12))
    const thu = comingUp().find((a) => a.textContent.includes('Lower Body'))
    assert.ok(thu, 'Thu row present')
    assert.match(squash(thu.textContent), /LowerBody·DoneTue✓/)
  })

  it('Home on Thu: today\'s block shows "Done Tue ✓" linking the session, and no Start', async () => {
    await open('/', new Date(2026, 9, 8, 12))
    const block = view.container.querySelector('.ui-today-workout')
    assert.ok(block.textContent.includes('Lower Body'))
    const done = [...block.querySelectorAll('a')].find((a) => a.textContent.includes('Done Tue ✓'))
    assert.ok(done, 'Done Tue ✓ link')
    assert.match(done.getAttribute('href'), /#\/history\/w-tue-off/)
    assert.equal(startButtons().length, 0, 'no Start')
  })

  it('Home on Thu without the Tue workout: Start as before (empty input renders as today)', async () => {
    await open('/', new Date(2026, 9, 8, 12), data([]))
    assert.equal(view.text().includes('Done Tue'), false)
    assert.equal(startButtons().length, 1)
  })

  it('the dated day screen (Thu, from Home on Wed): "Done Tue ✓" and no Start now', async () => {
    await open('/schedule/0/4?date=2026-10-08&from=%2F', new Date(2026, 9, 7, 12))
    const done = view.all('a').find((a) => a.textContent.includes('Done Tue ✓'))
    assert.ok(done, 'Done Tue ✓ link')
    assert.match(done.getAttribute('href'), /#\/history\/w-tue-off/)
    assert.equal(startButtons().length, 0, 'no Start now')
  })

  it('next week\'s Thu screen: Start now is back', async () => {
    await open('/schedule/0/4?date=2026-10-15&from=%2F', new Date(2026, 9, 7, 12))
    assert.equal(view.text().includes('Done Tue'), false)
    assert.equal(startButtons().length, 1)
  })

  it('nothing is stored: the saved schedule and workouts are unchanged by rendering', async () => {
    await open('/', new Date(2026, 9, 8, 12))
    const saved = JSON.parse(localStorage.getItem('workout-mvp-v9'))
    assert.ok(saved, 'the migrated doc is saved under v9')
    assert.deepEqual(saved.schedule.slots, [slot('s-thu', 4)])
    assert.deepEqual(saved.schedule.moves || [], [])
    assert.deepEqual(saved.workouts.map((workout) => [workout.id, workout.scheduledFor, workout.scheduleSlotId]), [['w-tue-off', null, null]])
  })
})
