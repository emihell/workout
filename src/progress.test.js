import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isDurationTarget, moveToValidWeight, recommendNextPrescription, validWeights } from './progress.js'

describe('req-44 isDurationTarget (was duplicated in item.jsx)', () => {
  it('recognises min/sec durations', () => {
    assert.equal(isDurationTarget('30 sec'), true)
    assert.equal(isDurationTarget('5 min'), true)
    assert.equal(isDurationTarget('45s'), true)
  })
  it('is false for a plain rep count and blanks', () => {
    assert.equal(isDurationTarget('10'), false)
    assert.equal(isDurationTarget(''), false)
    assert.equal(isDurationTarget(null), false)
    assert.equal(isDurationTarget(undefined), false)
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

describe('req-42 / DEC-030 — no valid increment holds (audit F-DIV-1)', () => {
  const naExercise = { type: 'machine', weightStep: 'n/a' }

  it('moveToValidWeight never invents a step when there are no options', () => {
    assert.equal(moveToValidWeight(40, naExercise, 1), 40)
    assert.equal(moveToValidWeight(40, naExercise, -1), 40)
  })

  it('a would-go-up set (rpe <= 2) holds instead of drifting +0.5', () => {
    const result = recommendNextPrescription({
      targets: ['10'],
      sets: [{ weight: 40, reps: '10', rpe: 2 }],
      exercise: naExercise,
    })
    assert.deepEqual(result.weights, [40])
    assert.equal(result.action, 'keep')
    assert.equal(result.reason, 'Same load.')
  })

  it('a would-go-down set (missed / rpe >= 5) holds instead of drifting -0.5', () => {
    const result = recommendNextPrescription({
      targets: ['10'],
      sets: [{ weight: 40, reps: '8', rpe: 5 }],
      exercise: naExercise,
    })
    assert.deepEqual(result.weights, [40])
    assert.equal(result.action, 'keep')
    assert.equal(result.reason, 'Same load.')
  })

  it('an exercise WITH a valid step still moves down (regression)', () => {
    const result = recommendNextPrescription({
      targets: ['10'],
      sets: [{ weight: 23, reps: '8', rpe: 5 }],
      exercise: { type: 'machine', weightStep: 'Alt 4/5' },
    })
    assert.deepEqual(result.weights, [18])
    assert.equal(result.action, 'down')
  })
})
