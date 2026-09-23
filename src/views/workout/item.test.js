// req-104 — the exercise screens trim (views/workout/item.jsx + ui/ui.css).
//
// item.jsx is JSX, so plain `node --test` can't import and render it; the source is
// locked as text — the static-source approach of views/shared.test.js and
// ui/safe-area.test.js. The rendered check is the req-104 screenshots.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url)) // src/views/workout
const src = readFileSync(join(here, 'item.jsx'), 'utf8')
const css = readFileSync(join(here, '..', '..', 'ui', 'ui.css'), 'utf8')

function fnBody(name) {
  const start = src.indexOf(`export function ${name}(`)
  assert.ok(start >= 0, `${name} not found`)
  const next = src.indexOf('\nexport function ', start + 1)
  return src.slice(start, next < 0 ? undefined : next)
}

function ruleBody(selector) {
  const start = css.indexOf(selector + ' {')
  assert.ok(start >= 0, `selector ${selector} not found`)
  const open = css.indexOf('{', start)
  return css.slice(open + 1, css.indexOf('}', open))
}

test('done view has no Previous section and reads no last-finished sets', () => {
  const done = fnBody('WorkoutItemDone')
  assert.doesNotMatch(done, /<SectionHeader>Previous/)
  assert.doesNotMatch(done, /lastSetsForExercise\(/)
  // exactly one "None." left — Today's empty state; none orphaned under a missing header
  assert.equal(done.match(/None\./g)?.length, 1)
  assert.match(done, /<SectionHeader>Today<\/SectionHeader>/)
  assert.match(done, /Add set/)
})

test('log screen still reads lastSetsForExercise (prefills)', () => {
  assert.match(src, /const last = lastSetsForExercise\(store\.workouts, item\.exerciseId\)/)
})

test('exercise title is scoped to section size; the shared Title keeps title size', () => {
  assert.match(ruleBody('.ui-exercise-head .ui-title'), /font-size: var\(--ui-text-section\)/)
  assert.match(ruleBody('.ui-title'), /font-size: var\(--ui-text-title\)/)
})
