// req-154 (audit F-TRUST-1, DEC-058 §1) — a typed kg with a comma ("22,5", the Swedish
// decimal keypad) is 22.5 at every logged-set save path; text that isn't a number is
// never saved as 0 or NaN. The four save paths are tested through the pure helpers they
// call (the views are .jsx, which `node --test` can't import); that the views and forms
// call them is checked on the source.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { kgError, kgToSave, normalizeKgText, readKg } from './kg-input.js'
import { activeSetPatch, historySetFields, liveSetWeight } from './views/set-values.js'
import { withHistorySet } from './views/history/add-set.js'
import { parseKg } from './routine-item-parse.js'
import { parseWeightStep } from './weight-step.js'

const src = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const BAD = ['abc', '2,5,5', '22.5.5', '1e1', '-5']

describe('readKg — the shared typed-kg parse', () => {
  it('reads a comma as the decimal point, and a dot the same', () => {
    assert.deepEqual(readKg('22,5'), { value: 22.5 })
    assert.deepEqual(readKg('22.5'), { value: 22.5 })
    assert.deepEqual(readKg(' 20 '), { value: 20 })
    assert.deepEqual(readKg('20 kg'), { value: 20 })
    assert.deepEqual(readKg(17.5), { value: 17.5 }, 'a stored number re-read unchanged')
    assert.deepEqual(readKg(0), { value: 0 })
  })
  it('blank is empty, not 0', () => {
    for (const blank of ['', '   ', null, undefined]) assert.deepEqual(readKg(blank), { empty: true })
  })
  it('text that is not a number is an error, never a value', () => {
    for (const bad of BAD) {
      const read = readKg(bad)
      assert.equal('value' in read, false, bad)
      assert.equal(typeof read.error, 'string', bad)
      assert.equal(kgError(bad), read.error)
    }
    assert.equal(kgError('22,5'), null)
    assert.equal(kgError(''), null)
  })
  it('kgToSave uses the site empty value only for a blank field', () => {
    assert.deepEqual(kgToSave('', 0), { value: 0 })
    assert.deepEqual(kgToSave('', ''), { value: '' })
    assert.deepEqual(kgToSave('22,5', 0), { value: 22.5 })
    assert.ok(kgToSave('abc', 0).error)
  })
  it('the routine editor and weight step share the normaliser (behaviour unchanged)', () => {
    assert.equal(normalizeKgText(' 22,5 kg '), '22.5')
    assert.deepEqual(parseKg('20/22,5').list, [20, 22.5])
    assert.equal(parseWeightStep('2,5'), 2.5)
    assert.equal(parseWeightStep('2,5 kg'), 2.5)
  })
})

describe('site 1 — live log (item.jsx completeSet → liveSetWeight)', () => {
  it('22,5 / 22.5 / " 20 " / blank', () => {
    assert.equal(liveSetWeight('22,5', true), 22.5)
    assert.equal(liveSetWeight('22.5', true), 22.5)
    assert.equal(liveSetWeight(' 20 ', true), 20)
    assert.equal(liveSetWeight('', true), 0, 'blank stays 0, as before')
  })
  it('unweighted is 0 whatever the text', () => {
    assert.equal(liveSetWeight('abc', false), 0)
  })
  it('bad text logs nothing (null), never 0 or NaN', () => {
    for (const bad of BAD) assert.equal(liveSetWeight(bad, true), null, bad)
  })
  it('item.jsx logs loggedWeight, returns before logging on null, and carries the parsed kg', () => {
    const item = src('./views/workout/item.jsx')
    assert.match(item, /const loggedWeight = liveSetWeight\(weight, isWeightedType\(ex\.type\)\)\n\s*if \(loggedWeight == null\) return\n\s*recordButton\('complete-set'\)/)
    assert.match(item, /weight: loggedWeight,/)
    assert.match(item, /logged: \{ weight: loggedWeight, reps \}/)
  })
})

