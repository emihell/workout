// req-107 — the one workout-level note, kept on the ACTIVE workout while it runs.
// It is the existing `activeWorkout.overallNote` (startWorkout creates it as '';
// finishWorkout writes it) — no second field, no schema change. The overview writes
// it through store.patchActive, the Finish screen shows/edits the same value, and the
// req-84 auto-complete path saves it instead of ''. JSX-free so `node --test` can load
// it (tests can't import .jsx — see workout-paths.js).

// The note as a display string. A legacy active workout / promoted draft
// (continueDraft) may carry no overallNote at all: that reads as '' — never
// `undefined` in a field, never a crash.
export function activeNote(active) {
  const note = active?.overallNote
  return typeof note === 'string' ? note : ''
}

// The store.finishWorkout arguments for the req-84 auto-complete commit. Feel stays
// empty (auto-complete never invents a Feel, DESIGN §1); the note is whatever the user
// wrote on the overview — '' when they wrote none, exactly as before req-107.
export function autoFinishArgs(active, progression) {
  return { overallNote: activeNote(active), overallFeel: '', progression }
}
