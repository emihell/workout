// req-109 — Skip exercise / Replace exercise mid-workout. The pure helpers live in
// workout-log.js; the persisted-data half is the workoutSnapshot guard in model.js,
// exercised here through the REAL migrateState (what storage.loadState runs on every
// load) and the REAL buildFinishProgression, finishedState and recalculatedState
// (store.finishWorkout / store.recalculateFuturePlans).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildFinishProgression,
  buildPlannedWorkout,
  migrateState,
  planSnapshot,
  recalculatedState,
} from './model.js'
import { historyPrescription, historySetPrefill, lastSetsForExercise } from './storage.js'
import {
  allItemsDone,
  finishedState,
  initialSetFields,
  isAddedMidWorkout,
  itemAllSkipped,
  itemIsMarkedDone,
  itemKey,
  itemLoggingState,
  replaceItemPatch,
  replacementItem,
  setPreview,
  setsForItem,
  skipItemPatch,
  withSkippedUnloggedSets,
} from './workout-log.js'
import { parseRoute } from './route.js'
import { itemReplacePath } from './workout-paths.js'
import { snapshotItemFor } from './views/history/snapshot-item.js'

const EXERCISES = [
  { id: 'ex-a', name: 'Chest Press', equipment: 'Machine', type: 'machine', weightStep: '5' },
  { id: 'ex-c', name: 'Shoulder Press', equipment: 'Machine', type: 'machine', weightStep: '5' },
  { id: 'ex-n', name: 'Pec Fly', equipment: 'Machine', type: 'machine', weightStep: '5' },
]

// A current-schema state: routine r1 = A (ex-a: 3 sets 10/8/6 @ 40/45/50, warm-up,
// rest 120) then C (ex-c: 2 sets 12/12 @ 30/30). The active workout is started the real
// way (buildPlannedWorkout → planSnapshot, as store.startWorkout does).
function baseState({ workouts = [], cEmpty = false } = {}) {
  const state = migrateState({
    schemaVersion: 9,
    exercises: EXERCISES,
    routines: [
      {
        id: 'r1',
        name: 'Push',
        focus: 'Machines',
        exercises: [
          {
            id: 'ri-a',
            exerciseId: 'ex-a',
            role: 'main',
            restSec: 120,
            warmup: { reps: 10 },
            sets: 3,
            targets: ['10', '8', '6'],
            suggestedWeights: [40, 45, 50],
          },
          {
            id: 'ri-c',
            exerciseId: 'ex-c',
            role: 'main',
            restSec: 90,
            sets: 2,
            targets: cEmpty ? [] : ['12', '12'],
            suggestedWeights: cEmpty ? [] : [30, 30],
          },
        ],
      },
    ],
    schedule: { loopWeeks: 1, slots: [] },
    workouts,
    activeWorkout: null,
  })
  const plan = buildPlannedWorkout(state, { routineId: 'r1', date: '2026-09-23' })
  state.activeWorkout = {
    id: 'wo-live',
    routineId: 'r1',
    scheduledFor: null,
    performedOn: '2026-09-23',
    scheduleSlotId: null,
    occurrenceId: plan.occurrenceId,
    snapshot: planSnapshot(plan),
    startedAt: '2026-09-23T10:00:00.000Z',
    finishedAt: null,
    overallNote: '',
    overallFeel: '',
    completedItemIds: [],
    restEndsAt: null,
    restPausedRemaining: null,
    sets: [],
    progression: null,
    seedOverrides: {},
  }
  return state
}

function withActive(state, patch) {
  return { ...state, activeWorkout: { ...state.activeWorkout, ...patch } }
}

const itemA = (state) => state.activeWorkout.snapshot.items[0]

function loggedSet(item, { setType = 'work', weight, reps, rpe = 3 }) {
  return {
    routineItemId: itemKey(item),
    exerciseId: item.exerciseId,
    setType,
    weight,
    reps: String(reps),
    rpe: setType === 'wu' ? null : rpe,
    note: '',
    targetReps: '',
    targetWeight: null,
  }
}

