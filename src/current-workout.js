import { dateKey, occurrenceId } from './schedule.js'

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
export function otherTodayOccurrences(todays, active, todayKey) {
  if (!active) return todays || []
  return (todays || []).filter(({ slot }) => occurrenceId(slot.id, todayKey) !== active.occurrenceId)
}
