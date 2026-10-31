// req-276 — split from workout-log.test.js: the tests of set-seed.js.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { rpeOptionValue } from './ids.js'
import {
  carriedWorkingSet,
  setLogSeed,
  initialSetFields,
  seedOverrideKey,
  nextSeedOverrides,
  setTargetFor,
  durationTargetFor,
} from './set-seed.js'
import { setPreviewText } from './set-display.js'
import { DEFAULT_DURATION_SEC } from './model.js'

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
  // req-191 (DEC-107 §2 amends DEC-052 for the no-target case; flagged in reports/req-191.md) —
  // with a target the target still wins (req-108's case, unchanged); with NO target the carry's
  // reps now prefill (was ''). A carry without reps still gives ''.
  it('req-108 + req-191: carry of 12 reps, target 15 → reps 15; no target → the carried 12; kg still carries', () => {
    const base = { weighted: true, fromRestore: false, restore: null, hasHistory: false, history, carry: { weight: '30', reps: '12' } }
    assert.deepEqual(setLogSeed({ ...base, target: '15' }), { weight: '30', reps: '15' })
    assert.deepEqual(setLogSeed({ ...base, target: '' }), { weight: '30', reps: '12' })
    assert.deepEqual(setLogSeed({ ...base, target: undefined }), { weight: '30', reps: '12' })
    assert.deepEqual(setLogSeed({ ...base, carry: { weight: '30' }, target: '' }), { weight: '30', reps: '' })
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
