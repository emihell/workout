# req-181 — start from a plan: pick days per week, fill the slots

**Status: READY — build after req-180 merges (uses its picker); behaviour calls below are `(unconfirmed)`.** (2026-09-26)
**Lane: ui** (plus one content fix, the dips tag). Source: DEC-098, req-144 prep §F. Blank routine stays (DEC-098 §4).

## Today [read 2026-09-26, main `1e228c0`]
- **Entry points.** Empty home (`isFirstRun`) → primary "Create your first routine" → `/routines/new`
  (`views/Today.jsx:318-328`, req-174). Routines list → "Add routine" → `/routines/new` (`views/Routine.jsx:42`).
  `/routines/new` is `RoutineNew` → `RoutineNewForm` (Name + Focus, `Routine.jsx:78-119`); route `routine-new`
  (`route.js:288`). No template, no days-per-week anywhere.
- **Routine** is created by `store.addRoutine({name, focus})` (`store.jsx:60-69`); items by `addRoutineExercise`
  (`store.jsx:79-82`), one `setState` (one save) per call (`store.jsx:41-47`).
- **Schedule** = `{ loopWeeks 1..4, anchor (a Monday), slots[] }`, slot `{ id, week (0-based), weekday (0=Sun), routineId }`
  (`schedule.js:1-4, 56-62`; `store.jsx:95-104`). `slotAddedState` drops an exact duplicate (`state-reducers.js:249-257`);
  `loopWeeksState` drops slots with `week >= loopWeeks` (`state-reducers.js:237-245`). Many routines per weekday are allowed
  (`Schedule.jsx:58-59` joins them). A 1–4 day week fits one loop week — no model change.
- **Library patterns** [measured: `node -e` over `src/library/exercises.json`, visible = `!hidden`]: visible 366, staples 194.
  Visible (staple) per slot pattern: squat 19 (10), hinge 20 (15), lunge 13 (10), horizontal-push 27 (16), vertical-push 21
  (14), horizontal-pull 19 (13), vertical-pull 17 (9), core-flexion 21 (12), core-stability 16 (9), core-rotation 6 (3).
- **Dips are `vertical-push`** in `src/library/common.js:29-34, 387` (Chest, Triceps, Bench, Machine, own-weighted,
  own-assisted, Ring — 7 rows); 6 of vertical-push's 14 staples are dips, so an "Overhead press" slot today lists
  dips beside overhead presses. `exercises.json` is generated from these tables by `scripts/build-library.mjs`
  (fetches the sha-pinned free-db source); `libraryProblems()` validates (`exerciseLibrary.js:405`). No app code reads
  `pattern` today (`grep -rn '\.pattern' src` → only `exerciseLibrary.js` validators/derive).
- Own exercises from the library keep `libraryId` (`exerciseCatalog.js:170`); manual ones have none, so no pattern.

## Change
1. **`/routines/new` offers two starts:** **"Start from a plan"** (top, primary) and **"Blank routine"** (today's form,
   as req-179 leaves it). Both entry points above land here unchanged.
2. **Plan step 1 — days per week: 1, 2, 3, 4.** Each shows its split and its days' slots (DEC-098 §2, prep §F table):

   | Days | Routines (name) | Slots |
   |---|---|---|
   | 1 "minimum" | Full body | Squat · Deadlift · Chest press · Row · Core |
   | 2 | Full body A, Full body B | A: Squat · Chest press · Row · Core — B: Deadlift · Overhead press · Pull-down · Lunge |
   | 3 | Full body A, B, C | A, B as 2 — C: Squat · Chest press · Pull-down · Core |
   | 4 | Upper, Lower (each twice a week) | Upper: Chest press · Row · Overhead press · Pull-down — Lower: Squat · Deadlift · Lunge · Core |

   Slot → pattern: Squat=squat, Deadlift=hinge, Chest press=horizontal-push, Row=horizontal-pull, Overhead
   press=vertical-push, Pull-down=vertical-pull, Lunge=lunge, Core=core-flexion|core-stability|core-rotation.
3. **Plan step 2 — fill the slots, day by day.** Each slot opens the req-180 picker **filtered to its pattern**: your
   own exercises of that pattern first (via `libraryId`), then library **staples** of it, "Show more" for the
   non-staples (DEC-098 §3). Typing searches everything, as req-180's picker does. One exercise per slot; a slot can be
   **skipped**. Values per item come from req-180's rule (history first, else the shown starting plan, DEC-097 §4;
   kg from history or blank, DEC-096 §2).
4. **Save** creates, in **one state write**: any library-picked exercises (as req-180 creates them, near-duplicate
   guard included), one routine per template day with its filled slots in order, and — only if the schedule has **no
   slots** — the week's schedule on these weekdays: 1 → Mon; 2 → Mon, Thu; 3 → Mon, Wed, Fri; 4 → Mon Upper, Tue Lower,
   Thu Upper, Fri Lower; `loopWeeks` set to 1. If slots exist, only the routines are made and the done screen says
   "Add them to your schedule" (link to Schedule). A day with every slot skipped makes no routine and no slot.
