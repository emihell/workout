// req-194 (DEC-108 §4) — a cardio set logs Duration (a stopwatch fills it, editable by hand),
// an optional Level and an optional Distance + unit. Stored as optional fields on the set
// (durationSec, level, distance, distanceUnit), a blank field absent. Old cardio sets keep
// their `reps` text and render as before. The stopwatch's start lives in the set's draft
// (activeWorkout.setDraft.cardio.startedAt), so it survives navigation and a reload.
// Rendered against the real store (happy-dom), as req-186/192.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { importJsx, render, act } from './test-support/render.js'
import { formatSetLine } from './ids.js'
import {
  cardioBits,
  cardioValues,
  clockText,
  lastDistanceUnit,
  readDuration,
  readLevel,
  withCardioValues,
} from './cardio-set.js'
import { formFieldsWithDraft, loggedSetRowText, setDraftFromForm, setDraftFor, setDraftKey } from './workout-log.js'
import { applyBackup, buildBackup } from './exchange.js'
import { migrateState } from './model.js'
import { activeSetPatch, historySetFields, liveSetEditPatch } from './views/set-values.js'
import { withHistorySet } from './views/history/add-set.js'

const h = React.createElement
const DB = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
const ROWING = 'si-sess-upper-0-ex-rowing' // cardio, not timed, target "5-8 min"

let view = null
afterEach(async () => {
  await view?.unmount()
  view = null
})