describe('site 2 — active set edit (item.jsx WorkoutSetEdit → activeSetPatch)', () => {
  const values = (weight) => ({ weight, reps: '8', rpe: '4', note: 'n' })
  it('22,5 / 22.5 / " 20 " / blank', () => {
    assert.deepEqual(activeSetPatch(values('22,5')), { weight: 22.5, reps: '8', rpe: 4, note: 'n' })
    assert.equal(activeSetPatch(values('22.5')).weight, 22.5)
    assert.equal(activeSetPatch(values(' 20 ')).weight, 20)
    assert.equal(activeSetPatch(values('')).weight, 0, 'blank stays 0, as before')
  })
  it('bad text → no patch (null)', () => {
    for (const bad of BAD) assert.equal(activeSetPatch(values(bad)), null, bad)
  })
  it('kg hidden (cardio / bodyweight): weight is left as stored, not re-read', () => {
    const patch = activeSetPatch(values('abc'), { showLoad: false })
    assert.deepEqual(patch, { reps: '8', rpe: 4, note: 'n' })
  })
  it('WorkoutSetEdit saves only a non-null patch', () => {
    assert.match(src('./views/workout/item.jsx'), /const patch = activeSetPatch\(values, \{ showLoad: usesLoad \}\)\n\s*if \(!patch\) return\n\s*store\.updateActiveSet\(index, patch\)/)
  })
})

describe('site 3 — History edit (history/edit.jsx HistorySet → historySetFields)', () => {
  const values = (weight) => ({ weight, reps: '8', rpe: '', note: '', setType: 'work' })
  it('22,5 / 22.5 / " 20 " / blank', () => {
    assert.deepEqual(historySetFields(values('17,5')), { setType: 'work', weight: 17.5, reps: '8', rpe: null, note: '' })
    assert.equal(historySetFields(values('22.5')).weight, 22.5)
    assert.equal(historySetFields(values(' 20 ')).weight, 20)
    assert.equal(historySetFields(values('')).weight, '', "blank stays '', as before")
  })
  it('bad text → nothing to save (null)', () => {
    for (const bad of BAD) assert.equal(historySetFields(values(bad)), null, bad)
  })
  it('the stored JSON has a number, not null', () => {
    assert.equal(JSON.stringify({ weight: historySetFields(values('22,5')).weight }), '{"weight":22.5}')
  })
  it('HistorySet saves only non-null fields', () => {
    assert.match(src('./views/history/edit.jsx'), /const fields = historySetFields\(values\)\n\s*if \(!fields\) return/)
  })
})

describe('site 4 — History add set (history/add-set.js withHistorySet)', () => {
  const workout = { id: 'w1', sets: [], snapshot: { items: [{ routineItemId: 'ri-a', exerciseId: 'ex-a' }] } }
  const add = (weight) =>
    withHistorySet(workout, {
      exerciseId: 'ex-a',
      itemId: 'ri-a',
      exercise: { name: 'Bench' },
      values: { weight, reps: '8', rpe: '', note: '', setType: 'work' },
    })
  it('22,5 / 22.5 / " 20 " / blank', () => {
    assert.equal(add('22,5').sets[0].weight, 22.5)
    assert.equal(add('22.5').sets[0].weight, 22.5)
    assert.equal(add(' 20 ').sets[0].weight, 20)
    assert.equal(add('').sets[0].weight, '', "blank stays '', as before")
  })
  it('bad text → no patch (null); the workout is not touched', () => {
    for (const bad of BAD) assert.equal(add(bad), null, bad)
    assert.equal(workout.sets.length, 0)
  })
  it('HistorySetAdd writes only a non-null patch', () => {
    assert.match(src('./views/history/edit.jsx'), /const patch = withHistorySet\([^)]*\)\n\s*if \(!patch\) return\n\s*store\.updateWorkout\(workout\.id, patch\)/)
  })
})

describe('the forms refuse Complete / Save with an inline error', () => {
  it('SetLogForm checks kgError before onComplete and shows it', () => {
    const ui = src('./ui/index.jsx')
    // req-155 — the same gate now also checks the Duration (`|| seconds?.error`); the kg
    // check still runs first and still returns before onComplete.
    assert.match(ui, /const error = weighted \? kgError\(weight\) : null\n(?:\s*\/\/.*\n)?\s*const seconds = [^\n]*\n\s*if \(error \|\| seconds\?\.error\) \{\n\s*setWeightError\(error\)\n[^}]*return\n\s*\}\n\s*onComplete\?\.\(/)
    assert.match(ui, /\{weightError \? \(\n\s*<p className="ui-field-error" role="alert">/)
  })
  it('SetEditForm checks kgError before onSave and shows it', () => {
    const edit = src('./views/set-edit.jsx')
    assert.match(edit, /const error = showLoad \? kgError\(weight\) : null\n\s*if \(error\) \{\n\s*setWeightError\(error\)\n\s*return\n\s*\}\n\s*onSave\(/)
    assert.match(edit, /\{showLoad && weightError \? \(\n\s*<p className="ui-field-error" role="alert">/)
  })
})
