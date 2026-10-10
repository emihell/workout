// req-110 — a multi-routine day on Today (views/Today.jsx + ui/ui.css).
//
// Today.jsx is JSX, so plain `node --test` can't import and render it; the source is
// locked as text — the static-source approach of views/workout/item.test.js. The
// rendered check is the req-110 screenshots + the scratch puppeteer drive (report).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url)) // src/views
const src = readFileSync(join(here, 'Today.jsx'), 'utf8')
const css = readFileSync(join(here, '..', 'ui', 'ui.css'), 'utf8')

function fnBody(name) {
  const start = src.indexOf(`function ${name}(`)
  assert.ok(start >= 0, `${name} not found`)
  const next = src.indexOf('\nfunction ', start + 1)
  const nextExport = src.indexOf('\nexport function ', start + 1)
  const ends = [next, nextExport].filter((i) => i > 0)
  return src.slice(start, ends.length ? Math.min(...ends) : undefined)
}

test('today block prints the date line once, not once per routine', () => {
  const block = fnBody('TodayWorkouts')
  assert.equal(block.match(/ui-today-workout__date/g)?.length, 1)
  // req-214 test edit: the per-routine map moved out of TodayWorkouts into TodayPending (the
  // pending names) and TodayDone (the done rows); the date line still prints once, before them.
  assert.ok(block.indexOf('ui-today-workout__date') < block.indexOf('<TodayPending'))
  // the per-routine pieces carry no date line
  assert.doesNotMatch(fnBody('TodayPending'), /ui-today-workout__date/)
  assert.doesNotMatch(fnBody('TodayDone'), /ui-today-workout__date/)
})

