// req-199 (DEC-110 §3, DEC-112) — Library goes: /routines is the plain list with Start on each
// row and two rows below it, "Your exercises ›" and "Whole plan ›". /exercises and /schedule
// are ordinary screens with Back → /routines; every /exercises/* and /schedule/* route stays
// (review F14). History › By exercise › exercise links to the exercise's settings.
//
// The whole App is rendered under happy-dom (test-support/render.js), as in req-198.test.js.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { act, importJsx, render } from './test-support/render.js'
import { parseRoute, showsTodayLink } from './route.js'

const here = dirname(fileURLToPath(import.meta.url))
const read = (path) => readFileSync(join(here, path), 'utf8')
const h = React.createElement
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

const seed = JSON.parse(read('db.json'))
// A fourth routine on NO schedule slot (AC2): a copy of Upper Body under a new id.
const UNSCHEDULED = {
  ...seed.routines[0],
  id: 'sess-unscheduled',
  name: 'Off Plan',
  exercises: seed.routines[0].exercises.map((item) => ({ ...item, id: `${item.id}-off` })),
}
const SEED = { ...seed, routines: [...seed.routines, UNSCHEDULED] }

let view = null
afterEach(async () => {
  if (view) await view.unmount()
  view = null
})

async function open(hash) {
  localStorage.clear()
  localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
  localStorage.setItem('workout-mvp-v8', JSON.stringify(SEED))
  window.location.hash = `#${hash}`
  const { default: App } = await importJsx('./App.jsx', import.meta.url)
  view = await render(h(App))
  await flush()
}
// Row links render their chevron in its own span ("Your exercises›"), NavLinks with a space.
const squash = (text) => text.replace(/\s+/g, '')
const link = (text) => view.all('a').find((a) => squash(a.textContent) === squash(text)) ?? null
const backHref = () => link('‹ Back')?.getAttribute('href') ?? null
async function tap(node) {
  await view.click(node)
  await flush()
}
function stored() {
  return JSON.parse(localStorage.getItem('workout-mvp-v9'))
}

