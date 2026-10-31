// req-240 (DEC-137) — "each side" for timed sets ("30s each side", "Duration each side (s)", the
// hold version of the one-side line), and an own "One side at a time" setting on an exercise:
// `exercise.unilateral` (true / false) wins when present, absent → the library entry (DEC-063 §3).
// Written only by the user's Details Save; untouched → the field stays absent.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { act, importJsx, render } from './test-support/render.js'
import {
  ONE_SIDE_LINE,
  ONE_SIDE_LINE_TIMED,
  durationLabel,
  isEachSide,
  libraryEachSide,
  oneSideLine,
  unilateralPatch,
} from './library-hints.js'
import { setPreviewText, loggedSetRowText } from './set-display.js'
import { migrateState } from './model.js'
import { applyBackup, buildBackup } from './exchange.js'
import { commonExercises } from './library/common.js'

const h = React.createElement
const DB = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))

// A tiny library: one unilateral entry (Side_Bridge, as common.js marks it) and one that isn't.
const LIB = [
  { id: 'Side_Bridge', name: 'Side Plank', unilateral: true },
  { id: 'Plank', name: 'Plank' },
]
const plank = (extra = {}) => ({ id: 'ex-sp', name: 'Side Plank', type: 'bodyweight', libraryId: 'Side_Bridge', hasDuration: true, durationSec: 30, ...extra })
const own = (extra = {}) => ({ id: 'ex-own', name: 'Kettlebell Lunge Press', type: 'free', ...extra })

describe('req-240 — isEachSide: own value wins, absent follows the library (pure)', () => {
  it('Side_Bridge is marked unilateral in the shipped library (the fact the spec measured)', () => {
    const entry = commonExercises().find((e) => e.id === 'Side_Bridge')
    assert.ok(entry, 'Side_Bridge present')
    assert.equal(entry.unilateral, true)
  })
  it('absent → the library (true for Side Plank, false for an own exercise)', () => {
    assert.equal(isEachSide(plank(), LIB), true)
    assert.equal(isEachSide(own(), LIB), false)
    assert.equal(libraryEachSide(plank(), LIB), true)
  })
  it('right mechanism: an own value beats the library both ways', () => {
    assert.equal(isEachSide(plank({ unilateral: false }), LIB), false)
    assert.equal(isEachSide(own({ unilateral: true }), LIB), true)
  })
  it('only a boolean counts: null / a string leave it to the library', () => {
    assert.equal(isEachSide(plank({ unilateral: null }), LIB), true)
    assert.equal(isEachSide(own({ unilateral: 'true' }), LIB), false)
  })
  it('cardio is never each side: an own true, or a library-unilateral entry, still reads false', () => {
    assert.equal(isEachSide(own({ type: 'cardio', unilateral: true }), LIB), false)
    assert.equal(isEachSide(plank({ type: 'cardio' }), LIB), false)
  })
})

describe('req-240 — what the Details Save writes (unilateralPatch, pure)', () => {
  it('untouched (null) → nothing, whatever the resolved value', () => {
    assert.deepEqual(unilateralPatch(own(), LIB, null), {})
    assert.deepEqual(unilateralPatch(plank(), LIB, null), {})
  })
  it('ticked on an own exercise → unilateral: true; unticking a library-unilateral one → false', () => {
    assert.deepEqual(unilateralPatch(own(), LIB, true), { unilateral: true })
    assert.deepEqual(unilateralPatch(plank(), LIB, false), { unilateral: false })
  })
  it('a choice equal to the library, with no own value yet → nothing (still follows the library)', () => {
    assert.deepEqual(unilateralPatch(plank(), LIB, true), {})
    assert.deepEqual(unilateralPatch(own(), LIB, false), {})
  })
  it('once the field exists, Save keeps it current', () => {
    assert.deepEqual(unilateralPatch(own({ unilateral: true }), LIB, false), { unilateral: false })
    assert.deepEqual(unilateralPatch(plank({ unilateral: false }), LIB, true), { unilateral: true })
  })
})

