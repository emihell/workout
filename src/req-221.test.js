// req-221 (DEC-125 §1, §6) — the clearable SegmentedControl has no "—" segment: nothing picked →
// no segment selected; tapping the selected one clears it. History set edit offers Easy · Medium ·
// Hard, keeping an old Failure visible on that set only. The seed Plank is timed.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { act, importJsx, render } from './test-support/render.js'
import { StoreContext } from './store-context.js'
import { answerConfirm, getPendingConfirm } from './ui/confirm.js'

const h = React.createElement
const DB = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
const CHEST = 'si-sess-upper-1-ex-chest-press'
const PLANK_ITEM = 'si-sess-upper-7-ex-plank'
const { SegmentedControl } = await importJsx('./ui/index.jsx', import.meta.url)
const { HistoryEdit, HistorySet } = await importJsx('./views/history/edit.jsx', import.meta.url)

let view = null
afterEach(async () => {
  if (getPendingConfirm()) answerConfirm(false)
  await view?.unmount()
  view = null
})

// The radios of the effort / feel group (History's set form also has a Warm-up / Work radio group).
const radios = () => view.all('[role="radiogroup"]:not([aria-label="Type"]) [role="radio"]')
const labels = () => radios().map((b) => b.textContent.trim())
const checked = () => radios().filter((b) => b.getAttribute('aria-checked') === 'true').map((b) => b.textContent.trim())
const radio = (label) => radios().find((b) => b.textContent.trim() === label)

// The real store (one StoreProvider per test, as req-212), seeded with db.json under the v8 key —
// the same document the QA seed (scripts/qa.mjs) writes on a fresh origin.
async function harness(payload = DB) {
  const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
  const { useStore } = await import('./store-context.js')
  const { ConfirmSheet } = await importJsx('./ui/index.jsx', import.meta.url)
  localStorage.clear()
  localStorage.setItem('workout-mvp-v8', JSON.stringify({ ...payload, activeWorkout: null }))
  const captured = {}
  function Screen() {
    // oxlint-disable-next-line react/immutability
    captured.store = useStore()
    const [child, setChild] = React.useState(null)
    // oxlint-disable-next-line react/immutability
    captured.setChild = setChild
    return child
  }
  view = await render(h(StoreProvider, null, h(Screen), h(ConfirmSheet)))
  const { WorkoutItemLog } = await importJsx('./views/workout/item.jsx', import.meta.url)
  const { WorkoutItemDone } = await importJsx('./views/workout/review.jsx', import.meta.url)
  // One StoreProvider per test (L-051): screens swap inside it.
  const show = (element) => act(async () => captured.setChild(() => element))
  return {
    captured,
    show,
    start: () => act(async () => captured.store.startWorkout('sess-upper')),
    log: (itemId) => h(WorkoutItemLog, { routineId: 'sess-upper', itemId }),
    review: (itemId) => h(WorkoutItemDone, { routineId: 'sess-upper', itemId }),
    active: () => captured.store.activeWorkout,
  }
}

describe('SegmentedControl — clearable has no extra segment; tap the picked one to clear', () => {
  function Host({ clearable, initial, seen }) {
    const [value, setValue] = React.useState(initial)
    return h(SegmentedControl, {
      clearable,
      options: [{ value: 2, label: 'Easy' }, { value: 3, label: 'Medium' }, { value: 4, label: 'Hard' }],
      value,
      onChange: (v) => {
        seen.push(v)
        setValue(v)
      },
      ariaLabel: 'Effort',
    })
  }
  it('clearable: three segments, none selected; pick → selected; tap it again → onChange("") and none selected', async () => {
    const seen = []
    view = await render(h(Host, { clearable: true, initial: '', seen }))
    assert.deepEqual(labels(), ['Easy', 'Medium', 'Hard'])
    assert.deepEqual(checked(), [])
    await view.click(radio('Medium'))
    assert.deepEqual(checked(), ['Medium'])
    await view.click(radio('Hard'))
    assert.deepEqual(checked(), ['Hard'])
    await view.click(radio('Hard'))
    assert.deepEqual(checked(), [])
    assert.deepEqual(seen, [3, 4, ''])
  })
  it('not clearable: unchanged — tapping the selected one re-fires its own value and it stays selected', async () => {
    const seen = []
    view = await render(h(Host, { clearable: false, initial: 3, seen }))
    assert.deepEqual(labels(), ['Easy', 'Medium', 'Hard'])
    await view.click(radio('Medium'))
    assert.deepEqual(seen, [3])
    assert.deepEqual(checked(), ['Medium'])
  })
})