function replace(state, exerciseId, { id = 'mid-test-1', workouts = state.workouts } = {}) {
  const original = itemA(state)
  const exercise = state.exercises.find((ex) => ex.id === exerciseId)
  const replacement = replacementItem({
    id,
    original,
    exercise,
    restSec: historyPrescription(workouts, exerciseId)?.restSec,
  })
  return withActive(state, replaceItemPatch(state.activeWorkout, itemKey(original), replacement))
}

// What storage.loadState does to the stored value on every load (JSON round-trip + migrate).
const reload = (state) => migrateState(JSON.parse(JSON.stringify(state)))

describe('req-109 Skip exercise (skipItemPatch)', () => {
  it('3-set exercise with 1 set logged → 1 logged + remaining skipped, marked done, reads done', () => {
    let state = baseState()
    const a = itemA(state)
    state = withActive(state, {
      sets: [loggedSet(a, { setType: 'wu', weight: 20, reps: 10 }), loggedSet(a, { weight: 40, reps: 10 })],
    })
    state = withActive(state, skipItemPatch(state.activeWorkout, itemKey(a)))
    const sets = setsForItem(state.activeWorkout.sets, a)
    const work = sets.filter((set) => set.setType === 'work')
    assert.equal(work.length, 3)
    assert.deepEqual(
      work.map((set) => set.reps),
      ['10', 'skipped', 'skipped'],
    )
    assert.equal(itemIsMarkedDone(state.activeWorkout, a), true)
    assert.equal(itemAllSkipped(state.activeWorkout, a), false) // → the row reads "done"
    // Finish records exactly that: withSkippedUnloggedSets adds nothing more for A.
    const finished = withSkippedUnloggedSets(state.activeWorkout)
    const finishedA = setsForItem(finished.sets, a)
    assert.equal(finishedA.length, sets.length)
    assert.equal(finishedA.filter((set) => set.setType === 'work' && set.reps !== 'skipped').length, 1)
    assert.equal(finishedA.filter((set) => set.setType === 'work' && set.reps === 'skipped').length, 2)
  })

  it('an unlogged exercise → every set (warm-up + 3 work) skipped → reads skipped', () => {
    let state = baseState()
    const a = itemA(state)
    state = withActive(state, skipItemPatch(state.activeWorkout, itemKey(a)))
    const sets = setsForItem(state.activeWorkout.sets, a)
    assert.deepEqual(
      sets.map((set) => `${set.setType}:${set.reps}`),
      ['wu:skipped', 'work:skipped', 'work:skipped', 'work:skipped'],
    )
    assert.equal(itemAllSkipped(state.activeWorkout, a), true)
    assert.equal(itemLoggingState(state.activeWorkout, a).plannedDone, true)
  })

  it('records the same skippedSet shape Finish would (targets + planned weights)', () => {
    const state = baseState()
    const a = itemA(state)
    const viaSkip = skipItemPatch(state.activeWorkout, itemKey(a)).sets
    const viaFinish = setsForItem(withSkippedUnloggedSets(state.activeWorkout).sets, a)
    assert.deepEqual(viaSkip, viaFinish)
  })

  it('leaves other items and the rest timer alone; unknown item → null', () => {
    const state = withActive(baseState(), { restEndsAt: 123 })
    const patch = skipItemPatch(state.activeWorkout, itemKey(itemA(state)))
    assert.deepEqual(Object.keys(patch).sort(), ['completedItemIds', 'sets'])
    const c = state.activeWorkout.snapshot.items[1]
    assert.equal(setsForItem(patch.sets, c).length, 0)
    assert.equal(skipItemPatch(state.activeWorkout, 'nope'), null)
  })

  it('auto-complete: a skipped item counts as done in allItemsDone', () => {
    let state = baseState()
    const [a, c] = state.activeWorkout.snapshot.items
    state = withActive(state, skipItemPatch(state.activeWorkout, itemKey(a)))
    assert.equal(allItemsDone(state.activeWorkout), false)
    state = withActive(state, {
      sets: [...state.activeWorkout.sets, loggedSet(c, { weight: 30, reps: 12 }), loggedSet(c, { weight: 30, reps: 12 })],
    })
    assert.equal(allItemsDone(state.activeWorkout), true)
    // and with C skipped rather than logged
    const skippedBoth = withActive(state, { sets: skipItemPatch(state.activeWorkout, itemKey(a)).sets })
    const bothSkipped = withActive(skippedBoth, skipItemPatch(skippedBoth.activeWorkout, itemKey(c)))
    assert.equal(allItemsDone(bothSkipped.activeWorkout), true)
  })
})

