// req-117 — taps you can take back: an unlogged extra set is removable (the persisted
// `addedSets` marker), Previous on a timed set keeps its time, and History "Add set"
// writes nothing until Save. Exercised through the REAL migrateState (what
// storage.loadState runs on every load), addWorkingSetToState (store.addWorkingSet)
// and finishedState (store.finishWorkout).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildPlannedWorkout, migrateState, planSnapshot } from './model.js'
import {
  addWorkingSetToState,
  anythingLogged,
  autoCompleteArmed,
  canRemoveAddedSet,
  finishedState,
  formFieldsWithDraft,
  setDraftFromLoggedSet,
  isSkippedSet,
  itemIsMarkedDone,
  itemKey,
  itemLoggingState,
  markItemDonePatch,
  removeAddedSetPatch,
  reopenItemPatch,
  restoreFromLoggedSet,
  setsForItem,
  withOneLessSet,
  withOneMoreSet,
} from './workout-log.js'
import { parseRoute } from './route.js'
import { historyAddItemId, historyAddSetDraft, historyAddSetPath, withHistorySet } from './views/history/add-set.js'

const EXERCISES = [
  { id: 'ex-a', name: 'Chest Press', equipment: 'Machine', type: 'machine', weightStep: '5' },
  { id: 'ex-c', name: 'Shoulder Press', equipment: 'Machine', type: 'machine', weightStep: '5' },
  { id: 'ex-p', name: 'Plank', equipment: '', type: 'bodyweight', weightStep: 'n/a', hasDuration: true },
]

// Current-schema state: routine r1 = A (3 sets 10/8/6 @ 40/45/50, warm-up) then C
// (2 sets 12/12 @ 30/30), started the real way (buildPlannedWorkout → planSnapshot).
function baseState() {
  const state = migrateState({
    schemaVersion: 9,
    exercises: EXERCISES,
    routines: [
      {
        id: 'r1',
        name: 'Push',
        exercises: [
          { id: 'ri-a', exerciseId: 'ex-a', role: 'main', restSec: 120, warmup: { reps: 10 }, sets: 3, targets: ['10', '8', '6'], suggestedWeights: [40, 45, 50] },
          { id: 'ri-c', exerciseId: 'ex-c', role: 'main', restSec: 90, sets: 2, targets: ['12', '12'], suggestedWeights: [30, 30] },
        ],
      },
    ],
    schedule: { loopWeeks: 1, slots: [] },
    workouts: [],
    activeWorkout: null,
  })
  const plan = buildPlannedWorkout(state, { routineId: 'r1', date: '2026-09-23' })
  state.activeWorkout = {
    id: 'wo-live',
    routineId: 'r1',
    performedOn: '2026-09-23',
    occurrenceId: plan.occurrenceId,
    snapshot: planSnapshot(plan),
    startedAt: '2026-09-23T10:00:00.000Z',
    finishedAt: null,
    completedItemIds: [],
    restEndsAt: null,
    restPausedRemaining: null,
    sets: [],
    seedOverrides: {},
  }
  return state
}

const reload = (state) => migrateState(JSON.parse(JSON.stringify(state)))
const withActive = (state, patch) => ({ ...state, activeWorkout: { ...state.activeWorkout, ...patch } })
const itemA = (state) => state.activeWorkout.snapshot.items[0]

function logged(item, { setType = 'work', weight = 40, reps = 10 } = {}) {
  return { routineItemId: itemKey(item), exerciseId: item.exerciseId, setType, weight, reps: String(reps), rpe: setType === 'wu' ? null : 3, note: '', targetReps: '', targetWeight: null }
}

// A done: warm-up + its 3 working sets logged, marked done (as completing the last set does).
function aDone() {
  let state = baseState()
  const a = itemA(state)
  state = withActive(state, { sets: [logged(a, { setType: 'wu', weight: 20 }), logged(a), logged(a), logged(a)] })
  return withActive(state, markItemDonePatch(state.activeWorkout, a))
}

// The done view's "Add set": reopen, then store.addWorkingSet.
function addSet(state) {
  const a = itemA(state)
  state = withActive(state, reopenItemPatch(state.activeWorkout, a))
  return addWorkingSetToState(state, itemKey(a))
}

