import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { moveToValidWeight, recommendNextPrescription, validWeights } from './progress.js'

describe('dated recommendation loads', () => {
  it('uses true alternating 4/5 kg machine loads', () => {
    const exercise = { type: 'machine', weightStep: 'Alt 4/5' }
    assert.deepEqual(validWeights(exercise).slice(0, 6), [9, 14, 18, 23, 27, 32])
    assert.equal(moveToValidWeight(18, exercise, 1), 23)
    assert.equal(moveToValidWeight(18, exercise, -1), 14)
  })

  it('moves each easy set one valid load step', () => {
    const result = recommendNextPrescription({
      targets: ['12', '10', '8'],
      sets: [
        { weight: 18, reps: '12', rpe: 2 },
        { weight: 23, reps: '10', rpe: 2 },
        { weight: 27, reps: '8', rpe: 2 },
      ],
      exercise: { type: 'machine', weightStep: 'Alt 4/5' },
    })
    assert.deepEqual(result.weights, [23, 27, 32])
    assert.equal(result.action, 'up')
  })
})