describe('req-240 — timed text (pure)', () => {
  it('seconds read "30s each side" on preview and logged rows; reps unchanged from req-217', () => {
    assert.equal(setPreviewText({ label: '1', durationSec: 30 }, false, true), '1 · 30s each side')
    assert.equal(setPreviewText({ label: '1', durationSec: 30 }, false), '1 · 30s')
    assert.equal(loggedSetRowText('1', { setType: 'work', weight: 0, reps: '', durationSec: 30 }, false, false, true), '1 · 30s each side')
    assert.equal(setPreviewText({ label: '1', weight: '14', reps: '8' }, true, true), '1 · 14 kg × 8 each side')
  })
  it('the head line and the form label', () => {
    assert.equal(oneSideLine(plank()), ONE_SIDE_LINE_TIMED)
    assert.equal(ONE_SIDE_LINE_TIMED, 'One side at a time — the full time on one side, then the other.')
    assert.equal(oneSideLine(own()), ONE_SIDE_LINE)
    assert.equal(durationLabel(true), 'Duration each side (s)')
    assert.equal(durationLabel(false), 'Duration (s)')
  })
})

describe('req-240 — the field survives load and Export → Import (criterion 4)', () => {
  const state = () => {
    const s = structuredClone(DB)
    s.exercises.find((x) => x.id === 'ex-overhead-db-press').unilateral = true
    s.exercises.find((x) => x.id === 'ex-one-arm-db-row').unilateral = false
    return s
  }
  const pick = (s, id) => s.exercises.find((x) => x.id === id)
  it('migrateState keeps true and false; an exercise without it stays without it', () => {
    const out = migrateState(state())
    assert.equal(pick(out, 'ex-overhead-db-press').unilateral, true)
    assert.equal(pick(out, 'ex-one-arm-db-row').unilateral, false)
    assert.equal('unilateral' in pick(out, 'ex-leg-curl'), false)
  })
  it('buildBackup → applyBackup round-trip keeps it', () => {
    const migrated = migrateState(state())
    const back = applyBackup(JSON.parse(JSON.stringify(buildBackup(migrated)))).state
    assert.equal(pick(back, 'ex-overhead-db-press').unilateral, true)
    assert.equal(pick(back, 'ex-one-arm-db-row').unilateral, false)
    assert.equal('unilateral' in pick(back, 'ex-leg-curl'), false)
  })
  it('an imported cardio record carrying unilateral: true keeps the field but is not each side', () => {
    const s = structuredClone(DB)
    const cardio = s.exercises.find((x) => x.type === 'cardio')
    cardio.unilateral = true
    const back = applyBackup(JSON.parse(JSON.stringify(buildBackup(migrateState(s))))).state
    const got = pick(back, cardio.id)
    assert.equal(got.unilateral, true, 'import keeps the stored value')
    assert.equal(isEachSide(got, LIB), false)
    assert.equal(setPreviewText({ label: '1', durationSec: 600 }, false, isEachSide(got, LIB)), '1 · 600s')
  })
})

// ---- Rendered against the real store (one StoreProvider, screens swapped inside — L-051) ----
let view = null
afterEach(async () => {
  await view?.unmount()
  view = null
})
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

const ROW = 'si-sess-push-pull-2-ex-one-arm-db-row' // One-Arm DB Row: library-unilateral
const PRESS = 'si-sess-push-pull-3-ex-overhead-db-press' // made own / Side Plank below

async function harness(payload) {
  const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
  const { useStore } = await import('./store-context.js')
  const { WorkoutItemLog } = await importJsx('./views/workout/item.jsx', import.meta.url)
  const { WorkoutItemDone } = await importJsx('./views/workout/review.jsx', import.meta.url)
  const { ExerciseEdit } = await importJsx('./views/Exercises.jsx', import.meta.url)
  const { DEVICE_FILL_KEY } = await import('./routine-kg-fill.js')
  localStorage.clear()
  localStorage.setItem(DEVICE_FILL_KEY, '2026-09-26T00:00:00.000Z')
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
  const show = async (child) => {
    await act(async () => captured.setChild(child))
    await settle()
  }
  return {
    captured,
    stored: () => JSON.parse(localStorage.getItem('workout-mvp-v9')),
    start: () => act(async () => captured.store.startWorkout('sess-push-pull')),
    edit: (exerciseId) => show(h(ExerciseEdit, { exerciseId })),
    log: (itemId) => show(h(WorkoutItemLog, { routineId: 'sess-push-pull', itemId })),
    review: (itemId) => show(h(WorkoutItemDone, { routineId: 'sess-push-pull', itemId })),
  }
}

