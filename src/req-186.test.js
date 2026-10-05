// req-186 — the exercise page: set list all the way, Previous without un-logging, one
// workout pill (DEC-103 §3–4). Pure helpers (workout-log.js, set-values.js) + one render
// test of the log screen against the real store.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { importJsx, render, act } from './test-support/render.js'
import {
  currentWorkoutItem,
  itemSetPosition,
  loggedSetRowText,
  restClockText,
  setListRows,
  workoutPillState,
} from './workout-log.js'
import { liveSetEditPatch } from './views/set-values.js'

const h = React.createElement
const DB = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))

const item = (id, extra = {}) => ({ routineItemId: id, exerciseId: `ex-${id}`, sets: 3, targets: ['8', '8', '8'], ...extra })
const set = (id, extra = {}) => ({ routineItemId: id, exerciseId: `ex-${id}`, setType: 'work', weight: 20, reps: '8', ...extra })
const workout = (items, sets = [], extra = {}) => ({ routineId: 'r', snapshot: { items }, sets, completedItemIds: [], ...extra })

describe('acceptance 1 — currentWorkoutItem', () => {
  const items = [item('a'), item('b'), item('c')]
  it('nothing logged → null (no "set 1/N" guess)', () => {
    assert.equal(currentWorkoutItem(workout(items)), null)
  })
  it('last logged item not done → that item (even when it is not the first)', () => {
    assert.equal(currentWorkoutItem(workout(items, [set('a'), set('a'), set('a'), set('c')])).routineItemId, 'c')
    assert.equal(currentWorkoutItem(workout(items, [set('b')])).routineItemId, 'b')
  })
  it('last logged item done → the first not-done item in snapshot order', () => {
    const w = workout(items, [set('b'), set('b'), set('b')])
    assert.equal(currentWorkoutItem(w).routineItemId, 'a')
    // marked done (e.g. Skip exercise) counts as done too
    const marked = workout(items, [set('a')], { completedItemIds: ['a'] })
    assert.equal(currentWorkoutItem(marked).routineItemId, 'b')
  })
  it('all done → null', () => {
    const sets = ['a', 'b', 'c'].flatMap((id) => [set(id), set(id), set(id)])
    assert.equal(currentWorkoutItem(workout(items, sets)), null)
  })
  it('a replacement item (addedMidWorkout) counts like any other', () => {
    const swapped = [item('a'), { ...item('x'), addedMidWorkout: true }]
    const w = workout(swapped, [set('a', { reps: 'skipped' }), set('x')], { completedItemIds: ['a'] })
    assert.equal(currentWorkoutItem(w).routineItemId, 'x')
    const w2 = workout(swapped, [set('a', { reps: 'skipped' })], { completedItemIds: ['a'] })
    assert.equal(currentWorkoutItem(w2).routineItemId, 'x')
  })
})

describe('acceptance 2 — set N/M (warm-up counts)', () => {
  const wu = item('a', { warmup: { reps: 12 } })
  it('warm-up + 3 work sets after 0, 1 (wu), 2 logs → 1/4, 2/4, 3/4', () => {
    const seen = [
      [],
      [set('a', { setType: 'wu' })],
      [set('a', { setType: 'wu' }), set('a')],
    ].map((sets) => itemSetPosition(workout([wu], sets), wu))
    assert.deepEqual(seen.map(({ current, total }) => `${current}/${total}`), ['1/4', '2/4', '3/4'])
  })
  it('clamped to M once every set is logged; no warm-up → M is the work count', () => {
    const plain = item('a')
    assert.deepEqual(itemSetPosition(workout([plain], [set('a'), set('a'), set('a')]), plain), { current: 3, total: 3 })
  })
})

describe('the pill label', () => {
  it('rest clock: Ns under a minute, m:ss from 60 s', () => {
    assert.deepEqual([0, 9, 59, 60, 72, 125.2].map(restClockText), ['0s', '9s', '59s', '1:00', '1:12', '2:06'])
  })
  it('resting → "1:12 · set 2/3"; rest over or none armed → "GO · set 2/3"; no current → null', () => {
    const items = [item('a')]
    const now = 1_000_000
    const resting = workout(items, [set('a')], { restEndsAt: now + 72_000 })
    assert.equal(workoutPillState(resting, now).label, '1:12 · set 2/3')
    assert.equal(workoutPillState(resting, now).go, false)
    const over = workout(items, [set('a')], { restEndsAt: now - 1 })
    assert.equal(workoutPillState(over, now).label, 'GO · set 2/3')
    assert.equal(workoutPillState(over, now).go, true)
    assert.equal(workoutPillState(workout(items, [set('a')]), now).label, 'GO · set 2/3')
    assert.equal(workoutPillState(workout(items), now), null)
  })
})

