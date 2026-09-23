import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { beatLastTimeWins, beatLastTimeLine } from './beat-last-time.js'

// Build a workout from a compact spec. `items` is [{ id, type }] (display order);
// `sets` is [{ ex, weight?, reps?, durationSec?, setType? }].
function workout(items, sets) {
  return {
    snapshot: { items: items.map(({ id, type, name }) => ({ exerciseId: id, exerciseType: type, exerciseName: name || id })) },
    sets: sets.map(({ ex, ...rest }) => ({ exerciseId: ex, ...rest })),
  }
}

const WEIGHTED = [{ id: 'bench', type: 'free', name: 'Bench press' }]
const BODY = [{ id: 'pullup', type: 'bodyweight', name: 'Pull-ups' }]
const TIMED = [{ id: 'plank', type: 'bodyweight', name: 'Plank' }]

describe('req-96 beatLastTimeWins — weighted axis', () => {
  it('fires when today is heavier (heavier)', () => {
    const prev = workout(WEIGHTED, [{ ex: 'bench', weight: 60, reps: 8 }])
    const cur = workout(WEIGHTED, [{ ex: 'bench', weight: 65, reps: 6 }])
    assert.deepEqual(beatLastTimeWins(cur, prev).map((w) => w.kind), ['heavier'])
  })

  it('fires when same top weight but more reps (more-reps)', () => {
    const prev = workout(WEIGHTED, [{ ex: 'bench', weight: 60, reps: 8 }])
    const cur = workout(WEIGHTED, [{ ex: 'bench', weight: 60, reps: 10 }])
    assert.deepEqual(beatLastTimeWins(cur, prev).map((w) => w.kind), ['more-reps'])
  })

  it('does NOT fire for more reps at a LIGHTER weight (weighted rule)', () => {
    const prev = workout(WEIGHTED, [{ ex: 'bench', weight: 60, reps: 8 }])
    const cur = workout(WEIGHTED, [{ ex: 'bench', weight: 55, reps: 20 }])
    assert.deepEqual(beatLastTimeWins(cur, prev), [])
  })

  it('is silent on an identical workout', () => {
    const prev = workout(WEIGHTED, [{ ex: 'bench', weight: 60, reps: 8 }])
    const cur = workout(WEIGHTED, [{ ex: 'bench', weight: 60, reps: 8 }])
    assert.deepEqual(beatLastTimeWins(cur, prev), [])
  })

  it('excludes warm-up sets from the best set (both sides)', () => {
    // A heavy warm-up must not count; the working top set is what's compared.
    const prev = workout(WEIGHTED, [{ ex: 'bench', weight: 60, reps: 8 }])
    const cur = workout(WEIGHTED, [
      { ex: 'bench', weight: 100, reps: 3, setType: 'wu' },
      { ex: 'bench', weight: 60, reps: 8 },
    ])
    assert.deepEqual(beatLastTimeWins(cur, prev), [])
  })
})

describe('req-96 beatLastTimeWins — bodyweight / reps axis', () => {
  it('fires on more reps', () => {
    const prev = workout(BODY, [{ ex: 'pullup', reps: 8 }])
    const cur = workout(BODY, [{ ex: 'pullup', reps: 10 }])
    assert.deepEqual(beatLastTimeWins(cur, prev).map((w) => w.kind), ['more-reps'])
  })

  it('is silent on fewer reps', () => {
    const prev = workout(BODY, [{ ex: 'pullup', reps: 10 }])
    const cur = workout(BODY, [{ ex: 'pullup', reps: 8 }])
    assert.deepEqual(beatLastTimeWins(cur, prev), [])
  })

  it('treats non-numeric reps (AMRAP) as no data, not a win', () => {
    const prev = workout(BODY, [{ ex: 'pullup', reps: 10 }])
    const cur = workout(BODY, [{ ex: 'pullup', reps: 'AMRAP' }])
    assert.deepEqual(beatLastTimeWins(cur, prev), [])
  })
})

describe('req-96 beatLastTimeWins — timed axis', () => {
  it('fires on a longer hold (75s vs 60s)', () => {
    const prev = workout(TIMED, [{ ex: 'plank', durationSec: 60 }])
    const cur = workout(TIMED, [{ ex: 'plank', durationSec: 75 }])
    assert.deepEqual(beatLastTimeWins(cur, prev).map((w) => w.kind), ['longer'])
  })

  it('is silent on a shorter/equal hold', () => {
    const prev = workout(TIMED, [{ ex: 'plank', durationSec: 60 }])
    const cur = workout(TIMED, [{ ex: 'plank', durationSec: 60 }])
    assert.deepEqual(beatLastTimeWins(cur, prev), [])
  })

  it('req-98 — no win when the prior has no duration (newly-flagged timed exercise)', () => {
    // Transitional: the exercise was just flagged Timed, so today has a real durationSec
    // but the prior same-routine workout was logged the old way (free-text reps, no
    // durationSec). No comparable prior → silent, not a bogus "↑ Longer".
    const prev = workout(TIMED, [{ ex: 'plank', reps: '60s' }])
    const cur = workout(TIMED, [{ ex: 'plank', durationSec: 75 }])
    assert.deepEqual(beatLastTimeWins(cur, prev), [])
  })
})