describe('req-109 Replace exercise (replaceItemPatch + replacementItem)', () => {
  it('the original reads skipped and the picked one sits directly under it: 1 set, no target, no kg', () => {
    const state = replace(baseState(), 'ex-n')
    const items = state.activeWorkout.snapshot.items
    assert.deepEqual(
      items.map((item) => item.exerciseId),
      ['ex-a', 'ex-n', 'ex-c'],
    )
    assert.equal(itemAllSkipped(state.activeWorkout, items[0]), true)
    assert.equal(itemIsMarkedDone(state.activeWorkout, items[0]), true)
    const rep = items[1]
    assert.equal(rep.sets, 1)
    assert.equal(itemIsMarkedDone(state.activeWorkout, rep), false)
    assert.equal(setsForItem(state.activeWorkout.sets, rep).length, 0)
  })

  it('failure case — no copying: original 10/8/6 @ 40/45/50 + warm-up, picked has no history → blank', () => {
    const state = replace(baseState(), 'ex-n')
    const [orig, rep] = state.activeWorkout.snapshot.items
    assert.deepEqual(orig.targets, ['10', '8', '6'])
    assert.deepEqual(orig.suggestedWeights, [40, 45, 50])
    assert.deepEqual(rep.targets, [])
    assert.deepEqual(rep.suggestedWeights, [])
    assert.equal(rep.warmup, null)
    assert.equal(rep.notes, '')
    assert.equal(rep.restSec, 0) // no history → no rest (never copied from the original's 120)
    assert.equal(rep.role, 'main') // the slot's role is kept
    assert.equal(isAddedMidWorkout(rep), true)
    assert.equal(rep.routineItemId, 'mid-test-1')
    assert.equal(rep.id, 'mid-test-1')
    // what the log screen shows for it: no kg, no reps, one line
    const preview = setPreview({
      item: rep,
      ex: EXERCISES[2],
      weighted: true,
      hasHistory: false,
      historyFor: () => ({ weight: '', reps: '' }),
      seedOverrides: {},
    })
    assert.deepEqual(
      preview.map((line) => line.text),
      ['1 · — × —'],
    )
  })

  it('keeps the original role (a warm-up replacement still reads as a warm-up)', () => {
    const rep = replacementItem({
      id: 'mid-x',
      original: { role: 'warmup', targets: ['5'], suggestedWeights: [9], warmup: { reps: 3 } },
      exercise: EXERCISES[2],
      restSec: undefined,
    })
    assert.equal(rep.role, 'warmup')
    assert.deepEqual([rep.targets, rep.suggestedWeights, rep.warmup], [[], [], null])
  })

  it('failure case — survives reload: a replacement whose exercise IS in the routine stays blank + keeps its id', () => {
    const state = replace(baseState(), 'ex-c')
    const reloaded = reload(state)
    const rep = reloaded.activeWorkout.snapshot.items[1]
    assert.equal(rep.exerciseId, 'ex-c')
    assert.equal(rep.routineItemId, 'mid-test-1') // not the template's 'ri-c'
    assert.deepEqual(rep.targets, []) // not ['12','12'] from the routine's copy
    assert.deepEqual(rep.suggestedWeights, []) // not [30,30]
    assert.equal(rep.warmup, null)
    assert.deepEqual(rep, state.activeWorkout.snapshot.items[1]) // kept exactly as written
    // a second load is a fixed point
    assert.deepEqual(reload(reloaded).activeWorkout, reloaded.activeWorkout)
  })

  it('survives reload after logging one set on it (60×7): still no backfilled targets or weights', () => {
    let state = replace(baseState(), 'ex-c')
    const rep = state.activeWorkout.snapshot.items[1]
    state = withActive(state, { sets: [...state.activeWorkout.sets, loggedSet(rep, { weight: 60, reps: 7 })] })
    const reloaded = reload(state)
    const after = reloaded.activeWorkout.snapshot.items[1]
    assert.equal(after.routineItemId, 'mid-test-1')
    assert.deepEqual(after.targets, [])
    assert.deepEqual(after.suggestedWeights, [])
    // its set stays attributed to it
    const set = reloaded.activeWorkout.sets.find((s) => s.weight === 60)
    assert.equal(set.routineItemId, 'mid-test-1')
    // the routine's own C item is untouched by the replacement's 60×7
    const c = reloaded.activeWorkout.snapshot.items[2]
    assert.deepEqual([c.routineItemId, c.targets, c.suggestedWeights], ['ri-c', ['12', '12'], [30, 30]])
  })

  it('the guard is load-bearing: the same item WITHOUT the marker is backfilled on reload', () => {
    let state = replace(baseState(), 'ex-c')
    const items = state.activeWorkout.snapshot.items.map((item, i) => {
      if (i !== 1) return item
      const { addedMidWorkout, ...rest } = item
      return rest
    })
    state = withActive(state, { snapshot: { ...state.activeWorkout.snapshot, items } })
    const rep = reload(state).activeWorkout.snapshot.items[1]
    assert.deepEqual(rep.targets, ['12', '12']) // the reviewer's probe result
  })

  // req-112 — Finish no longer writes the routine (DEC-056), so this now runs the path
  // that still does: the real finish reducer, then History recalc on that workout.
  it('template untouched: finish + recalc on the reloaded state leaves the routine as the same workout without the replacement', () => {
    const finishRoutines = (s) => {
      const progression = buildFinishProgression(s.exercises, s.activeWorkout)
      const finished = finishedState(s, { progression }, '2026-09-23T11:00:00.000Z')
      assert.equal(finished.routines, s.routines, 'Finish itself leaves routines alone')
      return recalculatedState(finished, s.activeWorkout.id).routines
    }
    // with the replacement (in the routine's exercise), one set logged on it (60×7), reloaded
    let withRep = replace(baseState(), 'ex-c')
    const rep = withRep.activeWorkout.snapshot.items[1]
    withRep = withActive(withRep, {
      sets: [...withRep.activeWorkout.sets, loggedSet(rep, { weight: 60, reps: 7 })],
    })
    withRep = reload(withRep)
    // the same workout without the replacement: A skipped, nothing inserted
    let without = baseState()
    without = withActive(without, skipItemPatch(without.activeWorkout, itemKey(itemA(without))))
    without = reload(without)

    const got = finishRoutines(withRep)
    const want = finishRoutines(without)
    assert.deepEqual(got, want)
    const pick = (routines) =>
      routines[0].exercises.map(({ id, exerciseId, targets, suggestedWeights, sets }) => ({
        id,
        exerciseId,
        targets,
        suggestedWeights,
        sets,
      }))
    assert.deepEqual(pick(got), [
      { id: 'ri-a', exerciseId: 'ex-a', targets: ['10', '8', '6'], suggestedWeights: [40, 45, 50], sets: 3 },
      { id: 'ri-c', exerciseId: 'ex-c', targets: ['12', '12'], suggestedWeights: [30, 30], sets: 2 },
    ])
    // and the routine the state already held is unchanged too
    assert.deepEqual(got, withRep.routines)
  })

  it('right mechanism — own history: set-1 seed = initialSetFields from the picked exercise’s history', () => {
    const prior = {
      id: 'wo-prior',
      routineId: 'r-other',
      finishedAt: '2026-09-20T10:00:00.000Z',
      snapshot: { items: [{ routineItemId: 'x', exerciseId: 'ex-n', restSec: 75 }] },
      sets: [
        { routineItemId: 'x', exerciseId: 'ex-n', setType: 'work', weight: 22.5, reps: '11', rpe: 3 },
        { routineItemId: 'x', exerciseId: 'ex-n', setType: 'work', weight: 25, reps: '9', rpe: 3 },
      ],
    }
    let state = baseState({ workouts: [prior] })
    // the original has its own history too — it must not leak into the replacement
    state.workouts = [
      prior,
      {
        id: 'wo-a',
        routineId: 'r1',
        finishedAt: '2026-09-21T10:00:00.000Z',
        snapshot: { items: [] },
        sets: [{ routineItemId: 'ri-a', exerciseId: 'ex-a', setType: 'work', weight: 40, reps: '10', rpe: 3 }],
      },
    ]
    state = replace(state, 'ex-n', { workouts: state.workouts })
    const rep = state.activeWorkout.snapshot.items[1]
    assert.equal(rep.restSec, 75) // rest from its OWN last finished snapshot
    const last = lastSetsForExercise(state.workouts, rep.exerciseId)
    const seed = initialSetFields({
      weighted: true,
      fromRestore: false,
      restore: null,
      hasHistory: Boolean(last),
      history: historySetPrefill(last, { setType: 'work', workIndex: 0 }),
      carry: null,
      target: '',
      override: undefined,
    })
    assert.equal(seed.weight, '22.5') // ex-n's history, not the original's 40
    assert.equal(seed.reps, '') // no target → blank (req-108: reps never come from history)
    const lastA = lastSetsForExercise(state.workouts, 'ex-a')
    assert.notEqual(historySetPrefill(lastA, { setType: 'work', workIndex: 0 }).weight, seed.weight)
  })

  it('an unlogged replacement is recorded as skipped at finish; unknown original → null', () => {
    const state = replace(baseState(), 'ex-n')
    const rep = state.activeWorkout.snapshot.items[1]
    const finished = withSkippedUnloggedSets(state.activeWorkout)
    assert.deepEqual(
      setsForItem(finished.sets, rep).map((set) => `${set.setType}:${set.reps}`),
      ['work:skipped'],
    )
    assert.equal(replaceItemPatch(state.activeWorkout, 'nope', rep), null)
  })

  it('same exercise twice: next session the prefill reads the merged sets of that workout', () => {
    // A workout holding C (routine) 30×12, 30×12 AND a replacement C 60×7 — finished.
    let state = replace(baseState(), 'ex-c')
    const [, rep, c] = state.activeWorkout.snapshot.items
    state = withActive(state, {
      sets: [
        ...state.activeWorkout.sets,
        loggedSet(rep, { weight: 60, reps: 7 }),
        loggedSet(c, { weight: 30, reps: 12 }),
        loggedSet(c, { weight: 30, reps: 12 }),
      ],
    })
    const finished = { ...withSkippedUnloggedSets(state.activeWorkout), finishedAt: '2026-09-23T11:00:00.000Z' }
    const last = lastSetsForExercise([finished], 'ex-c')
    assert.deepEqual(
      [0, 1, 2].map((workIndex) => historySetPrefill(last, { setType: 'work', workIndex }).weight),
      ['60', '30', '30'], // set order in the workout: the replacement's set first
    )
  })
})

