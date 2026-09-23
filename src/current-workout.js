import { coveringWorkout, dateKey, occurrenceId } from './schedule.js'

// req-114 / DEC-058 §2 — the ONE "current" rule for the in-progress workout. It is
// current if it was started today (local calendar day) OR within the last 6 hours, so
// a workout started 23:50 is still the Today hero at 00:05, and today's Start doesn't
// ask to abandon it. Older than that (started a prior day, 6 h+ ago) it is stale: a
// Continue row, not the hero (DEC-038). Used by the Today hero, startOrContinue's
// "continuing the same workout" check and staleInProgressWorkouts. Wake-lock is NOT
// on this rule (req-114 out of scope). Pure: `now` is injected so tests fake the clock.
export const CURRENT_WINDOW_MS = 6 * 60 * 60 * 1000

export function isCurrentWorkout(workout, now = new Date(), todayKey = dateKey(now)) {
  if (!workout) return false
  if (dateKey(workout.startedAt) === todayKey) return true
  const elapsed = new Date(now).getTime() - new Date(workout.startedAt).getTime()
  return elapsed >= 0 && elapsed <= CURRENT_WINDOW_MS
}

// req-114 / DEC-058 §3 — while a current workout is the Today hero, today's block still
// lists today's OTHER occurrences with their own Start/Done. "Other" is by occurrence
// id, not routine: today's slot of the same routine a pre-midnight workout came from
// (occurrence `slot@yesterday`) is a different occurrence and stays listed. `todays`
// is Today's resolved `{ slot, routine }` list for `todayKey`.
// req-114 review — an OFF-schedule workout (started from the Routine screen: no
// scheduleSlotId, occurrence `adhoc-R@today`) of a routine also scheduled today IS
// that slot's workout, as coveringWorkout (schedule.js) already treats an off-schedule
// same-routine workout finished today as covering it. So it drops the slot too;
// otherwise Today listed R twice (in progress + Start).
export function otherTodayOccurrences(todays, active, todayKey) {
  if (!active) return todays || []
  const activeRoutine = active.routineId || active.sessionId
  const offScheduleToday = !active.scheduleSlotId && active.performedOn === todayKey
  return (todays || []).filter(({ slot, routine }) => {
    if (occurrenceId(slot.id, todayKey) === active.occurrenceId) return false
    const slotRoutine = routine?.id || slot.routineId
    return !(offScheduleToday && slotRoutine === activeRoutine)
  })
}

// req-116 — the workout preview's guard: the finished workout that already covers the
// previewed plan's occurrence, or null. Browser Back after Finish lands on the preview
// (`go()` always pushes a hash entry); without this it offered a fresh Start one tap from
// the workout just saved. An exact occurrence match first, then the same coveringWorkout
// test Today's Done uses, so the preview says Done exactly when Today does. The ad hoc
// preview (`/workout/R`, no slot) is therefore Done once R was finished that day — the
// Routine screen's own Start (not the preview) still starts R again.
// req-116 review — Back after a CROSS-MIDNIGHT finish (slot started Tue 23:50, finished
// Wed 00:10) lands on the ad hoc preview dated Wed, which no date test covers. So for
// the ad hoc plan a same-routine workout FINISHED within the last 6 h also covers it —
// the DEC-058 §2 window (CURRENT_WINDOW_MS), as isCurrentWorkout uses. `now` injected.
export function finishedForPlan(workouts, plan, now = new Date()) {
  if (!plan) return null
  const sameRoutine = (w) => (w.routineId || w.sessionId) === plan.routineId
  const exact = (workouts || []).find(
    (w) => w.finishedAt && plan.occurrenceId && w.occurrenceId === plan.occurrenceId && sameRoutine(w),
  )
  if (exact) return exact
  const covering = coveringWorkout(workouts, plan.routineId, plan.date, plan.scheduleSlotId || null)
  if (covering || plan.scheduleSlotId) return covering
  const nowMs = new Date(now).getTime()
  return (
    (workouts || []).find((w) => {
      if (!w.finishedAt || !sameRoutine(w)) return false
      const elapsed = nowMs - new Date(w.finishedAt).getTime()
      return elapsed >= 0 && elapsed <= CURRENT_WINDOW_MS
    }) || null
  )
}
