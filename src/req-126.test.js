// req-126 / DEC-059 §2 — weight step: one number (comma or dot, optional kg) or the
// alternating 4/5 series; the catalog doesn't invent one; an unreadable stored value is
// never silently overwritten. Pure logic only (tests can't import .jsx): the editors'
// state and Save go through weight-step.js, exercised here exactly as the views call it.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recommendNextPrescription, validWeights } from './progress.js'
import { catalogItemToExercise } from './exerciseCatalog.js'
import {
  describeWeightStep,
  parseWeightStep,
  weightStepFields,
  weightStepNote,
  weightStepToSave,
} from './weight-step.js'

const series = (step, max = 250) => {
  const out = []
  for (let w = step; w <= max; w += step) out.push(Math.round(w * 100) / 100)
  return out
}

// validWeights as it was on main (4f1d952), for the "identical to main" check.
function validWeightsMain(exercise, max = 250) {
  if (exercise?.weightStep === 'Alt 4/5') {
    const out = []
    let weight = 9
    let addFive = true
    while (weight <= max) {
      out.push(weight)
      weight += addFive ? 5 : 4
      addFive = !addFive
    }
    return out
  }
  const step = Number(exercise?.weightStep)
  if (!Number.isFinite(step) || step <= 0) return []
  return series(step, max)
}

