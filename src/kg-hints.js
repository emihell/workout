// req-183 (DEC-102) — two quiet notes under a work set's kg box. Neither is a prefill, a
// block or a dialog: the box keeps whatever the seed chain put there (setLogSeed), and
// Complete logs the typed kg exactly as before.
//
//   lastTime     — the routine has no kg at this set index, but history does: the named
//                  history value ("Last time: 30 kg"), never copied into the box (DESIGN §1).
//   bigJumpFrom  — the typed kg differs from the reference by MORE than 50% (exactly 50%
//                  is not a big change). Reference = the routine kg at this index, else the
//                  last-time kg; no reference → no note.
//
// Inputs, as the log form holds them: `kg` is the box text (read with readKg, so `22,5`
// is 22.5 — DEC-058); `routineKg` is routineKgFor(item, ...) — undefined for a warm-up
// (no hints there), '' / 0 for a blank routine kg; `lastKg` is historySetPrefill(...).weight
// ('' when history has no kg at this index). Unweighted exercises get no hints.
import { readKg } from './kg-input.js'

const NONE = { lastTime: null, bigJumpFrom: null }

function positive(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function kgHints({ weighted, kg, routineKg, lastKg }) {
  if (!weighted || routineKg === undefined) return NONE
  const planned = positive(routineKg)
  const last = positive(lastKg)
  const lastTime = planned == null ? last : null
  const ref = planned ?? last
  const typed = readKg(kg).value
  const bigJumpFrom = ref != null && typed > 0 && Math.abs(typed - ref) / ref > 0.5 ? ref : null
  return { lastTime, bigJumpFrom }
}
