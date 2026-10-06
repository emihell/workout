// req-193 / DEC-108 §6 — weight steps you can set: "Two step sizes" (both editable, stored
// 'Alt A/B') and an optional "Lightest weight (kg)" (exercise.lightestWeight) that the load
// suggestions count from. Blank lightest weight → main's series exactly (golden below).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { moveToValidWeight, NO_SERIES_TEXT, recommendNextPrescription, validWeights, weightSeriesPreview } from './progress.js'
import {
  moveToValidWeight as mainMove,
  validWeights as mainValidWeights,
} from './req-193.progress-main.fixture.js'
import { catalogItemToExercise, loadExerciseCatalog } from './exerciseCatalog.js'
import {
  describeLightestWeight,
  describeWeightStep,
  lightestWeightNote,
  lightestWeightToSave,
  parseLightestWeight,
  parseTwoSteps,
  weightStepFields,
  weightStepToSave,
} from './weight-step.js'
import { applyBackup, buildBackup } from './exchange.js'
import { migrateState } from './model.js'
import { emptyState, loadState } from './storage.js'
import { exerciseUpdatedState } from './state-reducers.js'

// Every object in db.json that carries a weightStep: the seed exercises and every snapshot
// item that froze one.
function dbWeightStepHolders() {
  const db = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
  const out = []
  const walk = (value) => {
    if (Array.isArray(value)) return value.forEach(walk)
    if (value && typeof value === 'object') {
      if ('weightStep' in value) out.push(value)
      Object.values(value).forEach(walk)
    }
  }
  walk(db)
  return out
}

const HAND_WRITTEN = [
  'n/a', '', undefined, null, '5', '2', '10', '2.5', '2,5', '2.5 kg', '1.25', '+2.5', '2.', 'Alt 4/5', 'alt 4/5',
  '4/5', 'Alt 4 / 5', 'abc', '0', '-2.5', '1e1', '0x5',
]
const PROBE_WEIGHTS = [0, 2.5, 5, 9, 12.5, 14, 20, 47.5, 100, 249, 250, 300]

function assertSameAsMain(exercise, label) {
  assert.deepEqual(validWeights(exercise), mainValidWeights(exercise), `${label} validWeights`)
  assert.deepEqual(validWeights(exercise, 400), mainValidWeights(exercise, 400), `${label} validWeights max 400`)
  for (const w of PROBE_WEIGHTS) {
    for (const dir of [1, -1]) {
      assert.equal(moveToValidWeight(w, exercise, dir), mainMove(w, exercise, dir), `${label} move ${w} ${dir}`)
    }
  }
}

describe('req-193 acceptance 1 — golden: no lightest weight → main output, byte for byte', () => {
  it('every weightStep holder in src/db.json', () => {
    const holders = dbWeightStepHolders()
    assert.ok(holders.length > 100, `found ${holders.length}`)
    for (const [i, holder] of holders.entries()) assertSameAsMain(holder, `db[${i}] ${holder.weightStep}`)
  })

  it('every library entry as the app adds it (catalogItemToExercise)', async () => {
    const catalog = await loadExerciseCatalog()
    assert.ok(catalog.length > 100)
    for (const entry of catalog) assertSameAsMain(catalogItemToExercise(entry), entry.id)
  })

  it('a hand-written list of stored shapes, with absent / null / blank lightestWeight', () => {
    for (const weightStep of HAND_WRITTEN) {
      for (const type of ['machine', 'free', 'bodyweight', 'cardio']) {
        for (const extra of [{}, { lightestWeight: null }, { lightestWeight: undefined }, { lightestWeight: '' }]) {
          assertSameAsMain({ type, weightStep, ...extra }, `${type} ${weightStep} ${JSON.stringify(extra)}`)
        }
      }
    }
  })

  it("a stored 'Alt 4/5' still starts from 9, +5 first", () => {
    assert.deepEqual(validWeights({ weightStep: 'Alt 4/5' }).slice(0, 5), [9, 14, 18, 23, 27])
  })

  it('weightOptions still win over everything (unchanged)', () => {
    const exercise = { weightStep: '5', lightestWeight: 7.5, weightOptions: [30, 10, 20] }
    assert.deepEqual(validWeights(exercise), [10, 20, 30])
  })
})

