import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatSetLine, isWeightedType, roleLabel, roleTag, rpeLabel, rpeOptionValue } from './ids.js'

describe('req-44 isWeightedType (unifies usesWeight/usesLoad/weighted/bodyweight)', () => {
  it('machine and free carry load', () => {
    assert.equal(isWeightedType('machine'), true)
    assert.equal(isWeightedType('free'), true)
  })
  it('bodyweight and cardio do not', () => {
    assert.equal(isWeightedType('bodyweight'), false)
    assert.equal(isWeightedType('cardio'), false)
  })
  it('a missing/unknown type reads as weighted (matches every prior spelling)', () => {
    assert.equal(isWeightedType(undefined), true)
    assert.equal(isWeightedType(null), true)
    assert.equal(isWeightedType('anything-else'), true)
  })
})

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

describe('req-93 roleTag (main is unlabelled; only non-main roles carry a tag)', () => {
  it('main and absent role → no tag', () => {
    assert.equal(roleTag('main'), '')
    assert.equal(roleTag(undefined), '')
    assert.equal(roleTag(null), '')
    assert.equal(roleTag(''), '')
  })
  it('non-main roles keep their label (same wording as roleLabel)', () => {
    assert.equal(roleTag('warmup'), roleLabel('warmup'))
    assert.equal(roleTag('finisher'), roleLabel('finisher'))
    assert.equal(roleTag('cardio'), roleLabel('cardio'))
    assert.equal(roleTag('warmup'), 'WU routine')
    assert.equal(roleTag('finisher'), 'Finisher')
  })
})
