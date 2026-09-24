// req-155 — decimal leftovers from req-154's review. (1) A trailing `,` / `.` on a kg is
// the whole number (`22,` → 22), at all four set-save sites. (2) A typed duration reads a
// comma as a decimal point and rounds to whole seconds, half up (`30,5` → 31); unreadable
// text is an inline error, never a silent 0 / silent default.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readKg } from './kg-input.js'
import { defaultDurationToSave, readSeconds, secondsError, secondsToSave } from './seconds-input.js'
import { activeSetPatch, historySetFields, liveSetWeight } from './views/set-values.js'
import { withHistorySet } from './views/history/add-set.js'
import { parseKg } from './routine-item-parse.js'

const src = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('1 — a trailing separator on a kg is the whole number', () => {
  it('readKg: 22, and 22. → 22; still refused: 2,5,5 / abc / -5 / . / ,', () => {
    assert.deepEqual(readKg('22,'), { value: 22 })
    assert.deepEqual(readKg('22.'), { value: 22 })
    for (const bad of ['2,5,5', 'abc', '-5', '.', ',', '22,,']) assert.ok(readKg(bad).error, bad)
  })
  const values = (weight) => ({ weight, reps: '8', rpe: '', note: '', setType: 'work' })
  const workout = { id: 'w1', sets: [], snapshot: { items: [] } }
  const add = (weight) =>
    withHistorySet(workout, { exerciseId: 'ex-a', itemId: 'ri-a', exercise: null, values: values(weight) })
  for (const typed of ['22,', '22.']) {
    it(`"${typed}" → 22 at the live log, active set edit, History edit and History add`, () => {
      assert.equal(liveSetWeight(typed, true), 22)
      assert.equal(activeSetPatch(values(typed)).weight, 22)
      assert.equal(historySetFields(values(typed)).weight, 22)
      assert.equal(add(typed).sets[0].weight, 22)
    })
  }
  it('"2,5,5" is still refused at all four', () => {
    assert.equal(liveSetWeight('2,5,5', true), null)
    assert.equal(activeSetPatch(values('2,5,5')), null)
    assert.equal(historySetFields(values('2,5,5')), null)
    assert.equal(add('2,5,5'), null)
  })
  it('the routine editor Kg shares the shape: 20/22, → [20, 22]', () => {
    assert.deepEqual(parseKg('20/22,').list, [20, 22])
    assert.ok(parseKg('20/2,5,5').error)
  })
})

describe('2 — a typed duration in whole seconds', () => {
  it('readSeconds: comma is a decimal point, rounded half up', () => {
    assert.deepEqual(readSeconds('30,5'), { value: 31 })
    assert.deepEqual(readSeconds('30.5'), { value: 31 })
    assert.deepEqual(readSeconds('30,4'), { value: 30 })
    assert.deepEqual(readSeconds(' 45 '), { value: 45 })
    assert.deepEqual(readSeconds('45s'), { value: 45 })
    assert.deepEqual(readSeconds('30,'), { value: 30 })
    assert.deepEqual(readSeconds(60), { value: 60 }, 'a stored number re-read unchanged')
  })
  it('blank is empty; unreadable / negative is an error', () => {
    assert.deepEqual(readSeconds(''), { empty: true })
    for (const bad of ['abc', '3,0,5', '-5', '1e2']) {
      assert.ok(readSeconds(bad).error, bad)
      assert.equal(secondsError(bad), readSeconds(bad).error)
    }
    assert.equal(secondsError('30,5'), null)
  })
  it('timed set (SetLogForm): 30,5 → 31; blank → 0 as before; abc → error, not 0', () => {
    assert.deepEqual(secondsToSave('30,5', 0), { value: 31 })
    assert.deepEqual(secondsToSave('', 0), { value: 0 })
    assert.ok(secondsToSave('abc', 0).error)
    assert.equal('value' in secondsToSave('abc', 0), false)
  })
  it('exercise default (ExerciseEdit): 30,5 → 31; blank / 0 → the default as before; abc → error, not the default', () => {
    assert.deepEqual(defaultDurationToSave('30,5', 45), { value: 31 })
    assert.deepEqual(defaultDurationToSave('', 45), { value: 45 })
    assert.deepEqual(defaultDurationToSave('0', 45), { value: 45 })
    assert.deepEqual(defaultDurationToSave('0,4', 45), { value: 45 }, 'rounds to 0 → the default, as 0 did')
    assert.deepEqual(defaultDurationToSave('0,5', 45), { value: 1 })
    assert.ok(defaultDurationToSave('abc', 45).error)
  })
  it('SetLogForm gates Complete on the duration and shows the error', () => {
    const ui = src('./ui/index.jsx')
    assert.match(ui, /const seconds = timed \? secondsToSave\(duration, 0\) : null\n\s*if \(error \|\| seconds\?\.error\) \{[^}]*setDurationError\(seconds\?\.error \?\? null\)\n\s*return\n\s*\}/)
    assert.match(ui, /durationSec: timed \? seconds\.value : undefined,/)
    assert.match(ui, /\{durationError \? \(\n\s*<p className="ui-field-error" role="alert">/)
    assert.match(ui, /const typed = readSeconds\(seconds\)\.value \?\? 0/)
  })
  it('ExerciseEdit gates Save on the duration and saves duration.value', () => {
    const ex = src('./views/Exercises.jsx')
    assert.match(ex, /const duration = defaultDurationToSave\(durationSec, DEFAULT_DURATION_SEC\)/)
    assert.match(ex, /if \(saved\.error \|\| nameError\(name\) \|\| \(hasDuration && duration\.error\)\) return/)
    assert.match(ex, /durationSec: hasDuration \? duration\.value : ex\.durationSec \?\? DEFAULT_DURATION_SEC,/)
    assert.match(ex, /\{durationError \? \(\n\s*<p className="ui-field-error" role="alert">/)
  })
  it('the live log passes the form seconds through, no Number()', () => {
    assert.match(src('./views/workout/item.jsx'), /\.\.\.\(durationSec != null \? \{ durationSec \} : \{\}\),/)
  })
})
