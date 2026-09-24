// req-150 / DEC-075 — hold instead of guessing: a set whose target isn't a single whole number
// (range, AMRAP, duration, any text) or an assisted exercise keeps its kg and target, with a
// reason. No new rule: everything else is identical to main (property test vs a frozen copy).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { HOLD_REASONS, isAssistedExercise, recommendNextPrescription, unreadableTarget } from './progress.js'
import { recommendNextPrescription as mainRecommend } from './req-150.progress-main.fixture.js'

const machine = { type: 'machine', weightStep: '5', name: 'Leg Press' }
const both = (input) => ({ now: recommendNextPrescription(input), main: mainRecommend(input) })

describe('holds (each case differs from main)', () => {
  it('range "8-12": 5 reps + Easy → hold (main: up)', () => {
    const input = { targets: ['8-12'], weights: [100], sets: [{ weight: 100, reps: '5', rpe: 2 }], exercise: machine }
    const { now, main } = both(input)
    assert.equal(main.action, 'up')
    assert.deepEqual(now.weights, [100])
    assert.deepEqual(now.targets, ['8-12'])
    assert.equal(now.action, 'keep')
    assert.equal(now.reason, `Same load. ${HOLD_REASONS.target}`)
  })

  it('range "8-12": 12 reps + Easy → hold (main: up)', () => {
    const input = { targets: ['8-12'], sets: [{ weight: 100, reps: '12', rpe: 1 }], exercise: machine }
    const { now, main } = both(input)
    assert.equal(main.action, 'up')
    assert.deepEqual(now.weights, [100])
    assert.equal(now.action, 'keep')
  })

  it('"AMRAP": any reps and effort → hold (main: moves on effort)', () => {
    for (const rpe of [1, 2, 3, 5, null]) {
      for (const reps of ['3', '15', '30']) {
        const input = { targets: ['AMRAP'], sets: [{ weight: 60, reps, rpe }], exercise: machine }
        const { now } = both(input)
        assert.deepEqual(now.weights, [60], `${reps} @${rpe}`)
        assert.deepEqual(now.targets, ['AMRAP'])
        assert.equal(now.action, 'keep')
      }
    }
    assert.equal(mainRecommend({ targets: ['AMRAP'], sets: [{ weight: 60, reps: '3', rpe: 5 }], exercise: machine }).action, 'down')
  })

  it('an en-dash range "8–12" holds (main read it as 812 and dropped the load)', () => {
    const input = { targets: ['8–12'], sets: [{ weight: 100, reps: '10', rpe: 3 }], exercise: machine }
    const { now, main } = both(input)
    assert.equal(main.action, 'down')
    assert.equal(now.action, 'keep')
    assert.deepEqual(now.weights, [100])
  })

  it('assisted by libraryId: a missed set and an Easy set both hold, kg unchanged (main: down / up)', () => {
    for (const libraryId of ['own-assisted-pull-up', 'own-assisted-dip', 'Band_Assisted_Pull-Up']) {
      const exercise = { type: 'machine', weightStep: '5', name: 'My Pull-Up Helper', libraryId }
      const missed = both({ targets: ['8'], sets: [{ weight: 30, reps: '5', rpe: 3 }], exercise })
      assert.equal(missed.main.action, 'down', libraryId)
      assert.deepEqual(missed.now.weights, [30], libraryId)
      assert.equal(missed.now.action, 'keep')
      assert.equal(missed.now.reason, `Same load. ${HOLD_REASONS.assisted}`)
      const easy = both({ targets: ['8'], sets: [{ weight: 30, reps: '8', rpe: 2 }], exercise })
      assert.equal(easy.main.action, 'up', libraryId)
      assert.deepEqual(easy.now.weights, [30])
      assert.equal(easy.now.action, 'keep')
    }
  })

  it('assisted by name (case-insensitive), no libraryId', () => {
    const exercise = { type: 'machine', weightStep: '5', name: 'Gym ASSISTED Dip' }
    const { now, main } = both({ targets: ['10'], sets: [{ weight: 25, reps: '6', rpe: 5 }], exercise })
    assert.equal(main.action, 'down')
    assert.deepEqual(now.weights, [25])
    assert.equal(now.action, 'keep')
  })

  it('mixed item: numeric sets still move; the held set keeps its kg; the reason says both', () => {
    const input = { targets: ['10', 'AMRAP'], sets: [{ weight: 50, reps: '10', rpe: 2 }, { weight: 50, reps: '14', rpe: 2 }], exercise: machine }
    const now = recommendNextPrescription(input)
    assert.deepEqual(now.weights, [55, 50])
    assert.equal(now.action, 'up')
    assert.equal(now.reason, `Load up. ${HOLD_REASONS.target}`)
  })
})

