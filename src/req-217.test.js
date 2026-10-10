// req-217 (DEC-119 §6) — a unilateral library entry's reps read "12 each side" (log screen set
// list + reps label, the edit sheet, the review); during this exercise's rest the routine note +
// up to 3 form cues show under the set list. Read from the library at display time
// (libraryEntryFor) — never the exercise's name, never a stored field.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { act, importJsx, render } from './test-support/render.js'
import { libraryEntryFor, loadExerciseLibrary } from './exerciseLibrary.js'
import { REST_CUES_MAX, isEachSide, restNotesFor, restNotesShowing } from './library-hints.js'
import { eachSideReps, loggedSetRowText, setPreviewText } from './workout-log.js'

const h = React.createElement
const DB = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
const library = await loadExerciseLibrary()
const ROW = 'si-sess-push-pull-2-ex-one-arm-db-row' // One-Arm DB Row: warm-up + 12 / 10 / 12, note, rest 90
const PRESS = 'si-sess-push-pull-3-ex-overhead-db-press' // Overhead DB Press (two-arm): 10 / 8 / 5
const ROW_CUES = ['Back flat and level', 'Pull the dumbbell to the hip', 'Shoulders stay square']

describe('req-217 — "each side" comes from libraryEntryFor(...).unilateral (criterion 4)', () => {
  it('the stored One-Arm DB Row (no libraryId) resolves by alias to a unilateral entry; a two-arm press does not', () => {
    const row = DB.exercises.find((x) => x.id === 'ex-one-arm-db-row')
    const press = DB.exercises.find((x) => x.id === 'ex-overhead-db-press')
    assert.equal(row.libraryId, undefined)
    assert.equal(libraryEntryFor(row, library).id, 'One-Arm_Dumbbell_Row')
    assert.equal(isEachSide(row, library), true)
    assert.equal(isEachSide(press, library), false)
  })

  it('right mechanism: the entry decides, not the name', () => {
    // A name with no one-arm word, but a libraryId on a unilateral entry → each side.
    assert.equal(isEachSide({ name: 'Arm thing', libraryId: 'Concentration_Curls' }, library), true)
    // "One-Arm" in the name, but the entry it resolves to is not marked unilateral → not each side.
    const flye = { name: 'One-Arm Flat Bench Dumbbell Flye' }
    assert.equal(libraryEntryFor(flye, library).id, 'One-Arm_Flat_Bench_Dumbbell_Flye')
    assert.equal(isEachSide(flye, library), false)
    // Same stored exercise, two libraries differing only in the entry's flag → the flag decides.
    const entry = library.find((e) => e.id === 'One-Arm_Dumbbell_Row')
    const ex = { name: 'One-Arm DB Row' }
    assert.equal(isEachSide(ex, [{ ...entry, unilateral: true }]), true)
    assert.equal(isEachSide(ex, [{ ...entry, unilateral: false }]), false)
    // Agrees with libraryEntryFor(...).unilateral for every stored exercise in the seed data.
    for (const x of DB.exercises) assert.equal(isEachSide(x, library), libraryEntryFor(x, library)?.unilateral === true, x.name)
  })

  it('failure case: no library link (no libraryId, no name match) or no library loaded → not each side', () => {
    assert.equal(libraryEntryFor({ name: 'One-Arm Mystery Lever' }, library), null)
    assert.equal(isEachSide({ name: 'One-Arm Mystery Lever' }, library), false)
    assert.equal(isEachSide({ name: 'One-Arm DB Row' }, null), false)
  })
})

describe('req-217 — the text', () => {
  it('reps read "{n} each side"; seconds, blank and skipped are unchanged; stored reps untouched', () => {
    assert.equal(eachSideReps('12'), '12 each side')
    assert.equal(eachSideReps('12', false), '12')
    assert.equal(eachSideReps(''), '')
    assert.equal(setPreviewText({ label: '1', weight: '14', reps: '12' }, true, true), '1 · 14 kg × 12 each side')
    assert.equal(setPreviewText({ label: '1', weight: '14', reps: '12' }, true), '1 · 14 kg × 12')
    assert.equal(setPreviewText({ label: '1', weight: '', reps: '' }, true, true), '1 · — × —')
    assert.equal(setPreviewText({ label: '1', durationSec: 30 }, false, true), '1 · 30s')
    const set = { setType: 'work', weight: 14, reps: '12' }
    assert.equal(loggedSetRowText('1', set, true, false, true), '1 · 14 kg × 12 each side')
    assert.equal(set.reps, '12')
    assert.equal(loggedSetRowText('1', { weight: 0, reps: 'skipped', note: 'skipped' }, true, false, true), '1 · skipped')
  })
})