describe('req-193 acceptance 2 — series from the lightest weight', () => {
  it('step 5, lightest 7.5 → 7.5, 12.5, 17.5', () => {
    assert.deepEqual(validWeights({ weightStep: '5', lightestWeight: 7.5 }).slice(0, 3), [7.5, 12.5, 17.5])
  })

  it('two steps 2.5/5 from 10 → 10, 12.5, 17.5, 20, 25', () => {
    assert.deepEqual(validWeights({ weightStep: 'Alt 2.5/5', lightestWeight: 10 }).slice(0, 5), [10, 12.5, 17.5, 20, 25])
  })

  it('one step up from 12.5 on that stack → 17.5; down from 17.5 → 12.5', () => {
    const exercise = { type: 'machine', weightStep: 'Alt 2.5/5', lightestWeight: 10 }
    assert.equal(moveToValidWeight(12.5, exercise, 1), 17.5)
    assert.equal(moveToValidWeight(17.5, exercise, -1), 12.5)
    const r = recommendNextPrescription({
      targets: ['10'],
      weights: [12.5],
      sets: [{ weight: 12.5, reps: '10', rpe: 1 }],
      exercise,
    })
    assert.deepEqual(r.weights, [17.5])
    assert.equal(r.action, 'up')
  })

  it('a lightest weight on the legacy Alt 4/5 counts 4 first from it (the boxes read 4, 5)', () => {
    assert.deepEqual(validWeights({ weightStep: 'Alt 4/5', lightestWeight: 10 }).slice(0, 4), [10, 14, 19, 23])
  })

  it('new two steps with no lightest weight count from 0 like a single step (0 itself left out)', () => {
    assert.deepEqual(validWeights({ weightStep: 'Alt 2.5/5' }).slice(0, 4), [2.5, 7.5, 10, 15])
  })

  it('a stored string lightest weight reads (lenient, like the step)', () => {
    assert.deepEqual(validWeights({ weightStep: '5', lightestWeight: '7,5' }).slice(0, 2), [7.5, 12.5])
  })

  it('no float drift over a long series', () => {
    const series = validWeights({ weightStep: '1.25', lightestWeight: 0.1 })
    for (const w of series) assert.equal(w, Math.round(w * 100) / 100)
    assert.equal(series.at(-1), 248.85)
  })
})

describe('req-193 acceptance 3 — failure case', () => {
  it("lightest 'abc' / negative / over 250 / 0 → inline error, nothing saved", () => {
    const cases = {
      abc: "Can't read 'abc' — enter a weight in kg",
      '-5': 'Lightest weight must be more than 0 kg',
      '300': "Lightest weight can't be over 250 kg",
      '250.5': "Lightest weight can't be over 250 kg",
      '0': 'Lightest weight must be more than 0 kg',
    }
    for (const [text, message] of Object.entries(cases)) {
      assert.equal(lightestWeightNote(text), message, text)
      assert.deepEqual(lightestWeightToSave(text, { stored: 10, touched: true }), { error: message }, text)
    }
  })

  it('readable values save as a number; blank clears to null; untouched leaves the stored value', () => {
    assert.deepEqual(lightestWeightToSave('7,5', { stored: undefined, touched: true }), { value: 7.5 })
    assert.deepEqual(lightestWeightToSave('250', { stored: undefined, touched: true }), { value: 250 })
    assert.deepEqual(lightestWeightToSave('10 kg', { stored: undefined, touched: true }), { value: 10 })
    assert.deepEqual(lightestWeightToSave('', { stored: 10, touched: true }), { value: null })
    assert.deepEqual(lightestWeightToSave('abc', { stored: 'abc', touched: false }), { unchanged: true, value: 'abc' })
    assert.equal(lightestWeightNote(''), null)
  })

  it('step blank / n/a / unreadable + lightest set → no series: the recommendation holds (DEC-030)', () => {
    for (const weightStep of ['n/a', '', undefined, 'abc', 'alt 4/5']) {
      const exercise = { type: 'machine', weightStep, lightestWeight: 20 }
      assert.deepEqual(validWeights(exercise), [], String(weightStep))
      assert.equal(moveToValidWeight(30, exercise, 1), 30)
      const r = recommendNextPrescription({ targets: ['10'], weights: [30], sets: [{ weight: 30, reps: '10', rpe: 1 }], exercise })
      assert.deepEqual(r.weights, [30])
      assert.equal(r.action, 'keep')
    }
  })

  it('a lightest weight above the series max gives no options (hold), never a lower invented one', () => {
    assert.deepEqual(validWeights({ weightStep: '5', lightestWeight: 260 }), [])
  })
})

