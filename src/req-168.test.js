// req-168 — backlog sweep. Item 1 (legacy drafts are references) fails on main; item 2
// pins existing behaviour with render tests (its teeth: planted mutations, reports/req-168.md).
// Items 4–6 did not reproduce on main (req-129 fixed them) and were dropped (L-042).
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { importJsx, render, act } from './test-support/render.js'
import { StoreContext } from './store-context.js'
import { migrateState } from './model.js'
import {
  exerciseDeletionImpact,
  exerciseInActiveWorkout,
  removeExerciseFromState,
  removeRoutineFromState,
  deletionConfirmHead,
  routineDeletionImpact,
} from './state-reducers.js'

const h = React.createElement
const DB = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
let view
afterEach(async () => {
  await view?.unmount()
  view = null
})

describe('1 — a legacy draft workout is a reference: delete archives, never hard-deletes (DESIGN §3)', () => {
  const ex = (id) => ({ id, name: id, type: 'machine' })
  const state = () =>
    migrateState({
      schemaVersion: 9,
      exercises: [ex('ex-a'), ex('ex-only-draft'), ex('ex-draft-item-only'), ex('ex-unused')],
      routines: [
        { id: 'r1', name: 'R1', exercises: [{ id: 'i1', exerciseId: 'ex-a', sets: 1, targets: ['8'] }] },
        { id: 'r-only-draft', name: 'Old', exercises: [] },
        { id: 'r-unused', name: 'Unused', exercises: [] },
      ],
      schedule: { loopWeeks: 1, slots: [] },
      workouts: [],
      draftWorkouts: [
        {
          id: 'd1',
          routineId: 'r-only-draft',
          startedAt: '2025-01-01T10:00:00Z',
          snapshot: { routineId: 'r-only-draft', routineName: 'Old', items: [{ routineItemId: 'x', exerciseId: 'ex-only-draft' }, { routineItemId: 'y', exerciseId: 'ex-draft-item-only' }] },
          sets: [{ exerciseId: 'ex-only-draft', routineItemId: 'x', setType: 'work', weight: 20, reps: '8' }],
        },
      ],
      activeWorkout: null,
    })
  const AT = '2026-09-25T00:00:00.000Z'

  it('an exercise whose only reference is a draft (a logged set) → archived: archivedAt set, not removed (was: hard-deleted)', () => {
    const s = state()
    assert.equal(exerciseDeletionImpact(s, 'ex-only-draft').hasHistory, true)
    const kept = removeExerciseFromState(s, 'ex-only-draft', AT).exercises.find((e) => e.id === 'ex-only-draft')
    assert.equal(kept?.archivedAt, AT)
  })
  it("…or only a draft's snapshot item → archived too", () => {
    const kept = removeExerciseFromState(state(), 'ex-draft-item-only', AT).exercises.find((e) => e.id === 'ex-draft-item-only')
    assert.equal(kept?.archivedAt, AT)
  })
  it('a routine whose only reference is a draft → archived (was: hard-deleted)', () => {
    const s = state()
    assert.equal(routineDeletionImpact(s, 'r-only-draft').hasHistory, true)
    const kept = removeRoutineFromState(s, 'r-only-draft', AT).routines.find((r) => r.id === 'r-only-draft')
    assert.equal(kept?.archivedAt, AT)
  })
  it('the confirm names it the same way the delete treats it (both read hasHistory)', () => {
    const s = state()
    assert.match(deletionConfirmHead('Old', { hasHistory: routineDeletionImpact(s, 'r-only-draft').hasHistory, inCurrentWorkout: false }), /archived/)
  })
  it('control: unreferenced setup is still hard-deleted', () => {
    const s = state()
    assert.equal(removeExerciseFromState(s, 'ex-unused', AT).exercises.some((e) => e.id === 'ex-unused'), false)
    assert.equal(removeRoutineFromState(s, 'r-unused', AT).routines.some((r) => r.id === 'r-unused'), false)
  })
  it("exerciseInActiveWorkout's logged-sets branch: a set whose exercise is not a snapshot item (only a hand-edited import makes one) still counts", () => {
    const s = state()
    const active = { id: 'live', routineId: 'r1', snapshot: { routineId: 'r1', routineName: 'R1', items: [{ routineItemId: 'i1', exerciseId: 'ex-a' }] }, sets: [{ exerciseId: 'ex-unused', routineItemId: 'zz', setType: 'work', weight: 5, reps: '5' }] }
    assert.equal(exerciseInActiveWorkout({ ...s, activeWorkout: active }, 'ex-unused'), true)
    assert.equal(exerciseInActiveWorkout({ ...s, activeWorkout: { ...active, sets: [] } }, 'ex-unused'), false)
    // and migration never produces that shape: a legacy active workout's snapshot is rebuilt from its sets
    const legacy = migrateState({ schemaVersion: 8, exercises: [ex('ex-a'), ex('ex-stray')], routines: [{ id: 'r1', name: 'R1', exercises: [{ id: 'i1', exerciseId: 'ex-a', sets: 1, targets: ['8'] }] }], workouts: [], activeWorkout: { id: 'live', routineId: 'r1', startedAt: '2025-01-01T10:00:00Z', sets: [{ exerciseId: 'ex-stray', setType: 'work', weight: 10, reps: '5' }] } }, { legacy: true })
    assert.ok(legacy.activeWorkout.snapshot.items.some((i) => i.exerciseId === 'ex-stray'))
  })
})