describe('AC1 / AC2 / AC5 — the exercise review (render, real store)', () => {
  it('no effort → three radios, none checked, no "—"; Medium → rpe 3; Medium again → none, rpe null', async () => {
    const t = await harness()
    await t.start()
    window.location.hash = `#/workout/sess-upper/item/${CHEST}/log`
    await t.show(t.log(CHEST))
    for (let i = 0; i < 4; i++) await view.click(view.button('Done'))
    if (getPendingConfirm()) answerConfirm(false)
    await t.show(t.review(CHEST))
    // AC5 — both halves: the count of checked radios is 0 AND no radio reads "—"
    assert.equal(radios().length, 3)
    assert.deepEqual(labels(), ['Easy', 'Medium', 'Hard'])
    assert.equal(checked().length, 0, 'no radio is aria-checked')
    assert.equal(radios().some((b) => b.textContent.includes('—')), false, 'no "—" radio')
    const work = () => t.active().sets.filter((s) => s.routineItemId === CHEST && s.setType === 'work').map((s) => s.rpe)
    await view.click(radio('Medium'))
    assert.deepEqual(checked(), ['Medium'])
    assert.deepEqual(work(), [3, 3, 3])
    await view.click(radio('Medium'))
    assert.deepEqual(checked(), [])
    assert.deepEqual(work(), [null, null, null])
  })
})

// History's set form: the real HistorySet over a store stand-in that records writes (req-167 pattern).
function historyStore(sets) {
  const items = [{ id: 'pi-a', routineItemId: 'si-a', exerciseId: 'ex-a', exerciseName: 'Chest Press', exerciseType: 'machine', hasDuration: false }]
  const store = {
    exercises: [{ id: 'ex-a', name: 'Chest Press', type: 'machine' }],
    routines: [],
    workouts: [{ id: 'wo-h', routineId: 'r', finishedAt: '2026-09-20T10:00:00Z', overallFeel: '', snapshot: { routineId: 'r', routineName: 'R', items }, sets }],
    writes: [],
    updateWorkout(id, patch) {
      store.writes.push({ id, patch })
    },
  }
  return store
}
const workSet = (rpe) => ({ exerciseId: 'ex-a', routineItemId: 'si-a', setType: 'work', weight: 40, reps: '8', rpe, note: '' })

describe('AC3 — History set edit: Easy · Medium · Hard; an old Failure stays on that set', () => {
  it('rpe 5 → four radios, Failure checked; Save untouched → rpe stays 5', async () => {
    const store = historyStore([workSet(5)])
    view = await render(h(StoreContext.Provider, { value: store }, h(HistorySet, { workoutId: 'wo-h', index: 0 })))
    assert.deepEqual(labels(), ['Easy', 'Medium', 'Hard', 'Failure'])
    assert.deepEqual(checked(), ['Failure'])
    await view.click(view.button('Save'))
    assert.equal(store.writes[0].patch.sets[0].rpe, 5)
  })
  it('rpe 3 → three radios, no Failure, Medium checked', async () => {
    const store = historyStore([workSet(3)])
    view = await render(h(StoreContext.Provider, { value: store }, h(HistorySet, { workoutId: 'wo-h', index: 0 })))
    assert.deepEqual(labels(), ['Easy', 'Medium', 'Hard'])
    assert.deepEqual(checked(), ['Medium'])
  })
  it('rpe 4 → tap Hard again clears; Save writes rpe null', async () => {
    const store = historyStore([workSet(4)])
    view = await render(h(StoreContext.Provider, { value: store }, h(HistorySet, { workoutId: 'wo-h', index: 0 })))
    await view.click(radio('Hard'))
    assert.deepEqual(checked(), [])
    await view.click(view.button('Save'))
    assert.equal(store.writes[0].patch.sets[0].rpe, null)
  })
})

describe('AC4 — History workout Feel', () => {
  it('unset → none checked', async () => {
    const store = historyStore([workSet(3)])
    view = await render(h(StoreContext.Provider, { value: store }, h(HistoryEdit, { workoutId: 'wo-h' })))
    assert.deepEqual(labels(), ['Easy', 'Good', 'Hard', 'Exhausting'])
    assert.deepEqual(checked(), [])
  })
  it('"Good" → tap Good → none checked; Save writes overallFeel ""', async () => {
    const store = historyStore([workSet(3)])
    store.workouts[0].overallFeel = 'Good'
    view = await render(h(StoreContext.Provider, { value: store }, h(HistoryEdit, { workoutId: 'wo-h' })))
    assert.deepEqual(checked(), ['Good'])
    await view.click(radio('Good'))
    assert.deepEqual(checked(), [])
    await view.click(view.button('Save'))
    assert.equal(store.writes[0].patch.overallFeel, '')
  })
})

describe('AC6 — the seed Plank is timed', () => {
  it('db.json ex-plank: hasDuration true, durationSec 60', () => {
    const plank = DB.exercises.find((e) => e.id === 'ex-plank')
    assert.equal(plank.hasDuration, true)
    assert.equal(plank.durationSec, 60)
  })
  it("with the seed, Plank's log screen shows the Duration timer (control: untimed Plank shows none)", async () => {
    const count = async (payload) => {
      const t = await harness(payload)
      await t.start()
      window.location.hash = `#/workout/sess-upper/item/${PLANK_ITEM}/log`
      await t.show(t.log(PLANK_ITEM))
      const n = view.container.querySelectorAll('.ui-timer__count').length
      await view.unmount()
      view = null
      return n
    }
    assert.equal(await count(DB), 1)
    const untimed = structuredClone(DB)
    const p = untimed.exercises.find((e) => e.id === 'ex-plank')
    delete p.hasDuration
    delete p.durationSec
    assert.equal(await count(untimed), 0)
  })
})
