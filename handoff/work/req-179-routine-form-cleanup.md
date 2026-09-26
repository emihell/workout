# req-179 — Routine form cleanup: no Focus, a "Warm-up exercise" switch, no warm-up set, plain words

**Status: READY** (2026-09-26). **Lane: ui.** Source: DEC-099 (Emilio, req-144 prep §E.3/§E.6 + req-175 review).
Behaviour calls below are Planner's under DEC-095, marked `(unconfirmed)`, and go on Emilio's end-of-batch list.
**Build order (Planner, 2026-09-26):** **req-179** → req-180 → req-181 on main; req-178 is held for Emilio's Q1 and
the data-lane gate, and rebases onto these (it shares `ExerciseFields` in `views/Routine.jsx`, incl. the Kg field). req-180 (picker) rewrites the add flow
(`RoutineExerciseNew`) and req-181 (slot templates) builds on `RoutineNewForm` — both after this one.

## Today [read 2026-09-26, main `1e228c0`]
- **Focus** is asked in both routine forms: `<Select label="Focus" options={FOCUS_OPTIONS}>` at `views/Routine.jsx:96`
  (`RoutineNewForm`, default `'Machines'` at `:80`) and `:236` (`RoutineEdit`, saves `{ name, focus }` at `:230`).
  `store.addRoutine` stores `focus || 'Machines'` (`store.jsx:64`). Shown as a suffix/value at: `Routine.jsx:68`
  (`{routine.name} — {routine.focus}`), `:132` (detail meta `extra · focus`), `Schedule.jsx:178` (`<Row value={routine.focus}>`),
  `Today.jsx:71` (`WorkoutInfo`, fed `snapshot.focus`/`routine.focus` at `:85,:97,:120,:240`), `:145`, `:186`.
  Snapshots copy it (`model.js:236,477,487`). 16 `"focus"` keys in `src/db.json` [measured: `grep -c '"focus"' src/db.json` → 16].
- **Role** is a 4-option select: `<Select label="Role" options={ROUTINE_ROLES}>` (`Routine.jsx:350`); options
  warmup/main/finisher/cardio (`ids.js:62-67`). Read only as a label: `roleLabel`/`roleTag` (`ids.js:69-81`) →
  `routineItemMeta` (`ids.js:95`), `history/detail.jsx:132`, `workout/overview.jsx:25`. New item default:
  `role: ex?.type === 'cardio' ? 'warmup' : 'main'` (`Routine.jsx:412`).
- **Warm-up set**: `<Checkbox label="WU set">` + "Warmup reps" field (`Routine.jsx:351-360`); submit writes
  `warmup: warmup ? { reps: warmupReps } : null` (`:340`). A new item copies history's: `warmup: history?.warmup || null`
  (`:432`, from `history-queries.js:230`). Reducer keeps the old value when the patch omits it:
  `warmup: patch.warmup === undefined ? item.warmup : patch.warmup` (`state-reducers.js:211`).
- **Words:** `label="Rest (s)"` (`Routine.jsx:395`); Reps/Kg/Duration are single text fields read by slash
  (`routine-item-parse.js:5-6`: Reps/Duration split on `/` `,`; Kg on `/`); a shorter list repeats its last value
  (`:11-12`). Row meta says `'WU set'` (`ids.js:95`); in-workout and History already say "Warm-up set" (req-175,
  `workout/overview.jsx:75`).
- **Docs/prompt:** `README.md:8` "(sets, reps, kg, rest, notes, WU set)". `exchange.js:19` "add or remove a WU set";
  `:38` "warmup = WU routine … main | finisher | cardio"; `:40-41` WU set; `:82` focus enum in the example; `:123` `routineRoles`.

## Change
1. **Focus gone from the UI.** No Focus field in `RoutineNewForm` or `RoutineEdit`; no " — Focus" / focus value on any
   screen (the eight display sites above). `RoutineEdit` saves `{ name }` only, so a stored `focus` is left untouched.
   Stored values (routines and snapshots) stay, unread. Supersedes the `name — focus` row format (DECISIONS.md:570-575).
