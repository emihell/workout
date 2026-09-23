# req-125 — typed-but-not-completed set values survive navigation and reload (audit Tier 3)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[P]**: an optional field on the active workout, stripped
at finish; touches `workout-log.js` / `store.jsx` (DEC-057: reviewer + backup reminder). No schema bump. Rewritten
2026-09-23 after spec review, which found a req-83 regression risk, a typing-loss risk, and a Previous+reload loss.

## Why [measured, audit gym reviewer]

Weight, reps, effort and duration live in `SetLogForm` local state (`ui/index.jsx:~358-361`), and the note in
`WorkoutItemLive` state. Leaving via ‹ Exercises, the exercise-name link or the rest pill, or iOS reloading the tab,
loses what you typed for the current set. Previous puts the un-logged set's values into component state `restore`
(`item.jsx:~245-256`), which a reload also loses.

## The behaviour

1. **Field `setDraft` on the active workout** (not "draft": `draftWorkouts`/`continueDraft` already use that word):
   `{ key: <itemKey|setType|workIndex>, weight, reps, effort, durationSec, note }`, one at a time. **Load path:**
   `migrateState` → `workoutSnapshot` keeps unknown activeWorkout fields via `...workout` (`model.js:~151`, `~324`), so it
   survives a reload. The only strip path is `finishedState` (`workout-log.js:~177`); Abandon drops the whole workout.
2. **Written** as the user edits the current set's form (throttling is implementation; no visible lag).
3. **Read only on mount / set change** (keyed by the same `setSeedKey`), never as a live seed, so a late write can't
   reset a field mid-typing (the note re-seeds from `noteSeed` today, `item.jsx:~338-341`).
4. **Seed precedence:** a matching `setDraft` → the form's `initial*` values; else the existing chain (req-106/108).
   **The comparison base for req-83's weight carry stays the chain `seed`**, not the draft (`nextSeedOverrides`,
   `item.jsx:~192-198`), so a drafted weight change still carries to later sets.
5. **Previous writes the un-logged values as the `setDraft`** of the set it returns to (replacing `restore`
   component state), so Previous + reload keeps them.
6. **Cleared** when that set is Completed or Skipped; **ignored** when its key no longer matches the current set
   (logged elsewhere, item replaced).
7. Out of scope: a running duration timer's deadline (`ui/index.jsx:~292`); only the typed duration value is kept.
   The start-of-exercise preview keeps showing the **seed**, not the draft **(unconfirmed)**.

## Scope

`src/views/workout/item.jsx`, `src/ui/index.jsx` (SetLogForm `onChange`), `src/workout-log.js` (pure draft helpers
+ strip), `src/store.jsx` if needed, tests.

## Order vs siblings

After req-124 (`store.jsx`).

## Acceptance criteria

- **Failure case — reload (puppeteer):** type 42 kg / 7 reps on set 2, reload → the form shows 42 / 7.
- **Navigation (puppeteer):** type, go to ‹ Exercises, come back → the values are still there.
- **Previous + reload (puppeteer):** log set 1, Previous, reload → set 1's logged values are in the form.
- **req-83 still carries (unit):** a draft of 42 on set 2 (seed 40), Complete → set 3's seed is 42 via `seedOverrides`.
- **No mid-typing reset (unit/static):** the draft is read only when `setSeedKey` changes.
- **Cleared / stale (unit):** Complete → `setDraft` gone; a draft whose key doesn't match the current set → ignored.
- **Stripped (unit):** `finishedState` output has no `setDraft`. An old active workout loads without it.
- `./check` green; no schema change (receipt quoted).

## Decisions

- Field name, throttle, SetLogForm API: implementation. The preview keeps the seed **(unconfirmed)**.
