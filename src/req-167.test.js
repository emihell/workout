// req-167 — req-163's reviewer leftovers (timestamp ordering, the History type toggle) and
// req-164's review test gaps. Items 1–4 fail on main; item 5 pins existing behaviour (its
// teeth are shown by a planted mutation, reports/req-167.md).
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { importJsx, render, act } from './test-support/render.js'
import { StoreContext } from './store-context.js'
import { migrateState } from './model.js'
import { finishedNewestFirst, lastSetsForExercise, previousSameRoutineWorkouts } from './history-queries.js'
import { sortWorkoutsByDate, workoutDateKey } from './views/history/helpers.js'
import { workoutTime } from './history-queries.js'
import { dateKey } from './schedule.js'
import { recalculatedState } from './model.js'
import { startedWorkoutState } from './state-reducers.js'

const { HistorySet } = await importJsx('./views/history/edit.jsx', import.meta.url)
const h = React.createElement
const DB = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))

let view
afterEach(async () => {
  await view?.unmount()
  view = null
})

const wo = (id, extra = {}) => ({ id, routineId: 'r', snapshot: { routineId: 'r', routineName: 'R', items: [] }, sets: [], ...extra })
const active = wo('live', { startedAt: '2026-09-27T10:00:00Z' })

describe('1 — one comparator by parsed time: mixed offsets agree', () => {
  const A = wo('a-0930Z', { finishedAt: '2026-09-25T09:30:00Z' }) // 09:30 UTC — the NEWER
  const B = wo('b-1100+02', { finishedAt: '2026-09-25T11:00:00+02:00' }) // 09:00 UTC
  it('finishedNewestFirst puts 09:30Z before 11:00+02:00 (= 09:00Z), as a Date compare does', () => {
    for (const order of [[A, B], [B, A]]) assert.deepEqual(finishedNewestFirst(order).map((w) => w.id), ['a-0930Z', 'b-1100+02'])
  })
  it("History's sortWorkoutsByDate agrees with it (same day → the shared comparator)", () => {
    assert.deepEqual(sortWorkoutsByDate([B, A]).map((w) => w.id), finishedNewestFirst([B, A]).map((w) => w.id))
  })
  it('an unreadable finishedAt sorts last in History; it is not "last time" for the priors', () => {
    const bad = wo('bad', { finishedAt: 'not a date' })
    assert.deepEqual(sortWorkoutsByDate([bad, A]).map((w) => w.id), ['a-0930Z', 'bad'])
    assert.deepEqual(finishedNewestFirst([bad, A]).map((w) => w.id), ['a-0930Z'])
  })
})

