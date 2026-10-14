// req-223 (DEC-125 §2) — Start opens the first exercise; an "Up next" bar on each ARRIVAL
// (a new Start, the review's Next, the bar's own Skip), 5 s, Skip · Swap · Start now.
// Rendered as the whole App under happy-dom against the real store, seeded with db.json
// (one App / StoreProvider per test, never remounted mid-test — L-051). The 5 s countdown
// runs on mocked setInterval + Date (node:test mock.timers); setTimeout stays real for flush.
import { describe, it, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { act, importJsx, render } from './test-support/render.js'
import { arrivalFor, clearArrival, markArrival } from './up-next.js'
import { startOrContinue } from './workout-actions.js'

const h = React.createElement
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
const seed = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
const KEY = 'workout-mvp-v9'
const R = 'sess-upper'

// A 3-item Upper Body: Chest Press (1 set, no warm-up, so one Done finishes it), Lat Pulldown,
// Shoulder Press — the seed's own items, trimmed.
function threeItems(data = seed) {
  const routines = data.routines.map((r) => {
    if (r.id !== R) return r
    const [, chest, lat, shoulder] = r.exercises
    return { ...r, exercises: [{ ...chest, warmup: null, sets: 1, targets: ['12'], suggestedWeights: [25] }, lat, shoulder] }
  })
  return { ...data, routines }
}
const KEYS = ['si-sess-upper-1-ex-chest-press', 'si-sess-upper-2-ex-lat-pulldown', 'si-sess-upper-3-ex-shoulder-press']
const logPath = (key) => `#/workout/${R}/item/${key}/log`

let view = null
beforeEach(() => {
  clearArrival()
  mock.timers.enable({ apis: ['setInterval', 'Date'], now: Date.now() })
})
afterEach(async () => {
  if (view) await view.unmount()
  view = null
  mock.timers.reset()
  clearArrival()
})

async function open(hash, data) {
  localStorage.clear()
  localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
  localStorage.setItem('workout-mvp-v8', JSON.stringify(data))
  window.location.hash = `#${hash}`
  const { default: App } = await importJsx('./App.jsx', import.meta.url)
  view = await render(h(App))
  await flush()
}
const squash = (text) => text.replace(/\s+/g, ' ').trim()
const link = (text) => view.all('a').find((a) => squash(a.textContent) === text) ?? null
const button = (label) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === label) ?? null
const bar = () => view.container.querySelector('.ui-up-next')
const barText = () => (bar() ? [...bar().querySelectorAll('p, button, a')].map((n) => squash(n.textContent)).join(' ') : null)
const stored = () => JSON.parse(localStorage.getItem(KEY))
async function tap(node) {
  assert.ok(node, 'tap target exists')
  await view.click(node)
  await flush()
}
async function tick(ms) {
  await act(async () => mock.timers.tick(ms))
  await flush()
}
// Start the 3-item Upper Body from the Routines list (startOrContinue, no plan passed).
async function startThree(data = threeItems()) {
  await open('/routines', data)
  const start = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Start')[0]
  await tap(start)
}
const itemSets = (key) => (stored().activeWorkout.sets || []).filter((s) => s.routineItemId === key)

describe('AC1 — Start lands on item 1 with the bar; 5 s later it is gone, nothing written', () => {
  it('route is item 1\'s /log, "Up next: Chest Press", counts 5 → 1, hides at 0', async () => {
    await startThree()
    assert.equal(window.location.hash, logPath(KEYS[0]))
    assert.equal(stored().activeWorkout.routineId, R)
    assert.match(barText(), /^Up next: Chest Press Starting in 5… Skip Swap Start now$/)
    await tick(4000)
    assert.match(barText(), /Starting in 1…/)
    const before = localStorage.getItem(KEY)
    await tick(1000)
    assert.equal(bar(), null, 'the bar hides at 0')
    assert.equal(localStorage.getItem(KEY), before, 'the countdown wrote nothing')
    assert.deepEqual(stored().activeWorkout.sets, [])
    assert.equal(window.location.hash, logPath(KEYS[0]), 'and started nothing / went nowhere')
    assert.ok(button('Done'), 'the set form is there')
  })

  it('Start now hides the bar at once, writes nothing', async () => {
    await startThree()
    const before = localStorage.getItem(KEY)
    await tap(button('Start now'))
    assert.equal(bar(), null)
    assert.equal(localStorage.getItem(KEY), before)
  })
})

describe('AC2 — the review\'s Next is an arrival', () => {
  it('log item 1 → review → "Next: Lat Pulldown" → the bar shows for item 2', async () => {
    await startThree()
    await tap(button('Start now'))
    await tap(button('Done'))
    assert.equal(window.location.hash, `#/workout/${R}/item/${KEYS[0]}/done`)
    assert.equal(itemSets(KEYS[0]).length, 1)
    await tap(link('Next: Lat Pulldown'))
    assert.equal(window.location.hash, logPath(KEYS[1]))
    assert.match(barText(), /^Up next: Lat Pulldown Starting in 5…/)
  })
})

