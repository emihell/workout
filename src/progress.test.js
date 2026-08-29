import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  bumpWeight,
  moveToValidWeight,
  normalizeGoal,
  planNextExercise,
  recommendNextPrescription,
  validWeights,
} from './progress.js'

const chest = { type: 'machine', weightStep: '5' }
const item = {
  targets: ['12', '10', '8'],
  suggestedWeights: [25, 30, 30],
}

describe('normalizeGoal', () => {
  it('maps build muscle and stay lean to gain', () => {
    assert.equal(normalizeGoal('Build muscle and stay lean'), 'gain')
  })
})

describe('bumpWeight', () => {
  it('gain 5% on 100kg / 5kg stack is one plate', () => {
    assert.equal(bumpWeight(100, '5', 1, 0.05), 105)
  })
  it('power 7.5% on 100kg / 5kg stack is more than one plate', () => {
    assert.equal(bumpWeight(100, '5', 1, 0.075), 110)
  })
  it('always moves at least one stack step', () => {
    assert.equal(bumpWeight(25, '5', 1, 0.025), 30)
    assert.equal(bumpWeight(25, '5', -1, 0.025), 20)
  })
})

describe('planNextExercise', () => {
  const easyHits = [
    { weight: 25, reps: '12', rpe: 1 },
    { weight: 30, reps: '10', rpe: 1 },
    { weight: 30, reps: '8', rpe: 1 },
  ]
  const missed = [
    { weight: 25, reps: '8', rpe: 4 },
    { weight: 30, reps: '6', rpe: 5 },
    { weight: 30, reps: '5', rpe: 5 },
  ]

  it('gain + easy raises weight', () => {
    const { nextWeights, action } = planNextExercise(item, easyHits, chest, 'gain')
    assert.equal(action, 'up')
    assert.deepEqual(nextWeights, [30, 35, 35])
  })

  it('missed reps drops weight', () => {
    const { nextWeights, action } = planNextExercise(item, missed, chest, 'gain')
    assert.equal(action, 'down')
    assert.deepEqual(nextWeights, [20, 25, 25])
  })

  it('lean + easy adds a rep before adding weight', () => {
    const { nextWeights, nextTargets, action } = planNextExercise(item, easyHits, chest, 'lean')
    assert.equal(action, 'up')
    assert.deepEqual(nextWeights, [25, 30, 30])
    assert.deepEqual(nextTargets, ['13', '11', '9'])
  })

  it('moderate keep the logged weight', () => {
    const sets = [
      { weight: 25, reps: '12', rpe: 3 },
      { weight: 30, reps: '10', rpe: 4 },
      { weight: 30, reps: '8', rpe: 3 },
    ]
    const { nextWeights, action } = planNextExercise(item, sets, chest, 'gain')
    assert.equal(action, 'keep')
    assert.deepEqual(nextWeights, [25, 30, 30])
  })
})

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
