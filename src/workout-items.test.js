// req-276 — split from workout-log.test.js: the tests of workout-items.js (and allItemsDone, workout-progress.js).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { allItemsDone } from './workout-progress.js'
import {
  itemIsMarkedDone,
  itemKey,
  itemLoggingState,
  markItemDonePatch,
  reopenItemPatch,
  withOneMoreSet,
  addWorkingSetToState,
  withSkippedUnloggedSets,
} from './workout-items.js'

const item = {
  id: 'pi-si-row',
  routineItemId: 'si-row',
  exerciseId: 'ex-rowing',
  sets: 1,
  warmup: null,
}

describe('workout logging', () => {
  it('uses the routine item id as the stable key', () => {
    assert.equal(itemKey(item), 'si-row')
  })

  it('is not done until every planned working set is logged', () => {
    const empty = itemLoggingState({ sets: [] }, item)
    assert.equal(empty.plannedDone, false)
    const done = itemLoggingState(
      { sets: [{ routineItemId: 'si-row', exerciseId: 'ex-rowing', setType: 'work', reps: '6 min' }] },
      item,
    )
    assert.equal(done.plannedDone, true)
  })

  it('an exercise is marked done by completedItemIds membership', () => {
    assert.equal(itemIsMarkedDone({ completedItemIds: [] }, item), false)
    assert.equal(itemIsMarkedDone({ completedItemIds: ['si-row'] }, item), true)
  })

  // req-11 / DEC-013 — the mark-done transition moved from the review screen's
  // "Done" button to completing the last set. These test the pure patch.
  // req-25 update: the patch no longer clears rest. Before req-25 it set
  // restEndsAt/restPausedRemaining to null (the old "no rest after the last set"
  // behaviour). req-25 arms a rest on the last set too (rest-on-overview) and this
  // patch runs right after the rest patch, so it must NOT wipe the armed rest —
  // this test now asserts the patch leaves the rest fields untouched (domino check).
  it('completing the last set marks the exercise done and does NOT touch rest', () => {
    // A single-set exercise: after that set is logged, plannedDone is true and
    // the completion path fires markItemDonePatch.
    const workout = {
      completedItemIds: [],
      restEndsAt: 123456,
      restPausedRemaining: null,
      sets: [{ routineItemId: 'si-row', exerciseId: 'ex-rowing', setType: 'work', reps: '10' }],
    }
    assert.equal(itemLoggingState(workout, item).plannedDone, true)
    const patch = markItemDonePatch(workout, item)
    assert.deepEqual(patch.completedItemIds, ['si-row'])
    // The patch must not carry rest keys, so merging it preserves the armed rest.
    assert.equal('restEndsAt' in patch, false)
    assert.equal('restPausedRemaining' in patch, false)
    assert.equal(itemIsMarkedDone({ completedItemIds: patch.completedItemIds }, item), true)
  })

  // req-105 — the one "every exercise done" test: gates the auto-complete summary and
  // promotes Finish to primary. Done = marked done OR planned-done, per item.
  describe('req-105 allItemsDone', () => {
    const first = { id: 'pi-si-a', routineItemId: 'si-a', exerciseId: 'ex-a', sets: 1, warmup: null }
    const last = { id: 'pi-si-b', routineItemId: 'si-b', exerciseId: 'ex-b', sets: 1, warmup: null }
    const snapshot = { items: [first, last] }
    const workSet = (it) => ({ routineItemId: it.routineItemId, exerciseId: it.exerciseId, setType: 'work', reps: '8' })

    it('is false with the last item done and the first open', () => {
      assert.equal(allItemsDone({ snapshot, completedItemIds: ['si-b'], sets: [workSet(last)] }), false)
    })
    it('is false for a just-started workout (nothing logged)', () => {
      assert.equal(allItemsDone({ snapshot, completedItemIds: [], sets: [] }), false)
    })
    it('is true when every item is marked done', () => {
      assert.equal(allItemsDone({ snapshot, completedItemIds: ['si-a', 'si-b'], sets: [] }), true)
    })
    it('is true when every item is planned-done (sets logged, not marked)', () => {
      assert.equal(allItemsDone({ snapshot, completedItemIds: [], sets: [workSet(first), workSet(last)] }), true)
    })
    it('is true for a mix of marked-done and planned-done', () => {
      assert.equal(allItemsDone({ snapshot, completedItemIds: ['si-a'], sets: [workSet(last)] }), true)
    })
    it('is false for an empty or missing workout', () => {
      assert.equal(allItemsDone({ snapshot: { items: [] }, sets: [] }), false)
      assert.equal(allItemsDone(null), false)
    })
  })

  it('mark-done is idempotent and preserves other completed ids', () => {
    const patch = markItemDonePatch({ completedItemIds: ['si-other', 'si-row'] }, item)
    assert.deepEqual(patch.completedItemIds, ['si-other', 'si-row'])
  })

  it('"Add set" reopens a done exercise (removes only its key)', () => {
    const patch = reopenItemPatch({ completedItemIds: ['si-other', 'si-row'] }, item)
    assert.deepEqual(patch.completedItemIds, ['si-other'])
    assert.equal(itemIsMarkedDone({ completedItemIds: patch.completedItemIds }, item), false)
  })

  it('adds a working set to this workout only, not the routine', () => {
    const extra = withOneMoreSet({
      routineItemId: 'si-row',
      sets: 1,
      targets: ['5-8 min'],
      suggestedWeights: [],
    })
    assert.equal(extra.sets, 2)
    assert.deepEqual(extra.targets, ['5-8 min', '5-8 min'])

    const next = addWorkingSetToState(
      {
        routines: [
          {
            id: 'sess-upper',
            exercises: [
              {
                id: 'si-row',
                exerciseId: 'ex-rowing',
                sets: 1,
                targets: ['5-8 min'],
                suggestedWeights: [],
              },
            ],
          },
        ],
        activeWorkout: {
          routineId: 'sess-upper',
          snapshot: {
            items: [{ routineItemId: 'si-row', sets: 1, targets: ['5-8 min'], suggestedWeights: [] }],
          },
        },
      },
      'si-row',
    )
    assert.equal(next.activeWorkout.snapshot.items[0].sets, 2)
    assert.equal(next.routines[0].exercises[0].sets, 1)
    assert.deepEqual(next.routines[0].exercises[0].targets, ['5-8 min'])
  })

  it('records unopened planned sets as skipped when the workout is finished', () => {
    const next = withSkippedUnloggedSets({
      sets: [],
      completedItemIds: [],
      snapshot: {
        items: [
          {
            routineItemId: 'si-row',
            exerciseId: 'ex-rowing',
            sets: 2,
            targets: ['10', '10'],
            warmup: { reps: 12 },
          },
        ],
      },
    })
    assert.equal(next.sets.length, 3)
    assert.equal(next.sets[0].setType, 'wu')
    assert.equal(next.sets[0].reps, 'skipped')
    assert.equal(next.sets[1].reps, 'skipped')
    assert.equal(next.sets[2].reps, 'skipped')
    assert.deepEqual(next.completedItemIds, ['si-row'])
  })

  // req-30 — a warmup the user ticked without entering reps must not invent 12;
  // a skipped such warmup records an empty targetReps (DESIGN §1, no invented data).
  it('records a skipped warmup with no reps as an empty targetReps (not 12)', () => {
    const next = withSkippedUnloggedSets({
      sets: [],
      completedItemIds: [],
      snapshot: {
        items: [
          {
            routineItemId: 'si-row',
            exerciseId: 'ex-rowing',
            sets: 1,
            targets: ['10'],
            warmup: { reps: '' },
          },
        ],
      },
    })
    const wu = next.sets.find((set) => set.setType === 'wu')
    assert.equal(wu.reps, 'skipped')
    assert.equal(wu.targetReps, '')
  })

  // req-30 — a user-entered warmup rep count is still honoured on skip (not rewritten).
  it('keeps a user-entered warmup rep count on a skipped warmup', () => {
    const next = withSkippedUnloggedSets({
      sets: [],
      completedItemIds: [],
      snapshot: {
        items: [
          {
            routineItemId: 'si-row',
            exerciseId: 'ex-rowing',
            sets: 1,
            targets: ['10'],
            warmup: { reps: 12 },
          },
        ],
      },
    })
    const wu = next.sets.find((set) => set.setType === 'wu')
    assert.equal(wu.targetReps, '12')
  })
})
