// req-170 (DEC-090) — a workout's routine falls back to the one its snapshot names:
// routineId = top-level routineId || sessionId || snapshot.routineId || snapshot.sessionId.
// Top-level still wins; nothing is removed from any record. Before, a workout naming its
// routine only in its snapshot lost the reference on load, so deleting that routine
// hard-deleted it.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { migrateState } from './model.js'
import { removeRoutineFromState, routineDeletionImpact, routineInActiveWorkout } from './state-reducers.js'

const AT = '2026-09-25T00:00:00.000Z'
const routines = [
  { id: 'r-snap', name: 'Snap', exercises: [] },
  { id: 'r-top', name: 'Top', exercises: [] },
]
const workoutWith = (snapshot, top = {}) => ({ id: 'w', startedAt: '2026-09-20T10:00:00Z', ...top, snapshot: { routineName: 'Snap', items: [], ...snapshot }, sets: [] })
const load = (where, workout) =>
  migrateState({
    schemaVersion: 9,
    exercises: [],
    routines,
    schedule: { loopWeeks: 1, slots: [] },
    workouts: where === 'finished' ? [{ ...workout, finishedAt: '2026-09-20T11:00:00Z' }] : [],
    draftWorkouts: where === 'draft' ? [workout] : [],
    activeWorkout: where === 'active' ? workout : null,
  })
const pick = (state, where) =>
  where === 'finished' ? state.workouts[0] : where === 'draft' ? state.draftWorkouts[0] : state.activeWorkout

for (const where of ['finished', 'active', 'draft']) {
  for (const key of ['routineId', 'sessionId']) {
    describe(`${where} workout naming its routine only by snapshot.${key}`, () => {
      const state = load(where, workoutWith({ [key]: 'r-snap' }))
      const w = pick(state, where)
      it('keeps the routine reference on load (was: undefined)', () => {
        assert.equal(w.routineId, 'r-snap')
        assert.equal(w.snapshot.routineId, 'r-snap')
        assert.equal(w.snapshot.routineName, 'Snap')
      })
      it('deleting that routine archives it (was: hard-deleted)', () => {
        const next = removeRoutineFromState(state, 'r-snap', AT)
        assert.equal(next.routines.find((r) => r.id === 'r-snap')?.archivedAt, AT)
        const impact = routineDeletionImpact(state, 'r-snap')
        const referenced = { finished: impact.hasHistory, draft: impact.inDraft, active: routineInActiveWorkout(state, 'r-snap') }
        assert.equal(referenced[where], true)
      })
    })
  }
  it(`${where}: top-level routineId still wins over the snapshot's`, () => {
    const w = pick(load(where, workoutWith({ routineId: 'r-snap' }, { routineId: 'r-top' })), where)
    assert.equal(w.routineId, 'r-top')
    assert.equal(w.snapshot.routineId, 'r-top')
  })
  it(`${where}: top-level sessionId still wins over the snapshot's`, () => {
    const w = pick(load(where, workoutWith({ sessionId: 'r-snap' }, { sessionId: 'r-top' })), where)
    assert.equal(w.routineId, 'r-top')
  })
}

describe('no snapshot routine at all is unchanged', () => {
  it('a workout with no routine anywhere still loads with routineId undefined', () => {
    const w = pick(load('finished', workoutWith({})), 'finished')
    assert.equal(w.routineId, undefined)
  })
})
