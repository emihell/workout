// req-203 §1 / §3 — the day screen's decisions, pure and JSX-free so `node --test` reads
// them: which calendar date the screen is about (only when entered from Home's week),
// what finished on it, whether a slot still offers Start now, and the plain copy for
// the loop line and the Remove confirm.
import { weekdayName } from '../ids.js'
import { addDays, coveringWorkout, dateKey, loopWeekIndex, mondayOf, toLocalDate } from '../schedule.js'
import { completedOnDayKey } from '../history-queries.js'

// The date a day screen stands for when its link carries none (req-203). Home's old
// "This week" rows (req-200, gone in req-204) linked `/schedule/:week/:weekday?from=/`,
// every one a day of `now`'s Mon–Sun week. So from Home the date is that week's day with
// this weekday — provided its loop week is the one in the path (a stale link from last
// week's Home names another loop week: no date). Kept as the no-`?date=` fallback.
// Entered any other way (Whole plan, a slot page) the screen is the recurring loop day and
// has no date: null.
export function homeDayDate(schedule, week, weekday, from, now = new Date()) {
  if (!from || String(from).split('?')[0] !== '/') return null
  const monday = mondayOf(now)
  const offset = (Number(weekday) + 6) % 7 // Mon 0 … Sun 6
  const date = addDays(monday, offset)
  if (loopWeekIndex(schedule, date) !== Number(week)) return null
  return dateKey(date)
}

// req-204 — the date a day screen stands for. Home's "Coming up" rows link the date
// itself (`?date=`, parsed by route.js), since it can be next week or later. It is used
// when it really is a day of this path's loop week and weekday; a date that doesn't fit
// (hand-edited, or a schedule changed since) is ignored. Without a usable date the screen
// behaves as before: homeDayDate (this week's day when entered from Home), else none.
export function dayScreenDate(schedule, week, weekday, from, date, now = new Date()) {
  if (date && dateKey(date) === date) {
    const day = toLocalDate(date)
    if (day.getDay() === Number(weekday) && loopWeekIndex(schedule, day) === Number(week)) return date
  }
  return homeDayDate(schedule, week, weekday, from, now)
}

// The workouts finished on `date` (the finish date, never slot id),
// oldest first so the day reads down in order. None without a date.
export function doneOnDay(workouts, date) {
  if (!date) return []
  return completedOnDayKey(workouts, date).reverse()
}

// Start now: never on a past date; on today, not once a workout finished today covers
// this slot (coveringWorkout, Home's today block's rule); always on a future date. With
// no date (the recurring loop day from Whole plan) it shows as before (req-200).
export function startNowShown({ workouts, routineId, slotId, date, todayKey }) {
  if (!date) return true
  if (date < todayKey) return false
  if (date === todayKey && coveringWorkout(workouts, routineId, date, slotId)) return false
  return true
}

// "Every Wednesday", or "Every Wednesday in week 2 of 2" in a longer loop: the slots on
// this screen repeat, which a dated title alone does not say.
export function dayEveryText(weekday, week, loop) {
  const name = weekdayName(weekday)
  return loop > 1 ? `Every ${name} in week ${Number(week) + 1} of ${loop}` : `Every ${name}`
}

// The Remove confirm says what it does: the slot leaves the recurring day; history stays.
export function removeSlotText(name, weekday, week, loop) {
  const where = `${weekdayName(weekday)}s${loop > 1 ? ` in week ${Number(week) + 1}` : ''}`
  return `Take ${name} off ${where}? Your history is kept.`
}

// "Wednesday, Oct 7" — the dated title (the year only when it isn't this year, as
// weekdayDate).
export function longWeekdayDate(key, now = new Date()) {
  const [year, month, day] = String(key).split('-').map(Number)
  const opts = { weekday: 'long', month: 'short', day: 'numeric' }
  if (year !== now.getFullYear()) opts.year = 'numeric'
  return new Date(year, month - 1, day).toLocaleDateString(undefined, opts)
}