describe('AC3 — Skip on the bar', () => {
  it('item 2 skipped (its sets "skipped", marked done) and item 3 opens with its bar', async () => {
    await startThree()
    await tap(button('Skip')) // item 1 → item 2, with its bar
    assert.equal(window.location.hash, logPath(KEYS[1]))
    assert.match(barText(), /^Up next: Lat Pulldown/)
    await tap(button('Skip')) // item 2 → item 3
    const sets = itemSets(KEYS[1])
    assert.ok(sets.length >= 3, `item 2's sets logged: ${sets.length}`)
    assert.ok(sets.every((s) => s.reps === 'skipped'))
    assert.ok(stored().activeWorkout.completedItemIds.includes(KEYS[1]), 'item 2 marked done')
    assert.equal(window.location.hash, logPath(KEYS[2]))
    assert.match(barText(), /^Up next: Shoulder Press Starting in 5…/)
    assert.doesNotMatch(view.text(), /Not found\./)
  })
})

describe('AC4 — Skip on the last not-done item → the Finish target, no bar, no crash', () => {
  it('all skipped (nothing logged, auto-complete not armed) → /finish', async () => {
    await startThree()
    await tap(button('Skip'))
    await tap(button('Skip'))
    await tap(button('Skip'))
    assert.equal(window.location.hash, `#/workout/${R}/finish`)
    assert.equal(bar(), null)
    assert.doesNotMatch(view.text(), /Not found\./)
    assert.ok(stored().activeWorkout, 'nothing finished by the skip')
  })

  it('item 1 logged, then 2 and 3 skipped from the bar → the overview\'s auto-complete summary (armed)', async () => {
    await startThree()
    await tap(button('Start now'))
    await tap(button('Done'))
    await tap(link('Next: Lat Pulldown'))
    await tap(button('Skip'))
    await tap(button('Skip'))
    assert.equal(window.location.hash, `#/workout/${R}`)
    assert.match(view.text(), /Great job!/)
    assert.equal(bar(), null)
  })
})

describe('AC5 — Swap from the bar', () => {
  it('Swap → the Swap picker → pick → the replacement\'s log, with NO bar', async () => {
    await startThree()
    await tap(link('Swap'))
    assert.equal(window.location.hash, `#/workout/${R}/item/${KEYS[0]}/replace`)
    await flush()
    const pick = view.all('label').find((l) => squash(l.textContent).startsWith('Leg Press'))
    assert.ok(pick, 'Leg Press in the picker')
    await act(async () => pick.querySelector('input').click())
    await flush()
    await tap(button('Swap'))
    const items = stored().activeWorkout.snapshot.items
    const rep = items.find((i) => i.replacesItemId === KEYS[0])
    assert.ok(rep, 'the replacement is in the workout')
    assert.equal(window.location.hash, logPath(rep.routineItemId || rep.id))
    assert.equal(bar(), null)
    assert.ok(button('Done'), 'its log form is up')
  })
})

