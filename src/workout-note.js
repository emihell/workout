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

// req-116 — Feel lives on the active workout too (its existing `overallFeel`, created
// '' by startWorkout), so a Feel chosen on Finish survives Back and a reload. A legacy
// active workout without the field reads as ''.
export function activeFeel(active) {
  const feel = active?.overallFeel
  return typeof feel === 'string' ? feel : ''
}

// The store.finishWorkout arguments for the req-84 auto-complete commit. The note is
// whatever the user wrote on the overview — '' when they wrote none, exactly as before
// req-107. req-116 — Feel is whatever the user chose on Finish (activeFeel); still ''
// when they chose none, so auto-complete never invents a Feel (DESIGN §1). req-158 — no
// progression argument: Finish stores none.
export function autoFinishArgs(active) {
  return { overallNote: activeNote(active), overallFeel: activeFeel(active) }
}
