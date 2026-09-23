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
  // the date is outside the per-routine map
  assert.ok(block.indexOf('ui-today-workout__date') < block.indexOf('todays.map('))
  // the per-routine piece carries no date line
  assert.doesNotMatch(fnBody('TodayRoutine'), /ui-today-workout__date/)
})

test('Today renders one grouped block for all of today\'s slots', () => {
  const today = src.slice(src.indexOf('export function Today('))
  assert.match(today, /<TodayWorkouts store=\{store\} todays=\{todays\} date=\{todayKey\} \/>/)
  // no per-slot block with its own date is mapped any more
  assert.doesNotMatch(today, /todays\.map\(/)
})

test('each routine gets its own Start with its own slot, or Done once covered', () => {
  const routine = fnBody('TodayRoutine')
  assert.match(routine, /coveringWorkout\(store\.workouts, routine\.id, date, slot\.id\)/)
  assert.match(routine, /<StartButton store=\{store\} routine=\{routine\} slot=\{slot\} date=\{date\} variant="primary" block \/>/)
  // req-114 — `Done` now prints the shared weekdayDate format (was the raw ISO key).
  assert.match(routine, /Done \{weekdayDate\(dateKey\(done\.finishedAt\)\)\}/)
  // StartButton threads the slot through to the workout (scheduleSlotId)
  assert.match(fnBody('StartButton'), /scheduleSlotId: slot\.id/)
})

test('one routine renders the pre-req-110 shape (no __routine wrapper)', () => {
  const block = fnBody('TodayWorkouts')
  assert.match(block, /todays\.length === 1 \?/)
  const single = block.slice(block.indexOf('todays.length === 1 ?'), block.indexOf(') : ('))
  assert.doesNotMatch(single, /ui-today-workout__routine/)
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
  assert.match(today, /<TodayHero store=\{store\} workout=\{hero\} others=\{others\} date=\{todayKey\} \/>/)
  assert.doesNotMatch(today, /dateKey\(mine\.startedAt\)/)
  const hero = fnBody('TodayHero')
  // one date line — today's, not the workout's own date
  assert.equal(hero.match(/ui-today-workout__date/g)?.length, 1)
  assert.match(hero, /weekdayDate\(date\)/)
  assert.match(hero, /<TodayRoutine store=\{store\} routine=\{routine\} slot=\{slot\} date=\{date\} \/>/)
})

test('every Start names its occurrence; Done rows use weekdayDate', () => {
  assert.match(fnBody('StartButton'), /occurrenceId: occurrenceId\(slot\.id, date\)/)
  assert.doesNotMatch(src, /Done \$\{dateKey\(/)
  assert.doesNotMatch(src, /Done \{dateKey\(/)
})
