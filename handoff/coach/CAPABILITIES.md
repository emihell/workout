# What a plan can contain — Coach's capability file (DEC-145)

What the app can express today, for Coach to build plans from without reading `src/`. Field truth is
`reference/schema.md`; this file says what each field means **for a plan** and where the limits are. Planner owns it and
updates it when a req ships something new. Measured 2026-10-31 from rev 78 and `main` `a82e735`.

**Not here = not possible.** If a plan needs something this file doesn't list, don't approximate it in data: write it
under "For Planner" in the report (what, why, the data), and use the listed workaround meanwhile.

## The pieces

**Exercise** — one movement, shared by every routine that uses it.
- `name`, `type` (`machine` · `free` · `bodyweight` · `cardio`), `equipment`, `muscles`, `cues` (technique text).
- `weightStep`: the kg between valid weights (`"2.5"`, `"5"`, `"Steps A/B"`, `"n/a"` = no step; the app then holds).
- `lightestWeight` (optional): the first weight on the stack.
- `unilateral` (optional): one side at a time. Absent → the library entry decides.
- `hasDuration` + `durationSec`: timed exercise.
- New exercises come from the library (`src/library/exercises.json`, by `id`) with `libraryId`, as the app makes them.
  A new exercise gets **no kg**.

**Routine** — a reusable session: `name`, `focus`, an ordered list of items. Retire one with `archivedAt`; never delete.

**Routine item** — one exercise in a routine, in order:
- `sets` (number), `targets[]` per set (text: `"8"`, `"10-12"`, `"AMRAP"`, `"60s"`, `"6 × 30 s hårt / 30 s lugnt"`).
- `suggestedWeights[]` per set (kg) — the kg the workout starts from (DEC-096). From history, or blank.
- `durations[]` per set (seconds) for timed sets.
- `restSec` — rest after each set of this item.
- `role`: `warmup` · `main` · `finisher` · `cardio`.
- `warmup`: `{reps}` or null — **one** warm-up set before the work sets, reps only (no planned kg).
- `notes` — free text shown with the item.

**Schedule** — `loopWeeks` (a cycle of N weeks), `slots[]` = routine on week N, weekday (0 = Sunday … 6 = Saturday).

## Limits and workarounds

| Can't express | Workaround now | Status |
|---|---|---|
| Superset / circuit (items alternated set by set) | Put them next to each other; say "superset with X, alternate" in `notes`. The workout lets him jump between items. | Asked for by Emilio (28 Oct notes); req-184 item 15, Phase 2 |
| More than one warm-up set | One `warmup` + say "2nd warm-up: …" in `notes` | — |
| Warm-up kg | Leave to him; a note may suggest "about half" | — |
| EMOM / intervals as a type | `targets` text (`"EMOM 5 × 12"`, `"6 × 30 s / 30 s"`) | — |
| Technique cues per exercise from a plan | Put cues in the exercise's `cues`, not in item `notes` | Emilio: "notes here that should be set in the actual exercise" |

**What the app's recommendation reads:** only plain-number targets and logged kg/reps/effort. A range, AMRAP, duration or
text target holds (schema.md §Recommendation).

## Getting a plan into the app

A plan file in the Export shape, applied through `./server/ops plan preview|apply` (req-245, DEC-141): it shows the app's
own import preview, Emilio approves, it backs up and writes one revision on top of the previewed one. Logged workouts are
always kept as they are. Coach never writes the DB.