describe('req-117 Remove set (an unlogged extra set)', () => {
  it('done → Add set → Remove set → done again, item as before; Finish writes no skipped set', () => {
    const before = aDone()
    const a0 = itemA(before)
    let state = addSet(before)
    assert.equal(itemA(state).sets, 4)
    assert.equal(itemA(state).addedSets, 1)
    assert.equal(itemIsMarkedDone(state.activeWorkout, itemA(state)), false)
    // the marker survives a reload (migrateState → workoutSnapshot spreads the item)
    state = reload(state)
    assert.equal(itemA(state).addedSets, 1)
    assert.equal(canRemoveAddedSet(state.activeWorkout, itemA(state)), true)

    state = withActive(state, removeAddedSetPatch(state.activeWorkout, itemKey(a0)))
    assert.deepEqual(itemA(state), a0)
    assert.equal(itemIsMarkedDone(state.activeWorkout, itemA(state)), true)
    assert.equal(itemLoggingState(state.activeWorkout, itemA(state)).plannedDone, true)

    const finished = finishedState(state).workouts[0]
    const aSets = setsForItem(finished.sets, a0)
    assert.equal(aSets.length, 4)
    assert.equal(aSets.filter(isSkippedSet).length, 0)
  })

  it('control: without Remove, Finish records the extra set as skipped (the audit-F bug)', () => {
    const finished = finishedState(addSet(aDone())).workouts[0]
    assert.equal(setsForItem(finished.sets, itemA(aDone())).filter(isSkippedSet).length, 1)
  })

  it('Remove re-arms the req-116 summary gate exactly as before Add set', () => {
    // C still open, so neither is all-done; finish C, then compare.
    const done = (s) => {
      const c = s.activeWorkout.snapshot.items[1]
      s = withActive(s, { sets: [...s.activeWorkout.sets, logged(c, { weight: 30, reps: 12 }), logged(c, { weight: 30, reps: 12 })] })
      return withActive(s, markItemDonePatch(s.activeWorkout, c))
    }
    const before = done(aDone())
    assert.equal(autoCompleteArmed(before.activeWorkout), true)
    const added = addSet(before)
    assert.equal(autoCompleteArmed(added.activeWorkout), false)
    const removed = withActive(added, removeAddedSetPatch(added.activeWorkout, itemKey(itemA(added))))
    assert.equal(autoCompleteArmed(removed.activeWorkout), true)
    assert.equal(anythingLogged(removed.activeWorkout), true)
  })

  it('only an unlogged added set is removable; a logged one is not, a planned one never', () => {
    const plain = aDone()
    assert.equal(canRemoveAddedSet(plain.activeWorkout, itemA(plain)), false)
    assert.equal(removeAddedSetPatch(plain.activeWorkout, itemKey(itemA(plain))), null)
    // mid-exercise (planned set 3 unlogged) with no added set → not removable
    const fresh = baseState()
    assert.equal(canRemoveAddedSet(fresh.activeWorkout, itemA(fresh)), false)
    // extra set logged → not removable
    let state = addSet(aDone())
    state = withActive(state, { sets: [...state.activeWorkout.sets, logged(itemA(state))] })
    assert.equal(canRemoveAddedSet(state.activeWorkout, itemA(state)), false)
    assert.equal(removeAddedSetPatch(state.activeWorkout, itemKey(itemA(state))), null)
  })

  it('two added, none logged → Remove twice returns to the original item and done', () => {
    const before = aDone()
    let state = addSet(addSet(before))
    assert.equal(itemA(state).addedSets, 2)
    state = withActive(state, removeAddedSetPatch(state.activeWorkout, itemKey(itemA(state))))
    assert.equal(itemA(state).addedSets, 1)
    assert.equal(itemIsMarkedDone(state.activeWorkout, itemA(state)), false)
    assert.equal(canRemoveAddedSet(state.activeWorkout, itemA(state)), true)
    state = withActive(state, removeAddedSetPatch(state.activeWorkout, itemKey(itemA(state))))
    assert.deepEqual(itemA(state), itemA(before))
    assert.equal(itemIsMarkedDone(state.activeWorkout, itemA(state)), true)
  })

  it('withOneLessSet inverts withOneMoreSet for every weights shape', () => {
    for (const item of [
      { routineItemId: 'x', sets: 1, targets: ['8'], suggestedWeights: [40] },
      { routineItemId: 'x', sets: 1, targets: ['8'], suggestedWeights: [] },
      { routineItemId: 'x', sets: 2, targets: ['8', '8'], suggestedWeights: [40, null] },
      { routineItemId: 'x', sets: 2, targets: ['8', ''], suggestedWeights: [40, 45] },
    ]) {
      assert.deepEqual(withOneLessSet(withOneMoreSet(item)), item)
      assert.deepEqual(withOneLessSet(withOneLessSet(withOneMoreSet(withOneMoreSet(item)))), item)
    }
    const noMarker = { routineItemId: 'x', sets: 3, targets: ['8', '8', '8'], suggestedWeights: [] }
    assert.equal(withOneLessSet(noMarker), noMarker)
  })

  it('the marker also survives a legacy (req-120) migrate, which leaves filled targets alone', () => {
    const state = addSet(aDone())
    const legacy = migrateState(JSON.parse(JSON.stringify(state)), { legacy: true })
    assert.equal(itemA(legacy).addedSets, 1)
    assert.deepEqual(itemA(legacy).targets, itemA(state).targets)
  })
})

