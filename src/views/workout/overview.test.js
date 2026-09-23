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

// req-107 — one workout note on the active workout, shared by the overview and Finish.
test('the overview note is the active workout overallNote, written through patchActive', () => {
  assert.match(workout, /Add note/)
  assert.match(workout, /value=\{activeNote\(active\)\}/)
  assert.match(workout, /store\.patchActive\(\{ overallNote: e\.target\.value \}\)/)
  // Once the note has text the field stays shown (not only after tapping Add note).
  assert.match(workout, /noteOpen \|\| activeNote\(active\) \?/)
  // The note sits above the Finish/Abandon block.
  assert.ok(workout.indexOf('Add note') < workout.indexOf('to={`/workout/${routineId}/finish`}'))
})

test('Finish shows and writes back the same note; auto-complete saves it', () => {
  const finish = readFileSync(join(here, 'finish.jsx'), 'utf8')
  assert.doesNotMatch(finish, /setOverallNote/, 'no Finish-local note state')
  assert.match(finish, /const overallNote = activeNote\(active\)/)
  assert.match(finish, /store\.patchActive\(\{ overallNote: e\.target\.value \}\)/)
  assert.match(finish, /store\.finishWorkout\(\{ overallNote, overallFeel, progression \}\)/)
  const auto = readFileSync(join(here, 'auto-complete.jsx'), 'utf8')
  assert.doesNotMatch(auto, /overallNote: ''/)
  assert.match(auto, /store\.finishWorkout\(autoFinishArgs\(active, progression\)\)/)
})

// req-114 (audit G) — the preview's plan date is the local day (planDateFor, unit-tested
// under TZ=Europe/Stockholm in dates-tz.cases.js), never the UTC toISOString date.
test('the preview plan date is local (planDateFor), not the UTC date', () => {
  assert.match(fnBody('Workout'), /date: planDateFor\(date\)/)
  assert.doesNotMatch(src, /toISOString\(\)\.slice\(0, 10\)/)
})