describe('acceptance 3 / 8 — set list rows', () => {
  const base = { ex: { type: 'machine' }, weighted: true, hasHistory: false, historyFor: () => ({ weight: '', reps: '' }) }
  it('3-set exercise, set 1 logged → set 1 done with its kg×reps, set 2 current, set 3 upcoming', () => {
    const a = item('a', { suggestedWeights: [20, 20, 25] })
    const w = workout([a], [set('a', { weight: 22.5, reps: '9' })])
    const rows = setListRows({ ...base, workout: w, item: a })
    assert.deepEqual(
      rows.map((r) => [r.status, r.text, r.highlighted]),
      [
        ['done', '1 · 22.5 kg × 9', false],
        ['current', '2 · 20 kg × 8', true],
        ['upcoming', '3 · 25 kg × 8', false],
      ],
    )
    assert.equal(rows[0].setIndex, 0)
  })
  it('viewing a logged set moves the highlight to it', () => {
    const a = item('a')
    const w = workout([a], [set('a'), set('a')])
    const rows = setListRows({ ...base, workout: w, item: a, viewingIndex: 0 })
    assert.deepEqual(rows.map((r) => r.highlighted), [true, false, false])
  })
  it('a skipped set reads "skipped"; warm-up row first', () => {
    const a = item('a', { warmup: { reps: 12 } })
    const w = workout([a], [set('a', { setType: 'wu', weight: 10, reps: '12' }), set('a', { weight: 0, reps: 'skipped', note: 'skipped' })])
    const rows = setListRows({ ...base, workout: w, item: a })
    assert.deepEqual(rows.map((r) => r.text), ['Warm-up · 10 kg × 12', '1 · skipped', '2 · — × 8', '3 · — × 8'])
  })
  it('FAILURE CASE: routine kg blank, no history → upcoming rows show "—", never 0 or another exercise’s kg', () => {
    const a = item('a') // no suggestedWeights
    const other = item('b', { suggestedWeights: [60, 60, 60] })
    const w = workout([other, a], [set('b', { weight: 60 })], { seedOverrides: { 'ex-b::work': { weight: '65' } } })
    const rows = setListRows({ ...base, workout: w, item: a })
    assert.deepEqual(rows.map((r) => r.text), ['1 · — × 8', '2 · — × 8', '3 · — × 8'])
  })
  it('session carry: a no-routine-kg exercise’s upcoming rows follow the kg just logged (DEC-002)', () => {
    const a = item('a')
    const w = workout([a], [set('a', { weight: 40 })])
    assert.deepEqual(setListRows({ ...base, workout: w, item: a }).map((r) => r.text), ['1 · 40 kg × 8', '2 · 40 kg × 8', '3 · 40 kg × 8'])
  })
  it('loggedSetRowText: timed and bodyweight shapes', () => {
    assert.equal(loggedSetRowText('2', { setType: 'work', weight: 0, reps: '', durationSec: 45 }, false), '2 · 45s')
    assert.equal(loggedSetRowText('1', { setType: 'work', weight: 0, reps: '15' }, false), '1 · 15')
  })
})

describe('liveSetEditPatch (Save on a viewed set)', () => {
  it('reads like completeSet: kg parsed, effort → rpe, hidden effort → null; bad kg → null', () => {
    assert.deepEqual(liveSetEditPatch({ weight: '22,5', reps: '7', effort: 4 }, { weighted: true }), { weight: 22.5, reps: '7', rpe: 4 })
    assert.deepEqual(liveSetEditPatch({ weight: '', reps: '7', effort: null }, { weighted: false }), { weight: 0, reps: '7', rpe: null })
    assert.deepEqual(liveSetEditPatch({ weight: '', reps: '', effort: 3, durationSec: 40 }, { weighted: false, timed: true }), {
      weight: 0,
      reps: '',
      rpe: 3,
      durationSec: 40,
    })
    assert.equal(liveSetEditPatch({ weight: 'abc', reps: '7', effort: 3 }, { weighted: true }), null)
  })
})