2. **Role → one switch, "Warm-up exercise"** (the existing `Checkbox`). On = `role: 'warmup'`. Off = `'main'` —
   **except** an item whose stored role is `finisher` or `cardio` keeps it while the switch stays off (no silent rewrite).
   New items start **off for every type**, cardio included (DEC-099 §2 "Main is the default") `(unconfirmed)`.
3. **Warm-up set not offered.** No "WU set" checkbox, no warm-up reps field on a new item; a new item no longer copies
   `history.warmup` (saves `warmup: null`) `(unconfirmed)`. An item that already has one: its value is kept byte-for-byte
   on Save (DEC-022: never re-invent the reps), and the form shows one ticked checkbox **"Keep warm-up set (N reps)"** —
   untick removes it; it can't be added back `(unconfirmed)`.
4. **Plain words.** "Rest (seconds)". Reps: one field, the value applies to every set; a **"Different reps per set"**
   switch reveals one field per set ("Set 1", "Set 2" …, count = Sets). Same pattern for Kg ("Different kg per set") and,
   when timed, Duration ("Different duration per set") so no slash is asked anywhere in the form `(unconfirmed)`.
   The switch starts on when the item's stored values differ between sets. Turning it off keeps Set 1's value for all
   `(unconfirmed)`. Row meta `'WU set'` → `'Warm-up set'` (`ids.js:95`).
5. **Docs/prompt match.** `README.md:8` → "(sets, reps, kg, rest, notes; a warm-up exercise is marked with a switch)".
   `exchange.js`: drop `focus` from the example routine and "add or remove a WU set"; role text → "warmup for a warm-up
   exercise (e.g. 5 min bike), otherwise main; keep finisher/cardio where they already exist"; warmup text → "keep an
   existing { reps } as it is; null on new items". Import still accepts every old value.

## Out of scope
- Any data rewrite: `focus`, `finisher`/`cardio` roles, existing `warmup` objects all stay in storage and snapshots.
- `store.jsx` (`addRoutine` still writes `focus: 'Machines'`, now unread — a follow-up if wanted), `model.js` (snapshot
  `focus`, `model.js:12-15` role inference), `workout-log.js` (in-workout warm-up set handling). No trigger file changes.
- Display of stored finisher/cardio tags (`roleTag`) — unchanged; old items still read "Finisher"/"Cardio" `(unconfirmed)`.
- Slash in *display* ("20/22/24 kg" row meta, plan lines) — input only here.
- The weight source (req-178), the picker and starting plan (req-180), templates (req-181).
- `ui/Showcase.jsx:194` / `ui.css:526,566` comments — Builder may update the example/comments; not required.

## Steps
1. Branch from main; re-read `ExerciseFields` (`Routine.jsx:~299-402`).
2. Focus: remove the two Selects and the `focus` state/threading (`Routine.jsx:80,91,96,113-114,212,230,236`;
   `Schedule.jsx:161-162`); drop the display at the eight sites; remove the `FOCUS_OPTIONS` import (keep or delete the
   constant — Builder, if unused elsewhere).
3. Role: replace the Select with the switch; compute the saved role in a small pure helper
   (`savedRole(storedRole, switchOn)`) with unit tests; change `Routine.jsx:412` default to `'main'`.
4. Warm-up set: remove the checkbox/field for new items; `:432` → `warmup: null`; for an existing one render the "Keep"
   checkbox and on Save send `warmup: keep ? item.warmup : null` (the same object, not rebuilt).
5. Per-set fields: a view-level `PerSetField` that joins its values with `/` into the **unchanged** `parseRoutineItem`
   (`routine-item-parse.js:77`) — errors keep their `Set N` positions. Use it for Reps, Kg, Duration.
6. Labels: "Rest (seconds)", `ids.js:95` "Warm-up set"; README/exchange text as in Change 5.
7. Tests (render harness as `src/req-175.test.js:9,21-40`) in `src/req-179.test.js`; `./check`.

