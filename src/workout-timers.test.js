// req-276 — split from workout-log.test.js: the tests of workout-timers.js.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { restPatchAfterSet, restRemaining } from './workout-timers.js'

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