describe('AC6 — failure case: the trigger is the arrival, not "no sets logged"', () => {
  it('item 2 opened from the list row → no bar (item 2 has no set logged)', async () => {
    await startThree()
    await tap(button('Start now'))
    await tap(link('‹ Upper Body'))
    assert.equal(window.location.hash, `#/workout/${R}`)
    const row = view.all('a').find((a) => a.getAttribute('href') === logPath(KEYS[1]))
    await tap(row)
    assert.equal(window.location.hash, logPath(KEYS[1]))
    assert.deepEqual(itemSets(KEYS[1]), [])
    assert.equal(bar(), null)
  })

  it('item 2 opened from the GO pill → no bar', async () => {
    await startThree()
    await tap(button('Skip')) // item 1 skipped; item 2 is now the pill's current exercise
    await tap(link('‹ Upper Body'))
    const pill = view.container.querySelector('.ui-restpill--go')
    assert.ok(pill, 'the GO pill is on the overview')
    assert.match(squash(pill.textContent), /^GO/)
    await tap(pill)
    assert.equal(window.location.hash, logPath(KEYS[1]))
    assert.deepEqual(itemSets(KEYS[1]), [])
    assert.equal(bar(), null)
  })

  it('reloading the bar\'s URL → no bar (a fresh page: the marker is memory only)', async () => {
    // The state a Start leaves, saved; then a fresh App at item 1's URL, as a reload is.
    const started = threeItems()
    await open('/routines', started)
    await tap([...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Start')[0])
    assert.ok(bar(), 'the bar showed on the Start')
    const saved = localStorage.getItem(KEY)
    await view.unmount()
    view = null
    clearArrival() // a reload starts with a fresh module: no marker
    localStorage.setItem(KEY, saved)
    window.location.hash = logPath(KEYS[0])
    const { default: App } = await importJsx('./App.jsx', import.meta.url)
    view = await render(h(App))
    await flush()
    assert.equal(window.location.hash, logPath(KEYS[0]))
    assert.deepEqual(itemSets(KEYS[0]), [])
    assert.ok(button('Done'), 'the log screen rendered')
    assert.equal(bar(), null)
  })

  it('Back to the bar\'s screen after leaving it → no bar (the marker was used up on arrival)', async () => {
    await startThree()
    await tap(link('‹ Upper Body'))
    await act(async () => {
      window.location.hash = logPath(KEYS[0])
    })
    await flush()
    assert.equal(bar(), null)
  })
})

describe('AC7 — empty input: a workout with 0 items', () => {
  it('startOrContinue lands on the overview, as before; no marker is left', async () => {
    const store = {
      activeWorkout: null,
      getPlannedWorkout: () => ({ routineId: 'r0', items: [] }),
      startWorkout: () => {},
    }
    window.location.hash = '#/'
    await startOrContinue(store, 'r0')
    assert.equal(window.location.hash, '#/workout/r0')
    assert.equal(arrivalFor('r0', { routineItemId: undefined }), false)
  })

  it('a non-empty plan lands on its first item and marks that arrival (the caller\'s plan wins)', async () => {
    const store = {
      activeWorkout: null,
      getPlannedWorkout: () => assert.fail('not read when a plan is passed'),
      startWorkout: () => {},
    }
    window.location.hash = '#/'
    const plan = { routineId: 'r1', items: [{ id: 'a', routineItemId: 'a' }, { id: 'b', routineItemId: 'b' }] }
    await startOrContinue(store, 'r1', { plan })
    assert.equal(window.location.hash, '#/workout/r1/item/a/log')
    assert.equal(arrivalFor('r1', plan.items[0]), true)
    assert.equal(arrivalFor('r1', plan.items[1]), false)
  })

  it('Continue (the same workout) is unchanged: its current exercise, no marker', async () => {
    const active = {
      id: 'w', routineId: 'r2', startedAt: new Date().toISOString(), completedItemIds: [], sets: [],
      snapshot: { items: [{ id: 'a', routineItemId: 'a', sets: 1 }] },
    }
    const store = { activeWorkout: active, getPlannedWorkout: () => null, startWorkout: () => assert.fail('no restart') }
    window.location.hash = '#/'
    await startOrContinue(store, 'r2')
    assert.equal(window.location.hash, '#/workout/r2/item/a/log')
    assert.equal(arrivalFor('r2', active.snapshot.items[0]), false)
  })
})

describe('AC8 — logging a set while the countdown runs', () => {
  it('the bar hides and the set is saved once', async () => {
    await startThree()
    await tick(2000)
    assert.match(barText(), /Starting in 3…/)
    await tap(button('Done'))
    assert.equal(itemSets(KEYS[0]).length, 1, 'one set saved')
    assert.equal(bar(), null)
    await tick(5000) // the bar's timer is gone with it: nothing more happens
    assert.equal(itemSets(KEYS[0]).length, 1)
  })

  it('a set logged while the bar shows on a multi-set item: the bar hides on the same screen', async () => {
    await startThree()
    await tap(button('Skip')) // → Lat Pulldown (warm-up + 3 sets), with its bar
    assert.ok(bar())
    await tick(1000)
    await tap(button('Done')) // its warm-up set
    assert.equal(window.location.hash, logPath(KEYS[1]), 'still on Lat Pulldown')
    assert.equal(itemSets(KEYS[1]).length, 1)
    assert.equal(bar(), null)
    await tick(5000)
    assert.equal(itemSets(KEYS[1]).length, 1)
  })
})

describe('the arrival marker (up-next.js) — memory only', () => {
  it('matches one routine + item, and is cleared', () => {
    markArrival('r', { routineItemId: 'x' })
    assert.equal(arrivalFor('r', { routineItemId: 'x' }), true)
    assert.equal(arrivalFor('r', { routineItemId: 'y' }), false)
    assert.equal(arrivalFor('q', { routineItemId: 'x' }), false)
    clearArrival()
    assert.equal(arrivalFor('r', { routineItemId: 'x' }), false)
  })
  it('never touches storage', () => {
    localStorage.clear()
    sessionStorage.clear()
    markArrival('r', { routineItemId: 'x' })
    assert.equal(localStorage.length, 0)
    assert.equal(sessionStorage.length, 0)
  })
})