test('Today renders one grouped block for all of today\'s slots', () => {
  const today = src.slice(src.indexOf('export function Today('))
  // req-195 — the block also receives today's done rows (`done`).
  assert.match(today, /<TodayWorkouts store=\{store\} todays=\{todays\} date=\{todayKey\} done=\{done\} \/>/)
  // no per-slot block with its own date is mapped any more
  assert.doesNotMatch(today, /todays\.map\(/)
})

// req-214 test edit (DEC-119 §3): was "each routine gets its own Start". Now one startable
// spot keeps its own Start (with its own slot), 2+ share one Start that asks which
// (StartChooser, same start arguments), and a covered spot is one Row "{name}  Done ✓ ›"
// linking the session (was the "Done ✓ — see your sets ›" link). Still keyed off the same
// `done` (coveringWorkout); the rendered behaviour is tested in req-214.test.js.
test('one startable spot keeps its own Start; 2+ share one Start that asks; Done once covered', () => {
  assert.match(fnBody('todaySpots'), /coveringWorkout\(store\.workouts, routine\.id, date, slot\.id\)/)
  const pending = fnBody('TodayPending')
  assert.match(pending, /startable\.length === 1 \?/)
  assert.match(pending, /<StartButton store=\{store\} routine=\{startable\[0\]\.routine\} slot=\{startable\[0\]\.slot\} date=\{date\} variant="primary" block \/>/)
  assert.match(pending, /<StartChooser store=\{store\} spots=\{startable\} date=\{date\} \/>/)
  assert.match(fnBody('StartChooser'), /startOrContinue\(store, spot\.routine\.id, spotStartOptions\(spot\.slot\.id, date\)\)/)
  assert.match(fnBody('TodayDone'), /<Row key=\{slot\.id\} to=\{withFrom\(`\/history\/\$\{session\.id\}`, '\/'\)\} value=\{value\}>/)
  // StartButton threads the slot through to the workout (scheduleSlotId, via spotStartOptions)
  assert.match(fnBody('StartButton'), /spotStartOptions\(slot\.id, date\)/)
})

test('one routine renders the pre-req-110 shape (no __routine wrapper)', () => {
  // req-214 test edit: TodayWorkouts no longer maps routines itself (single or several), so
  // it has no __routine wrapper in any shape (was: none in the single-routine branch).
  assert.doesNotMatch(fnBody('TodayWorkouts'), /ui-today-workout__routine/)
})

test('consecutive routines are spaced apart', () => {
  assert.match(css, /\.ui-today-workout__routine \+ \.ui-today-workout__routine \{\s*margin-top: var\(--ui-s4\);/)
})

// req-114 — loop clamp, the current rule, and the hero plus the rest of the day.
test('Today clamps loopWeeks like Schedule (an imported 6 reads as 4)', () => {
  const today = src.slice(src.indexOf('export function Today('))
  assert.match(today, /const loop = clampLoopWeeks\(schedule\?\.loopWeeks\)/)
  assert.doesNotMatch(src, /Math\.max\(1, Number\(schedule\?\.loopWeeks\)/)
})

test('the hero is the CURRENT workout and keeps today\'s other occurrences', () => {
  const today = src.slice(src.indexOf('export function Today('))
  assert.match(today, /isCurrentWorkout\(mine, now, todayKey\)/)
  assert.match(today, /otherTodayOccurrences\(todays, hero, todayKey\)/)
  // req-195 — `done` added; the hero props are otherwise unchanged.
  assert.match(today, /<TodayHero store=\{store\} workout=\{hero\} others=\{others\} date=\{todayKey\} done=\{done\} \/>/)
  assert.doesNotMatch(today, /dateKey\(mine\.startedAt\)/)
  const hero = fnBody('TodayHero')
  // one date line — today's, not the workout's own date
  assert.equal(hero.match(/ui-today-workout__date/g)?.length, 1)
  assert.match(hero, /weekdayDate\(date\)/)
  // req-214 test edit: the others render through todaySpots → TodayPending / TodayDone (was
  // one TodayRoutine each).
  assert.match(hero, /todaySpots\(store, others, date\)/)
  assert.match(hero, /<TodayPending store=\{store\} pending=\{pending\} date=\{date\} \/>/)
})

test('every Start names its occurrence; Done rows use weekdayDate', () => {
  // req-214 test edit: the occurrence is built by spotStartOptions (schedule.js), shared by
  // StartButton, StartChooser and the scheduled-workout screen.
  const schedule = readFileSync(join(here, '..', 'schedule.js'), 'utf8')
  assert.match(schedule, /export function spotStartOptions\(slotId, date\) \{\s*return \{ scheduledFor: dateKey\(date\), scheduleSlotId: slotId, occurrenceId: occurrenceId\(slotId, date\) \}/)
  assert.match(fnBody('StartButton'), /spotStartOptions\(slot\.id, date\)/)
  assert.doesNotMatch(src, /Done \$\{dateKey\(/)
  assert.doesNotMatch(src, /Done \{dateKey\(/)
})

// req-114 review — the hero's Continue resumes by id, never through startOrContinue's
// fresh-clock "current" re-check (which could ask to abandon just past the 6 h edge).
test('the hero Continue calls continueInProgress, not startOrContinue', () => {
  const hero = fnBody('HeroRoutine')
  assert.match(hero, /onClick=\{\(\) => continueInProgress\(store, workout\)\}/)
  assert.doesNotMatch(hero, /startOrContinue\(/)
})

// req-195 / DEC-108 §5 — a workout finished today lives inside today's block, never as a
// second today-dated row in the list below.
test('today\'s finished workouts render inside every shape of today\'s block', () => {
  // req-214 test edit: TodayWorkouts / TodayHero also pass their covered spots (`covered`),
  // and each done line is a Row with value "Done ✓" (was the "<name> · Done ✓" link text).
  for (const name of ['TodayWorkouts', 'TodayHero']) {
    assert.match(fnBody(name), /<TodayDone store=\{store\} covered=\{covered\} done=\{done\} \/>/, name)
  }
  assert.match(fnBody('TodayEmpty'), /<TodayDone store=\{store\} done=\{done\} \/>/)
  const done = fnBody('TodayDone')
  assert.match(done, /if \(!covered\.length && !done\.length\) return null/)
  assert.match(done, /withFrom\(`\/history\/\$\{workout\.id\}`, '\/'\)/)
  assert.match(done, /value="Done ✓"/)
  const today = src.slice(src.indexOf('export function Today('))
  assert.match(today, /doneInTodayBlock\(store\.workouts, others, todayKey\)/)
})

test('something done today: no "Nothing scheduled", and Start new workout turns secondary', () => {
  const empty = fnBody('TodayEmpty')
  assert.match(empty, /done\.length \? \(\s*<TodayDone[^]*\) : \(\s*<p className="ui-today-workout__name">Nothing scheduled today\.<\/p>/)
  assert.match(empty, /look=\{done\.length \? 'secondary' : 'primary'\} block/)
})

test('the list below holds prior days only (no completed-today rows)', () => {
  assert.doesNotMatch(src, /CompletedTodayRow/)
  // req-204 test edit (DEC-113): the prior-day peek rows are gone from Home entirely, so the
  // list below today's block is the History link alone (was: it opens on `recent.map(`).
  assert.doesNotMatch(src, /recent\.map\(|HistoryPeekRow/)
  // req-205 test edit (DEC-115): that last row is now "Schedule ›" (History moved under it).
  // req-206 test edit: it is the same NavLink as "Workouts ›" now, not a Row in a List.
  assert.match(src, /<p>\s*<NavLink to="\/schedule" chevron="forward">Schedule<\/NavLink>\s*<\/p>/)
})
