// req-105 — the workout overview's Finish control (views/workout/overview.jsx).
//
// overview.jsx is JSX, so plain `node --test` can't import and render it; the source
// is locked as text — the static-source approach of views/workout/item.test.js. The
// rendered check is the req-105 screenshots.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url)) // src/views/workout
const src = readFileSync(join(here, 'overview.jsx'), 'utf8')

function fnBody(name) {
  const start = src.indexOf(`export function ${name}(`)
  assert.ok(start >= 0, `${name} not found`)
  const next = src.indexOf('\nexport function ', start + 1)
  return src.slice(start, next < 0 ? undefined : next)
}

const workout = fnBody('Workout')

test('Finish is no longer a list row', () => {
  assert.doesNotMatch(workout, /<Row[^>]*finish`\}/)
  assert.doesNotMatch(workout, /<Row[^>]*>Finish<\/Row>/)
})

test('Finish is a NavLink with the button look (DEC-040), above Abandon', () => {
  const finish = workout.indexOf('to={`/workout/${routineId}/finish`}')
  assert.ok(finish >= 0, 'Finish link to the finish route not found')
  const open = workout.lastIndexOf('<', finish)
  assert.ok(workout.startsWith('<NavLink', open), 'Finish must be a NavLink, not a Button')
  const abandon = workout.indexOf('Abandon', finish)
  assert.ok(abandon > finish, 'Finish must sit above Abandon')
  assert.match(workout, /ui-btn ui-btn--\$\{allDone \? 'primary' : 'secondary'\} ui-btn--block/)
})

test('a block-styled anchor fits its container (border-box on .ui-btn--block)', () => {
  const css = readFileSync(join(here, '..', '..', 'ui', 'ui.css'), 'utf8')
  const start = css.indexOf('.ui-btn--block {')
  assert.ok(start >= 0)
  assert.match(css.slice(start, css.indexOf('}', start)), /box-sizing: border-box/)
})

test('one allDone test gates both the summary and the Finish style', () => {
  assert.match(workout, /const allDone = allItemsDone\(active\)/)
  assert.match(workout, /if \(allDone && !autoDismissed\)/)
  assert.doesNotMatch(workout, /items\.every\(/)
})
