import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatSetLine, isWeightedType, roleLabel, roleTag, routineItemMeta, rpeLabel, rpeOptionValue } from './ids.js'

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
  it('maps stored numbers to Easy Moderate Hard Couldn\'t finish', () => {
    assert.equal(rpeLabel(1), 'Easy')
    assert.equal(rpeLabel(2), 'Easy')
    assert.equal(rpeLabel(3), 'Moderate')
    assert.equal(rpeLabel(4), 'Hard')
    assert.equal(rpeLabel(5), "Couldn't finish")
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

describe('req-103 routineItemMeta (routine editor row meta line)', () => {
  it('minimal item (no role, no warm-up, no weights) is just "1 set" — no stray separators, no Main', () => {
    assert.equal(routineItemMeta({ exerciseId: 'x' }), '1 set')
  })
  it('main is unlabelled; warm-up set, set count and kg join with " · "', () => {
    const meta = routineItemMeta({ role: 'main', warmup: true, sets: 3, suggestedWeights: [20, 22, 24] })
    assert.equal(meta, 'WU set · 3 sets · 20/22/24\u00a0kg')
    assert.ok(!meta.includes('Main'))
  })
  it('non-main roles keep their tag first', () => {
    assert.equal(routineItemMeta({ role: 'warmup', sets: 2 }), 'WU routine · 2 sets')
    assert.equal(routineItemMeta({ role: 'finisher', sets: 1 }), 'Finisher · 1 set')
    assert.equal(routineItemMeta({ role: 'cardio' }), 'Cardio · 1 set')
  })
  it('all-zero / empty weights print no kg', () => {
    assert.equal(routineItemMeta({ sets: 2, suggestedWeights: [0, '0'] }), '2 sets')
    assert.equal(routineItemMeta({ sets: 2, suggestedWeights: ['', ''] }), '2 sets')
  })
})

describe('req-113 routineItemMeta shows — for a set with no weight', () => {
  it('a 0, empty or missing weight prints as —, never 0', () => {
    assert.ok(routineItemMeta({ sets: 2, suggestedWeights: [0, 40] }).includes('—/40\u00a0kg'))
    assert.ok(routineItemMeta({ sets: 3, suggestedWeights: [40, 0, 45] }).includes('40/—/45\u00a0kg'))
    assert.ok(routineItemMeta({ sets: 2, suggestedWeights: ['', 40] }).includes('—/40\u00a0kg'))
    assert.ok(routineItemMeta({ sets: 2, suggestedWeights: [null, 40] }).includes('—/40\u00a0kg'))
  })
  it('all-zero or empty weights still print no kg part', () => {
    assert.equal(routineItemMeta({ sets: 2, suggestedWeights: [0, 0] }), '2 sets')
    assert.equal(routineItemMeta({ sets: 2, suggestedWeights: [] }), '2 sets')
  })
})
