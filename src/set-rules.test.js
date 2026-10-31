// req-276 — split from workout-log.test.js: the tests of set-rules.js.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isSkippedSet } from './set-rules.js'

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
