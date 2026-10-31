# What a plan can contain — Coach's capability file (DEC-145)

What the app can express today, for Coach to build plans from without reading `src/`. Field truth is
`reference/schema.md`; this file says what each field means **for a plan** and where the limits are. Planner owns it and
updates it when a req ships something new. Measured 2026-10-31 from rev 78 and `main` `a82e735`.

**Not here = not possible.** If a plan needs something this file doesn't list, don't approximate it in data and don't build
it: write it under "For Planner" in the report (what, why, the data). There are no workarounds (DEC-146).

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
- `sets` (whole number 1–20; `plan build` C4 refuses more, req-261), `targets[]` per set (text: `"8"`, `"10-12"`, `"AMRAP"`, `"60s"`, `"6 × 30 s hårt / 30 s lugnt"`).
- `suggestedWeights[]` per set (kg) — the kg the workout starts from (DEC-096). From history, or blank.
- `durations[]` per set (seconds) for timed sets.
- `restSec` — rest after each set of this item.
- `role`: `warmup` · `main` · `finisher` · `cardio`.
- `warmup`: `{reps}` or null — **one** warm-up set before the work sets, reps only (no planned kg).
- `notes` — free text shown with the item.

**Schedule** — `loopWeeks` (a cycle of N weeks), `slots[]` = routine on week N, weekday (0 = Sunday … 6 = Saturday).

**Week-to-week variation** (DEC-151): a second routine on another week of the `loopWeeks` schedule is as built — use it
for a lighter week or a heavy/light alternation (a 2-week loop). A set count that climbs every week of a block needs more
routine copies than that; it goes to "For Planner" instead.

## Limits and workarounds

**A plan uses only what the workout can run as built (DEC-146).** Something the app can't express is **not built at all**
— no notes, text targets or item order standing in for it. Plan without it, and write it under "For Planner" in the report
(what, why, the data) so it becomes a req. Run 4 is why: planned supersets written as notes were done as straight sets
(≈55 min, not ≈43) and the last pair and the finisher fell off.

| Can't express | In a plan now | Status |
|---|---|---|
| Superset / circuit (items alternated set by set) | Don't build one: straight sets only; the time saving goes to "For Planner" | Req candidate (BACKLOG §Phase 1); req-184 item 15 |
| More than one warm-up set | One `warmup` only; no "2nd warm-up" in `notes` | req-184 item 10 |
| Warm-up kg | Not planned; he picks it | req-184 item 10 |
| Short intervals (Tabata 20 s / 10 s) and EMOM (rest = the rest of the minute) | Avoid. Only if really needed: a text target, said in the report | Interval-chaining req (BACKLOG §Phase 1) |

**Intervals with the timers that exist** (DEC-146 §4): a timed exercise (`hasDuration`, `durations[]` = work seconds per
round) with `restSec` = rest seconds. Each round costs two taps — Done (starts rest) and Start (next countdown;
`src/ui/set-log-form.jsx` `DurationTimer`, `src/views/workout/item.jsx` `WorkoutItemLive`) — so build it only when work and rest are each ≥ 30 s
(Emilio, DEC-151).

**Where things belong:** item `notes` say something about this item in this routine, never a missing feature. Technique
cues: see "Notes and cues" below — today no field shows them reliably in the gym.

**What the app's recommendation reads:** only plain-number targets and logged kg/reps/effort. A range, AMRAP, duration or
text target holds (schema.md §Recommendation).

## How a plan runs in the workout (measured 2026-10-31 on `main` `356b146`)

Build for what he sees and taps. Every line is from the code; [inferred] = read, not run.

**Start and order**
- Start copies each item (`sets`, `targets`, `suggestedWeights`, `durations`, `restSec`, `notes`, `warmup`, `role`) into the
  workout; editing the routine later doesn't change a running workout (`src/model.js:504-538`). It opens the first item.
- **Order is free:** any exercise can be opened from the overview; "next" = the next not done (`src/workout-progress.js` `currentWorkoutItem`).
  Nothing pairs or alternates items, so put the priority exercise first — what's last gets dropped (run 4).
