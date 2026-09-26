// req-178 — the load guards (req-158 / req-164 / req-165) pin loadState to MAIN's output.
// loadState now also runs the one-time routine-kg fill (routine-kg-fill.js), so their
// expectation becomes "main's output with that same fill applied" — built here from the
// pinned value and the loaded state's own marker time, never from the branch's output. Every
// other field still has to deep-equal main; the fill's own rules are pinned in req-178.test.js.
import { FILL_MARKER, fillRoutineKgFromHistory } from '../routine-kg-fill.js'

const plain = (value) => JSON.parse(JSON.stringify(value))

// A main-pinned state → the same state after the fill, marked at `at`.
export function filledLike(mainState, at) {
  return plain(fillRoutineKgFromHistory(structuredClone(mainState), { at }).state)
}

// A main-pinned { state, disk } load (disk = key → parsed value) → with the fill: the state
// filled, and the v9 value on disk = that state. The first load of an unmarked value always
// saves (the marker is new), so v9 on disk is what was loaded, even where main wrote nothing
// (an already-current v9 doc); every other key on disk is main's.
export function loadFilledLike(golden, loaded) {
  const state = filledLike(golden.state, loaded[FILL_MARKER])
  return { state, disk: { ...golden.disk, 'workout-mvp-v9': state } }
}