describe('2 — a workout without finishedAt: placed by performedOn / date, never dropped or invented', () => {
  it('migrateState keeps it without finishedAt (never invents one) and keeps its date/performedOn', () => {
    const m = migrateState({ schemaVersion: 8, exercises: [], routines: [{ id: 'r', name: 'R', exercises: [] }], workouts: [{ id: 'd', routineId: 'r', date: '2025-01-02', sets: [] }, { id: 'p', routineId: 'r', performedOn: '2025-01-03', sets: [] }] }, { legacy: true })
    assert.deepEqual(m.workouts.map((w) => [w.id, 'finishedAt' in w, w.date, w.performedOn]), [['d', false, '2025-01-02', undefined], ['p', false, undefined, '2025-01-03']])
  })
  it("Finish's priors include it, in its place by date (was: dropped)", () => {
    const older = wo('older', { finishedAt: '2026-09-20T18:00:00Z' })
    const dated = wo('dated', { performedOn: '2026-09-22' })
    const newer = wo('newer', { finishedAt: '2026-09-24T18:00:00Z' })
    assert.deepEqual(previousSameRoutineWorkouts(active, [older, dated, newer], []).map((w) => w.id), ['newer', 'dated', 'older'])
  })
  it('and the prefill reads it as "last time" when it is the newest with the exercise', () => {
    const set = { exerciseId: 'ex', routineItemId: 'i', setType: 'work', weight: 40, reps: '8' }
    const last = lastSetsForExercise([wo('old', { finishedAt: '2026-09-01T10:00:00Z', sets: [{ ...set, weight: 30 }] }), wo('legacy', { date: '2026-09-10', sets: [set] })], 'ex')
    assert.equal(last.workout.id, 'legacy')
  })
  it('a date-only workout gets the SAME day in History as in the priors (review should-fix)', () => {
    const legacy = wo('legacy', { date: '2026-09-22' })
    assert.equal(workoutDateKey(legacy), '2026-09-22', 'was "unknown" — filed at the bottom of History')
    assert.equal(dateKey(new Date(workoutTime(legacy))), workoutDateKey(legacy))
    const a = wo('a', { finishedAt: '2026-09-24T18:00:00Z' })
    const b = wo('b', { finishedAt: '2026-09-20T18:00:00Z' })
    const order = sortWorkoutsByDate([b, legacy, a]).map((w) => w.id)
    assert.deepEqual(order, ['a', 'legacy', 'b'])
    assert.deepEqual(previousSameRoutineWorkouts(active, [b, legacy, a], []).map((w) => w.id), order)
  })
  it('a workout with no readable time at all is still not history', () => {
    assert.deepEqual(finishedNewestFirst([wo('none')]), [])
  })
})

// ---- History's set form (items 3, 4): the real HistorySet, a store stand-in that records writes.
function historyStore(exercise, sets) {
  const items = [{ id: 'pi-a', routineItemId: 'si-a', exerciseId: 'ex-a', exerciseName: exercise.name, exerciseType: exercise.type, hasDuration: Boolean(exercise.hasDuration) }]
  const store = {
    exercises: [exercise],
    routines: [],
    workouts: [{ id: 'wo-h', routineId: 'r', finishedAt: '2026-09-20T10:00:00Z', snapshot: { routineId: 'r', routineName: 'R', items }, sets }],
    writes: [],
    updateWorkout(id, patch) {
      store.writes.push({ id, patch })
    },
  }
  return store
}
const mount = (store) => render(h(StoreContext.Provider, { value: store }, h(HistorySet, { workoutId: 'wo-h', index: 0 })))
const typeButton = (v, label) => v.all('button').find((b) => b.textContent.trim() === label)
const PLANK = { id: 'ex-a', name: 'Plank', type: 'bodyweight', hasDuration: true }
const PRESS = { id: 'ex-a', name: 'Chest Press', type: 'machine' }

describe('3 — History toggle Work → WU clears the duration', () => {
  it('a timed work set toggled to WU saves durationSec null (was: kept, so the WU row read "46s")', async () => {
    const store = historyStore(PLANK, [{ exerciseId: 'ex-a', routineItemId: 'si-a', setType: 'work', weight: '', reps: '', durationSec: 46, rpe: null, note: '' }])
    view = await mount(store)
    await view.click(typeButton(view, 'Warm-up set'))
    await view.click(view.button('Save'))
    assert.equal(store.writes[0].patch.sets[0].setType, 'wu')
    assert.equal(store.writes[0].patch.sets[0].durationSec, null)
  })
  it('a timed work set left as Work keeps its duration; a set with no duration gains no key', async () => {
    const store = historyStore(PLANK, [{ exerciseId: 'ex-a', routineItemId: 'si-a', setType: 'work', weight: '', reps: '', durationSec: 46, rpe: null, note: '' }])
    view = await mount(store)
    await view.click(view.button('Save'))
    assert.equal(store.writes[0].patch.sets[0].durationSec, 46)
    await view.unmount()
    const plain = historyStore(PRESS, [{ exerciseId: 'ex-a', routineItemId: 'si-a', setType: 'work', weight: 40, reps: '8', rpe: 3, note: '' }])
    view = await mount(plain)
    await view.click(typeButton(view, 'Warm-up set'))
    await view.click(view.button('Save'))
    assert.equal('durationSec' in plain.writes[0].patch.sets[0], false)
  })
})

