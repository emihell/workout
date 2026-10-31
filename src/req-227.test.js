// req-227 — (1) the GO pill's "N/M" counts a swapped-away exercise reopened by Add set
// (workoutPosition); (2) the Finish screen re-derives its finish time on a tick and Save stores
// exactly the time it shows; (3) the auto-complete summary shows the left-open line.
// Rendered tests: one StoreProvider per test (L-051), the screen picked inside it with a key
// (L-056), string/boolean asserts only (L-055), setInterval + Date mocked (node:test
// mock.timers; setTimeout stays real for act/flush). Clocks are LOCAL parts (req-224 pattern).
import { describe, it, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { act, importJsx, render } from './test-support/render.js'
import {
  addWorkingSetToState,
  markItemDonePatch,
  reopenItemPatch,
  replaceItemPatch,
  replacementItem,
} from './workout-items.js'
import { workoutPillState, workoutPosition } from './workout-log.js'
import { leftOpenText } from './finish-unfinished.js'

const h = React.createElement

// ---- (1) workoutPosition --------------------------------------------------------------
const NOW = 1_000_000
const item = (id) => ({ routineItemId: id, exerciseId: `ex-${id}`, sets: 4, targets: ['8', '8', '8', '8'] })
const set = (id) => ({ routineItemId: id, exerciseId: `ex-${id}`, setType: 'work', weight: 20, reps: '8' })
const four = (id) => [set(id), set(id), set(id), set(id)]
const seven = () => ['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7'].map(item)
const workout = (items, sets = [], extra = {}) => ({ routineId: 'r', snapshot: { items }, sets, completedItemIds: [], ...extra })

// i1 logged, then i2 swapped for i2-new (replaceItemPatch, as the Swap sheet does).
function swapped() {
  let w = workout(seven(), four('i1'))
  const repl = replacementItem({ id: 'i2-new', original: w.snapshot.items[1], exercise: { id: 'ex-new', name: 'New' }, restSec: 0 })
  w = { ...w, ...replaceItemPatch(w, 'i2', repl) }
  return w
}
// i2's review → Add set: exactly the item.jsx handler (reopenItemPatch, then addWorkingSet).
function reopenAndAddSet(w, key) {
  const reopened = { ...w, ...reopenItemPatch(w, w.snapshot.items.find((it) => it.routineItemId === key)) }
  return addWorkingSetToState({ activeWorkout: reopened }, key).activeWorkout
}

describe('req-227 AC1 — a reopened swapped-away exercise counts', () => {
  it('swap A→A2, Add set on A\'s review → A in the total, current ≤ total', () => {
    const w = reopenAndAddSet(swapped(), 'i2')
    const pos = workoutPosition(w)
    assert.equal(JSON.stringify(pos), JSON.stringify({ current: 2, total: 8, done: 1 }))
    assert.equal(pos.current <= pos.total, true)
    assert.equal(workoutPillState(w, NOW).countText, '2/8')
  })
  // req-261 (DEC-155 §2) — N is the open row's place: A (i2) is 2nd of the 8 counted, so "2/8"
  // (was "8/8" when N was done + 1). Still never N > M, and never "7/7" with work left.
  it('everything else done, A reopened → "2/8" (A\'s place), never "N/M" with N > M (and not "7/7" with work left)', () => {
    let w = reopenAndAddSet(swapped(), 'i2')
    for (const key of ['i3', 'i4', 'i5', 'i6', 'i7', 'i2-new']) {
      w = { ...w, ...markItemDonePatch(w, w.snapshot.items.find((it) => it.routineItemId === key)) }
    }
    const pos = workoutPosition(w)
    assert.equal(JSON.stringify(pos), JSON.stringify({ current: 2, total: 8, done: 7 }))
    assert.equal(pos.current <= pos.total, true)
    assert.equal(workoutPillState(w, NOW).item.routineItemId, 'i2')
    assert.equal(workoutPillState(w, NOW).countText, '2/8')
  })
})

describe('req-227 AC2 — a swapped-away exercise left alone stays out', () => {
  it('swap A→A2, A not reopened → total 7, as req-222', () => {
    assert.equal(JSON.stringify(workoutPosition(swapped())), JSON.stringify({ current: 2, total: 7, done: 1 }))
  })
})

// ---- (2)(3) rendered ---------------------------------------------------------------------
const at = (hh, mm = 0, ss = 0) => new Date(2026, 9, 12, hh, mm, ss) // Mon 2026-10-12 local
const iso = (hh, mm, ss) => at(hh, mm, ss).toISOString()
const fixture = () => JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

let view = null
afterEach(async () => {
  if (view) await view.unmount()
  view = null
  mock.timers.reset()
})

async function tick(ms) {
  await act(async () => mock.timers.tick(ms))
  await flush()
}

// One StoreProvider; started at 10:00, sets logged 10:00 and 10:50; the clock is `now`. The
// screen (`finish` | `auto`) mounts inside the provider once the sets are in, keyed.
async function openScreen(screen, now) {
  mock.timers.enable({ apis: ['setInterval', 'Date'], now: now.getTime() })
  localStorage.clear()
  localStorage.setItem('workout-mvp-v8', JSON.stringify({ ...fixture(), activeWorkout: null }))
  const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
  const { useStore } = await import('./store-context.js')
  const { WorkoutFinish } = await importJsx('./views/workout/finish.jsx', import.meta.url)
  const { AutoCompleteSummary } = await importJsx('./views/workout/auto-complete.jsx', import.meta.url)
  const captured = {}
  function Grab() {
    // oxlint-disable-next-line react/immutability
    captured.store = useStore()
    const active = captured.store.activeWorkout
    if (!active?.sets?.length) return null
    if (screen === 'none') return null
    if (screen === 'finish') return h(WorkoutFinish, { key: 'finish', routineId: 'sess-lower' })
    return h(AutoCompleteSummary, { key: 'auto', routineId: 'sess-lower', active, store: captured.store, onCancel: () => {}, countdown: false })
  }
  view = await render(h(StoreProvider, null, h(Grab)))
  await act(async () => captured.store.startWorkout('sess-lower'))
  const first = captured.store.activeWorkout.snapshot.items[1]
  const logged = (t) => ({ routineItemId: first.routineItemId || first.id, exerciseId: first.exerciseId, setType: 'work', weight: 20, reps: '10', rpe: null, note: '', loggedAt: t })
  const sets = [logged(iso(10, 0)), logged(iso(10, 50))]
  await act(async () => captured.store.patchActive({ startedAt: iso(10, 0), sets }))
  await flush()
  return { captured, sets }
}

// What the Finish screen shows: its minutes, and the HH:MM of the left-open line (or null).
function shown() {
  const text = view.text()
  const minutes = text.match(/— (\d+) min ·/)
  const line = text.match(/saved as finished at (\d\d:\d\d)/)
  return { text, minutes: minutes ? Number(minutes[1]) : null, lineTime: line ? line[1] : null }
}
const hhmm = (isoText) => {
  const d = new Date(isoText)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

describe('req-227 AC3 / AC4 — the Finish screen updates while open; Save stores what it shows', () => {
  it('AC3: open 10:55 → "55 min", no line; at 15:00 → "50 min" + the line; Save → the last set\'s loggedAt', async () => {
    const { captured, sets } = await openScreen('finish', at(10, 55))
    let s = shown()
    assert.equal(s.minutes, 55, s.text)
    assert.equal(s.text.includes('You left this workout open'), false)

    await tick(at(15, 0).getTime() - at(10, 55).getTime())
    s = shown()
    assert.equal(s.minutes, 50, s.text)
    assert.equal(s.text.includes(leftOpenText(sets[1].loggedAt)), true, s.text)

    await view.click(view.button('Save'))
    const saved = captured.store.workouts[0]
    assert.equal(captured.store.activeWorkout === null, true)
    assert.equal(saved.finishedAt, sets[1].loggedAt)
    // AC4 — the stored value is the one the screen rendered (read from the DOM).
    assert.equal(Math.round((Date.parse(saved.finishedAt) - at(10, 0).getTime()) / 60000), s.minutes)
    assert.equal(hhmm(saved.finishedAt), s.lineTime)
  })

  it('AC4 failure case: the screen shows "not left open"; Save 5 s past the 3 h mark (before the next tick) stores the SHOWN time, not the last set\'s', async () => {
    // Opened at 13:49:50 (2 h 59 m 50 s after the 10:50 set) → not left open.
    const { captured, sets } = await openScreen('finish', at(13, 49, 50))
    await tick(15000) // 13:50:05 — past 3 h, but no 30 s tick has fired yet
    const s = shown()
    assert.equal(s.lineTime, null, s.text)
    assert.equal(s.minutes, 230, s.text)
    await view.click(view.button('Save'))
    const saved = captured.store.workouts[0]
    // A save-time recompute (the old mechanism) would store 10:50 here.
    assert.equal(saved.finishedAt === sets[1].loggedAt, false)
    assert.equal(saved.finishedAt, iso(13, 49, 50))
    assert.equal(Math.round((Date.parse(saved.finishedAt) - at(10, 0).getTime()) / 60000), s.minutes)
  })

  it('the tick re-derives the minutes: 10:55 "55 min" → 11:00 "60 min"', async () => {
    await openScreen('finish', at(10, 55))
    await tick(5 * 60000)
    assert.equal(shown().minutes, 60)
  })
})

describe('req-227 AC5 — the auto-complete summary says "left open" too', () => {
  it('left open (now 15:00, last set 10:50) → the line; Duration 50 min; Finish saves 10:50', async () => {
    const { captured, sets } = await openScreen('auto', at(15, 0))
    const text = view.text()
    assert.equal(text.includes(leftOpenText(sets[1].loggedAt)), true, text)
    assert.equal(/Duration50 min/.test(text), true, text)
    await view.click(view.button('Finish'))
    assert.equal(captured.store.workouts[0].finishedAt, sets[1].loggedAt)
  })
  it('a normal finish (now 11:00) → no line; Finish saves now', async () => {
    const { captured } = await openScreen('auto', at(11, 0))
    const text = view.text()
    assert.equal(text.includes('You left this workout open'), false, text)
    assert.equal(/Duration60 min/.test(text), true, text)
    await view.click(view.button('Finish'))
    assert.equal(captured.store.workouts[0].finishedAt, iso(11, 0))
  })
})

// ---- review round 1 ---------------------------------------------------------------------
// A locked / backgrounded phone suspends setInterval: mock.timers.setTime moves Date WITHOUT
// firing the interval, which is that suspension.
async function setClock(date) {
  await act(async () => mock.timers.setTime(date.getTime()))
}
async function becomeVisible() {
  const desc = Object.getOwnPropertyDescriptor(document, 'visibilityState')
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
  try {
    await act(async () => document.dispatchEvent(new window.Event('visibilitychange')))
    await flush()
  } finally {
    if (desc) Object.defineProperty(document, 'visibilityState', desc)
    else delete document.visibilityState
  }
}

describe('req-227 review round 1 — a suspended tick never saves a stale time', () => {
  it('(a) hidden → visible refreshes the shown minutes (no tick fired)', async () => {
    await openScreen('finish', at(10, 51))
    assert.equal(shown().minutes, 51)
    await setClock(at(13, 40))
    assert.equal(shown().minutes, 51) // still the stale render: the interval never fired
    await becomeVisible()
    assert.equal(shown().minutes, 220, shown().text)
  })
  it('pageshow and focus refresh too', async () => {
    await openScreen('finish', at(10, 51))
    await setClock(at(11, 0))
    await act(async () => window.dispatchEvent(new window.Event('pageshow')))
    assert.equal(shown().minutes, 60)
    await setClock(at(11, 10))
    await act(async () => window.dispatchEvent(new window.Event('focus')))
    assert.equal(shown().minutes, 70)
  })
  it('(b) Finish opened 10:51, phone locked, Save at 13:40 (shown `now` stale > tick + 5 s) → stores 13:40, not 10:51', async () => {
    const { captured } = await openScreen('finish', at(10, 51))
    await setClock(at(13, 40))
    await view.click(view.button('Save'))
    assert.equal(captured.store.workouts[0].finishedAt, iso(13, 40))
  })
  it("(b) stale and past 3 h at the tap (Save 15:00) → the re-derived left-open time, the last set's", async () => {
    const { captured, sets } = await openScreen('finish', at(10, 51))
    await setClock(at(15, 0))
    await view.click(view.button('Save'))
    assert.equal(captured.store.workouts[0].finishedAt, sets[1].loggedAt)
  })
  it('(c) stale by exactly tick + 5 s → still the shown time (the guard is strictly greater)', async () => {
    const { captured } = await openScreen('finish', at(10, 51))
    await setClock(new Date(at(10, 51).getTime() + 35000))
    await view.click(view.button('Save'))
    assert.equal(captured.store.workouts[0].finishedAt, iso(10, 51))
  })
})

describe('req-227 review round 1 — store.finishWorkout validates finishedAt', () => {
  const bad = [
    ["''", ''],
    ['a Date object', new Date(2026, 0, 1)],
    ['an event-like object', { type: 'click', target: null }],
    ['unreadable text', 'soon'],
  ]
  for (const [label, value] of bad) {
    it(`${label} → the computed time (left open at 15:00 → the last set's)`, async () => {
      const { captured, sets } = await openScreen('none', at(15, 0))
      await act(async () => captured.store.finishWorkout({}, value))
      assert.equal(captured.store.workouts[0].finishedAt, sets[1].loggedAt)
    })
  }
  it('a readable ISO string → stored as given', async () => {
    const { captured } = await openScreen('none', at(15, 0))
    await act(async () => captured.store.finishWorkout({}, iso(12, 34)))
    assert.equal(captured.store.workouts[0].finishedAt, iso(12, 34))
  })
})

describe('req-227 review round 1 — the no-countdown summary updates and saves what it shows', () => {
  it('last set 10:50, summary from a skip at 10:52 → "52 min", no line; at 15:00 → "50 min" + line; Finish stores 10:50', async () => {
    const { captured, sets } = await openScreen('auto', at(10, 52))
    let text = view.text()
    assert.equal(/Duration52 min/.test(text), true, text)
    assert.equal(text.includes('You left this workout open'), false)
    await tick(at(15, 0).getTime() - at(10, 52).getTime())
    text = view.text()
    assert.equal(/Duration50 min/.test(text), true, text)
    assert.equal(text.includes(leftOpenText(sets[1].loggedAt)), true, text)
    await view.click(view.button('Finish'))
    assert.equal(captured.store.workouts[0].finishedAt, sets[1].loggedAt)
  })
  it('the summary passes its shown time: opened 13:49:50 (not left open), Finish 13:50:05 → 13:49:50, not 10:50', async () => {
    const { captured, sets } = await openScreen('auto', at(13, 49, 50))
    await tick(15000)
    const text = view.text()
    assert.equal(text.includes('You left this workout open'), false, text)
    await view.click(view.button('Finish'))
    assert.equal(captured.store.workouts[0].finishedAt === sets[1].loggedAt, false)
    assert.equal(captured.store.workouts[0].finishedAt, iso(13, 49, 50))
  })
  it('summary opened 10:52, phone locked, Finish at 13:40 → stores 13:40 (stale guard)', async () => {
    const { captured } = await openScreen('auto', at(10, 52))
    await setClock(at(13, 40))
    await view.click(view.button('Finish'))
    assert.equal(captured.store.workouts[0].finishedAt, iso(13, 40))
  })
})