const sideBox = () => view.all('label').find((l) => l.textContent.trim() === 'One side at a time')?.querySelector('input')
const doneWarmup = async () => {
  if (view.text().includes('Warm-up set')) await view.click(view.button('Done'))
  const pill = view.container.querySelector('.ui-restpill')
  if (pill) await view.click(pill)
}
// The Details Type <select>: render's type() fires `input`, a select's onChange needs `change`.
const selectType = async (value) => {
  const select = view.all('label').find((l) => l.textContent.trim().startsWith('Type'))?.querySelector('select')
  assert.ok(select, 'the Type select')
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(select, value)
    select.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
}
// A library load is async; wait until the box reflects it (or give up after a few ticks).
const waitFor = async (check) => {
  for (let i = 0; i < 50 && !check(); i++) await settle()
}

describe('req-240 — Side Plank, library unilateral, timed (criterion 1)', () => {
  const sidePlank = () => {
    const payload = structuredClone(DB)
    const ex = payload.exercises.find((x) => x.id === 'ex-overhead-db-press')
    Object.assign(ex, { name: 'Side Plank', libraryId: 'Side_Bridge', type: 'bodyweight', hasDuration: true, durationSec: 30, equipment: 'Bodyweight' })
    const item = payload.routines.find((r) => r.id === 'sess-push-pull').exercises.find((i) => i.id === PRESS)
    item.warmup = null
    item.suggestedWeights = []
    return payload
  }
  it('set list "30s each side", form label "Duration each side (s)", the hold line; the review reads the same', async () => {
    const t = await harness(sidePlank())
    await t.start()
    await t.log(PRESS)
    await waitFor(() => view.text().includes(ONE_SIDE_LINE_TIMED))
    assert.ok(view.text().includes(ONE_SIDE_LINE_TIMED), 'the timed head line')
    assert.equal(view.text().includes(ONE_SIDE_LINE), false, 'not the reps line')
    assert.ok(view.input('Duration each side (s)'), 'the form label')
    assert.equal(view.input('Duration (s)'), null)
    assert.match(view.text(), /1 · 30s each side/)
    await view.click(view.button('Done'))
    const work = t.captured.store.activeWorkout.sets.filter((s) => s.setType === 'work')
    assert.equal(Number(work[0].durationSec), 30, 'stored seconds untouched')
    await t.review(PRESS)
    await waitFor(() => view.text().includes(ONE_SIDE_LINE_TIMED))
    assert.ok(view.text().includes(ONE_SIDE_LINE_TIMED), 'review head line')
    assert.match(view.text(), /1 · 30s each side/)
  })
})