describe('2 — component tests (req-117 a), with the req-156 render harness', () => {
  it("History's Add set writes nothing before Save: type values, Cancel → the workout is byte-identical", async () => {
    const { HistorySetAdd } = await importJsx('./views/history/edit.jsx', import.meta.url)
    const workout = { id: 'wo-h', routineId: 'r', finishedAt: '2026-09-20T10:00:00Z', snapshot: { routineId: 'r', routineName: 'R', items: [{ id: 'pi-a', routineItemId: 'si-a', exerciseId: 'ex-a', exerciseName: 'Chest Press', exerciseType: 'machine' }] }, sets: [{ exerciseId: 'ex-a', routineItemId: 'si-a', setType: 'work', weight: 40, reps: '8', rpe: 3, note: '' }] }
    const store = { exercises: [{ id: 'ex-a', name: 'Chest Press', type: 'machine' }], routines: [], workouts: [workout], writes: [], updateWorkout: (...a) => store.writes.push(a) }
    const before = JSON.stringify(store.workouts)
    view = await render(h(StoreContext.Provider, { value: store }, h(HistorySetAdd, { workoutId: 'wo-h', exerciseId: 'ex-a', itemId: 'si-a' })))
    await view.type(view.input('kg'), '55')
    await view.type(view.input('Reps'), '6')
    const cancel = view.all('a').find((a) => a.textContent.trim() === 'Cancel')
    assert.ok(cancel, 'a Cancel link')
    await view.click(cancel)
    assert.deepEqual(store.writes, [], 'no write on Cancel')
    assert.equal(JSON.stringify(store.workouts), before, 'byte-identical')
  })

  it('item.jsx passes a restored duration to the form: log a timed set at 50 s, Previous → the Duration field reads 50', async () => {
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { useStore } = await import('./store-context.js')
    const { WorkoutItemLog } = await importJsx('./views/workout/item.jsx', import.meta.url)
    localStorage.clear()
    localStorage.setItem('workout-mvp-v8', JSON.stringify({ ...DB, activeWorkout: null }))
    const captured = {}
    function Screen({ open }) {
      // oxlint-disable-next-line react/immutability
      captured.store = useStore()
      return open ? h(WorkoutItemLog, { routineId: 'sess-upper', itemId: 'si-sess-upper-7-ex-plank' }) : null
    }
    view = await render(h(StoreProvider, null, h(Screen, { open: false })))
    const plankIndex = captured.store.routines.find((r) => r.id === 'sess-upper').exercises.findIndex((e) => e.exerciseId === 'ex-plank')
    await act(async () => captured.store.updateExercise('ex-plank', { hasDuration: true }))
    await act(async () => captured.store.updateRoutineExercise('sess-upper', plankIndex, { sets: 2, durations: [60, 60] }))
    await act(async () => captured.store.startWorkout('sess-upper'))
    const item = captured.store.activeWorkout.snapshot.items.find((i) => i.exerciseId === 'ex-plank')
    assert.equal(item.hasDuration, true, 'timed, frozen at Start')
    await act(async () =>
      captured.store.completeSet({ exerciseId: 'ex-plank', routineItemId: item.routineItemId, setType: 'work', weight: 0, reps: '', durationSec: 50, rpe: 3, note: '' }),
    )
    await view.unmount()
    view = await render(h(StoreProvider, null, h(Screen, { open: true })))
    const previous = view.button('Previous')
    assert.ok(previous, 'Previous is offered after a logged set')
    await view.click(previous)
    const duration = view.input('Duration (s)')
    assert.ok(duration, 'the timed form')
    assert.equal(duration.value, '50', 'the restored 50 s, not the 60 s target')
  })
})
