// req-118 — acceptance criteria for the routine item editor's parser, one test each.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseDurations, parseKg, parseReps, parseRoutineItem } from './routine-item-parse.js'
import { durationTargetFor, setTargetFor } from './workout-log.js'
import { buildPlannedWorkout, migrateState } from './model.js'
import { routineItemMeta } from './ids.js'

describe('req-118 Kg: `/` separates, `,` is a decimal point (DEC-058 §1)', () => {
  it("'22,5' → [22.5]", () => assert.deepEqual(parseKg('22,5'), { list: [22.5], error: null }))
  it("'20/22,5/25' → [20, 22.5, 25]", () => assert.deepEqual(parseKg('20/22,5/25').list, [20, 22.5, 25]))
  it("'abc/20' → error at position 1, nothing dropped", () => {
    const { list, error } = parseKg('abc/20')
    assert.deepEqual(list, [])
    assert.equal(error.position, 1)
  })
  it("'-5' → error", () => assert.equal(parseKg('-5').error.position, 1))
  it("'20kg/22' → [20, 22] (suffix stripped)", () => assert.deepEqual(parseKg('20kg/22').list, [20, 22]))
  it("'' → [] (not set)", () => assert.deepEqual(parseKg(''), { list: [], error: null }))
  it("'20/-5/25' → error at position 2 (never shifted)", () => assert.equal(parseKg('20/-5/25').error.position, 2))
})

describe('req-118 Reps/Duration: `,` separates like `/` (DEC-058 §6)', () => {
  it("Reps '8,8,8' → ['8','8','8']", () => assert.deepEqual(parseReps('8,8,8').list, ['8', '8', '8']))
  it("Duration '30,45' → [30, 45]", () => assert.deepEqual(parseDurations('30,45').list, [30, 45]))
  it("Duration '30s/45s' → [30, 45] (suffix stripped)", () => assert.deepEqual(parseDurations('30s/45s').list, [30, 45]))
  it('AMRAP, 30s and 8-12 are kept as text targets', () => {
    assert.deepEqual(parseReps('AMRAP/30s/8-12'), { list: ['AMRAP', '30s', '8-12'], error: null })
  })
  it("Duration 'abc/20' → error at position 1", () => assert.equal(parseDurations('abc/20').error.position, 1))
})

describe('req-118 Sets is authoritative', () => {
  it("Sets 2 + Reps '8/8/8' → error, blocks save", () => {
    const { errors } = parseRoutineItem({ sets: '2', reps: '8/8/8', kg: '' })
    assert.equal(errors.reps.message, '2 sets, 3 reps given.')
  })
  it("Sets 3 + Reps '8' → ['8','8','8']", () => {
    const { errors, value } = parseRoutineItem({ sets: '3', reps: '8', kg: '' })
    assert.deepEqual(errors, {})
    assert.deepEqual(value.targets, ['8', '8', '8'])
    assert.equal(value.sets, 3)
  })
  it("Sets 3 + Kg '40' → [40, 40, 40] (DEC-058 §7)", () => {
    assert.deepEqual(parseRoutineItem({ sets: '3', reps: '', kg: '40' }).value.suggestedWeights, [40, 40, 40])
  })
  it('lowering Sets 3 → 2 with Reps 8/8 saves 2 sets (was: max() kept 3)', () => {
    const { errors, value } = parseRoutineItem({ sets: '2', reps: '8/8', kg: '40/40' })
    assert.deepEqual(errors, {})
    assert.equal(value.sets, 2)
  })
  it("Sets 2 + Kg '20/22/24' → error; timed Duration too long → error", () => {
    assert.equal(parseRoutineItem({ sets: '2', kg: '20/22/24' }).errors.kg.message, '2 sets, 3 kg values given.')
    assert.ok(parseRoutineItem({ sets: '1', duration: '30/30', timed: true }).errors.duration)
  })
  it('Duration is ignored (null) when the exercise is not timed', () => {
    const { errors, value } = parseRoutineItem({ sets: '1', duration: 'abc', timed: false })
    assert.deepEqual(errors, {})
    assert.equal(value.durations, null)
  })
})

