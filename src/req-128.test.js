// req-128 — five small fixes: History detail role labels (req-93 rule), the summary's
// prior skips an all-skipped workout, historyPrescription's rest/notes skip a req-109
// replacement item, and wake-lock only on a /workout/… route. Item 5 (dead-code
// removal) is checked statically by grep, so no test names the removed functions.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { historyPrescription, summaryPriorWorkout, workoutSummaryStats } from './storage.js'
import { historyGroupMeta } from './views/history/helpers.js'
import { wakeLockWanted } from './wake-lock.js'

describe('req-128 1: History detail row meta follows the req-93 rule', () => {
  it('main / absent role is unlabelled', () => {
    assert.equal(historyGroupMeta({ role: 'main' }, 3), '3 sets')
    assert.equal(historyGroupMeta({}, 1), '1 set')
    assert.equal(historyGroupMeta(null, 2), '2 sets')
    assert.doesNotMatch(historyGroupMeta({ role: 'main', warmup: true }, 3), /Main/)
  })
  it('warm-up / finisher / cardio carry their tag; WU set marker kept', () => {
    assert.equal(historyGroupMeta({ role: 'warmup' }, 2), 'Warm-up · 2 sets')
    assert.equal(historyGroupMeta({ role: 'finisher', warmup: true }, 1), 'Finisher · Warm-up set · 1 set')
    assert.equal(historyGroupMeta({ role: 'cardio' }, 1), 'Cardio · 1 set')
    assert.equal(historyGroupMeta({ role: 'main', warmup: true }, 4), 'Warm-up set · 4 sets')
  })
})

describe('req-128 2: the summary compares against the latest prior with anything logged', () => {
  const wk = (id, sets, finishedAt) => ({
    id,
    routineId: 'r1',
    snapshot: { routineId: 'r1', routineName: 'Push' },
    startedAt: '2026-09-01T10:00:00Z',
    finishedAt,
    sets,
  })
  const active = { ...wk('active', [{ exerciseId: 'b', weight: 100, reps: 5 }]), finishedAt: undefined }
  const skipped = wk('w3', [{ exerciseId: 'b', reps: 'skipped' }, { exerciseId: 'b', reps: 'skipped' }], '2026-09-03T11:00:00Z')
  const logged = wk('w2', [{ exerciseId: 'b', weight: 80, reps: 5 }, { exerciseId: 'b', weight: 80, reps: 5 }], '2026-09-02T11:00:00Z')

  it('prior all-skipped, the one before logged → deltas vs the logged one', () => {
    const prior = summaryPriorWorkout(active, [skipped, logged], [])
    assert.equal(prior.id, 'w2')
    const s = workoutSummaryStats(active, prior, Date.now())
    assert.equal(s.deltas.volume, 500 - 800)
    assert.equal(s.deltas.sets, 1 - 2)
  })
  it('only all-skipped priors → null prior → no deltas', () => {
    const prior = summaryPriorWorkout(active, [skipped], [])
    assert.equal(prior, null)
    assert.equal(workoutSummaryStats(active, prior, Date.now()).deltas, null)
  })
})

describe('req-128 3: historyPrescription reads rest/notes from the routine item, not a replacement', () => {
  const done = (items) => [
    {
      id: 'w1',
      finishedAt: '2026-09-02T11:00:00Z',
      snapshot: { items },
      sets: [
        { exerciseId: 'row', routineItemId: 'rep-1', weight: 50, reps: 8 },
        { exerciseId: 'row', routineItemId: 'it-row', weight: 60, reps: 10 },
      ],
    },
  ]
  it('replacement BEFORE the routine item → rest and notes are the routine item’s', () => {
    const items = [
      { id: 'rep-1', routineItemId: 'rep-1', exerciseId: 'row', restSec: 0, notes: '', addedMidWorkout: true },
      { id: 'it-row', routineItemId: 'it-row', exerciseId: 'row', restSec: 120, notes: 'Pause at top' },
    ]
    const p = historyPrescription(done(items), 'row')
    assert.equal(p.restSec, 120)
    assert.equal(p.notes, 'Pause at top')
  })
  it('only a replacement item → falls back to it (the first match)', () => {
    const items = [{ id: 'rep-1', exerciseId: 'row', restSec: 45, notes: 'x', addedMidWorkout: true }]
    const p = historyPrescription(done(items), 'row')
    assert.equal(p.restSec, 45)
    assert.equal(p.notes, 'x')
  })
})

describe('req-128 4: wake-lock predicate — active workout AND a /workout/… route', () => {
  const active = { occurrenceId: 'w1' }
  it('active + /settings → false', () => assert.equal(wakeLockWanted(active, '#/settings'), false))
  it('active + /workout/r → true', () => {
    assert.equal(wakeLockWanted(active, '#/workout/r'), true)
    assert.equal(wakeLockWanted(active, '#/workout/r/item/i1/log'), true)
  })
  it('no active workout → false', () => {
    assert.equal(wakeLockWanted(null, '#/workout/r'), false)
    assert.equal(wakeLockWanted(undefined, '#/workout/r'), false)
  })
  it('active + Today / History / no hash → false', () => {
    assert.equal(wakeLockWanted(active, '#/'), false)
    assert.equal(wakeLockWanted(active, '#/history/w1'), false)
    assert.equal(wakeLockWanted(active, ''), false)
  })
})
