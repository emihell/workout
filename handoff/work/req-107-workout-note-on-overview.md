# req-107 — a workout note on the workout overview, carried to Finish (batch 4, F7)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[ux-feel]** Persisted-adjacent (transient
`activeWorkout` field; **no schema-version bump**).

From Emilio's in-app note (2026-09-18, `/workout/sess-push-pull`): *"Able to add notes here as well"*

## Why

[measured] The only workout-level note is the Finish screen's `overallNote` — component state
(`src/views/workout/finish.jsx:23`), saved by `finishWorkout`. The auto-complete path finishes with
`overallNote: ''` (`src/views/workout/auto-complete.jsx:50`). So there's no way to jot a note mid-workout.

## The behaviour

- The overview gets an **"Add note"** control that reveals a note field (the req-26/req-80 pattern).
  Once there is text, the field stays shown.
- The note is kept on the **active workout** (an optional field), so it survives leaving the overview,
  logging sets and reloading.
- **Finish screen:** its Note field **starts with that text** and is still editable; what's saved is
  whatever the field holds at Finish.
- **Auto-complete** (req-84) saves the overview note as the workout's note instead of `''`. Otherwise
  a note written on the overview would be lost silently.
- Abandon discards it with the workout (unchanged semantics).

## Scope

`src/views/workout/overview.jsx`, `finish.jsx`, `auto-complete.jsx`; the store's active-workout patch
path; tests.

## Out of scope

Per-set notes (unchanged); editing the note in History (already exists for finished workouts).

## Order vs siblings

After req-105 (same overview file), before req-109.

## Acceptance criteria

- **Persists (browser):** type a note on the overview → open an exercise, log a set, reload → the
  note is still there.
- **Carried to Finish (browser):** press Finish → the Note field holds the overview text; save → the
  history detail shows it.
- **Failure case — auto-complete:** finish every exercise and let the summary auto-finish → the saved
  workout carries the overview note (unit test on the finish call's input; not `''`).
- **Failure case — older active workout (unit):** an active workout saved **without** the new field
  loads, and the overview + Finish show an empty note (no crash, no "undefined").
- **Empty note:** no note typed → the saved workout's note is `''`, as today.
- **No regression:** `./check` green; no `STORAGE_KEY` / schema-version change.

## Decisions

- One workout note: the overview note pre-fills Finish and auto-complete saves it (Emilio, 2026-09-23).
- Field name and where it's patched — implementation (CC).