describe('req-193 scope 4 — the two-step stored form', () => {
  it("parseTwoSteps reads exactly 'Alt A/B'; 'Alt 4/5' stays valid", () => {
    assert.deepEqual(parseTwoSteps('Alt 4/5'), [4, 5])
    assert.deepEqual(parseTwoSteps('Alt 2.5/5'), [2.5, 5])
    for (const text of ['alt 4/5', '4/5', 'Alt 4 / 5', 'Alt 0/5', 'Alt 4/5/6', 'Alt -4/5', 'Alt 4/', undefined, null, 5]) {
      assert.equal(parseTwoSteps(text), null, String(text))
    }
  })

  it('both boxes are editable and save as typed (comma decimals)', () => {
    const f = weightStepFields('Alt 4/5')
    assert.deepEqual(f, { amount: '4', second: '5', alternating: true, unreadable: null })
    assert.deepEqual(weightStepToSave({ ...f, amount: '2,5' }, { stored: 'Alt 4/5', touched: true }), { value: 'Alt 2.5/5' })
    assert.deepEqual(weightStepToSave({ ...f, second: '10' }, { stored: 'Alt 4/5', touched: true }), { value: 'Alt 4/10' })
    assert.deepEqual(weightStepToSave(f, { stored: 'Alt 4/5', touched: false }), { unchanged: true, value: 'Alt 4/5' })
    assert.deepEqual(weightStepFields('Alt 2.5/5'), { amount: '2.5', second: '5', alternating: true, unreadable: null })
  })

  it('a bad box blocks Save', () => {
    const f = weightStepFields('Alt 4/5')
    assert.deepEqual(weightStepToSave({ ...f, second: 'x' }, { stored: 'Alt 4/5', touched: true }), {
      error: "Can't read 'x' — enter a step size",
    })
    assert.deepEqual(weightStepToSave({ ...f, amount: '' }, { stored: 'Alt 4/5', touched: true }), { error: 'Enter both step sizes' })
  })

  it('detail line', () => {
    assert.equal(describeWeightStep('Alt 2.5/5'), 'Two steps 2.5/5 kg')
    assert.equal(describeLightestWeight(7.5), 'Lightest 7.5 kg')
    assert.equal(describeLightestWeight(null), null)
    assert.equal(describeLightestWeight(undefined), null)
    assert.equal(parseLightestWeight(-1), null)
  })
})

