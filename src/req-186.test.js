// req-186 — the exercise page: set list all the way, Previous without un-logging, one
// workout pill (DEC-103 §3–4). Pure helpers (workout-log.js, set-values.js) + one render
// test of the log screen against the real store.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { importJsx, render, act } from './test-support/render.js'
import {
  carryForSet,
  currentWorkoutItem,
  initialSetFields,
  nextSeedOverrides,
  replaceItemPatch,
  replacementItem,
  setDraftFromLoggedSet,
  skipItemPatch,
  itemSetPosition,
  loggedSetRowText,
  restClockText,
  setListRows,
  workoutPillState,
} from './workout-log.js'
import { liveSetEditPatch, viewedSetSave } from './views/set-values.js'

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
    // review fix 1 — a Swap alone (only skipped records) is "nothing logged": no pill
    const w2 = workout(swapped, [set('a', { reps: 'skipped' })], { completedItemIds: ['a'] })
    assert.equal(currentWorkoutItem(w2), null)
  })
})

describe('review fix 1 — skipped records and Swap', () => {
  const items = () => [item('a'), item('b'), item('c')]
  it('(a) fresh workout, Skip exercise on A → no pill (skipped records are not "logged")', () => {
    const w = workout(items())
    const after = { ...w, ...skipItemPatch(w, 'a') }
    assert.ok(after.sets.length > 0 && after.sets.every((x) => x.reps === 'skipped'))
    assert.equal(currentWorkoutItem(after), null)
  })
  it('(b) A and C in progress, B replaced → the pill item is the replacement', () => {
    let w = workout(items(), [set('a'), set('c')])
    const b = w.snapshot.items[1]
    const repl = replacementItem({ id: 'b-new', original: b, exercise: { id: 'ex-new', name: 'New' }, restSec: 0 })
    w = { ...w, ...replaceItemPatch(w, 'b', repl) }
    assert.deepEqual(w.snapshot.items.map((i) => i.routineItemId), ['a', 'b', 'b-new', 'c'])
    assert.equal(currentWorkoutItem(w).routineItemId, 'b-new')
  })
  it('Skip exercise on B while C is in progress → C (the last real set), not an untouched A', () => {
    let w = workout(items(), [set('c')])
    w = { ...w, ...skipItemPatch(w, 'b') }
    assert.equal(currentWorkoutItem(w).routineItemId, 'c')
  })
  it('a set-level Skip on an exercise in progress keeps it current', () => {
    const w = workout(items(), [set('a'), set('c'), set('c', { reps: 'skipped', weight: 0, note: 'skipped' })])
    assert.equal(currentWorkoutItem(w).routineItemId, 'c')
  })
})