describe("4 — History toggle WU → Work doesn't revive a legacy rpe", () => {
  it('an old WU set with rpe 3, toggled to Work: Effort starts unset and Save writes rpe null (was: "Moderate", 3)', async () => {
    const store = historyStore(PRESS, [{ exerciseId: 'ex-a', routineItemId: 'si-a', setType: 'wu', weight: 10, reps: '12', rpe: 3, note: '' }])
    view = await mount(store)
    await view.click(typeButton(view, 'Work'))
    // The clearable control shows "—" pressed when unset; no effort LABEL may be pressed.
    const pressed = view.all('[aria-label="Effort"] button').filter((b) => b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-checked') === 'true')
    assert.deepEqual(pressed.map((b) => b.textContent.trim()).filter((t) => t !== '—'), [], 'no effort pre-selected')
    await view.click(view.button('Save'))
    assert.equal(store.writes[0].patch.sets[0].rpe, null)
  })
  it('a work set keeps its own effort (control)', async () => {
    const store = historyStore(PRESS, [{ exerciseId: 'ex-a', routineItemId: 'si-a', setType: 'work', weight: 40, reps: '8', rpe: 4, note: '' }])
    view = await mount(store)
    await view.click(view.button('Save'))
    assert.equal(store.writes[0].patch.sets[0].rpe, 4)
  })
})

describe('5a — startedWorkoutState, scheduled start (req-164 review gap)', () => {
  const base = () => migrateState(structuredClone(DB), { legacy: true })
  const NOW = new Date(2026, 8, 21, 10, 0)
  it('a supplied plan with a slot: scheduledFor = the plan date, the slot and occurrence carried', () => {
    const plan = { routineId: 'sess-upper', date: '2026-09-24', scheduleSlotId: 'slot-sess-upper', occurrenceId: 'slot-sess-upper@2026-09-24', routineName: 'Upper Body', items: [] }
    const a = startedWorkoutState(base(), { routineId: 'sess-upper', suppliedPlan: plan, id: 'wo-s', now: NOW }).activeWorkout
    assert.deepEqual([a.scheduledFor, a.scheduleSlotId, a.occurrenceId, a.performedOn], ['2026-09-24', 'slot-sess-upper', 'slot-sess-upper@2026-09-24', '2026-09-21'])
  })
  it('scheduledFor + scheduleSlotId without a plan: built for that date and slot', () => {
    const a = startedWorkoutState(base(), { routineId: 'sess-upper', scheduledFor: '2026-09-28', scheduleSlotId: 'slot-sess-upper', id: 'wo-t', now: NOW }).activeWorkout
    assert.deepEqual([a.scheduledFor, a.scheduleSlotId, a.performedOn], ['2026-09-28', 'slot-sess-upper', '2026-09-21'])
    assert.match(a.occurrenceId, /2026-09-28/)
  })
  it('an unscheduled start (no slot): scheduledFor null', () => {
    const a = startedWorkoutState(base(), { routineId: 'sess-upper', id: 'wo-u', now: NOW }).activeWorkout
    assert.deepEqual([a.scheduledFor, a.scheduleSlotId], [null, null])
  })
})

describe('5b — every store action through the REAL store: store → reducer argument order (req-164 review gap)', () => {
  it('each action once, in sequence, produces the state its arguments name', async () => {
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { useStore } = await import('./store-context.js')
    localStorage.clear()
    localStorage.setItem('workout-mvp-v8', JSON.stringify({ ...DB, activeWorkout: null }))
    const captured = {}
    function Probe() {
      // oxlint-disable-next-line react/immutability
      captured.store = useStore()
      return null
    }
    view = await render(h(StoreProvider, null, h(Probe)))
    const s = () => captured.store
    // After EVERY action the saved doc is exactly the store's state (saveState ran in the
    // same update) — not only at the end.
    const saved = () => JSON.parse(localStorage.getItem('workout-mvp-v9'))
    const run = async (fn) => {
      let out
      await act(async () => {
        out = fn(s())
      })
      assert.deepEqual(saved(), JSON.parse(JSON.stringify(s())), 'persisted after the action')
      return out
    }
    const routine = (id) => s().routines.find((r) => r.id === id)
    const exIds = (id) => routine(id).exercises.map((e) => e.exerciseId)

    // routines
    const rid = await run((st) => st.addRoutine({ name: ' New ', focus: 'Free' }))
    assert.deepEqual([routine(rid).name, routine(rid).focus], ['New', 'Free'])
    await run((st) => st.updateRoutine(rid, { name: 'Renamed' }))
    assert.equal(routine(rid).name, 'Renamed')
    await run((st) => st.addRoutineExercise(rid, { id: 'si-1', exerciseId: 'ex-chest-press', targets: ['8', '8'] }))
    await run((st) => st.addRoutineExercise(rid, { id: 'si-2', exerciseId: 'ex-lat-pulldown' }))
    await run((st) => st.updateRoutineExercise(rid, 1, { restSec: 75 })) // (routineId, index, patch)
    assert.deepEqual(routine(rid).exercises.map((e) => e.restSec), [0, 75])
    await run((st) => st.moveRoutineExercise(rid, 1, -1)) // (routineId, index, dir)
    assert.deepEqual(exIds(rid), ['ex-lat-pulldown', 'ex-chest-press'])
    await run((st) => st.removeRoutineExercise(rid, 0)) // (routineId, index)
    assert.deepEqual(exIds(rid), ['ex-chest-press'])
    // schedule
    await run((st) => st.setLoopWeeks(2))
    assert.equal(s().schedule.loopWeeks, 2)
    const slotId = await run((st) => st.addSlot({ week: 1, weekday: 3, routineId: rid }))
    assert.deepEqual(s().schedule.slots.find((x) => x.id === slotId), { id: slotId, week: 1, weekday: 3, routineId: rid })
    await run((st) => st.removeSlot(slotId))
    assert.equal(s().schedule.slots.some((x) => x.id === slotId), false)
    // exercises
    const exId = await run((st) => st.addExercise({ name: 'Probe Press', equipment: 'Machine', type: 'machine' }))
    await run((st) => st.updateExercise(exId, { name: 'Probe Press 2' })) // (exerciseId, patch)
    assert.equal(s().exercises.find((e) => e.id === exId).name, 'Probe Press 2')
    await run((st) => st.removeExercise(exId))
    assert.equal(s().exercises.some((e) => e.id === exId), false, 'no history → hard-deleted')
    // workout: start, then the active-set actions
    await run((st) => st.startWorkout('sess-upper', '2026-09-28', 'slot-sess-upper')) // (routineId, scheduledFor, scheduleSlotId)
    assert.deepEqual([s().activeWorkout.routineId, s().activeWorkout.scheduledFor, s().activeWorkout.scheduleSlotId], ['sess-upper', '2026-09-28', 'slot-sess-upper'])
    const item = s().activeWorkout.snapshot.items[1]
    const set = (w) => ({ exerciseId: item.exerciseId, routineItemId: item.routineItemId, setType: 'work', weight: w, reps: '8', rpe: 3, note: '' })
    await run((st) => st.completeSet(set(30), { restEndsAt: 123 }, { draftKey: null })) // (setRecord, activePatch, { draftKey })
    await run((st) => st.completeSet(set(35)))
    assert.deepEqual([s().activeWorkout.sets.map((x) => x.weight), s().activeWorkout.restEndsAt], [[30, 35], 123])
    await run((st) => st.updateActiveSet(1, { weight: 36 })) // (index, patch)
    assert.deepEqual(s().activeWorkout.sets.map((x) => x.weight), [30, 36])
    await run((st) => st.removeActiveSet(0)) // (index)
    assert.deepEqual([s().activeWorkout.sets.map((x) => x.weight), s().activeWorkout.restEndsAt], [[36], null])
    await run((st) => st.patchActive({ overallNote: 'probe' }))
    assert.equal(s().activeWorkout.overallNote, 'probe')
    await run((st) => st.addWorkingSet(item.routineItemId))
    assert.equal(s().activeWorkout.snapshot.items[1].addedSets, 1)
    const other = s().activeWorkout.snapshot.items[2]
    await run((st) => st.skipItem(other.routineItemId))
    assert.ok(s().activeWorkout.completedItemIds.includes(other.routineItemId))
    const third = s().activeWorkout.snapshot.items[3]
    const newKey = await run((st) => st.replaceItem(third.routineItemId, 'ex-chest-press')) // (itemId, exerciseId)
    const rep = s().activeWorkout.snapshot.items.find((i) => (i.routineItemId || i.id) === newKey)
    assert.deepEqual([rep.exerciseId, rep.addedMidWorkout], ['ex-chest-press', true])
    await run((st) => st.abandonWorkout())
    assert.equal(s().activeWorkout, null)
    // finish, then history edits
    await run((st) => st.startWorkout('sess-upper'))
    await run((st) => st.completeSet(set(40)))
    const liveId = s().activeWorkout.id
    await run((st) => st.finishWorkout({ overallFeel: 'Good' }))
    const done = s().workouts.find((w) => w.id === liveId)
    assert.deepEqual([done.overallFeel, s().activeWorkout], ['Good', null])
    await run((st) => st.updateWorkout(liveId, { overallNote: 'edited' })) // (workoutId, patch)
    assert.equal(s().workouts.find((w) => w.id === liveId).overallNote, 'edited')
    // recalc writes THIS workout's recommendation onto its routine (DEC-056): the result is
    // exactly the pure recalculatedState of the state before, and it changed the routine.
    const beforeRecalc = JSON.parse(JSON.stringify(s()))
    await run((st) => st.recalculateFuturePlans(liveId))
    const expected = recalculatedState(beforeRecalc, liveId).routines
    assert.deepEqual(JSON.parse(JSON.stringify(s().routines)), JSON.parse(JSON.stringify(expected)))
    assert.notDeepEqual(beforeRecalc.routines.find((r) => r.id === 'sess-upper'), routine('sess-upper'), 'the recalc changed the routine')
    await run((st) => st.removeWorkout(liveId))
    assert.equal(s().workouts.some((w) => w.id === liveId), false)
    // archive + restore, routine removal, legacy drafts
    await run((st) => st.removeExercise('ex-chest-press'))
    assert.ok(s().exercises.find((e) => e.id === 'ex-chest-press').archivedAt, 'history → archived')
    await run((st) => st.restoreExercise('ex-chest-press'))
    assert.equal(s().exercises.find((e) => e.id === 'ex-chest-press').archivedAt, null)
    await run((st) => st.removeRoutine(rid))
    assert.equal(routine(rid), undefined)
    // legacy drafts only arrive in old stored data — put there by an import (applyBackup):
    await run((st) => st.applyBackup({ kind: 'workout-mvp-backup', version: 1, state: { ...JSON.parse(JSON.stringify(s())), draftWorkouts: [{ ...done, id: 'draft-1', finishedAt: null }, { ...done, id: 'draft-2', finishedAt: null }] } }))
    await run((st) => st.abandonDraft('draft-2'))
    assert.deepEqual(s().draftWorkouts.map((d) => d.id), ['draft-1'])
    await run((st) => st.continueDraft('draft-1'))
    assert.deepEqual([s().activeWorkout.id, s().draftWorkouts], ['draft-1', []])
    // and every change reached storage through saveState
    assert.equal(JSON.parse(localStorage.getItem('workout-mvp-v9')).activeWorkout.id, 'draft-1')
  })
})
