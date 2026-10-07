// req-203 §1 / §3 — the day screen's decisions, pure and JSX-free so `node --test` reads
// them: which calendar date the screen is about (only when entered from Home's week),
// what finished on it, whether a slot still offers Start now, and the plain copy for
// the loop line and the Remove confirm.
import { WEEKDAY_ORDER, weekdayName } from '../ids.js'
import { addDays, coveringWorkout, dateKey, loopWeekIndex, mondayOf, toLocalDate } from '../schedule.js'
import { completedOnDayKey } from '../history-queries.js'
import { WEEKDAY_SHORT } from '../plan-templates.js'

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

// req-208 — the slot row's "⋯" menu (the in-workout row menu's pattern, req-188): the
// workout's name as the title, then Change day and Remove. Each opens its own sheet as before.
export function slotMenuSheet(name) {
  return {
    title: name,
    choices: [
      { value: 'change', label: 'Change day' },
      { value: 'remove', label: 'Remove' },
    ],
  }
}

// req-207 (DEC-116) — "Change day": the sheet that moves a slot to another weekday of the
// same loop week (removeSlot + addSlot). The 7 weekdays Mon–Sun, the current one marked
// (picking it changes nothing); a day that already has this workout in this loop week is
// left out (a second slot of it there is what Add workout refuses too). `taken`: weekdays.
export function changeDaySheet(name, weekday, week, loop, taken = []) {
  const current = Number(weekday)
  const already = new Set(taken.map(Number))
  return {
    title: `Move ${name} to which day?`,
    message: `It moves ${loop > 1 ? `in week ${Number(week) + 1} of ${loop}` : 'for every week'}. Your history is kept.`,
    choices: WEEKDAY_ORDER.filter((day) => day === current || !already.has(day)).map((day) => ({
      value: String(day),
      label: day === current ? `${weekdayName(day)} (now)` : weekdayName(day),
    })),
  }
}

// Where Change day lands: the new day's screen in the same loop week. A dated screen stays
// dated — the same Mon–Sun week's day with the new weekday (dayScreenDate re-checks it fits,
// else the screen falls back as usual). The caller adds `from`.
export function changedDayPath(week, weekday, date) {
  const path = `/schedule/${week}/${weekday}`
  if (!date) return path
  const moved = addDays(mondayOf(date), (Number(weekday) + 6) % 7)
  return `${path}?date=${dateKey(moved)}`
}

// req-209 §7 (Noa: "Rest · Today" on a day she trained) — a Schedule row: the planned
// names, else "Rest"; today's row is marked "Today", or "Today · Done ✓" once a workout
// finished today (doneOnDay, by finish date). A finished workout on an unplanned day names
// the row instead of "Rest". `doneNames`: today's finished workouts' names. Pure.
export function scheduleRowText({ names = '', isToday = false, doneNames = [] } = {}) {
  const done = isToday && doneNames.length > 0
  return {
    label: names || (done ? doneNames.join(', ') : 'Rest'),
    value: isToday ? (done ? 'Today · Done ✓' : 'Today') : null,
  }
}

// req-211 (DEC-117 §2) — "Change day" on a DATED day screen (from Home) moves that one date
// (schedule.moves); the Schedule's undated day keeps req-207's every-week move. The sheet
// lists the 7 dates of `date`'s Mon–Sun week, the current one marked; a date that already
// has this workout on it (`taken`: date keys, from slotsOn) is left out, as req-207 leaves
// out a taken weekday. Values are the date keys.
export function oneDateSheet(name, date, taken = []) {
  const monday = mondayOf(date)
  const already = new Set(taken)
  const days = Array.from({ length: 7 }, (_, k) => dateKey(addDays(monday, k)))
  return {
    title: `Move ${name} to which day?`,
    message: 'Only this week — the Schedule stays as it is.',
    choices: days
      .filter((key) => key === date || !already.has(key))
      .map((key) => {
        const label = weekdayName(toLocalDate(key).getDay())
        return { value: key, label: key === date ? `${label} (now)` : label }
      }),
  }
}

// req-211 — where a one-date move lands: the chosen date's own day screen (its loop week and
// weekday, the date in `?date=`). The caller adds `from`.
export function dateDayPath(schedule, key) {
  return `/schedule/${loopWeekIndex(schedule, key)}/${toLocalDate(key).getDay()}?date=${key}`
}

// req-211 — the small sub-line on a moved slot's row: "moved from Fri".
export function movedFromText(from) {
  return `moved from ${WEEKDAY_SHORT[toLocalDate(from).getDay()]}`
}
