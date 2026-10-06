// req-194 (DEC-108 §4) — a cardio set logs Duration (a stopwatch fills it, editable by hand),
// an optional Level and an optional Distance + unit. Stored as optional fields on the set
// (durationSec, level, distance, distanceUnit), a blank field absent. Old cardio sets keep
// their `reps` text and render as before. The running stopwatch is its own activeWorkout
// field (review fix 1: `stopwatch: { draftKey, startedAt, baseSec }`), so it survives
// navigation, another exercise's draft and a reload.
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
  durationTargetText,
  stopwatchSeconds,
  targetDurationSec,
  lastDistanceUnit,
  readDuration,
  readLevel,
  withCardioValues,
} from './cardio-set.js'
import {
  finishedState,
  formFieldsWithDraft,
  loggedSetRowText,
  setDraftFromForm,
  setDraftKey,
  startStopwatchPatch,
  stopwatchFor,
  stopwatchOwner,
  withLoggedSet,
} from './workout-log.js'
import { historyPrescription } from './history-queries.js'
import { pickerItem } from './routine-picker.js'
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

describe('draft carries the cardio fields', () => {
  it('setDraftFromForm / formFieldsWithDraft round-trip `cardio`; absent on other forms', () => {
    const cardio = { duration: '0:40', level: '8', distance: '', distanceUnit: 'm', watched: true }
    const draft = setDraftFromForm('k', { weight: '', reps: '', effort: null, cardio }, '')
    assert.deepEqual(draft.cardio, cardio)
    const seed = { weight: '', reps: '5-8 min', effort: '', note: '' }
    assert.deepEqual(formFieldsWithDraft({ seed, draft, weighted: false }).cardio, cardio)
    assert.equal('cardio' in setDraftFromForm('k', { weight: '40', reps: '8' }, ''), false)
    assert.equal('cardio' in formFieldsWithDraft({ seed, draft: null, weighted: false }), false)
  })

  it('migrateState (the load path) keeps activeWorkout.stopwatch and setDraft.cardio', () => {
    const state = migrateState(JSON.parse(JSON.stringify({ ...DB, activeWorkout: null })))
    const active = {
      id: 'w1',
      routineId: 'sess-upper',
      snapshot: { routineId: 'sess-upper', routineName: 'Upper Body', items: [] },
      sets: [],
      setDraft: { key: 'k', cardio: { duration: '1:00', watched: true } },
      stopwatch: { draftKey: 'k', startedAt: 123, baseSec: 60 },
    }
    const reloaded = migrateState(JSON.parse(JSON.stringify({ ...state, activeWorkout: active })))
    assert.deepEqual(reloaded.activeWorkout.stopwatch, { draftKey: 'k', startedAt: 123, baseSec: 60 })
    assert.equal(reloaded.activeWorkout.setDraft.cardio.duration, '1:00')
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

const CHEST = 'si-sess-upper-1-ex-chest-press' // machine
const STAIRS = 'si-test-stairs' // a second cardio item, added to Upper Body by harness({ extraStairs })

describe('review fixes — pure', () => {
  it('fix 2: a cardio time becomes the history target ("13 min" / "12:30"), through pickerItem', () => {
    const workout = (durationSec, reps = '') => ({
      id: 'w',
      finishedAt: '2026-10-01T10:00:00Z',
      snapshot: { items: [{ routineItemId: 'i', exerciseId: 'ex-rowing', exerciseType: 'cardio', restSec: 0, notes: '' }] },
      sets: [{ exerciseId: 'ex-rowing', routineItemId: 'i', setType: 'work', weight: 0, reps, rpe: null, durationSec }],
    })
    const rowing = { id: 'ex-rowing', type: 'cardio' }
    assert.equal(durationTargetText(780), '13 min')
    assert.equal(durationTargetText(750), '12:30')
    let pick = pickerItem([workout(750)], rowing)
    assert.deepEqual(pick.item.targets, ['12:30'])
    assert.equal(pick.label, 'Last time: 1 × 12:30')
    pick = pickerItem([workout(780)], rowing)
    assert.equal(pick.label, 'Last time: 1 × 13 min')
    // An old typed "5-8 min" is unchanged; a timed (non-cardio) set's seconds never become a target.
    assert.deepEqual(historyPrescription([workout(undefined, '5-8 min')], 'ex-rowing').targets, ['5-8 min'])
    const timed = workout(30)
    timed.snapshot.items[0].exerciseType = 'bodyweight'
    assert.deepEqual(historyPrescription([timed], 'ex-rowing').targets, [''])
  })

  it('fix 3: a single-time target prefills; a range or blank does not', () => {
    assert.equal(targetDurationSec('20 min'), 1200)
    assert.equal(targetDurationSec('12:30'), 750)
    assert.equal(targetDurationSec('5-8 min'), null)
    assert.equal(targetDurationSec(''), null)
    assert.equal(targetDurationSec('0'), null)
  })

  it('fix 4: a zero duration is refused', () => {
    assert.equal(cardioValues({ duration: '0' }).errors.duration, 'Duration must be more than 0.')
    assert.equal(cardioValues({ duration: '0:00' }, { durationRequired: true }).errors.duration, 'Duration must be more than 0.')
  })

  it('fix 5: formatSetLine reads a cardio set with a time as cardio even without cardioFields', () => {
    const set = { setType: 'work', weight: 0, reps: '', durationSec: 750, rpe: null }
    assert.equal(formatSetLine(set, { cardio: true }), '12:30')
    assert.equal(formatSetLine({ setType: 'work', weight: 0, reps: '20 min', rpe: null }, { cardio: true }), '20 min')
    assert.equal(formatSetLine({ setType: 'work', weight: 0, reps: '', durationSec: 30, rpe: null }), '30s')
  })

  it('fix 1: Done / Skip set on its set, and Finish, clear the stopwatch; another set keeps it', () => {
    const base = { id: 'w', sets: [], snapshot: { items: [] }, stopwatch: { draftKey: 'a|work|0', startedAt: 1, baseSec: 0 } }
    assert.equal('stopwatch' in withLoggedSet(base, { reps: '' }, {}, 'a|work|0'), false)
    assert.ok(withLoggedSet(base, { reps: '' }, {}, 'b|work|0').stopwatch, 'logging another set keeps it')
    const done = finishedState({ workouts: [], activeWorkout: base }, {}, '2026-10-06T10:00:00Z')
    assert.equal(done.activeWorkout, null)
    assert.equal('stopwatch' in done.workouts[0], false)
    assert.equal(stopwatchSeconds({ startedAt: 1_000, baseSec: 40 }, 6_000), 45)
  })
})

async function harness({ fresh = true, targets = null, extraStairs = false } = {}) {
  const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
  const { useStore } = await import('./store-context.js')
  if (fresh) {
    localStorage.clear()
    const db = structuredClone(DB)
    const upper = db.routines.find((r) => r.id === 'sess-upper')
    if (targets) upper.exercises.find((i) => i.id === ROWING).targets = targets
    if (extraStairs) {
      upper.exercises.push({ id: STAIRS, exerciseId: 'ex-stairs', role: 'main', restSec: 0, notes: '', warmup: null, sets: 1, targets: ['5-8 min'], suggestedWeights: [] })
    }
    localStorage.setItem('workout-mvp-v8', JSON.stringify({ ...db, activeWorkout: null }))
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

function rowingKey(active) {
  return setDraftKey(active.snapshot.items.find((i) => i.routineItemId === ROWING), 'work', 0)
}

async function withClock(start, fn) {
  const realNow = Date.now
  const clock = { t: start }
  Date.now = () => clock.t
  try {
    await fn(clock)
  } finally {
    Date.now = realNow
  }
}

describe('the log screen (real store)', () => {
  it('Start → Stop fills Duration ≈ elapsed → Level 8 → Done stores durationSec + level, no distance keys (acceptance 1, 3)', async () => {
    const t = await harness()
    await t.mount(t.item(ROWING))
    await withClock(Date.now(), async (clock) => {
      await view.click(view.button('Start'))
      clock.t += 3_000
      await view.click(view.button('Stop'))
    })
    assert.equal(view.input('Duration').value, '0:03')
    assert.equal(t.active().stopwatch, null, 'Stop clears the stopwatch')
    assert.ok(view.button('Resume'), 'after a Stop, Start resumes from the stopwatch time')
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

  it('failure cases: Level "abc" → inline error, nothing stored; Start + Stop at 0 s → "more than 0"', async () => {
    const t = await harness()
    await t.mount(t.item(ROWING))
    await view.type(view.input('Duration'), '7:00')
    await view.type(view.input('Level'), 'abc')
    await view.click(view.button('Done'))
    assert.equal((t.active().sets || []).length, 0)
    assert.match(view.container.querySelector('.ui-field-error').textContent, /as a level/)
    await view.type(view.input('Level'), '')
    await withClock(Date.now(), async () => {
      await view.click(view.button('Start'))
      await view.click(view.button('Stop'))
    })
    assert.equal(view.input('Duration').value, '0:00')
    await view.click(view.button('Done'))
    assert.equal((t.active().sets || []).length, 0)
    assert.match(view.container.querySelector('.ui-field-error').textContent, /more than 0/)
  })

  it('the running stopwatch survives leaving the screen and a reload, from the same start (acceptance 2)', async () => {
    const t = await harness()
    await t.mount(t.item(ROWING))
    await view.click(view.button('Start'))
    const key = rowingKey(t.active())
    const startedAt = stopwatchFor(t.active(), key)?.startedAt
    assert.equal(typeof startedAt, 'number', 'Start writes activeWorkout.stopwatch')
    await t.mount(null)
    await t.mount(t.item(ROWING))
    assert.ok(view.button('Stop'), 'still running after navigation')
    // Reload: a fresh store from what saveState wrote (workout-mvp-v9 → loadState → migrateState).
    const stored = JSON.parse(localStorage.getItem('workout-mvp-v9'))
    assert.equal(stored.activeWorkout.stopwatch.startedAt, startedAt)
    await view.unmount()
    view = null
    const r = await harness({ fresh: false })
    await r.mount(r.item(ROWING))
    assert.equal(stopwatchFor(r.active(), key).startedAt, startedAt, 'same start after reload')
    assert.ok(view.button('Stop'), 'still running after reload')
    await withClock(startedAt + 65_000, async () => view.click(view.button('Stop')))
    assert.equal(view.input('Duration').value, '1:05', 'elapsed counted from the original start')
  })

  it('fix 1: typing on another exercise (its own setDraft) does not drop the stopwatch; one stopwatch at a time', async () => {
    const t = await harness()
    await t.mount(t.item(ROWING))
    await view.click(view.button('Start'))
    const watch = t.active().stopwatch
    // Another exercise: its typing replaces the single setDraft (flushed on leaving).
    await t.mount(t.item(CHEST))
    await view.type(view.input('kg'), '42')
    await t.mount(null)
    assert.equal(t.active().setDraft.key.startsWith(CHEST), true, 'the draft is now Chest Press')
    assert.deepEqual(t.active().stopwatch, watch, 'the stopwatch is untouched')
    await t.mount(t.item(ROWING))
    assert.ok(view.button('Stop'), 'Rowing still running')
    // A second stopwatch is refused while Rowing's is live.
    const other = { ...t.active(), snapshot: { ...t.active().snapshot } }
    const lower = other.snapshot.items.find((i) => i.routineItemId !== ROWING)
    assert.equal(stopwatchOwner(other).routineItemId, ROWING)
    assert.equal(startStopwatchPatch(other, setDraftKey(lower, 'work', 0), 0, 5), null)
    // Once Rowing's set is logged its stopwatch is gone and another may start.
    await withClock(watch.startedAt + 5_000, async () => view.click(view.button('Done')))
    assert.equal(t.active().sets.at(-1).durationSec, 5)
    // re-review: Done on the last set also marks the item done (markItemDonePatch → null).
    assert.equal(t.active().stopwatch ?? null, null, 'Done clears it')
    assert.ok(startStopwatchPatch(t.active(), setDraftKey(lower, 'work', 0), 0, 5))
  })

  it('fix 1: a second cardio exercise shows Start disabled and names the one running (refused, not taken over)', async () => {
    const t = await harness({ extraStairs: true })
    await t.mount(t.item(ROWING))
    await view.click(view.button('Start'))
    const watch = t.active().stopwatch
    await t.mount(t.item(STAIRS))
    const start = view.button('Start')
    assert.equal(start.disabled, true)
    assert.match(view.text(), /The stopwatch is running on Rowing — stop it there first\./)
    await view.click(start)
    assert.deepEqual(t.active().stopwatch, watch, "still Rowing's")
    // Rowing skipped from the list (its set no longer current) → stale: Stairs may take over.
    await act(async () => t.captured.store.skipItem(ROWING))
    await t.mount(t.item(STAIRS))
    assert.equal(view.button('Start').disabled, false)
    await view.click(view.button('Start'))
    assert.ok(t.active().stopwatch.draftKey.startsWith(STAIRS))
  })

  it('re-review: Start → ⋯ Skip exercise → Add set → no running stopwatch (reviewer scenario)', async () => {
    const t = await harness()
    await t.mount(t.item(ROWING))
    await view.click(view.button('Start'))
    const key = rowingKey(t.active())
    assert.ok(stopwatchFor(t.active(), key))
    await act(async () => t.captured.store.skipItem(ROWING))
    assert.equal(t.active().stopwatch, null, 'Skip exercise (markItemDonePatch) clears it')
    // "Add set" on the done exercise (WorkoutItemDone, the screen Skip leads to): reopen and add
    // a working set in one tap, then the log screen.
    await t.mount(null)
    const { reopenItemPatch } = await import('./workout-log.js')
    const item = t.active().snapshot.items.find((i) => i.routineItemId === ROWING)
    await act(async () => {
      t.captured.store.patchActive(reopenItemPatch(t.active(), item))
      t.captured.store.addWorkingSet(ROWING)
    })
    await t.mount(t.item(ROWING))
    assert.equal(view.button('Stop'), null, 'nothing shows as running')
    assert.ok(view.button('Start'), 'the new set starts with a stopped stopwatch')
    // Even a stopwatch left behind (pre-fix data) for a set whose item is done never shows:
    const done = { ...t.active(), completedItemIds: [ROWING], stopwatch: { draftKey: key, startedAt: 1, baseSec: 0 } }
    assert.equal(stopwatchFor(done, key), null)
  })

  it('re-review: Swap (replaceItem) clears the stopwatch', async () => {
    const t = await harness()
    await t.mount(t.item(ROWING))
    await view.click(view.button('Start'))
    await act(async () => t.captured.store.replaceItem(ROWING, 'ex-stairs'))
    assert.equal(t.active().stopwatch, null)
  })

  it('re-review: an imported backup never resumes a stopwatch', () => {
    const state = migrateState(JSON.parse(JSON.stringify({ ...DB, activeWorkout: null })))
    const active = {
      id: 'w1',
      routineId: 'sess-upper',
      snapshot: { routineId: 'sess-upper', routineName: 'Upper Body', items: [] },
      sets: [],
      stopwatch: { draftKey: 'k', startedAt: 123, baseSec: 0 },
    }
    const file = JSON.parse(JSON.stringify(buildBackup({ ...state, activeWorkout: active })))
    assert.equal(file.state.activeWorkout.stopwatch.startedAt, 123, 'exported as stored')
    const back = applyBackup(file).state.activeWorkout
    assert.equal(back.id, 'w1', 'the active workout itself is restored')
    assert.equal('stopwatch' in back, false)
  })

  it('fix 1: Skip set clears the stopwatch', async () => {
    const t = await harness()
    await t.mount(t.item(ROWING))
    await view.click(view.button('Start'))
    assert.ok(t.active().stopwatch)
    await view.click(view.button('Skip set'))
    assert.equal(t.active().stopwatch ?? null, null)
  })

  it('fix 3: a single-time target ("20 min") prefills Duration as 20:00; Start still runs from 0:00', async () => {
    const t = await harness({ targets: ['20 min'] })
    await t.mount(t.item(ROWING))
    assert.equal(view.input('Duration').value, '20:00')
    assert.doesNotMatch(view.text(), /Target 20 min/)
    assert.ok(view.button('Start'), 'a prefilled time is not a stopwatch time: Start, not Resume')
    await withClock(Date.now(), async (clock) => {
      await view.click(view.button('Start'))
      clock.t += 4_000
      await view.click(view.button('Stop'))
    })
    assert.equal(view.input('Duration').value, '0:04')
  })

  it('fix 3: a range target ("5-8 min") leaves Duration blank and required', async () => {
    const t = await harness()
    await t.mount(t.item(ROWING))
    assert.equal(view.input('Duration').value, '')
    assert.match(view.text(), /Target 5-8 min/)
    await view.click(view.button('Done'))
    assert.equal((t.active().sets || []).length, 0)
    assert.match(view.text(), /Enter duration/)
  })

  it('Done while running logs the elapsed time; Distance + km', async () => {
    const t = await harness()
    await t.mount(t.item(ROWING))
    await withClock(Date.now(), async (clock) => {
      await view.click(view.button('Start'))
      clock.t += 125_000
      await view.type(view.input('Distance'), '1,5')
      await view.click(view.all('[role="radio"]').find((b) => b.textContent === 'km'))
      await view.click(view.button('Done'))
    })
    const set = t.active().sets[0]
    assert.deepEqual(
      { durationSec: set.durationSec, distance: set.distance, distanceUnit: set.distanceUnit, level: set.level },
      { durationSec: 125, distance: 1.5, distanceUnit: 'km', level: undefined },
    )
    assert.equal(t.active().stopwatch ?? null, null)
  })
})