describe('req-126 validWeights reads the shared single-value parser', () => {
  it("'2,5' and '2.5 kg' are the 2.5 series; 'Alt 4/5' unchanged; 'n/a', '', 'abc' → []", () => {
    assert.deepEqual(validWeights({ weightStep: '2,5' }), series(2.5))
    assert.deepEqual(validWeights({ weightStep: '2.5 kg' }), series(2.5))
    assert.deepEqual(validWeights({ weightStep: 'Alt 4/5' }), validWeightsMain({ weightStep: 'Alt 4/5' }))
    for (const v of ['n/a', '', 'abc']) assert.deepEqual(validWeights({ weightStep: v }), [], v)
  })

  it("hand-written list: '+2.5' and '2.' read the same as main (review loop-back)", () => {
    assert.deepEqual(validWeights({ weightStep: '+2.5' }), validWeightsMain({ weightStep: '+2.5' }))
    assert.deepEqual(validWeights({ weightStep: '2.' }), validWeightsMain({ weightStep: '2.' }))
    assert.deepEqual(validWeights({ weightStep: '+2.5' }).slice(0, 2), [2.5, 5])
    assert.deepEqual(validWeights({ weightStep: '2.' }).slice(0, 3), [2, 4, 6])
    for (const text of ['1e1', '0x5']) assert.deepEqual(validWeights({ weightStep: text }), [], text)
  })

  it('hand-written failure list: newly parse', () => {
    const cases = { '2,5': 2.5, '2.5 kg': 2.5, '2,5 kg': 2.5, '5 kg': 5 }
    for (const [text, step] of Object.entries(cases)) {
      assert.deepEqual(validWeightsMain({ weightStep: text }), [], `${text} held on main`)
      assert.deepEqual(validWeights({ weightStep: text }), series(step), text)
    }
  })

  it('hand-written failure list: still []', () => {
    for (const text of ['4/5', '0', '-2.5', 'alt 4/5', 'abc', '']) {
      assert.deepEqual(validWeights({ weightStep: text }), [], text)
      assert.equal(parseWeightStep(text), null, text)
    }
  })

  it('canonical values are identical to main', () => {
    for (const text of ['n/a', '5', '2', '10', 'Alt 4/5']) {
      assert.deepEqual(validWeights({ weightStep: text }), validWeightsMain({ weightStep: text }), text)
    }
  })

  it("every stored weightStep in db.json reads exactly as on main", () => {
    const db = readFileSync(new URL('./db.json', import.meta.url), 'utf8')
    const values = [...new Set([...db.matchAll(/"weightStep": "([^"]*)"/g)].map((m) => m[1]))]
    assert.ok(values.length >= 4)
    for (const v of values) assert.deepEqual(validWeights({ weightStep: v }), validWeightsMain({ weightStep: v }), v)
  })

  it("a stored '2,5' now moves the recommendation instead of holding (unconfirmed §2)", () => {
    const r = recommendNextPrescription({
      targets: ['10'],
      weights: [20],
      sets: [{ weight: 20, reps: '10', rpe: 1 }],
      exercise: { type: 'free', weightStep: '2,5' },
    })
    assert.deepEqual(r.weights, [22.5])
  })
})

describe('req-126 editor fields and Save', () => {
  it("entering '2,5' saves '2.5'; ticking Alternating saves 'Alt 4/5'; empty saves 'n/a'", () => {
    const f = weightStepFields('n/a')
    assert.deepEqual(weightStepToSave({ ...f, amount: '2,5' }, { stored: 'n/a', touched: true }), { value: '2.5' })
    assert.deepEqual(weightStepToSave({ ...f, amount: '5 kg' }, { stored: 'n/a', touched: true }), { value: '5' })
    assert.deepEqual(weightStepToSave({ ...f, amount: '2,5', alternating: true }, { stored: 'n/a', touched: true }), {
      value: 'Alt 4/5',
    })
    assert.deepEqual(weightStepToSave({ ...weightStepFields('5'), amount: '' }, { stored: '5', touched: true }), {
      value: 'n/a',
    })
  })

  it("no silent overwrite: 'abc' opens with a note and an untouched Save keeps 'abc'", () => {
    const f = weightStepFields('abc')
    assert.equal(f.unreadable, 'abc')
    assert.equal(weightStepNote(f), "Can't read 'abc' — enter an increment")
    assert.deepEqual(weightStepToSave(f, { stored: 'abc', touched: false }), { unchanged: true, value: 'abc' })
  })

  it('a typed value that does not read blocks Save with the note', () => {
    const f = { ...weightStepFields('5'), amount: 'abc' }
    assert.deepEqual(weightStepToSave(f, { stored: '5', touched: true }), { error: "Can't read 'abc' — enter an increment" })
  })

  it("'4/5' is offered as Alternating", () => {
    assert.match(weightStepNote(weightStepFields('4/5')), /Alternating \(4\/5\)\?/)
    assert.deepEqual(weightStepToSave(weightStepFields('4/5'), { stored: '4/5', touched: false }), {
      unchanged: true,
      value: '4/5',
    })
  })

  // Review loop-back (edit to this branch's own test): an untouched Save of a missing / '' /
  // null step is now `unchanged` (the field is left as stored), no longer { value: 'n/a' }.
  it('stored values open as expected; a missing field opens empty (not an invented 2.5)', () => {
    assert.deepEqual(weightStepFields('Alt 4/5'), { amount: '', alternating: true, unreadable: null })
    assert.deepEqual(weightStepFields(undefined), { amount: '', alternating: false, unreadable: null })
    assert.deepEqual(weightStepFields('n/a'), { amount: '', alternating: false, unreadable: null })
    assert.deepEqual(weightStepFields('2,5'), { amount: '2,5', alternating: false, unreadable: null })
    for (const stored of [undefined, null, '']) {
      assert.deepEqual(weightStepToSave(weightStepFields(stored), { stored, touched: false }), {
        unchanged: true,
        value: stored,
      })
    }
    // A touched step that ends empty still saves 'n/a'.
    assert.deepEqual(weightStepToSave({ ...weightStepFields(undefined), amount: '' }, { stored: undefined, touched: true }), {
      value: 'n/a',
    })
  })

  it('detail line wording', () => {
    assert.equal(describeWeightStep('2.5'), 'Increment 2.5 kg')
    assert.equal(describeWeightStep('2,5'), 'Increment 2.5 kg')
    assert.equal(describeWeightStep('Alt 4/5'), 'Alternating 4/5')
    assert.equal(describeWeightStep('n/a'), null)
    assert.equal(describeWeightStep('abc'), 'abc')
  })
})

describe('req-126 catalog', () => {
  it("an imported machine / free exercise has weightStep 'n/a'", () => {
    const machine = catalogItemToExercise({ name: 'Chest Press', equipment: 'machine', category: 'strength' })
    const free = catalogItemToExercise({ name: 'Curl', equipment: 'dumbbell', category: 'strength' })
    assert.equal(machine.type, 'machine')
    assert.equal(free.type, 'free')
    assert.equal(machine.weightStep, 'n/a')
    assert.equal(free.weightStep, 'n/a')
  })
})