- After an item's last set: its review (sets, Effort, "Next: X"). The next exercise opens only when he taps Next
  (`src/views/workout/item.jsx` `WorkoutItemLive`, `review.jsx` `ExerciseReview`). The overview rows show names only — no targets, kg or notes.

**Targets and the Reps box**
- The target text is **prefilled into Reps and logged as typed** unless he changes it: `"10-12"`, `"AMRAP"` or a sentence
  becomes the logged reps (`src/set-seed.js` `setLogSeed`). Prefer one plain number per set; a range means he retypes every set.
- Label "Duration" whenever the target contains "min"/"sec" or ends in "s" (`src/progress.js:89-92`) — **"12 reps" too**.
  It is still a text box, no timer. Write reps as bare numbers.
- `sets` decides the count; a shorter `targets` repeats its last entry, a shorter `suggestedWeights` leaves kg blank
  (`src/set-seed.js` `setTargetFor`, `routineKgFor`). Fill both to the set count.
- Blank kg → Done logs 0 with a quiet note (`src/ui/set-log-form.jsx` `SetLogForm`). The warm-up never gets a routine kg.

**Warm-up and rest**
- `warmup: {reps}` = one reps set before the work sets, logged or skipped first; it gets the item's `restSec` too.
- `restSec` runs after **every** logged set, the last one included; Skip set starts none (`src/workout-timers.js` `restPatchAfterSet`).
  Rest never blocks the next set; it can be skipped (tap the pill), not paused, not edited mid-workout.
- `restSec` 0 = no rest at all, and then the item's notes never show during the workout (below).
- Rest end: a beep (same sound as the set timer) and "GO". Nothing starts by itself.

**Notes and cues**
- Item `notes` show **only while that item's rest runs** after one of its sets, with up to 3 library form cues
  (`src/library-hints.js:52-71`), and on its review. Not before set 1, not on the overview. Keep them one line, and
  don't put anything there he needs before his first set.
- The exercise's own `cues` field is **never shown in the workout** — only in the exercise editor. → For Planner.

**Timed and cardio**
- `hasDuration` work sets: a countdown box prefilled from `durations[i]` (else the last entry, else the exercise's
  `durationSec`, else 30); tap Start, one beep at 0, then Done. It logs the box value, not the time run
  (`src/ui/set-log-form.jsx` `DurationTimer`, `src/set-seed.js` `durationTargetFor`). Targets are ignored on timed sets. One-sided = one
  countdown per set; the second side needs Restart.
- Cardio without `hasDuration`: Duration (mm:ss) with a stopwatch + optional Level/Distance. A target "20 min" or "12:30"
  prefills it; **a bare number means minutes** ("8" → 8:00, `src/cardio-set.js:41-58`). Cardio has no effort.
- A non-timed exercise with target `"60s"`: no timer — the text is logged as reps. Use `hasDuration` for timed work.

**Intervals:** see the Limits table. 60 s / 60 s × 6 = `hasDuration`, `durations` [60×6], `restSec` 60 — two taps a round.
Tabata = 16 taps in 4 min with the tap delay inside a 10 s rest; EMOM can't be expressed (rest is fixed, not "the rest of
the minute"), and a timed EMOM logs no reps.

**Swap / add mid-workout** bring sets, reps, kg and rest from that exercise's history, and **drop the item's `notes` and
`warmup`** (`src/workout-items.js` `replacementItem`, `replaceItemPatch`). A plan can't make a swap carry them.

## Getting a plan into the app

A plan file in the Export shape, applied through `./server/ops plan preview|apply` (req-245, DEC-141): it shows the app's
own import preview, Emilio approves, it backs up and writes one revision on top of the previewed one. Logged workouts are
always kept as they are. Coach never writes the DB. Coach makes the file with `./server/ops plan build` (req-254, COACH.md
§The plan file). Schedule slots: `week` is **0-based** (0 … `loopWeeks`−1), `loopWeeks` 1–4, `weekday` 0–6 (0 = Sunday).