// req-165 (F-DEAD-5) — initialDurationFor was superseded by req-125's draft path and
// removed; these now run the path the log screen uses: Previous writes the un-logged set
// as the draft (setDraftFromLoggedSet), and the form starts from formFieldsWithDraft.
const SEED = { weight: '', reps: '', effort: 3, note: '' }
const durationAfterPrevious = (set, target) =>
  formFieldsWithDraft({ seed: SEED, draft: set ? setDraftFromLoggedSet('k', set) : null, weighted: false, durationTarget: target }).durationSec

describe('req-117 Previous on a timed set restores its time', () => {
  it('log 50 s → Previous → the form shows 50 s, not the target', () => {
    const set = { routineItemId: 'ri-p', exerciseId: 'ex-p', setType: 'work', weight: 0, reps: '', durationSec: 50, rpe: 3, note: '' }
    const restore = restoreFromLoggedSet(set)
    assert.equal(restore.durationSec, 50)
    assert.equal(durationAfterPrevious(set, 30), 50)
    // not restoring → the target, as before
    assert.equal(durationAfterPrevious(null, 30), 30)
  })

  it('a reps set restores as before (no durationSec); a skipped timed set gets the target', () => {
    const reps = restoreFromLoggedSet({ setType: 'work', weight: 40, reps: '8', rpe: 4, note: 'x' })
    assert.deepEqual(reps, { setType: 'work', workIndex: null, weight: '40', reps: '8', rpe: '4', note: 'x' })
    assert.equal(durationAfterPrevious({ setType: 'work', weight: 0, reps: 'skipped', durationSec: 0, note: 'skipped' }, 30), 30)
  })
})

describe('req-117 History Add set writes only on Save', () => {
  function finishedWorkout() {
    return finishedState(withActive(aDone(), {}), {}, '2026-09-23T11:00:00.000Z').workouts[0]
  }

  it('Add set → Cancel: the workout deep-equals before (nothing is written to open the form)', () => {
    const workout = finishedWorkout()
    const before = structuredClone(workout)
    const path = historyAddSetPath(workout, 'ex-a', 'ri-a')
    const route = parseRoute(path)
    historyAddSetDraft(workout, route.exerciseId, route.itemId)
    // Cancel is a NavLink to the exercise page: no write. The record is unchanged.
    assert.deepEqual(workout, before)
  })

  it('Add set → 40×8 → Save → exactly one new set, filed under the item', () => {
    const workout = finishedWorkout()
    const draft = historyAddSetDraft(workout, 'ex-a', 'ri-a')
    assert.equal(draft.weight, 40) // this item's last set in this workout (as before)
    const patch = withHistorySet(workout, {
      exerciseId: 'ex-a',
      itemId: 'ri-a',
      exercise: EXERCISES[0],
      values: { weight: '40', reps: '8', rpe: '', note: '', setType: 'work' },
    })
    assert.equal(patch.sets.length, workout.sets.length + 1)
    assert.deepEqual(patch.sets.slice(0, -1), workout.sets)
    assert.deepEqual(patch.sets.at(-1), { exerciseId: 'ex-a', routineItemId: 'ri-a', setType: 'work', weight: 40, reps: '8', rpe: null, note: '' })
    assert.equal(patch.snapshot.items, workout.snapshot.items) // existing item: no new snapshot item
  })

  it('a new exercise gets its snapshot item only on Save', () => {
    const workout = finishedWorkout()
    const itemId = historyAddItemId(workout, 'ex-c-new', null)
    assert.equal(itemId, `history-${workout.id}-ex-c-new`)
    const patch = withHistorySet(workout, {
      exerciseId: 'ex-c-new',
      itemId,
      exercise: { id: 'ex-c-new', name: 'Row', type: 'machine' },
      values: { weight: '', reps: '10', rpe: '3', note: '', setType: 'work' },
    })
    assert.equal(patch.snapshot.items.length, workout.snapshot.items.length + 1)
    assert.equal(patch.snapshot.items.at(-1).routineItemId, itemId)
    assert.equal(patch.snapshot.items.at(-1).notes, 'Added during history correction')
    assert.equal(patch.sets.at(-1).weight, '')
    assert.equal(patch.sets.at(-1).rpe, 3)
  })

  it('routes: the add form, the picker and an existing set stay distinct', () => {
    const workout = { id: 'wo-1', sets: [] }
    const path = historyAddSetPath(workout, 'ex a/1', null)
    assert.deepEqual(parseRoute(path), { name: 'history-set-add', id: 'wo-1', exerciseId: 'ex a/1', itemId: 'history-wo-1-ex a/1' })
    assert.deepEqual(parseRoute('/history/wo-1/set/new'), { name: 'history-set-new', id: 'wo-1' })
    assert.deepEqual(parseRoute('/history/wo-1/set/3'), { name: 'history-set', id: 'wo-1', index: 3 })
  })
})
