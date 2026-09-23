// req-121 — navigation-only buttons become links (DEC-016/DEC-040); app banners use
// the library; History's in-progress row puts retreat left, forward right (DESIGN §4).
//
// The files are JSX, so plain `node --test` can't import and render them; the source
// is locked as text — the static-source approach of views/workout/item.test.js. The
// rendered check is the req-121 screenshots.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url)) // src
const read = (p) => readFileSync(join(here, p), 'utf8')

const today = read('views/Today.jsx')
const routine = read('views/Routine.jsx')
const schedule = read('views/Schedule.jsx')
const setup = read('views/workout/setup.jsx')
const app = read('App.jsx')
const list = read('views/history/list.jsx')
const autoComplete = read('views/workout/auto-complete.jsx')

function fnBody(src, name) {
  const start = src.search(new RegExp(`(export )?function ${name}\\(`))
  assert.ok(start >= 0, `${name} not found`)
  const next = src.slice(start + 1).search(/\n(export )?function /)
  return src.slice(start, next < 0 ? undefined : start + 1 + next)
}

// A <Button …> whose only handler is a go() call — the pattern this req removes.
const NAV_BUTTON = /<Button\b[^>]*onClick=\{\(\) =>\s*go\(/

test('Today empty day: "Start new workout" is a NavLink to /routines with the primary block look', () => {
  const body = fnBody(today, 'TodayEmpty')
  assert.doesNotMatch(body, NAV_BUTTON)
  assert.doesNotMatch(body, /<Button\b/)
  assert.match(
    body,
    /<NavLink to="\/routines" className="ui-btn ui-btn--primary ui-btn--block">\s*Start new workout\s*<\/NavLink>/,
  )
})

test('Routine forms: Cancel is a NavLink to cancelTo, no onCancel handler left', () => {
  for (const name of ['RoutineNewForm', 'ExerciseFields']) {
    const body = fnBody(routine, name)
    assert.match(body, /<NavLink to=\{cancelTo\} className="ui-btn ui-btn--secondary">Cancel<\/NavLink>/, name)
    assert.doesNotMatch(body, /onCancel/, name)
    assert.doesNotMatch(body, />Cancel<\/Button>/, name)
  }
  // Every caller passes a path, not a go() callback.
  assert.doesNotMatch(routine, /onCancel=/)
  assert.doesNotMatch(schedule, /onCancel=/)
  assert.match(routine, /cancelTo="\/routines"/)
  assert.match(routine, /cancelTo=\{nav\.pick\}/)
  assert.match(routine, /cancelTo=\{parent\}/)
  assert.match(schedule, /cancelTo=\{dayPath\}/)
})

test('Workout exercise setup: Cancel is a NavLink to backTo', () => {
  const body = fnBody(setup, 'WorkoutItemExercise')
  assert.doesNotMatch(body, NAV_BUTTON)
  assert.match(body, /<NavLink to=\{backTo\} className="ui-btn ui-btn--secondary">Cancel<\/NavLink>/)
})

test('App: no raw role="alert" div and no raw <button>; banners use Banner, Reload uses Button', () => {
  assert.doesNotMatch(app, /<div role="alert">/)
  assert.doesNotMatch(app, /<button\b/)
  assert.equal((app.match(/<Banner role="alert">/g) || []).length, 3)
  assert.match(app, /<Button onClick=\{\(\) => window\.location\.reload\(\)\}>Reload<\/Button>/)
  assert.match(app, /import \{ Banner, Button \} from '\.\/ui\/index\.jsx'/)
})

test('History in-progress row: Abandon (retreat) left, Continue (forward) right', () => {
  const body = fnBody(list, 'InProgressHistoryRow')
  const abandon = body.indexOf('Abandon\n')
  const cont = body.indexOf('>Continue</Button>')
  assert.ok(abandon > 0 && cont > 0, 'both controls present')
  assert.ok(abandon < cont, 'Abandon must come before Continue')
})

test('failure case: auto-complete Edit stays a Button that sets the flag (req-116)', () => {
  const edit = autoComplete.lastIndexOf('<Button', autoComplete.indexOf('>\n        Edit\n'))
  const block = autoComplete.slice(edit, autoComplete.indexOf('Edit\n      </Button>', edit))
  assert.match(block, /store\.patchActive\(\{ autoFinishDismissed: true \}\)/)
  assert.doesNotMatch(autoComplete, /<NavLink[^>]*>\s*Edit/)
})