## Acceptance criteria
1. Add routine and Edit routine (Name) render no "Focus" field; Save of a new routine, then Edit→Save, leave
   `routines[i].focus` as stored (test reads `workout-mvp-v9`).
2. A v8 fixture routine with `focus: 'Machines'` renders on Routines, routine detail, Schedule "Add routine" list and
   Today with **no** "Machines" text; the finished workout row with `snapshot.focus` likewise (render test, assert on
   the DOM text, not the source).
3. **Failure case — no silent rewrite:** a stored item with `role: 'finisher'` and `warmup: { reps: 12 }`, opened and
   saved with nothing touched → stored `role === 'finisher'` and `warmup` deep-equals `{ reps: 12 }`. Untick "Keep
   warm-up set" → `warmup === null`; switch on → `role === 'warmup'`; switch off again → `'main'`.
4. **Is the right mechanism answering?** New item for an exercise whose history has a warm-up set (`history-queries.js:230`
   returns `{ reps }`) → saved `warmup === null`, and no warm-up control is rendered. A cardio exercise → switch off,
   saved `role === 'main'`.
5. Reps "Different reps per set" on, Sets 3, values 12 / 10 / 8 → stored `targets` `['12','10','8']`; switch off with
   "10" → `['10','10','10']`. Clear Set 2 with the switch on → Save blocked with "Set 2 is empty." (the parser's message,
   `routine-item-parse.js:39`). Editing an item with `['12','10','8']` opens with the switch on. Same checks for Kg.
6. No "WU set", "Rest (s)", "Role", "Finisher" (as an option) or "/"-separated input remains in the routine item form
   (DOM text of the rendered form); README.md:8 and `exchange.js` no longer contain "WU".
7. `node --test` for existing suites unchanged except named edits: `ids.test.js:66` (`'WU set'` → `'Warm-up set'`) —
   justified in the report. `./check --smoke` green.
8. Browser (Planner, `plan qa`, 390×844): create a routine, add two exercises, one with different reps per set; edit a
   seeded item that has a warm-up set and a finisher role, Save, read back `workout-mvp-v9`.

## Decisions made on Emilio's behalf
**Behaviour `(unconfirmed)`** (Planner, DEC-095): new cardio items start as Main, not Warm-up (Change 2); stored
finisher/cardio kept while the switch is off and still tagged in rows/History; new items drop history's warm-up set;
an existing warm-up set shows as "Keep warm-up set (N reps)", removable, not re-addable; "Different … per set" applied to
Kg and Duration too; turning it off keeps Set 1's value; README/prompt wording.
**Implementation (Builder):** `savedRole` / `PerSetField` names and files; whether `FOCUS_OPTIONS` is deleted; test layout.

## READY checks
1. DECs grepped (focus, role, WU, warm-up, finisher, slash): DEC-099 (source), DEC-022 (warm-up reps never invented →
   keep the stored object), DEC-058 §1 (Kg `,` is a decimal — per-set Kg fields keep it), DECISIONS.md:570-575 (`name —
   focus` format, superseded by DEC-099 §1), DEC-093 (listed Focus suffix/jargon as waiting for req-144), DEC-095.
2. Siblings: req-178 before (shared `ExerciseFields`/Kg), req-180 and req-181 after (add flow; `RoutineNewForm`).
3. Deferral: `store.jsx:64` still writes `'Machines'` for new routines — unread, cheap to drop later; stays that size.
4. Numbers: 16 focus keys in `db.json` (command above); line refs read this session on `1e228c0`.
5. Trigger files (`store.jsx`, `model.js`, `storage.js`, `progress.js`, `workout-log.js`, load/migrate): **none touched**
   → no independent reviewer required, no backup reminder. If the build finds it must touch one, the reviewer runs.
   No migration, no bulk write → ask-gate #2 does not fire.
6. Every user-visible call above is marked `(unconfirmed)`.
