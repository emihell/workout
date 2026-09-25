// req-169 (DEC-089) — (1) a finished workout's snapshot is a reference even with zero logged
// sets (exercise); the routine side has no such gap in loaded data (measured, pinned below);
// schedule slots still are not a reference (DEC-031). (2) the delete confirm tells the truth
// about a draft-only reference. The confirm and the reducer read the same impact.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { migrateState } from './model.js'
import {
  deletionConfirmHead,
  exerciseDeletionImpact,
  exerciseInActiveWorkout,
  removeExerciseFromState,
  removeRoutineFromState,
  routineDeletionImpact,
  routineInActiveWorkout,
} from './state-reducers.js'

const AT = '2026-09-25T00:00:00.000Z'
const ex = (id) => ({ id, name: id, type: 'machine' })
const doc = (extra = {}) =>
  migrateState({
    schemaVersion: 9,
    exercises: [ex('ex-a'), ex('ex-zero'), ex('ex-past'), ex('ex-draft'), ex('ex-live'), ex('ex-free')],
    routines: [
      { id: 'r1', name: 'R1', exercises: [{ id: 'i1', exerciseId: 'ex-a', sets: 1, targets: ['8'] }] },
      { id: 'r-snap', name: 'Snap', exercises: [] },
      { id: 'r-slot', name: 'Slot only', exercises: [] },
      { id: 'r-free', name: 'Free', exercises: [] },
    ],
    schedule: { loopWeeks: 1, slots: [{ id: 's1', week: 0, weekday: 1, routineId: 'r-slot' }] },
    workouts: [
      {
        id: 'w1', routineId: 'r1', finishedAt: '2026-09-20T10:00:00Z',
        snapshot: { routineId: 'r1', routineName: 'R1', items: [{ routineItemId: 'i1', exerciseId: 'ex-a' }, { routineItemId: 'i2', exerciseId: 'ex-zero' }] },
        sets: [{ exerciseId: 'ex-a', routineItemId: 'i1', setType: 'work', weight: 20, reps: '8' }, { exerciseId: 'ex-past', routineItemId: 'i9', setType: 'work', weight: 5, reps: '5' }],
      },
      // names its routine only by snapshot.routineId (migrateState leaves routineId undefined)
      { id: 'w2', finishedAt: '2026-09-21T10:00:00Z', snapshot: { routineId: 'r-snap', routineName: 'Snap', items: [] }, sets: [] },
    ],
    draftWorkouts: [{ id: 'd1', routineId: 'r1', startedAt: '2025-01-01T10:00:00Z', snapshot: { routineId: 'r1', routineName: 'R1', items: [{ routineItemId: 'x', exerciseId: 'ex-draft' }] }, sets: [] }],
    activeWorkout: null,
    ...extra,
  })

describe('1 — finished history names a reference by its snapshot too (DEC-089 §1)', () => {
  it('an exercise listed in a finished snapshot with ZERO logged sets → archived (was: hard-deleted)', () => {
    const s = doc()
    assert.equal(exerciseDeletionImpact(s, 'ex-zero').hasHistory, true)
    assert.equal(removeExerciseFromState(s, 'ex-zero', AT).exercises.find((e) => e.id === 'ex-zero')?.archivedAt, AT)
  })
  it('routine side, measured: a loaded workout never names its routine only by snapshot.routineId — migrateState rebuilds the snapshot from routineId, so that shape arrives with NO routine reference at all (a load-path finding, reported, not changed here)', () => {
    const w2 = doc().workouts.find((w) => w.id === 'w2')
    assert.equal(w2.routineId, undefined)
    assert.equal(w2.snapshot.routineId, undefined, 'dropped on load — nothing left for an impact check to read')
    assert.equal(w2.snapshot.routineName, 'Snap')
  })
  it('control (DEC-031 stands): a routine referenced only by a schedule slot is hard-deleted; its slot goes', () => {
    const s = doc()
    assert.deepEqual(routineDeletionImpact(s, 'r-slot'), { slots: 1, hasHistory: false, inDraft: false })
    const next = removeRoutineFromState(s, 'r-slot', AT)
    assert.equal(next.routines.some((r) => r.id === 'r-slot'), false)
    assert.equal(next.schedule.slots.some((slot) => slot.routineId === 'r-slot'), false)
  })
})

