**Status: READY** · **Lane: tooling** · DEC-145 §4, DEC-146, DEC-151, DEC-152, DEC-155. After req-256 and req-255 (same file).

# req-260 — `plan build` warns about every live routine, not only the items it changed

## Why (observed)

Coach run 5 (BACKLOG §Tooling, run 5 item 7): run 3's plan left superset/EMOM notes in 6 routines that later plans
didn't touch. `plan build` never mentioned them. Run 5 found them with its own `scripts/dec146_scan.py`.

[measured, `main` `4c1121b`, 2026-10-31] `server/plan-build.mjs:399-414` runs C3–C6 and the warnings (`itemProblems`,
`:102-150`) only for items in `touched` (`if (!touched.has(key)) continue`, `:404`). Reproduction: `fullState()` plus a
live routine "Core" whose plank item has `notes: 'superset with Row, EMOM 10'` and `durations: [20, 20]`, and a change list
that only sets `restSec` on Upper · Chest Press:

```
WORKOUT_SERVER_TEST=1 node r260.mjs
refusals: 0 warnings: []          ← Core's "superset"/"EMOM" notes and 20 s durations: nothing
routines: Upper, Core
```

The same item, if touched, gets two warnings (`:146-148`: notes pattern; `:145`: duration under 30 s).

## Scope

1. After the touched loop (`:400-414`), run every item of every **live** routine (`!archivedAt`) that the loop didn't
   check through `itemProblems(item, exercise, workouts, item)`. Pass `before = item` so C5 (`kgChanged`, `:135`) can't
   fire: an existing kg was typed or confirmed by Emilio (DEC-096) and isn't Coach's to question here.
2. Everything it finds is a **warning**, never a refusal, prefixed `existing: <routine> · <exercise>: `. That includes C4
   shape refusals, C6 refusals and an archived/missing exercise (C3). Exit code and the `--out` file are unchanged
   by them.
3. One summary line before the counts, after the change list's own warnings:
   `existing: N warning(s) in M routine(s)`, omitted when N = 0.
4. Tests in `server/req-260.test.mjs`, temp data only (BACKEND rule 8), reusing req-254's fixtures (`phoneState`,
   `server/req-254.test.mjs:30-38`).
5. `CAPABILITIES.md`/`COACH.md` are Planner's (don't edit `handoff/`). Say in the report what they should now say.

## Out of scope

- Refusing on existing data. It would block every plan until old routines are rewritten; Coach decides what to fix.
- Archived routines; routines' schedule placement; anything in `plan preview|apply`.
- Fixing the notes in Emilio's routines (that's a Coach change list).

## Acceptance criteria

1. **Fires on untouched data:** the reproduction above prints `existing: Core · Plank: notes mention "superset" …` and
   `existing: Core · Plank: a duration under 30 s …`, plus `existing: 2 warning(s) in 1 routine(s)`. Exit 0, and the file is written.
2. **The guard fires (self-test):** the same test against main's `plan-build.mjs` finds no `existing:` warning, so it fails
   (paste both runs).
3. **Failure case: no double report, right mechanism.** When the change list touches Core · Plank itself, its warnings
   appear once, unprefixed, as today, and Core contributes no `existing:` line for that item. An untouched item whose kg
   is > 0 on an exercise with no history gets **no** warning (C5 is off for existing items). A change list whose only
   problem is existing data still exits 0.
4. **Existing refusals become warnings:** an untouched item with `targets: ['12', '12']` and `sets: 3` (a C4 shape error)
   → an `existing:` warning, exit 0. The same item touched → refused as today.
5. req-254/255/256 tests pass unedited; `./check` and `node --test server/` green.

## Checks run (WORKFLOW §Before READY)

1. DECs grepped (plan build, superset, warning, existing, C5): DEC-145 §4, DEC-146 (no workaround notes), DEC-151, DEC-152
   (req-254's open choices), DEC-153 (C5 opt-in, req-255), DEC-096 (kg typed by Emilio is his).
2. Siblings, order: **req-256** (C6 via `isDurationTarget`) → **req-255** (C5 + `itemFields`, same function) → this.
   All three touch `itemProblems`/`buildPlan`; rebase on both.
3. Deferral: none.
4. Numbers: "6 routines" is from run 5's for-planner notes as recorded in BACKLOG, not re-measured (the live DB isn't on
   this machine). The reproduction above was run 2026-10-31.
5. Trigger files: none (server ops only). No reviewer, no backup.
6. `(unconfirmed)`: none in the app. Only Coach and Planner see the new lines.

## Decisions made on Emilio's behalf

- **implementation:** existing problems are warnings with a prefix, never refusals; C5 is off for existing items; one
  summary line.
