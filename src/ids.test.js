import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatSetLine, rpeLabel, rpeOptionValue } from './ids.js'

describe('effort labels', () => {
  it('maps stored numbers to Easy Moderate Hard Failure', () => {
    assert.equal(rpeLabel(1), 'Easy')
    assert.equal(rpeLabel(2), 'Easy')
    assert.equal(rpeLabel(3), 'Moderate')
    assert.equal(rpeLabel(4), 'Hard')
    assert.equal(rpeLabel(5), 'Failure')
    assert.equal(rpeLabel(''), '')
  })

  it('maps old Very Easy onto Easy when editing', () => {
    assert.equal(rpeOptionValue(1), 2)
    assert.equal(rpeOptionValue(2), 2)
    assert.equal(rpeOptionValue(3), 3)
    assert.equal(rpeOptionValue(5), 5)
  })

  it('shows the label on set lines, not a number', () => {
    assert.equal(formatSetLine({ weight: 20, reps: '10', rpe: 3 }), '20 kg · 10 · Moderate')
    assert.equal(formatSetLine({ weight: 20, reps: '10', rpe: 1 }), '20 kg · 10 · Easy')
  })
})
