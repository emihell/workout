// req-222 (DEC-125 §3) — the GO pill shows from the start of a workout and counts the whole
// workout ("GO · set 2/4 · 3/7"). Pure: workoutPillState / workoutPosition (workout-log.js).
// Rendered: the overview of a just-started workout against the real store (one StoreProvider
// per test, L-051), seeded with db.json as the QA seed writes it.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { act, importJsx, render } from './test-support/render.js'
import { itemKey, replaceItemPatch, replacementItem, skipItemPatch, workoutPillState, workoutPosition } from './workout-log.js'

const h = React.createElement
const DB = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
const NOW = 1_000_000

const item = (id) => ({ routineItemId: id, exerciseId: `ex-${id}`, sets: 4, targets: ['8', '8', '8', '8'] })
const set = (id) => ({ routineItemId: id, exerciseId: `ex-${id}`, setType: 'work', weight: 20, reps: '8' })
const four = (id) => [set(id), set(id), set(id), set(id)]
const seven = () => ['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7'].map(item)
const workout = (items, sets = [], extra = {}) => ({ routineId: 'r', snapshot: { items }, sets, completedItemIds: [], ...extra })

describe('AC1 — a fresh workout shows GO on the first item', () => {
  it('7 items, no sets → { lead GO, item items[0] }, "GO · 1/7"', () => {
    const items = seven()
    const pill = workoutPillState(workout(items), NOW)
    assert.equal(pill.go, true)
    assert.equal(pill.item, items[0])
    assert.equal(pill.setText, '')
    assert.equal(pill.countText, '1/7')
    assert.equal(pill.label, 'GO · 1/7')
  })
  it('a Skip exercise on item 1 alone (only skipped records) → item 2, "GO · 2/7"', () => {
    const w = workout(seven())
    const after = { ...w, ...skipItemPatch(w, 'i1') }
    const pill = workoutPillState(after, NOW)
    assert.equal(pill.item.routineItemId, 'i2')
    assert.equal(pill.label, 'GO · 2/7')
  })
})

describe('AC2 — the whole-workout count after the set count', () => {
  const sets = [...four('i1'), ...four('i2'), set('i3')]
  it('2 done, 3rd has 1 of 4 → "GO · set 2/4 · 3/7"', () => {
    const pill = workoutPillState(workout(seven(), sets), NOW)
    assert.equal(pill.item.routineItemId, 'i3')
    assert.equal(pill.label, 'GO · set 2/4 · 3/7')
  })
  it('resting → clock lead, same tail', () => {
    const pill = workoutPillState(workout(seven(), sets, { restEndsAt: NOW + 72_000 }), NOW)
    assert.equal(pill.go, false)
    assert.equal(pill.label, '1:12 · set 2/4 · 3/7')
  })
  it('after an item\'s last set: the next item, no set count → "1:30 · 3/7" then "GO · 3/7"', () => {
    const w = workout(seven(), [...four('i1'), ...four('i2')], { restEndsAt: NOW + 90_000 })
    assert.equal(workoutPillState(w, NOW).label, '1:30 · 3/7')
    assert.equal(workoutPillState({ ...w, restEndsAt: NOW - 1 }, NOW).label, 'GO · 3/7')
  })
})

describe('AC3 / AC6 — a Swap: M counts the replacement, not the original', () => {
  it('item 2 swapped via replaceItemPatch itself → 8 rows in the snapshot, M stays 7', () => {
    let w = workout(seven(), four('i1'))
    const repl = replacementItem({ id: 'i2-new', original: w.snapshot.items[1], exercise: { id: 'ex-new', name: 'New' }, restSec: 0 })
    w = { ...w, ...replaceItemPatch(w, 'i2', repl) }
    assert.equal(w.snapshot.items.length, 8)
    assert.equal(w.snapshot.items[2].replacesItemId, 'i2')
    assert.deepEqual(workoutPosition(w), { current: 2, total: 7, done: 1 })
    const pill = workoutPillState(w, NOW)
    assert.equal(itemKey(pill.item), 'i2-new')
    assert.equal(pill.label, 'GO · 2/7')
  })
  it('a plain Skip exercise still counts (done), an Add exercise item adds one', () => {
    let w = workout(seven(), four('i1'))
    w = { ...w, ...skipItemPatch(w, 'i2') }
    assert.deepEqual(workoutPosition(w), { current: 3, total: 7, done: 2 })
    const added = { ...item('i8'), addedMidWorkout: true }
    w = { ...w, snapshot: { items: [...w.snapshot.items, added] } }
    assert.deepEqual(workoutPosition(w), { current: 3, total: 8, done: 2 })
  })
})

describe('AC4 — N counts done items, not the row position', () => {
  it('items 5 and 6 done, rest not → N = 3, current = item 1', () => {
    const pill = workoutPillState(workout(seven(), [...four('i5'), ...four('i6')]), NOW)
    assert.equal(pill.item.routineItemId, 'i1')
    assert.equal(pill.countText, '3/7')
    assert.equal(pill.label, 'GO · 3/7')
  })
})

describe('AC5 — failure case: empty input and all done', () => {
  it('0 items → null, no crash (also with no snapshot at all)', () => {
    assert.equal(workoutPillState(workout([]), NOW), null)
    assert.equal(workoutPillState({ sets: [] }, NOW), null)
    assert.equal(workoutPillState(null, NOW), null)
    assert.equal(workoutPosition(workout([])), null)
  })
  it('all items done → null', () => {
    const items = seven()
    assert.equal(workoutPillState(workout(items, items.flatMap((i) => four(i.routineItemId))), NOW), null)
    assert.equal(workoutPillState(workout(items, [], { completedItemIds: items.map(itemKey) }), NOW), null)
  })
})

// ── AC7 rendered ───────────────────────────────────────────────────────────────────
let view = null
afterEach(async () => {
  await view?.unmount()
  view = null
})

describe('AC7 — the overview of a just-started workout', () => {
  it('shows the pill "GO · 1/9" (the seed\'s Upper Body has 9 items); tapping it opens item 1\'s log screen', async () => {
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { useStore } = await import('./store-context.js')
    const { Workout } = await importJsx('./views/workout/overview.jsx', import.meta.url)
    localStorage.clear()
    localStorage.setItem('workout-mvp-v8', JSON.stringify({ ...DB, activeWorkout: null }))
    window.location.hash = '#/workout/sess-upper'
    const captured = {}
    function Screen() {
      // oxlint-disable-next-line react/immutability
      captured.store = useStore()
      return captured.store.activeWorkout ? h(Workout, { routineId: 'sess-upper' }) : null
    }
    view = await render(h(StoreProvider, null, h(Screen)))
    await act(async () => captured.store.startWorkout('sess-upper'))
    const active = captured.store.activeWorkout
    assert.equal(active.sets.length, 0, 'nothing logged')
    assert.equal(active.snapshot.items.length, 9)
    const pill = view.container.querySelector('.ui-restpill')
    assert.ok(pill, 'the pill is on the overview')
    assert.equal(pill.textContent.replace(/\s+/g, ''), 'GO·1/9')
    await view.click(pill)
    assert.equal(window.location.hash, `#/workout/sess-upper/item/${itemKey(active.snapshot.items[0])}/log`)
  })
})