describe('cardio-set.js — parse and format', () => {
  it('clock text and typed durations', () => {
    assert.equal(clockText(750), '12:30')
    assert.equal(clockText(3), '0:03')
    assert.equal(clockText(3725), '1:02:05')
    assert.deepEqual(readDuration('12:30'), { value: 750 })
    assert.deepEqual(readDuration('1:02:05'), { value: 3725 })
    assert.deepEqual(readDuration('20'), { value: 1200 }, 'a bare number is minutes')
    assert.deepEqual(readDuration('20 min'), { value: 1200 })
    assert.deepEqual(readDuration('20,5'), { value: 1230 })
    assert.deepEqual(readDuration('90 s'), { value: 90 })
    assert.deepEqual(readDuration(''), { empty: true })
    assert.ok(readDuration('abc').error)
    assert.ok(readDuration('5-8 min').error)
    assert.ok(readDuration('12:75').error)
  })

  it('Level "abc" → error; blank optional fields → null; unit only with a distance', () => {
    assert.ok(readLevel('abc').error)
    assert.deepEqual(readLevel('8,5'), { value: 8.5 })
    const bad = cardioValues({ duration: '3:00', level: 'abc', distance: '', distanceUnit: 'm' }, { durationRequired: true })
    assert.match(bad.errors.level, /Can't read 'abc' as a level/)
    assert.equal(bad.values, undefined)
    assert.deepEqual(cardioValues({ duration: '', level: '', distance: '' }, { durationRequired: true }).errors, { duration: 'Enter duration' })
    assert.deepEqual(cardioValues({ duration: '3:00', level: '', distance: '', distanceUnit: 'km' }).values, {
      durationSec: 180,
      level: null,
      distance: null,
      distanceUnit: null,
    })
  })

  it('withCardioValues sets entered fields and removes blank ones', () => {
    const old = { reps: '', durationSec: 60, level: 5, distance: 1, distanceUnit: 'km', note: 'x' }
    const next = withCardioValues(old, { durationSec: 90, level: null, distance: null, distanceUnit: null })
    assert.deepEqual(next, { reps: '', durationSec: 90, note: 'x' })
    assert.equal('level' in next, false)
  })

  it('display: "12:30 · level 8 · 1.5 km"; an old cardio set still reads "20 min"; a timed hold still "30s"', () => {
    const set = { setType: 'work', weight: 0, reps: '', durationSec: 750, level: 8, distance: 1.5, distanceUnit: 'km', rpe: null }
    assert.deepEqual(cardioBits(set), ['12:30', 'level 8', '1.5 km'])
    assert.equal(formatSetLine(set, { cardio: true, cardioFields: true }), '12:30 · level 8 · 1.5 km')
    // Acceptance 4 — an old cardio set: typed reps, no durationSec.
    assert.equal(formatSetLine({ setType: 'work', weight: 0, reps: '20 min', rpe: null }, { cardio: true, cardioFields: true }), '20 min')
    assert.equal(formatSetLine({ setType: 'work', weight: 0, reps: '', durationSec: 30, rpe: null }), '30s')
    assert.equal(loggedSetRowText('1', set, false, true), '1 · 12:30 · level 8 · 1.5 km')
    assert.equal(loggedSetRowText('1', { setType: 'work', weight: 0, reps: '20 min' }, false, true), '1 · 20 min')
  })

  it('the unit starts on the last finished distance unit, else m', () => {
    assert.equal(lastDistanceUnit([{ distance: 2, distanceUnit: 'km' }]), 'km')
    assert.equal(lastDistanceUnit([{ reps: '5-8 min' }]), 'm')
    assert.equal(lastDistanceUnit(undefined), 'm')
  })
})

describe('draft carries the cardio fields and the running stopwatch', () => {
  it('setDraftFromForm / formFieldsWithDraft round-trip `cardio`; absent on other forms', () => {
    const cardio = { duration: '', level: '8', distance: '', distanceUnit: 'm', startedAt: 1_000 }
    const draft = setDraftFromForm('k', { weight: '', reps: '', effort: null, cardio }, '')
    assert.deepEqual(draft.cardio, cardio)
    const seed = { weight: '', reps: '5-8 min', effort: '', note: '' }
    assert.deepEqual(formFieldsWithDraft({ seed, draft, weighted: false }).cardio, cardio)
    assert.equal('cardio' in setDraftFromForm('k', { weight: '40', reps: '8' }, ''), false)
    assert.equal('cardio' in formFieldsWithDraft({ seed, draft: null, weighted: false }), false)
  })

  it('migrateState (the load path) keeps setDraft.cardio on the active workout', () => {
    const state = migrateState(JSON.parse(JSON.stringify({ ...DB, activeWorkout: null })))
    const active = { id: 'w1', routineId: 'sess-upper', snapshot: { routineId: 'sess-upper', routineName: 'Upper Body', items: [] }, sets: [], setDraft: { key: 'k', cardio: { startedAt: 123, duration: '' } } }
    const reloaded = migrateState(JSON.parse(JSON.stringify({ ...state, activeWorkout: active })))
    assert.equal(reloaded.activeWorkout.setDraft.cardio.startedAt, 123)
  })
})

describe('save paths', () => {
  it('Previous → Save (liveSetEditPatch) and active set edit (activeSetPatch): blank → undefined (dropped on save)', () => {
    const values = { durationSec: 600, level: null, distance: 2000, distanceUnit: 'm' }
    const live = liveSetEditPatch({ weight: '', reps: '', effort: null, cardio: values }, { weighted: false, set: { reps: '' } })
    assert.equal(live.durationSec, 600)
    assert.equal(live.distance, 2000)
    assert.equal(JSON.parse(JSON.stringify({ ...{ level: 7 }, ...live })).level, undefined)
    const edit = activeSetPatch({ reps: '', rpe: '', note: '', cardio: values }, { showLoad: false })
    assert.equal(edit.distanceUnit, 'm')
    assert.equal('level' in JSON.parse(JSON.stringify(edit)), false)
  })

  it('History add set writes the cardio fields, without a `cardio` key on the record', () => {
    const fields = historySetFields({ weight: '', reps: '', rpe: '', note: '', setType: 'work', cardio: { durationSec: 420, level: 8, distance: null, distanceUnit: null } })
    assert.equal(fields.cardio.level, 8)
    const workout = { id: 'w', sets: [], snapshot: { items: [{ routineItemId: 'i' }] } }
    const patch = withHistorySet(workout, { exerciseId: 'ex-rowing', itemId: 'i', values: { weight: '', reps: '', rpe: '', note: '', setType: 'work', cardio: fields.cardio } })
    const set = patch.sets[0]
    assert.equal(set.durationSec, 420)
    assert.equal(set.level, 8)
    assert.equal('distance' in set, false)
    assert.equal('cardio' in set, false)
  })
})

describe('Export → Import round-trip (acceptance 5)', () => {
  it('keeps durationSec / level / distance / distanceUnit on a finished set, and an old reps-only set as it was', () => {
    const state = migrateState(JSON.parse(JSON.stringify({ ...DB, activeWorkout: null })))
    const workout = structuredClone(state.workouts.find((w) => w.sets.some((s) => s.exerciseId === 'ex-rowing')))
    const old = workout.sets.find((s) => s.exerciseId === 'ex-rowing')
    const fresh = { ...old, reps: '', note: '', durationSec: 750, level: 8, distance: 1.5, distanceUnit: 'km' }
    workout.sets.push(fresh)
    const withSet = { ...state, workouts: state.workouts.map((w) => (w.id === workout.id ? workout : w)) }
    const file = JSON.parse(JSON.stringify(buildBackup(withSet)))
    const back = applyBackup(file).state.workouts.find((w) => w.id === workout.id)
    const got = back.sets.at(-1)
    assert.deepEqual(
      { durationSec: got.durationSec, level: got.level, distance: got.distance, distanceUnit: got.distanceUnit, reps: got.reps },
      { durationSec: 750, level: 8, distance: 1.5, distanceUnit: 'km', reps: '' },
    )
    const oldBack = back.sets.find((s) => s.exerciseId === 'ex-rowing')
    assert.equal(oldBack.reps, '5-8 min')
    assert.equal('level' in oldBack, false)
    assert.equal('durationSec' in oldBack, false)
  })
})

async function harness({ fresh = true } = {}) {
  const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
  const { useStore } = await import('./store-context.js')
  if (fresh) {
    localStorage.clear()
    localStorage.setItem('workout-mvp-v8', JSON.stringify({ ...DB, activeWorkout: null }))
  }
  const captured = {}
  function Screen({ child }) {
    // oxlint-disable-next-line react/immutability
    captured.store = useStore()
    return child
  }
  const mount = async (child) => {
    await view?.unmount()
    view = await render(h(StoreProvider, null, h(Screen, { child })))
  }
  await mount(null)
  if (fresh) await act(async () => captured.store.startWorkout('sess-upper'))
  const { WorkoutItemLog } = await importJsx('./views/workout/item.jsx', import.meta.url)
  const item = (itemId) => h(WorkoutItemLog, { routineId: 'sess-upper', itemId })
  return { captured, mount, item, active: () => captured.store.activeWorkout }
}

function rowingItem(active) {
  return active.snapshot.items.find((i) => i.routineItemId === ROWING)
}

describe('the log screen (real store)', () => {
  it('Start → Stop fills Duration ≈ elapsed → Level 8 → Done stores durationSec + level, no distance keys (acceptance 1, 3)', async () => {
    const t = await harness()
    await t.mount(t.item(ROWING))
    const realNow = Date.now
    let clock = realNow()
    Date.now = () => clock
    try {
      await view.click(view.button('Start'))
      clock += 3_000
      await view.click(view.button('Stop'))
    } finally {
      Date.now = realNow
    }
    assert.equal(view.input('Duration').value, '0:03')
    assert.ok(view.button('Resume'), 'Start resumes once a time is in the box')
    await view.type(view.input('Level'), '8')
    await view.click(view.button('Done'))
    const set = t.active().sets[0]
    assert.equal(set.durationSec, 3)
    assert.equal(set.level, 8)
    assert.equal(set.reps, '')
    assert.equal(set.rpe, null)
    assert.equal('distance' in set, false)
    assert.equal('distanceUnit' in set, false)
    assert.equal(t.active().setDraft, undefined, 'the draft is cleared once logged')
  })

  it('failure case: Level "abc" → inline error, nothing stored', async () => {
    const t = await harness()
    await t.mount(t.item(ROWING))
    await view.type(view.input('Duration'), '7:00')
    await view.type(view.input('Level'), 'abc')
    await view.click(view.button('Done'))
    assert.equal((t.active().sets || []).length, 0)
    assert.match(view.container.querySelector('.ui-field-error').textContent, /as a level/)
  })

  it('the running stopwatch survives leaving the screen and a reload, from the same start (acceptance 2)', async () => {
    const t = await harness()
    await t.mount(t.item(ROWING))
    await view.click(view.button('Start'))
    const key = setDraftKey(rowingItem(t.active()), 'work', 0)
    const startedAt = setDraftFor(t.active(), key)?.cardio?.startedAt
    assert.equal(typeof startedAt, 'number', 'Start writes the start to the draft at once (no debounce)')
    // Leave the screen and come back.
    await t.mount(null)
    await t.mount(t.item(ROWING))
    assert.ok(view.button('Stop'), 'still running after navigation')
    // Reload: a fresh store from what saveState wrote (workout-mvp-v9 → loadState → migrateState).
    const stored = JSON.parse(localStorage.getItem('workout-mvp-v9'))
    assert.equal(stored.activeWorkout.setDraft.cardio.startedAt, startedAt)
    await view.unmount()
    view = null
    const r = await harness({ fresh: false })
    await r.mount(r.item(ROWING))
    assert.equal(setDraftFor(r.active(), key).cardio.startedAt, startedAt, 'same start after reload')
    assert.ok(view.button('Stop'), 'still running after reload')
    const realNow = Date.now
    Date.now = () => startedAt + 65_000
    try {
      await view.click(view.button('Stop'))
    } finally {
      Date.now = realNow
    }
    assert.equal(view.input('Duration').value, '1:05', 'elapsed counted from the original start')
  })

  it('Done while running logs the elapsed time; Distance + km', async () => {
    const t = await harness()
    await t.mount(t.item(ROWING))
    const realNow = Date.now
    let clock = realNow()
    Date.now = () => clock
    try {
      await view.click(view.button('Start'))
      clock += 125_000
      await view.type(view.input('Distance'), '1,5')
      await view.click(view.all('[role="radio"]').find((b) => b.textContent === 'km'))
      await view.click(view.button('Done'))
    } finally {
      Date.now = realNow
    }
    const set = t.active().sets[0]
    assert.deepEqual(
      { durationSec: set.durationSec, distance: set.distance, distanceUnit: set.distanceUnit, level: set.level },
      { durationSec: 125, distance: 1.5, distanceUnit: 'km', level: undefined },
    )
  })
})