describe('req-109 picker route', () => {
  it('/workout/:routineId/item/:itemId/replace parses and round-trips', () => {
    const path = itemReplacePath('r1', { routineItemId: 'ri-a' })
    assert.equal(path, '/workout/r1/item/ri-a/replace')
    assert.deepEqual(parseRoute(path), { name: 'workout-item-replace', routineId: 'r1', itemId: 'ri-a' })
    // the neighbours are unchanged
    assert.equal(parseRoute('/workout/r1/item/ri-a/log').name, 'workout-item-log')
    assert.equal(parseRoute('/workout/r1/item/ri-a').name, 'workout-item')
  })
})

// req-109 review loop-back — guard 2 in workoutSnapshot: a replacement's logged sets
// never backfill a routine item of the same exercise whose targets/weights are empty.
describe('req-109 guard 2 — a replacement’s sets never backfill a same-exercise routine item', () => {
  it('routine C with EMPTY targets/weights + replacement C logged 60×7 → after migrateState, C is still empty', () => {
    let state = replace(baseState({ cEmpty: true }), 'ex-c')
    const [, rep, c] = state.activeWorkout.snapshot.items
    assert.deepEqual([c.routineItemId, c.targets, c.suggestedWeights], ['ri-c', [], []])
    state = withActive(state, { sets: [...state.activeWorkout.sets, loggedSet(rep, { weight: 60, reps: 7 })] })
    const after = reload(state).activeWorkout.snapshot.items[2]
    assert.equal(after.routineItemId, 'ri-c')
    assert.deepEqual(after.targets, []) // not ['7']
    assert.deepEqual(after.suggestedWeights, []) // not [60]
  })

  it('control: the routine item’s OWN logged set still backfills it (unchanged behaviour)', () => {
    let state = baseState({ cEmpty: true })
    const c = state.activeWorkout.snapshot.items[1]
    state = withActive(state, { sets: [loggedSet(c, { weight: 32.5, reps: 11 })] })
    const after = reload(state).activeWorkout.snapshot.items[1]
    assert.deepEqual([after.targets, after.suggestedWeights], [['11'], [32.5]])
  })
})