describe('the predicates', () => {
  it('unreadableTarget: whole numbers and blanks are readable; everything else is not', () => {
    for (const t of ['10', ' 8 ', '0', '', null, undefined]) assert.equal(unreadableTarget(t), false, String(t))
    for (const t of ['8-12', '8–12', 'AMRAP', '60 sec', '60s', '5-8 min', '10 reps', 'abc', '12+']) assert.equal(unreadableTarget(t), true, t)
  })
  it('isAssistedExercise: by the three library ids or "assisted" in the name', () => {
    assert.equal(isAssistedExercise({ libraryId: 'own-assisted-dip' }), true)
    assert.equal(isAssistedExercise({ name: 'assisted pull-up machine' }), true)
    assert.equal(isAssistedExercise({ name: 'Pull-Up', libraryId: 'Pullups' }), false)
    assert.equal(isAssistedExercise(null), false)
  })
})

describe('unchanged otherwise (property test vs main)', () => {
  // Deterministic PRNG (mulberry32) so a failure is reproducible.
  function rng(seed) {
    let a = seed >>> 0
    return () => {
      a = (a + 0x6d2b79f5) >>> 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  const pick = (r, list) => list[Math.floor(r() * list.length)]
  const TYPES = ['machine', 'free', 'cable', 'bodyweight', 'cardio']
  const STEPS = ['5', '2.5', '2,5', 'Alt 4/5', 'n/a', '1.25', '10']
  const NAMES = ['Leg Press', 'Bench Press', 'Pull-Up', 'Plank', 'Row', 'Curl']
  const IDS = [undefined, 'Pullups', 'Leg_Press', 'Plank', 'own-seal-row']
  const TARGETS = ['', '1', '3', '5', '6', '8', '10', '12', '15', '20', undefined]

  it('5,000 generated items with whole-number or blank targets and non-assisted exercises: identical output', () => {
    const r = rng(150)
    for (let n = 0; n < 5000; n += 1) {
      const count = 1 + Math.floor(r() * 5)
      const exercise = { type: pick(r, TYPES), weightStep: pick(r, STEPS), name: pick(r, NAMES), libraryId: pick(r, IDS) }
      if (r() < 0.15) exercise.weightOptions = [10, 15, 20, 30, 45]
      const targets = r() < 0.1 ? undefined : Array.from({ length: 1 + Math.floor(r() * count) }, () => pick(r, TARGETS))
      const weights = r() < 0.2 ? undefined : Array.from({ length: Math.floor(r() * (count + 1)) }, () => pick(r, [0, 10, 20, 32.5, 50, 100]))
      const sets = Array.from({ length: count }, () => {
        const roll = r()
        if (roll < 0.1) return null
        if (roll < 0.2) return { reps: 'skipped' }
        return { weight: pick(r, [0, 5, 18, 20, 23, 40, 60, 100]), reps: String(Math.floor(r() * 20)), rpe: pick(r, [null, 1, 2, 3, 4, 5]) }
      })
      const input = { targets, weights, sets, exercise }
      assert.deepEqual(recommendNextPrescription(input), mainRecommend(input), JSON.stringify(input))
    }
  })
})
