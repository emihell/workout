# req-107 — a workout note on the workout overview, carried to Finish (batch 4, F7)

**Status: BUILT AND MERGED, 2026-09-23 — branch `req-107` (`279f185`…`279f185`, 1 commit).** Phase 1. **[ux-feel]** Persisted-adjacent (transient
`activeWorkout` field; **no schema-version bump**).

From Emilio's in-app note (2026-09-18, `/workout/sess-push-pull`): *"Able to add notes here as well"*

## Why

[measured] The only workout-level note is the Finish screen's `overallNote` — component state
(`src/views/workout/finish.jsx:23`), saved by `finishWorkout`. The auto-complete path finishes with
`overallNote: ''` (`src/views/workout/auto-complete.jsx:50`). So there's no way to jot a note mid-workout.

## The behaviour

- The overview gets an **"Add note"** control that reveals a note field (the req-26/req-80 pattern).
  Once there is text, the field stays shown.
- The note is kept on the **active workout**, so it survives leaving the overview, logging sets and
  reloading. **Reuse the existing `activeWorkout.overallNote`** — `startWorkout` already creates it as `''`
  (`store.jsx:241`) and `finishWorkout` writes it (`:369`). Don't add a second field. [review 2026-09-23]
- **Finish screen:** its Note field shows the **same note**, editable, and edits **write back** to the active
  workout's note — so Back from Finish and returning, or going back to the overview, shows the edit. One
  shared note (Emilio, 2026-09-23). What's saved is the note at Finish.
- **Auto-complete** (req-84) saves the note instead of `''`. Otherwise a note written on the overview
  would be lost silently. Build the auto-finish arguments in a **pure helper** in a `.js` module (e.g.
  `autoFinishArgs(active, …)` → `{ overallNote: active.overallNote || '', overallFeel: '', progression }`),
  called by `auto-complete.jsx:49-50` — tests can't import `.jsx` (`workout-paths.js:4`).
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
- **Write-through (browser):** edit the note on Finish → Back → overview shows the edited text.
- **Failure case — auto-complete (unit):** the auto-finish helper, given an active workout with a note,
  returns that note (not `''`); given none, returns `''`.
- **Failure case — older active workout (unit):** an active workout **without** `overallNote` (a legacy
  draft / `continueDraft`) loads, and the overview + Finish show an empty note (no crash, no "undefined").
- **Empty note:** no note typed → the saved workout's note is `''`, as today.
- **No regression:** `./check` green; no `STORAGE_KEY` / schema-version change.

## Decisions

- One workout note: the overview note pre-fills Finish and auto-complete saves it (Emilio, 2026-09-23).
- Field name and where it's patched — implementation (CC).