describe('req-109 history detail — snapshotItemFor resolves by id first', () => {
  // ri-a replaced by C; the routine's own ri-c is also C (accessory + WU).
  const items = [
    { routineItemId: 'ri-a', exerciseId: 'ex-a', role: 'main', warmup: { reps: 10 } },
    { routineItemId: 'mid-1', exerciseId: 'ex-c', role: 'main', warmup: null, addedMidWorkout: true },
    { routineItemId: 'ri-c', exerciseId: 'ex-c', role: 'accessory', warmup: { reps: 8 } },
  ]
  it('the ri-c row resolves to ri-c (accessory + WU), not the earlier replacement', () => {
    const got = snapshotItemFor(items, 'ri-c', 'ex-c')
    assert.equal(got.routineItemId, 'ri-c')
    assert.equal(got.role, 'accessory')
    assert.ok(got.warmup)
    // the old first-hit find picked the replacement — the bug this fixes
    const old = items.find((item) => item.routineItemId === 'ri-c' || item.exerciseId === 'ex-c')
    assert.equal(old.routineItemId, 'mid-1')
  })
  it('the replacement row resolves to the replacement', () => {
    assert.equal(snapshotItemFor(items, 'mid-1', 'ex-c').routineItemId, 'mid-1')
  })
  it('falls back to exerciseId only when no item has the id (legacy key / exercise route param)', () => {
    assert.equal(snapshotItemFor(items, 'history-wo-ex-a', 'ex-a').routineItemId, 'ri-a')
    assert.equal(snapshotItemFor(items, 'ex-a').routineItemId, 'ri-a')
    assert.equal(snapshotItemFor(items, 'nope', 'ex-zzz'), null)
    assert.equal(snapshotItemFor(undefined, 'ri-a'), null)
  })
})