5. **Leaving before Save writes nothing.** After Save → Home (Today). DESIGN §4: the two starts and the day choice
   are navigation (`NavLink`); Save is the one committing Button (right), Cancel/Back left; a slot's Skip is lateral.
6. **Library fix:** the 7 dip rows move off `vertical-push` to `horizontal-push`; regenerate `exercises.json`.

## Out of scope
5–6 day splits (DEC-098 §2); equipment questions; storing the template on the routine or any new persisted field
(output is plain routines + slots); editing a plan after Save (it's ordinary routines/schedule then); Carry slot; the
picker itself (req-180); the routine form (req-179); weight carry-back (req-178); any other library re-tagging.

## Steps
1. Library: change the dip rows' pattern in `common.js`; `node scripts/build-library.mjs`; run the validators.
2. A pure module (e.g. `src/plan-templates.js`): the table in Change §2, `slotCandidates(pattern, exercises, library)`
   (own-by-pattern, staples, rest), and `planToState(state, choices, ids)` — a pure reducer building exercises,
   routines, items and (when the schedule is empty) slots. Unit-test it before any view.
3. Store: one action calling that reducer in a single `setState` (`store.jsx` — **trigger file**, see READY check 5).
4. Views: the two-start `/routines/new`, days step, slot-filling step, done screen; routes in `route.js`.
5. Tests, then `./check`.

## Acceptance criteria
1. For each of 1–4 days, `planToState` on an empty state with every slot filled makes the table's routines (names,
   slot order) and slots on the listed weekdays, `loopWeeks` 1 — unit test, asserting routines by `slot.routineId`.
2. **Is the right mechanism answering?** `slotCandidates('vertical-push', …)` returns no dip after the fix, and its
   staples equal `library.filter(e => !e.hidden && e.staple && e.pattern === 'vertical-push')` (assert against the
   library, not a hand list). An own exercise whose `libraryId` is a squat staple leads the Squat slot; a manual own
   exercise (no `libraryId`) is not in any slot's filtered list but is found by typing.
3. Item values: a picked exercise with a finished workout gets that history's prescription (and kg); one without gets
   the starting plan and **no kg** — unit test through req-180's value function, not a copy of it.
4. **Failure case — schedule already has slots:** `planToState` adds the routines and leaves `schedule` deep-equal
   to before (loopWeeks, anchor, slots). **Empty input:** all slots skipped → state deep-equal to before (no empty
   routine, no slot). **Abandon:** leaving mid-flow writes nothing (`workout-mvp-v9` unchanged — browser).
5. Library: `libraryProblems()` empty; visible count still 366; vertical-push staples 14 → 8 and horizontal-push
   staples 16 → 22 [expected from the rows above; Builder pastes the measured numbers].
6. Browser (Planner, `plan qa --seed` with an `emptyState()` file, as req-174): empty home → Create your first routine → Start from a plan → 3 days → fill
   A's slots (one own, one library, one skipped) → Save → Home; Schedule shows Mon/Wed/Fri; stored routines read back.
7. From the Routines list with an existing schedule → plan → Save → routines added, schedule unchanged.
8. Blank routine still works as before from both entry points.
9. `./check --smoke` green.

## Decisions left to Builder (implementation)
Module/function names; whether plan steps are routes or in-component steps (in-flow state may be lost on reload —
fine); how the done screen is laid out; test file name (`req-181.test.js`).

## Behaviour calls — Planner's, `(unconfirmed)`, on Emilio's end-of-batch list
1. Slot names: Squat, Deadlift, Chest press, Row, Overhead press, Pull-down, Lunge, Core (DEC-098 §3 "plain words").
2. Weekdays per split (Change §4) and `loopWeeks` → 1; 4-day = two routines each scheduled twice.
3. Existing slots → routines only, no schedule change (vs. adding slots, which would stack on his days).
4. One exercise per slot, skippable; typing in a slot searches everything.
5. Routine names "Full body A/B/C", "Upper", "Lower"; two starts on `/routines/new` with the plan on top.
6. Nothing saved until Save; lands on Home.
7. Dips → `horizontal-push` (content call, DEC-067), not `elbow-extension` (loses the chest dips) or a new pattern.

## READY checks
1. DECs: DEC-098 (source), DEC-097 (picker, values, library pick creates own record), DEC-096 (kg), DEC-099 (form),
   DEC-067 (content calls delegated), DEC-064 §2 (search), req-174 (entry). No DEC on templates or the schedule shape.
2. Siblings, in build order: req-178 (routine sets the weight) and req-179 (form cleanup, `RoutineNewForm`) → req-180
   (picker + values — **this req depends on it**) → req-181. Shared files: `Routine.jsx` (179, 180), `store.jsx` (180?).
3. Deferral: 5–6 days deferred; adding later is table rows only (the model already holds up to 7 weekdays × 4 weeks).
4. Numbers: counts are the `node -e` receipt above; weekdays and slot lists are prep §F + Planner's calls.
5. Trigger files: `store.jsx` → **independent reviewer** before merge. Writes only new records (no existing record
   rewritten, no schema bump) → no migration, ask-gate #2 not fired, no backup reminder.
6. Every visible call above is `(unconfirmed)`.