describe('req-199 — /routines is the plain list (no segmented control)', () => {
  it('AC1: Home → "Workouts ›" shows no segment control, the list with Start, and both rows', async () => {
    await open('/')
    await tap(link('Workouts ›'))
    assert.equal(window.location.hash, '#/routines')
    assert.equal(view.all('[role="radiogroup"]').length, 0, 'no segmented control')
    assert.equal(document.querySelectorAll('.ui-library-toggle').length, 0)
    assert.match(view.text(), /Upper Body/)
    assert.ok(view.all('button').filter((b) => b.textContent.trim() === 'Start').length >= 4, 'Start on every startable row')
    assert.equal(link('Your exercises ›')?.getAttribute('href'), '#/exercises')
    // req-205 test edit (DEC-115): "Whole plan ›" is removed from this list (was: links
    // /schedule). Every other assertion unchanged.
    assert.equal(link('Whole plan ›'), null)
    assert.equal(backHref(), '#/', 'Back home')
  })

  it("the routine's name opens it; the row's Edit button is gone", async () => {
    await open('/routines')
    const name = link('Upper Body›')
    assert.equal(name?.getAttribute('href'), '#/routines/sess-upper')
    assert.equal(view.all('a').filter((a) => a.textContent.trim() === 'Edit').length, 0)
    await tap(name)
    assert.equal(window.location.hash, '#/routines/sess-upper')
  })

  it('AC1: "Your exercises ›" opens the Exercises list; its Back returns to /routines', async () => {
    await open('/routines')
    await tap(link('Your exercises ›'))
    assert.equal(window.location.hash, '#/exercises')
    assert.match(view.text(), /Exercises/)
    assert.equal(view.all('[role="radiogroup"]').length, 0)
    assert.equal(backHref(), '#/routines')
    assert.equal(link('Today')?.getAttribute('href'), '#/', 'Today link appears (Back is not "/")')
    await tap(link('‹ Back'))
    assert.equal(window.location.hash, '#/routines')
  })

  // req-205 test edit (DEC-115): the Schedule is now reached from Home's "Schedule ›" (was
  // "Whole plan ›" here), so its Back returns Home and there is no Today link (Back is "/").
  it('Home\'s "Schedule ›" opens the Schedule screen; its Back returns Home (no Today link)', async () => {
    await open('/')
    await tap(link('Schedule›'))
    assert.equal(window.location.hash, '#/schedule')
    assert.match(view.text(), /Loop · 1 week/)
    assert.equal(backHref(), '#/')
    assert.equal(link('Today'), null)
  })

  it('AC2: a routine on no schedule starts in 2 taps from Home (activeWorkout set in v9)', async () => {
    assert.ok(!SEED.schedule.slots.some((slot) => slot.routineId === 'sess-unscheduled'))
    await open('/')
    assert.equal(stored()?.activeWorkout ?? null, null)
    await tap(link('Workouts ›')) // tap 1
    const row = view.all('li').find((li) => li.textContent.includes('Off Plan'))
    const start = [...row.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Start')
    await tap(start) // tap 2
    const active = stored().activeWorkout
    assert.ok(active, 'activeWorkout is set')
    assert.equal(active.routineId ?? active.sessionId ?? active.routine?.id, 'sess-unscheduled', JSON.stringify(active).slice(0, 200))
  })

  it('Home\'s "Start new workout" still goes to /routines', () => {
    assert.match(read('views/Today.jsx'), /<NavLink to="\/routines" look=\{done\.length \? 'secondary' : 'primary'\} block>/)
  })
})

describe('req-199 — /exercises/* and /schedule/* routes stay (review F14)', () => {
  const ROUTES = [
    ['/exercises', 'exercises'],
    ['/exercises/new', 'exercise-new'],
    ['/exercises/type/strength', 'exercises-type'],
    ['/exercises/ex-rowing', 'exercise'],
    ['/exercises/ex-rowing/edit', 'exercise-edit'],
    ['/schedule', 'schedule'],
    ['/schedule/loop', 'schedule-loop'],
    ['/schedule/0/1', 'schedule-day'],
    ['/schedule/0/1/slot-sess-upper', 'schedule-slot'],
  ]
  for (const [path, name] of ROUTES) {
    it(`${path} → ${name}`, () => assert.equal(parseRoute(path).name, name))
  }

  it('the Library view and its toggle CSS are gone', () => {
    assert.equal(existsSync(join(here, 'views/Library.jsx')), false)
    assert.doesNotMatch(read('App.jsx'), /Library/)
    assert.doesNotMatch(read('ui/ui.css'), /\.ui-library-toggle/)
  })

  it('the Today link rule gives /exercises and /schedule a Today link (Back → /routines)', () => {
    assert.equal(showsTodayLink('/routines', 'exercises'), true)
    assert.equal(showsTodayLink('/routines', 'schedule'), true)
    assert.equal(showsTodayLink('/', 'routines'), false)
  })
})

describe('req-199 AC3 (failure case) — exercise settings Save lands back where you came from', () => {
  it('routine item → "Edit exercise settings ›" → Save lands on the routine item, not Today', async () => {
    await open('/routines/sess-upper/exercise/si-sess-upper-1-ex-chest-press')
    const settings = link('Edit exercise settings ›')
    assert.ok(settings, view.text().slice(0, 300))
    await tap(settings)
    assert.equal(parseRoute(window.location.hash.slice(1)).name, 'exercise-edit')
    await tap(view.button('Save'))
    assert.equal(window.location.hash, '#/routines/sess-upper/exercise/si-sess-upper-1-ex-chest-press')
  })

  it('History › By exercise › exercise → "Exercise settings ›" → Save lands back on that page', async () => {
    await open('/history/exercises')
    const row = view.all('a').find((a) => a.getAttribute('href') === '#/history/exercise/ex-chest-press')
    assert.ok(row, 'By exercise lists Chest press')
    await tap(row)
    const settings = link('Exercise settings ›')
    assert.ok(settings)
    assert.equal(settings.getAttribute('href'), `#/exercises/ex-chest-press/edit?from=${encodeURIComponent('/history/exercise/ex-chest-press')}`)
    await tap(settings)
    assert.equal(backHref(), '#/history/exercise/ex-chest-press', 'Back honours from too')
    await tap(view.button('Save'))
    assert.equal(window.location.hash, '#/history/exercise/ex-chest-press')
  })

  it('a deleted (archived) exercise has no settings link in its history', async () => {
    const archived = { ...SEED, exercises: SEED.exercises.map((ex) => (ex.id === 'ex-chest-press' ? { ...ex, archivedAt: '2026-10-01T00:00:00.000Z' } : ex)) }
    localStorage.clear()
    localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
    localStorage.setItem('workout-mvp-v8', JSON.stringify(archived))
    window.location.hash = '#/history/exercise/ex-chest-press'
    const { default: App } = await importJsx('./App.jsx', import.meta.url)
    view = await render(h(App))
    await flush()
    assert.equal(link('Exercise settings ›'), null)
  })
})
