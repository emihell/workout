import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { rpeOptionValue } from './ids.js'
import {
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
  pendingWeightFor,
} from './workout-log.js'

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

  it('carry (main): no history, weighted → carried kg + reps both prefill', () => {
    const seed = setLogSeed({
      weighted: true,
      fromRestore: false,
      restore: null,
      hasHistory: false,
      history,
      carry: { weight: '40', reps: '10' },
      target: '10',
    })
    assert.deepEqual(seed, { weight: '40', reps: '10' })
  })

  it('reps carry overrides the per-set target', () => {
    const seed = setLogSeed({
      weighted: true,
      fromRestore: false,
      restore: null,
      hasHistory: false,
      history,
      carry: { weight: '42.5', reps: '8' },
      target: '10',
    })
    assert.equal(seed.reps, '8')
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

  // req-27 — an upcoming-weight edit made during rest overrides the seed weight for
  // that one set only. Weight-only, never on a restore, never inventing on no-history.
  describe('weightOverride (req-27 upcoming edit)', () => {
    it('overrides the computed history weight (weighted, not restore)', () => {
      const fields = initialSetFields({
        weighted: true,
        fromRestore: false,
        restore: null,
        hasHistory: true,
        history: { weight: '60', reps: '5' },
        carry: null,
        target: '5',
        weightOverride: '65',
      })
      assert.deepEqual(fields, { weight: '65', reps: '5', effort: 3, note: '' })
    })

    it('an explicit blank override ("") blanks the weight (distinct from null = no edit)', () => {
      const fields = initialSetFields({
        weighted: true,
        fromRestore: false,
        restore: null,
        hasHistory: true,
        history: { weight: '60', reps: '5' },
        carry: null,
        target: '5',
        weightOverride: '',
      })
      assert.equal(fields.weight, '')
    })

    it('no-invent: null override leaves a no-history blank weight blank', () => {
      const fields = initialSetFields({
        weighted: true,
        fromRestore: false,
        restore: null,
        hasHistory: false,
        history: { weight: '', reps: '' },
        carry: null,
        target: '10',
        weightOverride: null,
      })
      assert.equal(fields.weight, '')
    })

    it('ignored on a restore (Previous re-log wins over a stale upcoming edit)', () => {
      const fields = initialSetFields({
        weighted: true,
        fromRestore: true,
        restore: { weight: '35', reps: '9', rpe: '4', note: '' },
        hasHistory: true,
        history: { weight: '60', reps: '5' },
        carry: null,
        target: '5',
        weightOverride: '99',
      })
      assert.equal(fields.weight, '35')
    })

    it('ignored when the exercise is not weighted (weight stays blank)', () => {
      const fields = initialSetFields({
        weighted: false,
        fromRestore: false,
        restore: null,
        hasHistory: true,
        history: { weight: '60', reps: '12' },
        carry: null,
        target: '12',
        weightOverride: '80',
      })
      assert.equal(fields.weight, '')
    })
  })
})

// req-27 — the pending upcoming-weight override is scoped to one { itemId, workIndex }
// so an edit can only ever pre-fill that exact set — never another set or exercise.
describe('pendingWeightFor (req-27 override scope)', () => {
  const pending = { itemId: 'si-row', workIndex: 1, weight: '42.5' }

  it('returns the weight when itemId and workIndex both match', () => {
    assert.equal(pendingWeightFor(pending, { itemId: 'si-row', workIndex: 1 }), '42.5')
  })

  it('does not leak to another exercise (itemId mismatch → null)', () => {
    assert.equal(pendingWeightFor(pending, { itemId: 'si-press', workIndex: 1 }), null)
  })

  it('does not leak to another set of the same exercise (workIndex mismatch → null)', () => {
    assert.equal(pendingWeightFor(pending, { itemId: 'si-row', workIndex: 2 }), null)
  })

  it('no pending override → null', () => {
    assert.equal(pendingWeightFor(null, { itemId: 'si-row', workIndex: 1 }), null)
    assert.equal(pendingWeightFor(undefined, { itemId: 'si-row', workIndex: 1 }), null)
  })

  it('an explicit blank override is preserved as "" (not collapsed to null)', () => {
    const blank = { itemId: 'si-row', workIndex: 1, weight: '' }
    assert.equal(pendingWeightFor(blank, { itemId: 'si-row', workIndex: 1 }), '')
  })
})
