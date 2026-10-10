// req-215 (DEC-119 §4) — the "Days" row on a workout's own screen. Pure reads of the schedule:
// which weekdays this workout is on (in any loop week), and what one chip tap writes. The view
// applies the result through the store's own addSlot / removeSlot — no new action, no schema.
import { clampLoopWeeks } from './schedule.js'
import { WEEKDAYS_MON_FIRST } from './plan-templates.js'
import { routineScheduledDaysText } from './state-reducers.js'

function slotsOf(schedule, routineId) {
  return (schedule?.slots || []).filter((slot) => slot.routineId === routineId)
}

// The weekdays (0 = Sun) with at least one slot of this workout in any loop week, Mon–Sun.
// `(unconfirmed)` DEC-119 §4: a day on in any week reads as on.
export function routineWeekdays(schedule, routineId) {
  const on = new Set(slotsOf(schedule, routineId).map((slot) => Number(slot.weekday)))
  return WEEKDAYS_MON_FIRST.filter((weekday) => on.has(weekday))
}

// One chip tap on `weekday`. On → off: every slot of this workout on that weekday, in every
// loop week, is removed (other workouts' slots untouched). Off → on: a slot in each loop week
// (none of them has one, or the day would read as on).
// → { on (after the tap), add: [{ week, weekday, routineId }], remove: [slotId] }
export function daysToggle(schedule, routineId, weekday) {
  const day = Number(weekday)
  const mine = slotsOf(schedule, routineId).filter((slot) => Number(slot.weekday) === day)
  if (mine.length) return { on: false, add: [], remove: mine.map((slot) => slot.id) }
  const loop = clampLoopWeeks(schedule?.loopWeeks)
  const add = []
  for (let week = 0; week < loop; week += 1) add.push({ week, weekday: day, routineId })
  return { on: true, add, remove: [] }
}

// The row's value: "Mon and Thu" (routineScheduledDaysText), or "Not scheduled".
export function daysRowText(state, routineId) {
  return routineScheduledDaysText(state, routineId) || 'Not scheduled'
}

// req-215 §2 — the first-time starts ("Not sure? Use a plan", the days step) show only while
// there is no active (not archived) workout.
export function hasActiveWorkout(routines) {
  return (routines || []).some((routine) => routine && !routine.archivedAt)
}