describe('req-217 — rest notes (pure)', () => {
  const item = { id: ROW, notes: 'Pull to ribs, squeeze scapula' }
  const row = { name: 'One-Arm DB Row' }

  it('the note, then the entry\'s form cues, at most 3', () => {
    assert.deepEqual(restNotesFor(item, row, library), { note: 'Pull to ribs, squeeze scapula', cues: ROW_CUES })
    const entry = library.find((e) => e.id === 'One-Arm_Dumbbell_Row')
    const five = [{ ...entry, formCues: ['a', 'b', 'c', 'd', 'e'] }]
    assert.equal(REST_CUES_MAX, 3)
    assert.deepEqual(restNotesFor(item, row, five).cues, ['a', 'b', 'c'])
  })

  it('failure case: no entry → the note only; no note and no entry → null', () => {
    const manual = { name: 'Mystery Lever' }
    assert.deepEqual(restNotesFor(item, manual, library), { note: 'Pull to ribs, squeeze scapula', cues: [] })
    assert.equal(restNotesFor({ id: 'x', notes: '' }, manual, library), null)
    assert.equal(restNotesFor({ id: 'x', notes: '  ' }, manual, null), null)
    assert.deepEqual(restNotesFor({ id: 'x', notes: '' }, row, library), { note: '', cues: ROW_CUES })
  })

  it('shows only while THIS exercise\'s rest runs', () => {
    const now = 1_000_000
    const sets = [{ routineItemId: 'other' }, { routineItemId: ROW }]
    assert.equal(restNotesShowing({ restEndsAt: now + 5000, sets }, item, now), true)
    assert.equal(restNotesShowing({ restEndsAt: null, sets }, item, now), false, 'skipped / no rest')
    assert.equal(restNotesShowing({ restEndsAt: now - 1, sets }, item, now), false, 'rest over')
    assert.equal(restNotesShowing({ restEndsAt: now + 5000, sets: [...sets, { routineItemId: 'other' }] }, item, now), false, 'another exercise\'s rest')
    assert.equal(restNotesShowing({ restEndsAt: now + 5000, sets: [] }, item, now), false)
  })
})

// ---- Rendered against the real store ----
let view = null
afterEach(async () => {
  await view?.unmount()
  view = null
})

const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

async function harness(payload = DB) {
  const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
  const { useStore } = await import('./store-context.js')
  const { WorkoutItemLog, WorkoutItemDone } = await importJsx('./views/workout/item.jsx', import.meta.url)
  localStorage.clear()
  localStorage.setItem('workout-mvp-v8', JSON.stringify({ ...payload, activeWorkout: null }))
  const captured = {}
  function Host() {
    const [child, setChild] = React.useState(null)
    // oxlint-disable-next-line react/immutability
    captured.setChild = setChild
    return h(StoreProvider, null, h(Screen, { child }))
  }
  function Screen({ child }) {
    // oxlint-disable-next-line react/immutability
    captured.store = useStore()
    return child
  }
  view = await render(h(Host))
  await act(async () => captured.store.startWorkout('sess-push-pull'))
  const show = async (child) => {
    await act(async () => captured.setChild(child))
    await settle() // the library chunk's promise → the hook's state
  }
  return {
    captured,
    log: (itemId) => show(h(WorkoutItemLog, { routineId: 'sess-push-pull', itemId })),
    review: (itemId) => show(h(WorkoutItemDone, { routineId: 'sess-push-pull', itemId })),
    active: () => captured.store.activeWorkout,
  }
}

const rows = () => view.all('.ui-setpreview__row').map((node) => node.textContent.replace('✓', '').replace('Done: ', ''))
const repsLabels = () => view.all('label').map((node) => node.textContent.trim()).filter((text) => text.startsWith('Reps'))