describe('req-118 failure case — blank Duration', () => {
  it('timed exercise, blank Duration → the target is the exercise default, not 0', () => {
    const { value } = parseRoutineItem({ sets: '3', reps: '', kg: '', duration: '', timed: true })
    assert.deepEqual(value.durations, [])
    const ex = { id: 'ex-plank', hasDuration: true, durationSec: 45 }
    assert.equal(durationTargetFor({ durations: value.durations }, ex, 0), 45)
    assert.equal(durationTargetFor({ durations: value.durations }, ex, 2), 45)
  })
})

describe('req-118 failure case — cleared Kg survives reload (needs req-120)', () => {
  it('an item with a legacyRecommendations baseline, Kg cleared → migrateState → still []', () => {
    const v9 = migrateState({
      exercises: [{ id: 'ex-1', name: 'Chest press', type: 'machine', weightStep: '5' }],
      routines: [
        {
          id: 'r-1',
          name: 'Push',
          exercises: [{ id: 'si-1', exerciseId: 'ex-1', sets: 3, targets: ['8'], suggestedWeights: [40, 40, 40] }],
        },
      ],
      workouts: [],
    })
    assert.deepEqual(v9.legacyRecommendations['si-1'].suggestedWeights, [40, 40, 40])
    const { value } = parseRoutineItem({ sets: '3', reps: '8', kg: '' })
    assert.deepEqual(value.suggestedWeights, [])
    v9.routines[0].exercises[0] = { ...v9.routines[0].exercises[0], ...value, durations: [] }
    // A v9 reload: loadState passes legacy=false for a v9 key at schemaVersion 9 (req-120).
    const reloaded = migrateState(JSON.parse(JSON.stringify(v9)))
    assert.deepEqual(reloaded.routines[0].exercises[0].suggestedWeights, [])
  })
})

describe('req-118 readers of the parser output still hold', () => {
  const { value } = parseRoutineItem({ sets: '3', reps: '8/10', kg: '20/22,5', duration: '30', timed: true })
  const item = { id: 'si-1', exerciseId: 'ex-1', role: 'main', ...value }
  it('output lists are parallel to sets (short lists repeated)', () => {
    assert.deepEqual(value, { sets: 3, targets: ['8', '10', '10'], suggestedWeights: [20, 22.5, 22.5], durations: [30, 30, 30] })
  })
  it('setTargetFor reads each working set’s target', () => {
    assert.deepEqual([0, 1, 2].map((i) => setTargetFor(item, 'work', i)), ['8', '10', '10'])
  })
  it('routineItemMeta prints the decimal weight', () => {
    assert.equal(routineItemMeta(item), '3 sets · 20/22.5/22.5 kg')
  })
  it('buildPlannedWorkout carries sets/targets/weights/durations and needs no calibration', () => {
    const state = { exercises: [{ id: 'ex-1', name: 'Press', type: 'machine' }], routines: [{ id: 'r-1', exercises: [item] }] }
    const planned = buildPlannedWorkout(state, { routineId: 'r-1', date: '2026-09-23' }).items[0]
    assert.equal(planned.sets, 3)
    assert.deepEqual(planned.suggestedWeights, [20, 22.5, 22.5])
    assert.deepEqual(planned.durations, [30, 30, 30])
    assert.equal(planned.calibrationRequired, false)
  })
  it('an empty Kg plans as uncalibrated (no invented weight)', () => {
    const empty = { ...item, ...parseRoutineItem({ sets: '3', reps: '8', kg: '' }).value, durations: [] }
    const state = { exercises: [{ id: 'ex-1', name: 'Press', type: 'machine' }], routines: [{ id: 'r-1', exercises: [empty] }] }
    assert.equal(buildPlannedWorkout(state, { routineId: 'r-1', date: '2026-09-23' }).items[0].calibrationRequired, true)
  })
})