describe('2 — the delete confirm, in DEC-089 order: current → past → unfinished (draft) → plain', () => {
  const head = (name, refs) => deletionConfirmHead(name, { hasHistory: false, inCurrentWorkout: false, inDraft: false, ...refs })
  it('in the current workout', () => {
    assert.equal(head('Bench', { inCurrentWorkout: true }), 'Bench is in the current workout and will be archived (the workout keeps it).')
  })
  it('past workouts', () => {
    assert.equal(head('Bench', { hasHistory: true }), 'Bench has past workouts and will be archived (kept in your history).')
  })
  it('draft-only: "is in an unfinished workout" (was: "has past workouts")', () => {
    assert.equal(head('Bench', { inDraft: true }), 'Bench is in an unfinished workout and will be archived (kept).')
  })
  it('no reference: a plain delete', () => {
    assert.equal(head('Bench', {}), 'Delete Bench?')
  })
  it('the order: current beats past beats draft', () => {
    assert.match(head('B', { inCurrentWorkout: true, hasHistory: true, inDraft: true }), /current workout/)
    assert.match(head('B', { hasHistory: true, inDraft: true }), /past workouts/)
  })
})

describe('the confirm and the reducer read the same impact: "archived" wording ⇔ archived', () => {
  const live = { id: 'live', routineId: 'r-free', snapshot: { routineId: 'r-free', routineName: 'Free', items: [{ routineItemId: 'l1', exerciseId: 'ex-live' }] }, sets: [] }
  const exerciseCases = [
    ['ex-past', 'past workouts'],
    ['ex-zero', 'past workouts'],
    ['ex-draft', 'unfinished workout'],
    ['ex-live', 'current workout'],
    ['ex-free', null],
  ]
  for (const [id, wording] of exerciseCases) {
    it(`exercise ${id}: ${wording ?? 'plain delete'}`, () => {
      const s = doc({ activeWorkout: live })
      const impact = exerciseDeletionImpact(s, id)
      const text = deletionConfirmHead(id, { ...impact, inCurrentWorkout: exerciseInActiveWorkout(s, id) })
      const kept = removeExerciseFromState(s, id, AT).exercises.find((e) => e.id === id)
      if (wording) {
        assert.match(text, new RegExp(`${wording}.*will be archived`))
        assert.equal(kept?.archivedAt, AT)
      } else {
        assert.equal(text, `Delete ${id}?`)
        assert.equal(kept, undefined)
      }
    })
  }
  const routineCases = [
    ['r1', 'past workouts'],
    ['r-free', 'current workout'],
    ['r-slot', null],
  ]
  for (const [id, wording] of routineCases) {
    it(`routine ${id}: ${wording ?? 'plain delete'}`, () => {
      const s = doc({ activeWorkout: live })
      const impact = routineDeletionImpact(s, id)
      const text = deletionConfirmHead(id, { ...impact, inCurrentWorkout: routineInActiveWorkout(s, id) })
      const kept = removeRoutineFromState(s, id, AT).routines.find((r) => r.id === id)
      if (wording) {
        assert.match(text, new RegExp(`${wording}.*will be archived`))
        assert.equal(kept?.archivedAt, AT)
      } else {
        assert.equal(text, `Delete ${id}?`)
        assert.equal(kept, undefined)
      }
    })
  }
  it('a routine referenced only by a draft: unfinished-workout wording, archived', () => {
    const s = doc({ workouts: [], draftWorkouts: [{ id: 'd2', routineId: 'r-free', startedAt: '2025-01-01T10:00:00Z', snapshot: { routineId: 'r-free', routineName: 'Free', items: [] }, sets: [] }] })
    const impact = routineDeletionImpact(s, 'r-free')
    assert.equal(deletionConfirmHead('Free', { ...impact, inCurrentWorkout: false }), 'Free is in an unfinished workout and will be archived (kept).')
    assert.equal(removeRoutineFromState(s, 'r-free', AT).routines.find((r) => r.id === 'r-free')?.archivedAt, AT)
  })
})