describe('req-96 beatLastTimeWins — no-invent guardrails', () => {
  it('no prior workout → nothing', () => {
    const cur = workout(WEIGHTED, [{ ex: 'bench', weight: 60, reps: 8 }])
    assert.deepEqual(beatLastTimeWins(cur, null), [])
  })

  it('a newly-added exercise (no match in prior) contributes no win', () => {
    const prev = workout(WEIGHTED, [{ ex: 'bench', weight: 60, reps: 8 }])
    const cur = workout(
      [{ id: 'bench', type: 'free' }, { id: 'rows', type: 'free', name: 'Rows' }],
      [
        { ex: 'bench', weight: 60, reps: 8 }, // unchanged
        { ex: 'rows', weight: 999, reps: 99 }, // new, no prior → not a win
      ],
    )
    assert.deepEqual(beatLastTimeWins(cur, prev), [])
  })
})

describe('req-96 per-exercise, not aggregate', () => {
  it('fires on one improved exercise even while another regresses', () => {
    const items = [{ id: 'bench', type: 'free', name: 'Bench press' }, { id: 'squat', type: 'free', name: 'Squat' }]
    const prev = workout(items, [
      { ex: 'bench', weight: 60, reps: 8 },
      { ex: 'squat', weight: 100, reps: 5 },
    ])
    const cur = workout(items, [
      { ex: 'bench', weight: 65, reps: 8 }, // up
      { ex: 'squat', weight: 90, reps: 5 }, // down — must NOT suppress
    ])
    const wins = beatLastTimeWins(cur, prev)
    assert.deepEqual(wins.map((w) => w.kind), ['heavier'])
    assert.equal(wins[0].name, 'Bench press')
  })

  it('reports multiple wins in workout order', () => {
    const items = [{ id: 'bench', type: 'free', name: 'Bench press' }, { id: 'pullup', type: 'bodyweight', name: 'Pull-ups' }]
    const prev = workout(items, [
      { ex: 'bench', weight: 60, reps: 8 },
      { ex: 'pullup', reps: 8 },
    ])
    const cur = workout(items, [
      { ex: 'bench', weight: 62, reps: 8 },
      { ex: 'pullup', reps: 10 },
    ])
    assert.deepEqual(beatLastTimeWins(cur, prev).map((w) => w.name), ['Bench press', 'Pull-ups'])
  })
})

describe('req-96 beatLastTimeLine', () => {
  it('names a single win, no accent (view adds ↑)', () => {
    assert.equal(beatLastTimeLine([{ name: 'Bench press', kind: 'heavier' }]), 'Heavier on Bench press')
    assert.equal(beatLastTimeLine([{ name: 'Pull-ups', kind: 'more-reps' }]), 'More reps on Pull-ups')
    assert.equal(beatLastTimeLine([{ name: 'Plank', kind: 'longer' }]), 'Longer Plank than last time')
  })

  it('names the first + "+N more" for multiple wins', () => {
    assert.equal(
      beatLastTimeLine([
        { name: 'Bench press', kind: 'heavier' },
        { name: 'Pull-ups', kind: 'more-reps' },
        { name: 'Plank', kind: 'longer' },
      ]),
      'Heavier on Bench press · +2 more',
    )
  })

  it('returns null for no wins', () => {
    assert.equal(beatLastTimeLine([]), null)
    assert.equal(beatLastTimeLine(null), null)
  })
})

// req-111 / DEC-053 — skipped sets never count on either side; a prior where the
// exercise was entirely skipped is looked past to the one before.
describe('req-111 beatLastTimeWins — skipped sets', () => {
  const skipped = { ex: 'bench', weight: 0, reps: 'skipped' }

  it('no false win: prev all skipped, the one before 40 kg, today 40 kg → no win', () => {
    const cur = workout(WEIGHTED, [{ ex: 'bench', weight: 40, reps: 8 }])
    const skippedWeek = workout(WEIGHTED, [skipped, skipped])
    const before = workout(WEIGHTED, [{ ex: 'bench', weight: 40, reps: 8 }])
    assert.deepEqual(beatLastTimeWins(cur, [skippedWeek, before]), [])
    // the single-prior form also reports no false "heavier" against the 0 kg record
    assert.deepEqual(beatLastTimeWins(cur, skippedWeek), [])
  })

  it('same current vs a 35 kg one before the skipped week → heavier', () => {
    const cur = workout(WEIGHTED, [{ ex: 'bench', weight: 40, reps: 8 }])
    const skippedWeek = workout(WEIGHTED, [skipped, skipped])
    const before = workout(WEIGHTED, [{ ex: 'bench', weight: 35, reps: 8 }])
    assert.deepEqual(beatLastTimeWins(cur, [skippedWeek, before]).map((w) => w.kind), ['heavier'])
  })

  it('skipped this time: current bench all skipped, prior 40 → no bench win', () => {
    const cur = workout(WEIGHTED, [skipped, skipped])
    const prev = workout(WEIGHTED, [{ ex: 'bench', weight: 40, reps: 8 }])
    assert.deepEqual(beatLastTimeWins(cur, [prev]), [])
    assert.deepEqual(beatLastTimeWins(cur, prev), [])
  })

  it('a skipped set on the current side does not hide a real win in the same exercise', () => {
    const cur = workout(WEIGHTED, [{ ex: 'bench', weight: 45, reps: 8 }, skipped])
    const prev = workout(WEIGHTED, [{ ex: 'bench', weight: 40, reps: 8 }])
    assert.deepEqual(beatLastTimeWins(cur, [prev]).map((w) => w.kind), ['heavier'])
  })

  it('empty prior list → silent', () => {
    const cur = workout(WEIGHTED, [{ ex: 'bench', weight: 40, reps: 8 }])
    assert.deepEqual(beatLastTimeWins(cur, []), [])
  })
})