describe('review fix 2 — Save that changes kg re-runs the seed overrides (DEC-052)', () => {
  it('routine 60, set 1 logged 62.5, Previous → 60 → Save → set 2 and the upcoming rows prefill 60', () => {
    const a = item('a', { suggestedWeights: [60, 60, 60] })
    // Complete set 1 at 62.5 (seed 60) — what completeSet records
    const afterComplete = nextSeedOverrides({}, { exerciseId: 'ex-a', setType: 'work', weighted: true, seed: { weight: '60' }, logged: { weight: 62.5 } })
    let w = workout([a], [set('a', { weight: 62.5, reps: '8', rpe: 3 })], { seedOverrides: afterComplete })
    const base = { ex: { type: 'machine' }, weighted: true, hasHistory: false, historyFor: () => ({ weight: '', reps: '' }) }
    assert.deepEqual(setListRows({ ...base, workout: w, item: a }).slice(1).map((r) => r.text), ['2 · 62.5 kg × 8', '3 · 62.5 kg × 8'])
    // Previous shows 62.5; change to 60; Save
    const save = viewedSetSave(
      { weight: '60', reps: '8', effort: 3 },
      { weighted: true, initialEffort: 3, set: w.sets[0], presentedWeight: '62.5', seedOverrides: w.seedOverrides, sets: w.sets, setIndex: 0 },
    )
    assert.deepEqual(save.setPatch, { weight: 60, reps: '8' })
    w = { ...w, sets: [{ ...w.sets[0], ...save.setPatch }], seedOverrides: save.seedOverrides }
    assert.equal(w.sets[0].weight, 60)
    assert.deepEqual(setListRows({ ...base, workout: w, item: a }).slice(1).map((r) => r.text), ['2 · 60 kg × 8', '3 · 60 kg × 8'])
    // the current set's form seed (the same initialSetFields the log form uses)
    const seed = initialSetFields({
      weighted: true,
      fromRestore: false,
      restore: null,
      hasHistory: false,
      history: { weight: '', reps: '' },
      carry: carryForSet('work', w.sets),
      target: '8',
      override: w.seedOverrides['ex-a::work'],
      routineKg: 60,
    })
    assert.equal(seed.weight, '60')
  })
  it('re-review fix 1 — editing an EARLIER set leaves the carry: 60, 65 (carry 65); set 1 → 61, Save → carry 65, set 3 prefills 65', () => {
    const a = item('a') // no routine kg: the session carry decides
    let overrides = nextSeedOverrides({}, { exerciseId: 'ex-a', setType: 'work', weighted: true, seed: { weight: '' }, logged: { weight: 60 } })
    overrides = nextSeedOverrides(overrides, { exerciseId: 'ex-a', setType: 'work', weighted: true, seed: { weight: '60' }, logged: { weight: 65 } })
    let w = workout([a], [set('a', { weight: 60 }), set('a', { weight: 65 })], { seedOverrides: overrides })
    assert.deepEqual(w.seedOverrides['ex-a::work'], { weight: '65' })
    const save = viewedSetSave(
      { weight: '61', reps: '8', effort: 3 },
      { weighted: true, initialEffort: 3, set: w.sets[0], presentedWeight: '60', seedOverrides: w.seedOverrides, sets: w.sets, setIndex: 0 },
    )
    assert.equal(save.seedOverrides, w.seedOverrides, 'carry untouched')
    w = { ...w, sets: [{ ...w.sets[0], ...save.setPatch }, w.sets[1]], seedOverrides: save.seedOverrides }
    assert.equal(w.sets[0].weight, 61)
    const base = { ex: { type: 'machine' }, weighted: true, hasHistory: false, historyFor: () => ({ weight: '', reps: '' }) }
    assert.equal(setListRows({ ...base, workout: w, item: a })[2].text, '3 · 65 kg × 8')
    // the latest set (set 2) DOES re-run it
    const latest = viewedSetSave(
      { weight: '62.5', reps: '8', effort: 3 },
      { weighted: true, initialEffort: 3, set: w.sets[1], presentedWeight: '65', seedOverrides: w.seedOverrides, sets: w.sets, setIndex: 1 },
    )
    assert.deepEqual(latest.seedOverrides['ex-a::work'], { weight: '62.5' })
  })
  it('a Save that leaves kg alone returns the same overrides map (no write)', () => {
    const overrides = { 'ex-a::work': { weight: '62.5' } }
    const save = viewedSetSave({ weight: '62.5', reps: '9', effort: 3 }, { weighted: true, initialEffort: 3, set: set('a', { weight: 62.5 }), presentedWeight: '62.5', seedOverrides: overrides })
    assert.equal(save.seedOverrides, overrides)
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
        // req-210 test edit: was × 8 — a uniform 8/8/8 plan now carries set 1's logged 9 reps (DEC-117 §3).
        ['current', '2 · 20 kg × 9', true],
        ['upcoming', '3 · 25 kg × 9', false],
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
  it('reads like completeSet: kg parsed, a changed effort → rpe, hidden effort → no rpe; bad kg → null', () => {
    assert.deepEqual(liveSetEditPatch({ weight: '22,5', reps: '7', effort: 4 }, { weighted: true, initialEffort: 3 }), { weight: 22.5, reps: '7', rpe: 4 })
    assert.deepEqual(liveSetEditPatch({ weight: '', reps: '7', effort: null }, { weighted: false, initialEffort: 3 }), { weight: 0, reps: '7' })
    assert.deepEqual(liveSetEditPatch({ weight: '', reps: '', effort: 2, durationSec: 40 }, { weighted: false, timed: true, initialEffort: 3 }), {
      weight: 0,
      reps: '',
      rpe: 2,
      durationSec: 40,
    })
    assert.equal(liveSetEditPatch({ weight: 'abc', reps: '7', effort: 3 }, { weighted: true }), null)
  })
  it('review fix 4 — a reps-only edit never rewrites rpe (stored rpe 1 shows as segment 2; untouched → not rescaled)', () => {
    const stored = set('a', { rpe: 1 })
    const shown = setDraftFromLoggedSet('', stored).effort
    assert.equal(shown, 2, 'rpe 1 maps to the lowest segment')
    const patch = liveSetEditPatch({ weight: '20', reps: '9', effort: shown }, { weighted: true, initialEffort: shown, set: stored })
    assert.equal('rpe' in patch, false)
    assert.equal({ ...stored, ...patch }.rpe, 1, 'stored rpe kept')
    // changed effort → written
    assert.equal(liveSetEditPatch({ weight: '20', reps: '9', effort: 4 }, { weighted: true, initialEffort: shown, set: stored }).rpe, 4)
  })
  it('review fix 3 — editing a skipped set into a real one clears its "skipped" note', () => {
    const skipped = set('a', { weight: 0, reps: 'skipped', note: 'skipped', rpe: null })
    const patch = liveSetEditPatch({ weight: '40', reps: '8', effort: 3 }, { weighted: true, initialEffort: 3, set: skipped })
    // re-review fix 2 — the shown (untouched) effort is written: Moderate → rpe 3
    assert.deepEqual(patch, { weight: 40, reps: '8', rpe: 3, note: '' })
    // effort hidden (warm-up / cardio) → still no rpe
    assert.equal('rpe' in liveSetEditPatch({ weight: '40', reps: '8', effort: null }, { weighted: true, initialEffort: 3, set: skipped }), false)
    const saved = { ...skipped, ...patch }
    assert.equal(loggedSetRowText('1', saved, true), '1 · 40 kg × 8')
    // a non-skipped set's note is never touched
    assert.equal('note' in liveSetEditPatch({ weight: '40', reps: '8', effort: 3 }, { weighted: true, initialEffort: 3, set: set('a', { note: 'grip' }) }), false)
  })
})

describe('acceptance 4 / 5 — the log screen (render, real store)', () => {
  let view
  afterEach(async () => {
    await view?.unmount()
    view = null
  })

  // req-212 test edit (DEC-119 §1) — Previous / Next are gone: a done row opens the logged set in
  // the edit sheet (Cancel / Save), the set form staying underneath. The req-186 guarantees are
  // asserted on the sheet instead: nothing un-logged, the rest untouched, a reps-only Save keeps rpe.
  it('a done row opens the logged set in the edit sheet without un-logging; Cancel and Save leave restEndsAt alone; the pill skips the rest (req-192)', async () => {
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
    // req-192 test edit: "Done" logs the warm-up, Medium (rpe 3, as Complete stored) set 1.
    // req-212 test edit: one Done logs set 1 too (rpe null).
    await view.click(view.button('Done'))
    await view.type(view.input('kg'), '27.5')
    await view.click(view.button('Done'))
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
    // req-192 test edit (DEC-108 §3): resting on its own exercise the pill reads "1:30 · skip"
    // (was "· set 3/4"; the set count is on the list).
    assert.match(view.container.querySelector('.ui-restpill').textContent, /·skip$/) // the separator is its own span
    // scope 5 — the title's small "N/M" is gone
    for (const sub of view.all('.ui-sub')) assert.doesNotMatch(sub.textContent, /\d\/\d/)

    assert.equal(view.button('Previous'), null, 'no Previous (req-212)')
    assert.equal(view.button('Next'), null, 'no Next (req-212)')
    const sheet = () => view.container.querySelector('[role="dialog"]')
    const sheetInput = (label) => [...sheet().querySelectorAll('label')].find((l) => l.textContent.trim().startsWith(label))?.querySelector('input')
    const sheetButton = (label) => [...sheet().querySelectorAll('button')].find((b) => b.textContent.trim() === label)

    // tap set 1 → the sheet shows its logged values, nothing removed, rest untouched
    await view.click(view.all('.ui-setpreview__tap')[1])
    assert.ok(sheet(), 'the edit sheet')
    assert.equal(sheetInput('kg').value, '27.5')
    assert.equal(sheetInput('Reps').value, '12')
    assert.equal(active().sets.length, 2, 'sets logged count unchanged')
    assert.equal(active().restEndsAt, restEndsAt, 'rest not reset')
    assert.equal(rows()[1][1], 'step', 'the open set is highlighted')
    assert.ok(view.button('Skip set'), 'the current set form stays underneath')

    // Cancel → nothing written, back on set 2, same countdown
    const before = JSON.stringify(active().sets)
    await view.click(sheetButton('Cancel'))
    assert.equal(sheet(), null)
    assert.equal(JSON.stringify(active().sets), before, 'Cancel writes nothing')
    assert.equal(view.input('Reps').value, '11')
    assert.equal(active().restEndsAt, restEndsAt)

    // reopen, change reps, Save → stored, rest unchanged, loggedAt kept
    await view.click(view.all('.ui-setpreview__tap')[1])
    const rpeBefore = active().sets[1].rpe
    const loggedAtBefore = active().sets[1].loggedAt
    await view.type(sheetInput('Reps'), '10')
    assert.match(sheetButton('Save').className, /ui-btn--primary/)
    await view.click(sheetButton('Save'))
    assert.equal(sheet(), null)
    assert.equal(active().sets[1].reps, '10')
    assert.equal(active().sets[1].rpe, rpeBefore, 'review fix 4 — reps-only Save keeps rpe')
    assert.equal(active().sets[1].loggedAt, loggedAtBefore, 'req-212 — an edit never changes loggedAt')
    assert.equal(active().sets[1].weight, 27.5)
    assert.equal(active().sets.length, 2)
    assert.equal(active().restEndsAt, restEndsAt, 'Save leaves the rest alone')
    assert.ok(view.button('Skip set'), 'back on the current set') // req-192 test edit: was Complete

    // req-192 test edit (DEC-108 §3): the "Skip rest" button is gone; a tap on the pill, on its
    // own exercise's screen, makes the same write.
    assert.equal(view.button('Skip rest'), null)
    await view.click(view.container.querySelector('.ui-restpill'))
    assert.equal(active().restEndsAt, null)
    assert.match(view.container.querySelector('.ui-restpill').textContent, /^GO/)
  })
})