describe('acceptance 4 / 5 — the log screen (render, real store)', () => {
  let view
  afterEach(async () => {
    await view?.unmount()
    view = null
  })

  it('Previous shows the logged set without un-logging; Next and Save leave restEndsAt alone; Skip rest clears it', async () => {
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { useStore } = await import('./store-context.js')
    const { WorkoutItemLog } = await importJsx('./views/workout/item.jsx', import.meta.url)
    localStorage.clear()
    localStorage.setItem('workout-mvp-v8', JSON.stringify({ ...DB, activeWorkout: null }))
    const captured = {}
    function Screen({ open }) {
      // oxlint-disable-next-line react/immutability
      captured.store = useStore()
      return open ? h(WorkoutItemLog, { routineId: 'sess-upper', itemId: 'si-sess-upper-1-ex-chest-press' }) : null
    }
    view = await render(h(StoreProvider, null, h(Screen, { open: false })))
    await act(async () => captured.store.startWorkout('sess-upper'))
    await view.unmount()
    view = await render(h(StoreProvider, null, h(Screen, { open: true })))
    const active = () => captured.store.activeWorkout
    const rows = () => view.all('.ui-setpreview li').map((li) => [li.className.replace('ui-setpreview__row ', ''), li.getAttribute('aria-current'), li.textContent])

    // warm-up, then work set 1
    await view.click(view.button('Complete'))
    await view.type(view.input('kg'), '27.5')
    await view.click(view.button('Complete'))
    assert.equal(active().sets.length, 2)
    assert.deepEqual(rows(), [
      ['is-done', null, '✓Done: Warm-up · 10 kg × 12'], // warm-up kg from db.json history,
      ['is-done', null, '✓Done: 1 · 27.5 kg × 12'],
      ['is-current is-here', 'step', '2 · 27.5 kg × 11'],
      ['is-upcoming', null, '3 · 27.5 kg × 9'],
    ])
    const restEndsAt = active().restEndsAt
    assert.ok(restEndsAt > Date.now(), 'a 90 s rest is running')
    assert.ok(view.container.querySelector('.ui-restpill'), 'the pill shows')
    assert.match(view.container.querySelector('.ui-restpill').textContent, /set 3\/4$/)
    // scope 5 — the title's small "N/M" is gone
    for (const sub of view.all('.ui-sub')) assert.doesNotMatch(sub.textContent, /\d\/\d/)

    // Previous → set 1's logged values, nothing removed, rest untouched
    await view.click(view.button('Previous'))
    assert.equal(view.input('kg').value, '27.5')
    assert.equal(view.input('Reps').value, '12')
    assert.equal(active().sets.length, 2, 'sets logged count unchanged')
    assert.equal(active().restEndsAt, restEndsAt, 'rest not reset')
    assert.equal(view.button('Complete'), null)
    assert.ok(view.button('Next'), 'Next (secondary)')
    assert.match(view.button('Next').className, /ui-btn--secondary/)
    assert.ok(view.button('Previous'), 'the warm-up is earlier, so Previous stays')
    assert.equal(rows()[1][1], 'step', 'the viewed set is highlighted')

    // Next → back on set 2, same countdown
    await view.click(view.button('Next'))
    assert.ok(view.button('Complete'))
    assert.equal(view.input('Reps').value, '11')
    assert.equal(active().restEndsAt, restEndsAt)

    // Previous, change reps, Save → stored, rest unchanged
    await view.click(view.button('Previous'))
    await view.type(view.input('Reps'), '10')
    assert.equal(view.button('Next'), null)
    assert.match(view.button('Save').className, /ui-btn--primary/)
    await view.click(view.button('Save'))
    assert.equal(active().sets[1].reps, '10')
    assert.equal(active().sets[1].weight, 27.5)
    assert.equal(active().sets.length, 2)
    assert.equal(active().restEndsAt, restEndsAt, 'Save leaves the rest alone')
    assert.ok(view.button('Complete'), 'back on the current set')

    // Skip rest — the pill's old write, now on the screen
    await view.click(view.button('Skip rest'))
    assert.equal(active().restEndsAt, null)
    assert.equal(view.button('Skip rest'), null)
    assert.match(view.container.querySelector('.ui-restpill').textContent, /^GO/)
  })
})
