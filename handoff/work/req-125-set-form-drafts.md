# req-125 — typed-but-not-completed set values survive navigation and reload (audit Tier 3)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[P]**: an optional field on the active workout, stripped
at finish; touches `workout-log.js` / `store.jsx` (DEC-057: reviewer + backup reminder). No schema bump.

## Why [measured, audit gym reviewer]

Weight, reps, effort and duration live in `SetLogForm` local state (`ui/index.jsx:~358-361`), and the note in
`WorkoutItemLive` state. Tapping ‹ Exercises, the exercise-name link, the rest pill, or iOS reloading the tab loses
what you typed for the set you're on.

## The behaviour

1. While you edit the **current** set's form, its values (weight, reps, effort, duration, note) are kept as a draft
   on the active workout, keyed by item + set type + work index.
2. Coming back to that same set (navigation or reload) shows the draft instead of the normal seed.
3. The draft is cleared when that set is Completed, Skipped, or removed/Previous'd. A draft for a set that no longer
   exists or is already logged is ignored.
4. At most one draft per item; `finishedState` strips drafts (like `seedOverrides`); Abandon discards them.
5. Seed precedence: restore (Previous) > draft > the existing seed chain (req-106/108 unchanged). The start-of-exercise
   preview (req-106) keeps showing the **seed**, not the draft.

## Scope

`src/views/workout/item.jsx`, `src/ui/index.jsx` (SetLogForm `onChange` hook), `src/workout-log.js` (pure draft
helpers + finishedState strip), `src/store.jsx` if needed, tests. Write throttling is implementation, but every
keystroke must not cause a visible lag.

## Order vs siblings

After req-124 (both edit `item.jsx`).

## Acceptance criteria

- **Failure case — reload (puppeteer):** type 42 kg / 7 reps on set 2, reload → the form shows 42 / 7.
- **Navigation (puppeteer):** type, go to ‹ Exercises, come back → the values are still there.
- **Cleared (unit):** Complete → draft gone; next set shows its normal seed. Previous → draft gone.
- **Stale (unit):** a draft whose set was logged elsewhere, or whose item was replaced → ignored.
- **Stripped (unit):** `finishedState` output has no draft field.
- **Old active workout (unit):** loads without the field.
- `./check` green; no schema change (receipt quoted).

## Decisions

- Draft shown on return; the preview keeps the seed **(unconfirmed)**.
