import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { rpeOptionValue } from './ids.js'
import {
  allItemsDone,
  itemIsMarkedDone,
  itemKey,
  itemLoggingState,
  lastLoggedSetIndex,
  markItemDonePatch,
  reopenItemPatch,
  withOneMoreSet,
  addWorkingSetToState,
  withSkippedUnloggedSets,
  restPatchAfterSet,
  restRemaining,
  carriedWorkingSet,
  setLogSeed,
  initialSetFields,
  isSkippedSet,
  seedOverrideKey,
  nextSeedOverrides,
  setTargetFor,
  durationTargetFor,
  setPreview,
  setPreviewText,
} from './workout-log.js'
import { historySetPrefill, lastSetsForExercise } from './storage.js'
import { DEFAULT_DURATION_SEC } from './model.js'

describe('req-44 isSkippedSet (one shared guarded predicate)', () => {
  it('is true for reps "skipped", case-insensitive', () => {
    assert.equal(isSkippedSet({ reps: 'skipped' }), true)
    assert.equal(isSkippedSet({ reps: 'Skipped' }), true)
    assert.equal(isSkippedSet({ reps: 'SKIPPED' }), true)
  })
  it('is false for a real rep count', () => {
    assert.equal(isSkippedSet({ reps: '10' }), false)
    assert.equal(isSkippedSet({ reps: 0 }), false)
  })
  it('handles null/undefined reps and a missing set (the finish.jsx guard fix)', () => {
    assert.equal(isSkippedSet({ reps: null }), false)
    assert.equal(isSkippedSet({ reps: undefined }), false)
    assert.equal(isSkippedSet({}), false)
    assert.equal(isSkippedSet(undefined), false)
  })
})

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

  it('finds the last logged set for this exercise so you can go back', () => {
    const workout = {
      sets: [
        { routineItemId: 'si-other', reps: '8' },
        { routineItemId: 'si-row', setType: 'work', reps: '10' },
        { routineItemId: 'si-row', setType: 'work', reps: 'skipped' },
      ],
    }
    assert.equal(lastLoggedSetIndex(workout, item), 2)
    assert.equal(lastLoggedSetIndex({ sets: [] }, item), -1)
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

// req-25 — rest is armed by completion, not suppressed on the last set; only a
// skipped set (or restSec 0) suppresses it. The bug was the final set getting no
// rest. This pins the pure decision the view delegates to.
describe('restPatchAfterSet (req-25 rest-on-completion)', () => {
  it('a completed set with restSec > 0 arms a future rest (last set or not)', () => {
    const before = Date.now()
    const patch = restPatchAfterSet({ restSec: 90, skipped: false })
    assert.ok(patch.restEndsAt >= before + 90 * 1000)
    assert.equal(patch.restPausedRemaining, null)
  })

  it('a skipped set never rests (no over-fix on skip)', () => {
    assert.deepEqual(restPatchAfterSet({ restSec: 90, skipped: true }), {
      restEndsAt: null,
      restPausedRemaining: null,
    })
  })

  it('restSec 0 never arms rest (leaves restEndsAt untouched to merge)', () => {
    const patch = restPatchAfterSet({ restSec: 0, skipped: false })
    assert.equal('restEndsAt' in patch, false)
    assert.equal(patch.restPausedRemaining, null)
  })

  it('skipped defaults to false: restSec > 0 arms rest when skipped is omitted', () => {
    assert.ok(restPatchAfterSet({ restSec: 60 }).restEndsAt > Date.now())
  })
})

describe('restRemaining (rest timer recompute)', () => {
  it('(a) active countdown recomputes from restEndsAt for any now, not frozen/reset', () => {
    const active = { restEndsAt: 10_000, restPausedRemaining: null }
    // Different `now` values yield different remaining — proves it is recomputed,
    // which is what keeps navigating away and back showing the correct time.
    assert.deepEqual(restRemaining(active, 2_000), { remainingMs: 8_000, paused: false, resting: true })
    assert.deepEqual(restRemaining(active, 7_500), { remainingMs: 2_500, paused: false, resting: true })
    assert.equal(restRemaining(active, 9_999).remainingMs, 1)
  })

  it('(b) paused: remaining is the frozen paused value, regardless of now', () => {
    const active = { restEndsAt: null, restPausedRemaining: 4_200 }
    assert.deepEqual(restRemaining(active, 0), { remainingMs: 4_200, paused: true, resting: true })
    assert.deepEqual(restRemaining(active, 1_000_000), { remainingMs: 4_200, paused: true, resting: true })
  })

  it('(c) expired: now at/after restEndsAt clamps to 0 and stops resting', () => {
    const active = { restEndsAt: 10_000, restPausedRemaining: null }
    assert.deepEqual(restRemaining(active, 10_000), { remainingMs: 0, paused: false, resting: false })
    assert.deepEqual(restRemaining(active, 12_345), { remainingMs: 0, paused: false, resting: false })
  })

  it('(d) no rest: both fields null → not resting', () => {
    assert.deepEqual(restRemaining({ restEndsAt: null, restPausedRemaining: null }, 5_000), {
      remainingMs: 0,
      paused: false,
      resting: false,
    })
    // and tolerates a missing/absent active workout
    assert.equal(restRemaining(null, 5_000).resting, false)
  })
})

// req-02 / DEC-002 — a no-history exercise carries the entered kg + reps forward.
describe('carriedWorkingSet (req-02 source)', () => {
  it('carries the most recent logged working set', () => {
    const src = carriedWorkingSet([
      { setType: 'work', weight: 40, reps: '10' },
      { setType: 'work', weight: 42.5, reps: '8' },
    ])
    assert.deepEqual({ weight: src.weight, reps: src.reps }, { weight: 42.5, reps: '8' })
  })

  it('nothing logged yet → null (first set is not seeded)', () => {
    assert.equal(carriedWorkingSet([]), null)
    assert.equal(carriedWorkingSet(undefined), null)
  })

  it('skips over a skipped set to the last non-skipped one (failure case)', () => {
    const src = carriedWorkingSet([
      { setType: 'work', weight: 40, reps: '10' },
      { setType: 'work', weight: 0, reps: 'skipped' },
    ])
    assert.deepEqual({ weight: src.weight, reps: src.reps }, { weight: 40, reps: '10' })
  })

  it('all sets skipped → null (falls back to blank/target, never carries "skipped")', () => {
    assert.equal(
      carriedWorkingSet([{ setType: 'work', weight: 0, reps: 'skipped' }]),
      null,
    )
  })
})

describe('setLogSeed (req-02 prefill order)', () => {
  const history = { weight: '', reps: '' }

  // req-108 (DEC-052 amendment) — edited: this asserted kg + reps both carry. Reps no
  // longer carry; the kg half of DEC-002 stands, reps come from the set's own target.
  it('carry (main): no history, weighted → carried kg prefills, reps from the target', () => {
    const seed = setLogSeed({
      weighted: true,
      fromRestore: false,
      restore: null,
      hasHistory: false,
      history,
      carry: { weight: '40', reps: '12' },
      target: '10',
    })
    assert.deepEqual(seed, { weight: '40', reps: '10' })
  })

  // req-108 (DEC-052 amendment) — edited: was "reps carry overrides the per-set target"
  // (asserted reps '8' from the carry). Reversed: the target wins, the carry's reps are ignored.
  it('a carried reps value never overrides the per-set target', () => {
    const seed = setLogSeed({
      weighted: true,
      fromRestore: false,
      restore: null,
      hasHistory: false,
      history,
      carry: { weight: '42.5', reps: '8' },
      target: '10',
    })
    assert.equal(seed.reps, '10')
    assert.equal(seed.weight, '42.5')
  })

  // req-108 acceptance — "Reps separate, no history (unit)".
  it('req-108: no history, carry of 12 reps, target 15 → reps 15; no target → empty; kg still carries', () => {
    const base = { weighted: true, fromRestore: false, restore: null, hasHistory: false, history, carry: { weight: '30', reps: '12' } }
    assert.deepEqual(setLogSeed({ ...base, target: '15' }), { weight: '30', reps: '15' })
    assert.deepEqual(setLogSeed({ ...base, target: '' }), { weight: '30', reps: '' })
    assert.deepEqual(setLogSeed({ ...base, target: undefined }), { weight: '30', reps: '' })
  })

  it('first working set of a no-history exercise: blank kg, target reps', () => {
    const seed = setLogSeed({
      weighted: true,
      fromRestore: false,
      restore: null,
      hasHistory: false,
      history,
      carry: null,
      target: '10',
    })
    assert.deepEqual(seed, { weight: '', reps: '10' })
  })

  it('scope guard: an exercise WITH history uses history weight + target reps, never the carry', () => {
    const seed = setLogSeed({
      weighted: true,
      fromRestore: false,
      restore: null,
      hasHistory: true,
      history: { weight: '60', reps: '5' },
      // a carry is never even computed with history, but assert it is ignored if present
      carry: { weight: '99', reps: '99' },
      target: '5',
    })
    assert.deepEqual(seed, { weight: '60', reps: '5' })
  })

  it('bodyweight (not weighted): kg stays blank even when a carry exists', () => {
    const seed = setLogSeed({
      weighted: false,
      fromRestore: false,
      restore: null,
      hasHistory: false,
      history,
      carry: { weight: '', reps: '12' },
      target: '12',
    })
    assert.deepEqual(seed, { weight: '', reps: '12' })
  })

  it('restore (Previous) wins over any carry', () => {
    const seed = setLogSeed({
      weighted: true,
      fromRestore: true,
      restore: { weight: '35', reps: '9' },
      hasHistory: false,
      history,
      carry: { weight: '40', reps: '10' },
      target: '10',
    })
    assert.deepEqual(seed, { weight: '35', reps: '9' })
  })
})

// req-17 / DEC-021 — the whole live set-log seed (weight, reps, effort, note),
// extracted from WorkoutItemLive so the history-is-truth rule is unit-testable.
describe('initialSetFields (req-17 seed extraction)', () => {
  const history = { weight: '', reps: '' }

  it('no-invent: weighted, NO history, no restore → blank weight, never a guessed kg', () => {
    const fields = initialSetFields({
      weighted: true,
      fromRestore: false,
      restore: null,
      hasHistory: false,
      history,
      carry: null,
      target: '10',
    })
    assert.deepEqual(fields, { weight: '', reps: '10', effort: 3, note: '' })
  })

  it('history prefill (weighted): weight = history-derived kg, effort/note stay at defaults', () => {
    const fields = initialSetFields({
      weighted: true,
      fromRestore: false,
      restore: null,
      hasHistory: true,
      history: { weight: '60', reps: '5' },
      carry: { weight: '99', reps: '99' },
      target: '5',
    })
    assert.deepEqual(fields, { weight: '60', reps: '5', effort: 3, note: '' })
  })

  it('history prefill (bodyweight): weight stays blank, reps from history', () => {
    const fields = initialSetFields({
      weighted: false,
      fromRestore: false,
      restore: null,
      hasHistory: true,
      history: { weight: '60', reps: '12' },
      carry: null,
      target: '12',
    })
    assert.deepEqual(fields, { weight: '', reps: '12', effort: 3, note: '' })
  })

  it('restore wins when fromRestore: weight/reps/effort/note all come from the restore payload', () => {
    const fields = initialSetFields({
      weighted: true,
      fromRestore: true,
      restore: { weight: '35', reps: '9', rpe: '4', note: 'felt strong' },
      hasHistory: true,
      history: { weight: '60', reps: '5' },
      carry: { weight: '40', reps: '10' },
      target: '5',
    })
    assert.deepEqual(fields, { weight: '35', reps: '9', effort: 4, note: 'felt strong' })
  })

  it('empty restore.rpe falls back to the current default effort (3)', () => {
    const fields = initialSetFields({
      weighted: true,
      fromRestore: true,
      restore: { weight: '35', reps: '9', rpe: '', note: '' },
      hasHistory: false,
      history,
      carry: null,
      target: '10',
    })
    assert.equal(fields.effort, 3)
  })

  // Parity: initialSetFields(x) must equal exactly what the old inline expressions
  // in WorkoutItemLive produced. Recompute the pre-req-17 inline path here and
  // assert equality over representative inputs, so a future edit that changes the
  // seed is caught as a parity break, not a silent behaviour change.
  it('parity with the old inline WorkoutItemLive expressions', () => {
    const oldInline = ({ weighted, fromRestore, restore, hasHistory, history, carry, target }) => {
      const seed = setLogSeed({ weighted, fromRestore, restore, hasHistory, history, carry, target })
      const initialEffort =
        fromRestore && restore.rpe != null && restore.rpe !== ''
          ? rpeOptionValue(restore.rpe) || restore.rpe
          : 3
      const initialNote = fromRestore ? restore.note : ''
      return { weight: seed.weight, reps: seed.reps, effort: initialEffort, note: initialNote }
    }
    const cases = [
      // no-history, weighted, first set: blank kg, target reps, default effort
      { weighted: true, fromRestore: false, restore: null, hasHistory: false, history, carry: null, target: '10' },
      // has-history, weighted: history weight, target reps
      { weighted: true, fromRestore: false, restore: null, hasHistory: true, history: { weight: '60', reps: '5' }, carry: null, target: '5' },
      // fromRestore with a real rpe + note: everything from restore
      { weighted: true, fromRestore: true, restore: { weight: '35', reps: '9', rpe: '5', note: 'x' }, hasHistory: false, history, carry: { weight: '40', reps: '10' }, target: '10' },
    ]
    for (const input of cases) {
      assert.deepEqual(initialSetFields(input), oldInline(input))
    }
  })

  // req-78 (D1) — the req-27 `weightOverride` param and the `pendingWeightFor` helper
  // were removed: the next set's log form is now the always-present editable surface
  // during rest, so there is no separate upcoming-weight override to seed or scope.
  // Their test blocks (weightOverride cases + the pendingWeightFor describe) are
  // removed with them; the remaining initialSetFields cases above still lock the
  // restore/carry/history seed (the no-invent rule) that survives the fold.
})

// req-83 (N9) — a value changed mid-workout seeds this exercise's remaining sets
// this session (live/session only; never the routine template, never history).
describe('req-83 seedOverrideKey (per exercise + set kind)', () => {
  it('separates warm-up from working and one exercise from another', () => {
    assert.equal(seedOverrideKey('ex1', 'wu'), 'ex1::wu')
    assert.equal(seedOverrideKey('ex1', 'work'), 'ex1::work')
    assert.notEqual(seedOverrideKey('ex1', 'work'), seedOverrideKey('ex2', 'work'))
    // any non-'wu' setType folds to 'work'
    assert.equal(seedOverrideKey('ex1', undefined), 'ex1::work')
  })
})

describe('req-83 setLogSeed override (live carry of a changed field)', () => {
  const history = { weight: '4', reps: '8' }

  it('weight override replaces the history/target weight; reps untouched', () => {
    const seed = setLogSeed({
      weighted: true,
      fromRestore: false,
      restore: null,
      hasHistory: true,
      history,
      carry: null,
      target: '8',
      override: { weight: '5' },
    })
    assert.deepEqual(seed, { weight: '5', reps: '8' })
  })

  // req-108 (DEC-052) — edited: was "reps override replaces the target" (asserted reps
  // '6'). Reversed: a reps value on the override (a stale one, stored before req-108)
  // is ignored — the target wins — and weight is still untouched.
  it('failure case — a stale reps override is ignored: reps come from the target', () => {
    const seed = setLogSeed({
      weighted: true,
      fromRestore: false,
      restore: null,
      hasHistory: true,
      history,
      carry: null,
      target: '8',
      override: { reps: '6' },
    })
    assert.deepEqual(seed, { weight: '4', reps: '8' })
  })

  it('req-108: a stale override holding weight AND reps → weight carries, reps from the target', () => {
    const seed = setLogSeed({
      weighted: true,
      fromRestore: false,
      restore: null,
      hasHistory: true,
      history,
      carry: null,
      target: '8',
      override: { weight: '5', reps: '6' },
    })
    assert.deepEqual(seed, { weight: '5', reps: '8' })
  })

  it('no override → identical to the pre-req-83 seed', () => {
    const base = { weighted: true, fromRestore: false, restore: null, hasHistory: true, history, carry: null, target: '8' }
    assert.deepEqual(setLogSeed(base), setLogSeed({ ...base, override: undefined }))
    assert.deepEqual(setLogSeed(base), { weight: '4', reps: '8' })
  })

  it('restore (Previous) still wins over an override', () => {
    const seed = setLogSeed({
      weighted: true,
      fromRestore: true,
      restore: { weight: '99', reps: '99' },
      hasHistory: true,
      history,
      carry: null,
      target: '8',
      override: { weight: '5', reps: '6' },
    })
    assert.deepEqual(seed, { weight: '99', reps: '99' })
  })

  // req-108 — edited: expected reps '6' (the override's); now the target '8'.
  it('a weight override never lands on a bodyweight (not weighted) set', () => {
    const seed = setLogSeed({
      weighted: false,
      fromRestore: false,
      restore: null,
      hasHistory: true,
      history,
      carry: null,
      target: '8',
      override: { weight: '5', reps: '6' },
    })
    assert.deepEqual(seed, { weight: '', reps: '8' })
  })
})

describe('req-83 nextSeedOverrides (only a changed field propagates)', () => {
  const at = (exerciseId, setType, weighted, seed, logged) =>
    nextSeedOverrides({}, { exerciseId, setType, weighted, seed, logged })

  it('changing only weight records weight, not reps', () => {
    const next = at('ex1', 'work', true, { weight: '4', reps: '8' }, { weight: '5', reps: '8' })
    assert.deepEqual(next, { 'ex1::work': { weight: '5' } })
  })

  // req-108 (DEC-052) — edited: was "changing only reps records reps" (asserted
  // { reps: '6' }). Reversed: a reps change records nothing, and returns the SAME map.
  it('changing only reps records nothing (reps do not carry)', () => {
    const map = {}
    const next = nextSeedOverrides(map, {
      exerciseId: 'ex1', setType: 'work', weighted: true,
      seed: { weight: '4', reps: '8' }, logged: { weight: '4', reps: '6' },
    })
    assert.equal(next, map)
  })

  it('req-108: changing weight AND reps records only the weight', () => {
    const next = at('ex1', 'work', true, { weight: '20', reps: '8' }, { weight: '22', reps: '6' })
    assert.deepEqual(next, { 'ex1::work': { weight: '22' } })
  })

  it('req-108: a stale stored reps override is passed through untouched, never rewritten', () => {
    const map = { 'ex1::work': { weight: '5', reps: '6' } }
    assert.equal(
      nextSeedOverrides(map, {
        exerciseId: 'ex1', setType: 'work', weighted: true,
        seed: { weight: '5', reps: '8' }, logged: { weight: '5', reps: '7' },
      }),
      map,
    )
    const next = nextSeedOverrides(map, {
      exerciseId: 'ex1', setType: 'work', weighted: true,
      seed: { weight: '5', reps: '8' }, logged: { weight: '6', reps: '8' },
    })
    assert.deepEqual(next, { 'ex1::work': { weight: '6', reps: '6' } })
  })

  it('logging the seed unchanged records nothing and returns the SAME map', () => {
    const map = { 'ex1::work': { weight: '5' } }
    const next = nextSeedOverrides(map, {
      exerciseId: 'ex1', setType: 'work', weighted: true,
      seed: { weight: '5', reps: '8' }, logged: { weight: '5', reps: '8' },
    })
    assert.equal(next, map) // identity — no needless write
  })

  it('numeric equality: 5 vs "5.0" is not a change', () => {
    const next = at('ex1', 'work', true, { weight: '5', reps: '8' }, { weight: '5.0', reps: '8' })
    assert.deepEqual(next, {})
  })

  it('a weight change on a bodyweight (not weighted) set is ignored', () => {
    const next = at('ex1', 'work', false, { weight: '', reps: '8' }, { weight: '5', reps: '8' })
    assert.deepEqual(next, {})
  })

  it('a warm-up change and a working change live under separate keys (no wu→work leak)', () => {
    let map = nextSeedOverrides({}, {
      exerciseId: 'ex1', setType: 'wu', weighted: true,
      seed: { weight: '4', reps: '10' }, logged: { weight: '5', reps: '10' },
    })
    assert.deepEqual(map, { 'ex1::wu': { weight: '5' } })
    map = nextSeedOverrides(map, {
      exerciseId: 'ex1', setType: 'work', weighted: true,
      seed: { weight: '20', reps: '8' }, logged: { weight: '22.5', reps: '8' },
    })
    assert.deepEqual(map, { 'ex1::wu': { weight: '5' }, 'ex1::work': { weight: '22.5' } })
  })

  it('never crosses to another exercise', () => {
    const map = { 'ex1::work': { weight: '5' } }
    const next = nextSeedOverrides(map, {
      exerciseId: 'ex2', setType: 'work', weighted: true,
      seed: { weight: '10', reps: '8' }, logged: { weight: '12', reps: '8' },
    })
    assert.deepEqual(next['ex1::work'], { weight: '5' }) // ex1 untouched
    assert.deepEqual(next['ex2::work'], { weight: '12' })
  })

  it('changing a field again overrides the prior override ("until changed again")', () => {
    const map = { 'ex1::work': { weight: '5' } }
    // the form now presents weight 5 (the override); the user changes it to 6
    const next = nextSeedOverrides(map, {
      exerciseId: 'ex1', setType: 'work', weighted: true,
      seed: { weight: '5', reps: '8' }, logged: { weight: '6', reps: '8' },
    })
    assert.deepEqual(next, { 'ex1::work': { weight: '6' } })
  })
})

// req-108 (DEC-052 + amendment) — the whole per-set loop, driven through the real
// seed → log → nextSeedOverrides → next seed path: weight carries, reps never do.
describe('req-108 per-set reps (weight carries, reps stay per set)', () => {
  const item = { exerciseId: 'ex1', sets: 3, targets: ['10', '8', '6'] }
  // Runs the sets in order, logging `logs[i]` on set i, and returns each set's seed.
  function run({ hasHistory, historyFor, logs, weighted = true }) {
    let overrides = {}
    const logged = []
    const seeds = []
    for (let i = 0; i < logs.length + 1 && i < 3; i++) {
      const src = carriedWorkingSet(logged)
      // the pre-req-108 carry shape (kg + reps), to prove setLogSeed ignores its reps
      const carry = !hasHistory && src ? { weight: String(src.weight || ''), reps: String(src.reps) } : null
      const seed = initialSetFields({
        weighted,
        fromRestore: false,
        restore: null,
        hasHistory,
        history: historyFor(i),
        carry,
        target: setTargetFor(item, 'work', i),
        override: overrides[seedOverrideKey('ex1', 'work')],
      })
      seeds.push(seed)
      if (i >= logs.length) break
      const entry = { weight: logs[i].weight ?? seed.weight, reps: logs[i].reps ?? seed.reps }
      overrides = nextSeedOverrides(overrides, { exerciseId: 'ex1', setType: 'work', weighted, seed, logged: entry })
      logged.push({ setType: 'work', ...entry })
    }
    return seeds
  }
  const withHistory = (i) => ({ weight: ['20', '20', '20'][i], reps: '' })
  const noHistory = () => ({ weight: '', reps: '' })

  it('targets 10/8/6, set 1 logged with 9 → set 2 seeds 8, set 3 seeds 6 (with history)', () => {
    const seeds = run({ hasHistory: true, historyFor: withHistory, logs: [{ reps: '9' }, {}] })
    assert.deepEqual(seeds.map((x) => x.reps), ['10', '8', '6'])
  })

  it('targets 10/8/6, set 1 logged with 9 → set 2 seeds 8, set 3 seeds 6 (no history)', () => {
    const seeds = run({ hasHistory: false, historyFor: noHistory, logs: [{ weight: '30', reps: '9' }, {}] })
    assert.deepEqual(seeds.map((x) => x.reps), ['10', '8', '6'])
    assert.deepEqual(seeds.map((x) => x.weight), ['', '30', '30']) // DEC-002 kg carry stands
  })

  it('with history, 20→22 kg on set 1 → set 2 prefills 22 kg from seedOverrides, reps = its target', () => {
    const seeds = run({ hasHistory: true, historyFor: withHistory, logs: [{ weight: '22' }] })
    assert.deepEqual(seeds[1], { weight: '22', reps: '8', effort: 3, note: '' })
  })

  it('bodyweight (push-ups), targets 15/15/15, set 1 logged 12 → set 2 prefills 15', () => {
    const pushups = { exerciseId: 'ex1', sets: 3, targets: ['15', '15', '15'] }
    let overrides = {}
    const base = { weighted: false, fromRestore: false, restore: null, hasHistory: true, history: { weight: '', reps: '15' }, carry: null }
    const seed1 = initialSetFields({ ...base, target: setTargetFor(pushups, 'work', 0), override: undefined })
    overrides = nextSeedOverrides(overrides, { exerciseId: 'ex1', setType: 'work', weighted: false, seed: seed1, logged: { weight: '', reps: '12' } })
    const seed2 = initialSetFields({ ...base, target: setTargetFor(pushups, 'work', 1), override: overrides['ex1::work'] })
    assert.equal(seed2.reps, '15')
  })
})

// req-106 — the start-of-exercise preview. Uses the REAL history path
// (lastSetsForExercise + historySetPrefill from storage.js), the same the view binds.
describe('req-106 setPreview (start-of-exercise set preview)', () => {
  const finished = (sets, finishedAt = '2026-09-20T10:00:00Z') => ({ finishedAt, sets })
  const hist = (exerciseId, rows) =>
    rows.map(([setType, weight, reps]) => ({ exerciseId, setType, weight, reps }))
  const odp = {
    exerciseId: 'odp',
    routineItemId: 'ri-odp',
    sets: 3,
    warmup: { reps: 10 },
    targets: ['8', '8', '6'],
  }
  const workouts = [
    finished(hist('odp', [['wu', 10, '10'], ['work', 20, '8'], ['work', 22, '8'], ['work', 24, '6']])),
  ]
  function previewFor(item, { workouts: ws = workouts, ex = {}, weighted = true, seedOverrides } = {}) {
    const last = lastSetsForExercise(ws, item.exerciseId)
    return setPreview({
      item,
      ex,
      weighted,
      hasHistory: Boolean(last),
      historyFor: (at) => historySetPrefill(last, at),
      seedOverrides,
    })
  }

  it('fixed numbers: WU 10×10, work 20×8 / 22×8 / 24×6 → exact lines', () => {
    assert.deepEqual(
      previewFor(odp).map((line) => line.text),
      ['WU · 10 kg × 10', '1 · 20 kg × 8', '2 · 22 kg × 8', '3 · 24 kg × 6'],
    )
  })

  it('right mechanism: each line equals initialSetFields for that set', () => {
    const last = lastSetsForExercise(workouts, 'odp')
    const lines = previewFor(odp)
    const slots = [['wu', 0], ['work', 0], ['work', 1], ['work', 2]]
    assert.equal(lines.length, slots.length)
    slots.forEach(([setType, workIndex], i) => {
      const form = initialSetFields({
        weighted: true,
        fromRestore: false,
        restore: null,
        hasHistory: true,
        history: historySetPrefill(last, { setType, workIndex }),
        carry: null,
        target: setTargetFor(odp, setType, workIndex),
        override: undefined,
      })
      assert.equal(lines[i].setType, setType)
      assert.equal(lines[i].weight, form.weight)
      assert.equal(lines[i].reps, form.reps)
    })
  })

  it('failure case — no finished history: no kg on any line, reps from targets', () => {
    const lines = previewFor(odp, { workouts: [] })
    assert.deepEqual(lines.map((line) => line.weight), ['', '', '', ''])
    assert.deepEqual(lines.map((line) => line.reps), ['10', '8', '8', '6'])
    assert.deepEqual(
      lines.map((line) => line.text),
      ['WU · — × 10', '1 · — × 8', '2 · — × 8', '3 · — × 6'],
    )
  })

  it('an unfinished workout is not history (no kg)', () => {
    const lines = previewFor(odp, { workouts: [{ sets: workouts[0].sets }] })
    assert.ok(lines.every((line) => line.weight === ''))
  })

  it('a set beyond the history has no kg — never copied from an earlier set', () => {
    const lines = previewFor({ ...odp, sets: 4, targets: ['8', '8', '6', '6'] })
    assert.equal(lines[4].text, '4 · — × 6')
  })

  it('a session seed override from an earlier item of the same exercise shows, as the form would', () => {
    const lines = previewFor(odp, { seedOverrides: { 'odp::work': { weight: '26' }, 'other::work': { weight: '99' } } })
    assert.deepEqual(
      lines.map((line) => line.text),
      ['WU · 10 kg × 10', '1 · 26 kg × 8', '2 · 26 kg × 8', '3 · 26 kg × 6'],
    )
  })

  // req-108 acceptance — "Preview consistent": with a weight override (and a stale reps
  // one), each line still equals initialSetFields for that set — weight from the
  // override, reps from the set's own target.
  it('req-108: with seedOverrides[k].weight (+ a stale reps), each line equals initialSetFields', () => {
    const seedOverrides = { 'odp::work': { weight: '26', reps: '3' } }
    const last = lastSetsForExercise(workouts, 'odp')
    const lines = previewFor(odp, { seedOverrides })
    const slots = [['wu', 0], ['work', 0], ['work', 1], ['work', 2]]
    slots.forEach(([setType, workIndex], i) => {
      const form = initialSetFields({
        weighted: true,
        fromRestore: false,
        restore: null,
        hasHistory: true,
        history: historySetPrefill(last, { setType, workIndex }),
        carry: null,
        target: setTargetFor(odp, setType, workIndex),
        override: seedOverrides[seedOverrideKey('odp', setType)],
      })
      assert.equal(lines[i].weight, form.weight)
      assert.equal(lines[i].reps, form.reps)
    })
    assert.deepEqual(lines.map((line) => line.text), ['WU · 10 kg × 10', '1 · 26 kg × 8', '2 · 26 kg × 8', '3 · 26 kg × 6'])
  })

  it('no warm-up → work lines only', () => {
    const lines = previewFor({ ...odp, warmup: null })
    assert.deepEqual(lines.map((line) => line.label), ['1', '2', '3'])
  })

  it('bodyweight: reps only, never a kg (even with a weight in history)', () => {
    const pushups = { exerciseId: 'pu', sets: 2, targets: ['12', '10'] }
    const ws = [finished(hist('pu', [['work', 5, '12'], ['work', 5, '10']]))]
    const lines = previewFor(pushups, { workouts: ws, weighted: false })
    assert.deepEqual(lines.map((line) => line.text), ['1 · 12', '2 · 10'])
    assert.ok(lines.every((line) => line.weight === ''))
  })

  it('timed: work sets show the duration (per-set, then last in list); the WU stays reps', () => {
    const plank = { exerciseId: 'pl', sets: 3, warmup: { reps: 5 }, targets: ['', '', ''], durations: [45, 60] }
    const lines = previewFor(plank, { workouts: [], weighted: false, ex: { hasDuration: true, durationSec: 20 } })
    assert.deepEqual(lines.map((line) => line.text), ['WU · 5', '1 · 45s', '2 · 60s', '3 · 60s'])
    assert.deepEqual(lines.map((line) => line.durationSec), [null, 45, 60, 60])
  })
})

describe('req-106 durationTargetFor / setTargetFor (moved out of item.jsx)', () => {
  it('duration: per-set → last in list → exercise default → app default', () => {
    assert.equal(durationTargetFor({ durations: [40, 50] }, { durationSec: 20 }, 0), 40)
    assert.equal(durationTargetFor({ durations: [40, 50] }, { durationSec: 20 }, 5), 50)
    assert.equal(durationTargetFor({ durations: [] }, { durationSec: 20 }, 0), 20)
    assert.equal(durationTargetFor({}, {}, 0), DEFAULT_DURATION_SEC)
  })
  it('target: WU reps for wu; per-set → last target → empty for work', () => {
    const item = { warmup: { reps: 10 }, targets: ['8', '6'] }
    assert.equal(setTargetFor(item, 'wu', 0), '10')
    assert.equal(setTargetFor(item, 'work', 1), '6')
    assert.equal(setTargetFor(item, 'work', 4), '6')
    assert.equal(setTargetFor({}, 'work', 0), '')
    assert.equal(setTargetFor({}, 'wu', 0), '')
  })
  it('setPreviewText shows the kg slot as absent, never 0', () => {
    assert.equal(setPreviewText({ label: '1', weight: '', reps: '8', durationSec: null }, true), '1 · — × 8')
    assert.equal(setPreviewText({ label: '1', weight: '20', reps: '', durationSec: null }, true), '1 · 20 kg × —')
  })
})