describe('req-193 — the new field travels: update, migrateState, load, export/import', () => {
  const exercises = [
    { id: 'e1', name: 'Chest press', type: 'machine', weightStep: 'Alt 2.5/5', lightestWeight: 10 },
    { id: 'e2', name: 'Squat', type: 'free', weightStep: '2.5' },
    { id: 'e3', name: 'Row', type: 'machine', weightStep: '5', lightestWeight: null },
  ]

  it('updateExercise merges the patch (lightestWeight set, then cleared)', () => {
    const s = { ...emptyState(), exercises: structuredClone(exercises) }
    const set = exerciseUpdatedState(s, 'e2', { lightestWeight: 20 })
    assert.equal(set.exercises[1].lightestWeight, 20)
    assert.equal(set.exercises[1].weightStep, '2.5')
    const cleared = exerciseUpdatedState(set, 'e2', { lightestWeight: null })
    assert.equal(cleared.exercises[1].lightestWeight, null)
  })

  it('migrateState passes it through and adds it to no exercise that lacks it', () => {
    const migrated = migrateState({ ...emptyState(), exercises: structuredClone(exercises) })
    assert.equal(migrated.exercises[0].lightestWeight, 10)
    assert.equal(migrated.exercises[0].weightStep, 'Alt 2.5/5')
    assert.equal('lightestWeight' in migrated.exercises[1], false)
    assert.equal(migrated.exercises[2].lightestWeight, null)
  })

  it('loadState from a stored v9 doc keeps it', () => {
    const doc = migrateState({ ...emptyState(), exercises: structuredClone(exercises) })
    const map = new Map([['workout-mvp-v9', JSON.stringify(doc)]])
    const previous = globalThis.localStorage
    globalThis.localStorage = {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => map.set(key, String(value)),
      removeItem: (key) => map.delete(key),
    }
    try {
      const state = loadState()
      assert.equal(state.exercises[0].lightestWeight, 10)
      assert.equal(state.exercises[0].weightStep, 'Alt 2.5/5')
    } finally {
      globalThis.localStorage = previous
    }
  })

  it('export → JSON → import round-trips it', () => {
    const source = migrateState({ ...emptyState(), exercises: structuredClone(exercises) })
    const file = JSON.parse(JSON.stringify(buildBackup(source)))
    const { state } = applyBackup(file)
    assert.deepEqual(
      state.exercises.map(({ id, weightStep, lightestWeight }) => ({ id, weightStep, lightestWeight })),
      source.exercises.map(({ id, weightStep, lightestWeight }) => ({ id, weightStep, lightestWeight })),
    )
    assert.deepEqual(validWeights(state.exercises[0]).slice(0, 3), [10, 12.5, 17.5])
  })
})

describe('req-193 — the editors\' series preview (first 5 of validWeights)', () => {
  it('single step, with and without a lightest weight', () => {
    assert.equal(weightSeriesPreview({ weightStep: '5' }), 'Weights: 5, 10, 15, 20, 25 …')
    assert.equal(weightSeriesPreview({ weightStep: '5', lightestWeight: 7.5 }), 'Weights: 7.5, 12.5, 17.5, 22.5, 27.5 …')
  })

  it('two steps from a lightest weight', () => {
    assert.equal(weightSeriesPreview({ weightStep: 'Alt 2.5/5', lightestWeight: 10 }), 'Weights: 10, 12.5, 17.5, 20, 25 …')
  })

  it("legacy 'Alt 4/5', no lightest weight → from 9, +5 first", () => {
    assert.equal(weightSeriesPreview({ weightStep: 'Alt 4/5' }), 'Weights: 9, 14, 18, 23, 27 …')
    assert.equal(weightSeriesPreview({ weightStep: 'Alt 4/5', lightestWeight: null }), 'Weights: 9, 14, 18, 23, 27 …')
  })

  it('no step → the hold text', () => {
    for (const weightStep of ['n/a', '', undefined, 'abc']) {
      assert.equal(weightSeriesPreview({ weightStep }), NO_SERIES_TEXT)
      assert.equal(weightSeriesPreview({ weightStep, lightestWeight: 20 }), NO_SERIES_TEXT)
    }
    assert.equal(NO_SERIES_TEXT, 'No step set — suggestions hold')
  })

  it('a short series has no ellipsis', () => {
    assert.equal(weightSeriesPreview({ weightStep: '10', lightestWeight: 220 }), 'Weights: 220, 230, 240, 250')
  })
})
