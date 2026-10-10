**Status: READY** **Lane: data** — import replaces stored state (a bulk write): independent reviewer, backup reminder,
Emilio's eyes before merge (DEC-035 carve-out).

# req-220 — "Export for your AI": a current, self-describing export, and an import that shows what changed

DEC-121 §1 (Emilio, 2026-10-10: "the export should have the rules for import and data structure, so users can export the data,
and chat with their prefered ai to upgrade the plan, then import it in again"). Builder: Builder session or throwaway agent.

## Decided (DEC-123 §2–3, Emilio "your picks") — Q1 (a), Q2 recommended

1. **When the AI's file changes logged history** (a workout edited or removed), what does import do?
   - **(a) Recommended:** the preview says so ("2 logged workouts changed") and offers **Keep my history** (default; take the
     plan, exercises and schedule from the file, keep the current `workouts`) or **Replace everything**.
   - (b) Refuse files that change history.  (c) Warn only, then replace everything.
2. **Where the button lives:** on Backup & data as **"Export for your AI"** under "Back up now" (recommended), or also on the
   Workouts list?

## Facts (rescanned 2026-10-10, `main` 98f94cf) [measured, Explore agent]

- `ASSISTANT` (`src/exchange.js:9-125`): `prompt`, `howTheAppWorks` (summary, exercises, routines, routineExercise, schedule incl.
  `moves`, workout, ids), `import` (kind, version, instructions, `stateShape`, enums). Added to the backup by
  `buildBackup(state, { includeAssistant })` (`exchange.js:131-140`).
- The option is a dev-only Checkbox "Assistant prompt" (`views/Settings.jsx:115-120`, shown only with `#/settings?dev=1`).
  Export: "Back up now" → `workout-database-YYYY-MM-DD.json` (`import-backup.js:28`).
- **Missing from `ASSISTANT`** (omissions, nothing false): effort/`rpe` meaning (per exercise since req-212; 2/3/4 offered, 5
  legacy; `progress.js` ≤2 → up, ≥5 or missed reps → down); the set shape (weight, reps / `'skipped'`, rpe, targetReps,
  targetWeight, durationSec, note, `loggedAt`); cardio set fields (`level`, `distance`, `distanceUnit`, `cardio-set.js:108-116`);
  timed fields (`hasDuration`, exercise `durationSec`, routine item `durations[]`); `libraryId` in the exercise sample; `moves`
  in the schedule sample.
- Import (`import-backup.js:87-118` → `exchange.js:263-306`): validate → confirm "Replace all data on this device?" → download a
  copy of current data (req-07) → `commitBackup` replaces the whole state. **No comparison of incoming `workouts` with current
  ones; "keep workouts" exists only as an instruction to the AI** (`exchange.js:23, 60, 114`).
- Tests pin `ASSISTANT` by a few regexes only (`exchange.test.js:67-79, 177-180`); nothing checks it against the stored shape.
- `handoff/reference/schema.md` is stale on the same points (Planner updates it alongside this req).

## Scope

1. **Button.** "Export for your AI" on Backup & data (per Q2), always visible, with a 3-line how-to: export → give the file to
   your AI and talk it through → Restore its file here. Writes the backup with `assistant` included. The dev checkbox goes.
2. **Bring `ASSISTANT` current** for every gap above, plus: how to read history for progression (effort per exercise, missed
   reps, `loggedAt`), "never invent completed workouts or sets", and "change routines' `suggestedWeights` / targets to progress".
3. **Can't go stale:** a test builds a full sample state through `migrateState` and fails if any stored field of an exercise,
   routine item, schedule (incl. moves), finished workout or set is not described in `ASSISTANT` (a field map in exchange.js).
4. **Import preview** before anything is replaced: counts of workouts (plans) added / changed / removed, exercises added,
   schedule changed yes/no, and logged history: unchanged / N changed / N removed. Then the Q1 behaviour. The req-07 copy of
   current data still downloads first. Applies to every import (AI or backup).

## Out of scope

In-app AI / any API (DEC-121 §2, Phase 3); merging individual workouts; validating references beyond what `migrateState` does.

## Acceptance criteria

1. The button exports a file whose `assistant` covers every field the stale-test lists; the test fails when a field is added to a
   sample without a description (proven by a deliberately undocumented field in a test fixture).
2. Import of a file identical to current data → preview "nothing changed"; of a file with one routine edited → "1 changed",
   history unchanged.
3. **Failure case:** a file with one logged workout's set kg altered → preview "1 logged workout changed"; Keep my history →
   stored `workouts` byte-identical to before, routines taken from the file (per Q1 (a)).
4. Cancel at the preview writes nothing. Invalid file → the existing friendly error, no preview.
5. Round-trip: export → import unchanged → state deep-equal (incl. `loggedAt`, moves, cardio fields).
6. `./check` green; smoke; reviewer; Emilio's eyes.

## Decisions made on Emilio's behalf

- **behaviour** `(unconfirmed)`: the preview applies to every import, not only AI files.
- **behaviour** `(unconfirmed)`: how-to wording; "Export for your AI" label.
- **implementation:** the field map lives beside `ASSISTANT`; the preview is a pure diff helper with unit tests.

## READY checks

1. DECs: DEC-121, DEC-085 §7 (in-app AI later), DEC-046 (backup), req-07/115/157 (import safety). 2. Siblings: none in flight.
3. Deferral: the in-app API reuses the same `ASSISTANT` + preview — building them now is the reusable part. 4. Facts from the
   rescan. 5. Trigger: import path (`exchange.js`, `import-backup.js`, store) → reviewer + backup reminder. 6. Q1/Q2 open → NEEDS
   DECISIONS.