describe('req-217 — the log screen, edit sheet and review (criteria 1–3)', () => {
  it('criterion 1: One-Arm DB Row → "12 each side" on the set list and the reps label; a two-arm press → "12"', async () => {
    const t = await harness()
    await t.log(ROW)
    // The kg is whatever the seed's routine / history gives (not under test); the reps carry "each side".
    assert.deepEqual(rows().map((text) => text.replace(/ · .* × /, ' · × ')), ['Warm-up · × 12 each side', '1 · × 12 each side', '2 · × 10 each side', '3 · × 12 each side'])
    assert.deepEqual(repsLabels(), ['Reps each side'])
    assert.equal(view.input('Reps each side').value, '12', 'the stored / prefilled number is unchanged')
    await t.log(PRESS)
    assert.equal(view.text().includes('each side'), false)
    assert.deepEqual(rows().slice(1).map((text) => text.replace(/ · .* × /, ' · × ')), ['1 · × 10', '2 · × 8', '3 · × 5'])
    assert.deepEqual(repsLabels(), ['Reps'])
  })

  it('logged reps stay "12" in storage; the done row, the edit sheet label and the review read "each side"', async () => {
    const t = await harness()
    await t.log(ROW)
    await view.click(view.button('Done')) // warm-up
    await view.click(view.button('Done')) // set 1
    assert.deepEqual(t.active().sets.map((s) => s.reps), ['12', '12'])
    assert.equal(rows()[1], '1 · 14 kg × 12 each side')
    await view.click(view.all('.ui-setpreview__tap')[1])
    assert.ok(view.all('label').some((node) => node.textContent.trim().startsWith('Reps each side')), 'the edit sheet label')
    await t.review(ROW)
    assert.deepEqual(rows(), ['Warm-up · 6 kg × 12 each side', '1 · 14 kg × 12 each side'])
    // The review keeps the routine note (req-212), outside any rest block.
    assert.match(view.text(), /Pull to ribs, squeeze scapula/)
    assert.equal(view.container.querySelector('.ui-restnotes'), null)
  })

  it('criterion 2: a Done arms rest → note + 3 cues under the set list; skip rest → gone; next set, no rest → no block', async () => {
    const t = await harness()
    await t.log(ROW)
    assert.equal(view.container.querySelector('.ui-restnotes'), null, 'no rest yet → no block')
    assert.doesNotMatch(view.text(), /Pull to ribs/, 'the note is not under the title')
    await view.click(view.button('Done'))
    assert.ok(t.active().restEndsAt > Date.now(), 'rest armed (90 s)')
    const block = view.container.querySelector('.ui-restnotes')
    assert.ok(block, 'the rest block')
    assert.equal(block.querySelector('.ui-restnotes__note').textContent, 'Pull to ribs, squeeze scapula')
    assert.deepEqual([...block.querySelectorAll('li')].map((li) => li.textContent), ROW_CUES)
    const list = view.container.querySelector('.ui-setpreview')
    assert.ok(list.compareDocumentPosition(block) & 4, 'under the set list')
    await view.click(view.container.querySelector('.ui-restpill')) // the pill skips the rest here
    assert.equal(t.active().restEndsAt, null)
    assert.equal(view.container.querySelector('.ui-restnotes'), null, 'skip rest → gone')
    // Another exercise's rest does not show this one's block.
    await view.click(view.button('Done'))
    assert.ok(view.container.querySelector('.ui-restnotes'))
    await t.log(PRESS)
    assert.equal(view.container.querySelector('.ui-restnotes'), null, 'the row\'s rest is not the press\'s')
  })

  it('criterion 3: a manual exercise (no libraryId, no name match) → no "each side"; rest shows the note only, or nothing', async () => {
    const payload = structuredClone(DB)
    const original = payload.exercises.find((x) => x.id === 'ex-one-arm-db-row')
    payload.exercises.push({ ...original, id: 'ex-mystery', name: 'One-Arm Mystery Lever' })
    const routine = payload.routines.find((r) => r.id === 'sess-push-pull')
    const rowItem = routine.exercises.find((i) => i.id === ROW)
    rowItem.exerciseId = 'ex-mystery'
    const pressItem = routine.exercises.find((i) => i.id === PRESS)
    pressItem.exerciseId = 'ex-mystery'
    pressItem.notes = ''
    const t = await harness(payload)
    await t.log(ROW)
    assert.equal(view.text().includes('each side'), false)
    assert.deepEqual(repsLabels(), ['Reps'])
    await view.click(view.button('Done'))
    const block = view.container.querySelector('.ui-restnotes')
    assert.equal(block.querySelector('.ui-restnotes__note').textContent, 'Pull to ribs, squeeze scapula')
    assert.equal(block.querySelectorAll('li').length, 0, 'no cues without a library entry')
    // No note and no entry → nothing during rest.
    await t.log(PRESS)
    await view.click(view.button('Done'))
    assert.ok(t.active().restEndsAt > Date.now())
    assert.equal(view.container.querySelector('.ui-restnotes'), null)
  })
})
