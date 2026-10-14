import { itemKey } from './workout-log.js'

// req-223 (DEC-125 §2) — the "Up next" bar's trigger: an ARRIVAL at an exercise's log screen
// from a new Start, the review's `Next:` link, or the bar's own Skip. Not a stored fact: the
// marker lives in this module's memory only (never localStorage, never the workout), so a
// reload, Back, a list row, the GO pill or Continue — none of which mark — show no bar.
//
// One marker at a time. The caller marks right before it navigates; the log screen reads it
// when it mounts (arrivalFor, a pure read so a StrictMode double-run of its state initializer
// sees the same answer) and then clears it (clearArrival) whatever item it was for, so a
// marker whose screen never mounted can't surface later on another visit.
let pending = null

export function markArrival(routineId, item) {
  pending = { routineId, key: itemKey(item) }
}

export function arrivalFor(routineId, item) {
  return Boolean(pending && pending.routineId === routineId && pending.key === itemKey(item))
}

export function clearArrival() {
  pending = null
}

// The bar's countdown length (Emilio's number, DEC-125 §2 / I5).
export const UP_NEXT_MS = 5000
