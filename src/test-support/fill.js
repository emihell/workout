// req-178 — the load guards (req-158 / req-164 / req-165) pin loadState to MAIN's output.
// loadState now also runs the one-time routine-kg fill (routine-kg-fill.js), so their
// expectation becomes "main's output with that same fill applied" — built here from the
// pinned value and the loaded state's own marker time, never from the branch's output. Every
// other field still has to deep-equal main; the fill's own rules are pinned in req-178.test.js.
import { DEVICE_FILL_KEY, fillRoutineKgFromHistory } from '../routine-kg-fill.js'

export { DEVICE_FILL_KEY }
const plain = (value) => JSON.parse(JSON.stringify(value))

// A disk value as the guards snapshot it: parsed JSON, or the raw string (the device marker
// is a plain ISO time, not JSON).
export function diskValue(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

// A main-pinned state → the same state after the fill.
export function filledLike(mainState) {
  return plain(fillRoutineKgFromHistory(structuredClone(mainState)).state)
}

// A main-pinned { state, disk } load (disk = key → parsed value) → with the fill: the state
// filled; on disk, the v9 value = that state when the fill changed something (else main's),
// and the device marker `marker` (the value this load wrote). Every other key is main's.
export function loadFilledLike(golden, marker) {
  const state = filledLike(golden.state)
  const changed = JSON.stringify(state) !== JSON.stringify(plain(golden.state))
  const disk = { ...golden.disk, [DEVICE_FILL_KEY]: marker }
  if (changed) disk['workout-mvp-v9'] = state
  return { state, disk }
}