describe('req-240 — the own "One side at a time" box (criteria 2–3)', () => {
  const ownPress = () => {
    const payload = structuredClone(DB)
    const ex = payload.exercises.find((x) => x.id === 'ex-overhead-db-press')
    ex.name = 'Kettlebell Lunge Press'
    delete ex.libraryId
    return payload
  }
  it('own exercise: tick + Save → stored unilateral: true; the log screen and review read "8 each side"', async () => {
    const t = await harness(ownPress())
    await t.edit('ex-overhead-db-press')
    await waitFor(() => Boolean(sideBox()))
    assert.equal(sideBox().checked, false, 'starts from the resolved value (no library entry → off)')
    await view.click(sideBox())
    assert.equal(sideBox().checked, true)
    await view.click(view.button('Save'))
    await settle()
    assert.equal(t.stored().exercises.find((x) => x.id === 'ex-overhead-db-press').unilateral, true)
    await t.start()
    await t.log(PRESS)
    await doneWarmup()
    assert.ok(view.text().includes(ONE_SIDE_LINE))
    assert.match(view.text(), /× 8 each side/)
    assert.ok(view.input('Reps each side'))
    await view.click(view.button('Done'))
    await t.review(PRESS)
    assert.ok(view.text().includes(ONE_SIDE_LINE))
    assert.match(view.text(), /each side/)
  })

  it('failure / right mechanism: library-unilateral One-Arm DB Row with unilateral: false stored → no "each side" anywhere', async () => {
    const payload = structuredClone(DB)
    payload.exercises.find((x) => x.id === 'ex-one-arm-db-row').unilateral = false
    const t = await harness(payload)
    await t.edit('ex-one-arm-db-row')
    await waitFor(() => Boolean(sideBox()))
    assert.equal(sideBox().checked, false, 'the own false shows, not the library true')
    await t.start()
    await t.log(ROW)
    await settle()
    await doneWarmup()
    assert.equal(/each side/i.test(view.text()), false)
    assert.equal(view.text().includes(ONE_SIDE_LINE), false)
    assert.ok(view.input('Reps'))
    await view.click(view.button('Done'))
    await t.review(ROW)
    await settle()
    assert.equal(/each side/i.test(view.text()), false)
    assert.equal(view.text().includes(ONE_SIDE_LINE), false)
  })

  it('an untouched Save writes no field: the box shows the library value, the record stays without `unilateral`', async () => {
    const t = await harness(structuredClone(DB))
    await t.edit('ex-one-arm-db-row')
    await waitFor(() => sideBox()?.checked === true)
    assert.equal(sideBox().checked, true, 'starts from the library (unilateral)')
    await view.click(view.button('Save'))
    await settle()
    assert.equal('unilateral' in t.stored().exercises.find((x) => x.id === 'ex-one-arm-db-row'), false)
  })

  it('failure: tick + Save, then Type → Cardio + Save → the stored true stays, but nothing reads "each side"', async () => {
    const t = await harness(ownPress())
    await t.edit('ex-overhead-db-press')
    await waitFor(() => Boolean(sideBox()))
    await view.click(sideBox())
    await view.click(view.button('Save'))
    await settle()
    assert.equal(t.stored().exercises.find((x) => x.id === 'ex-overhead-db-press').unilateral, true)
    await t.edit('ex-overhead-db-press')
    await waitFor(() => Boolean(sideBox()))
    await selectType('cardio')
    assert.equal(sideBox(), undefined, 'cardio hides the box')
    await view.click(view.button('Save'))
    await settle()
    const saved = t.stored().exercises.find((x) => x.id === 'ex-overhead-db-press')
    assert.equal(saved.type, 'cardio')
    assert.equal(saved.unilateral, true, 'the patch is skipped for cardio, so the field stays')
    assert.equal(isEachSide(saved, LIB), false)
    await t.start()
    await t.log(PRESS)
    await settle()
    await doneWarmup()
    assert.equal(/each side/i.test(view.text()), false)
    assert.equal(view.text().includes(ONE_SIDE_LINE), false)
  })

  it('failure: stored cardio + unilateral: true, Type → Free in the form → the box shows ticked; an untouched Save keeps it', async () => {
    const payload = ownPress()
    Object.assign(payload.exercises.find((x) => x.id === 'ex-overhead-db-press'), { type: 'cardio', unilateral: true })
    const t = await harness(payload)
    await t.edit('ex-overhead-db-press')
    await settle()
    assert.equal(sideBox(), undefined, 'cardio: no box')
    await selectType('free')
    await waitFor(() => Boolean(sideBox()))
    assert.equal(sideBox().checked, true, 'the form type decides: the stored true shows')
    await view.click(view.button('Save'))
    await settle()
    const saved = t.stored().exercises.find((x) => x.id === 'ex-overhead-db-press')
    assert.equal(saved.type, 'free')
    assert.equal(saved.unilateral, true)
    await t.edit('ex-overhead-db-press')
    await waitFor(() => Boolean(sideBox()))
    assert.equal(sideBox().checked, true, 'reopened: the same as what the form showed before Save')
  })

  it('cardio shows no box', async () => {
    const payload = structuredClone(DB)
    const cardio = payload.exercises.find((x) => x.type === 'cardio')
    assert.ok(cardio, 'fixture has a cardio exercise')
    await harness(payload).then((t) => t.edit(cardio.id))
    await settle()
    assert.equal(sideBox(), undefined)
  })
})
