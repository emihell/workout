import { itemKey } from './workout-log.js'

// Pure route builders for the in-workout item screens. Extracted from
// views/workout/helpers.jsx (req-76) so JSX-free modules can share them: notably
// workout-actions.js, which is loaded by `node --test` and therefore must not pull
// in any .jsx. views/workout/helpers.jsx re-exports these, so its callers are
// unchanged — this is the one source of truth for the item log/done paths.

export function itemLogPath(routineId, item) {
  return `/workout/${routineId}/item/${itemKey(item)}/log`
}

export function itemDonePath(routineId, item) {
  return `/workout/${routineId}/item/${itemKey(item)}/done`
}

// req-109 — the Replace exercise picker for an item.
export function itemReplacePath(routineId, item) {
  return `/workout/${routineId}/item/${itemKey(item)}/replace`
}

// One branch, written once: a done exercise goes to its done screen, otherwise its
// log screen. The `done` boolean varies by caller (marked-done+plannedDone on the
// overview, plannedDone alone on the setup form), so it stays an argument.
export function itemCurrentPath(routineId, item, done) {
  return done ? itemDonePath(routineId, item) : itemLogPath(routineId, item)
}

// req-153 — what an in-workout route (item log/done/replace/exercise, set edit, finish)
// shows when there is NO active workout for its routine — typically an old history
// entry reached by Back after the workout was saved or abandoned: 'redirect' to the
// routine's overview (/workout/<id>, its preview or Done view), replacing the entry.
// An active workout for this routine whose item/set isn't there, or a routine that
// doesn't exist, is a genuinely wrong route: 'missing' ("Not found.").
export function inWorkoutFallback({ active, routineId, routineKnown }) {
  const activeHere = Boolean(active && (active.routineId || active.sessionId) === routineId)
  return !activeHere && routineKnown ? 'redirect' : 'missing'
}
