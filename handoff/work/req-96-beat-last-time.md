# req-96 — replace finish "Next time" with a "you beat last time" line (per-exercise, any axis) (notes n4/n6 + new)

**Status: BUILT AND MERGED, 2026-09-17 — branch `req-96` (`d45f93d`…`d45f93d`, 1 commit).** (design decided with Emilio 2026-09-17). **Gate: ux-feel** (a comparison
metric + a quiet celebratory line; the exact multi-win phrasing iterates live with Emilio).

From Emilio's in-app notes (2026-09-16): `/workout/.../finish` — *"The next time section — what is
that? … Maybe remove it?"*; `/history/…` — *"We don't need 'next time' here."* Direction
(2026-09-17): *"remove it, instead a light and easy way if it went better this time than last time
— a little UI thing to be proud that you did better."* Then, on what "better" means:
*"if you do it for longer than last time (75s vs 60s)? or more reps? or higher weight?"*

## Two things in one req (same screen, one swap)

1. **Remove "Next time".** It's the load recommendation (`buildFinishProgression` → `progress.js`),
   rendered at `src/views/workout/finish.jsx:42` and `src/views/history/detail.jsx:80`. It only
   changes when an RPE/effort signal is present (`progress.js:57–122`); Emilio doesn't log RPE, so it
   just echoes what he did → inert. Remove from **both** finish and history detail.
2. **Add "you beat last time".** One quiet line on the **Finish** screen, celebrating real improvement.

## Detection — per exercise, any axis (decided)

Total volume alone was rejected: it's blind to a longer hold and to bodyweight/timed work, and it
hides a per-exercise win inside an aggregate. Instead, compare **this workout to the previous
same-routine finished workout, exercise by exercise**, each on its natural axis:

- Match each exercise in today's workout to the **same exercise (by exercise id)** in the prior
  workout (reuse `previousSameRoutineWorkout`, `storage.js:452`).
- For each matched exercise, compare the **best work set** (warm-up sets `setType==='wu'` excluded,
  matching `workoutVolume`):
  - **Weighted** (`isWeightedType(ex.type)`): best set = highest `weight`, tiebreak highest `reps`.
    Win if today's best is **heavier**, or **same weight with more reps**.
  - **Bodyweight / reps**: best = highest `reps`. Win if **more reps**.
  - **Timed** (`durationSec` present / `isDurationTarget`): best = highest `durationSec`. Win if
    **longer**.
- **Fire the line if ANY exercise improved.** A different exercise being *down* does NOT suppress it
  (a normal gym day). Never show a "you did worse" message — silent when nothing improved.

**No-invent guardrails (DESIGN §1):**
- First-ever same-routine workout (no prior) → show nothing.
- An exercise with no match in the prior workout (newly added) contributes no win — never invented.
- Comparison is a **pure, unit-tested function** (history-only input, decision inspectable — the
  "reasoning made visible" rule). `workoutVolume`/`workoutSummaryStats` stay as-is for the
  auto-complete screen (req-84); this is a new sibling function, not a change to those.

## The line — name the win (decided)

One quiet line + subtle accent, **naming what improved**, e.g. "↑ Heavier on Bench press" /
"↑ Longer plank than last time" / "↑ More reps on Pull-ups". Not a badge/animation.

- **Multiple wins:** default — name one (first improved in workout order) + a light "+N more". Exact
  phrasing/format is **ux-feel, iterate live with Emilio** at Builder's terminal.

## Scope

- `src/views/workout/finish.jsx` — remove the "Next time" section; add the win line.
- `src/views/history/detail.jsx` — remove the "Next time" section only (no win line — it's a past
  record, not a forward celebration; confirmed).
- `src/storage.js` (or a small sibling module) — the new per-exercise comparison function + tests.

## Out of scope

- The load-recommendation logic itself (`progress.js`, `buildFinishProgression`) — left intact; only
  its finish/history *surfaces* are removed. (If nothing else renders it after this, note that in the
  report — a later req can decide whether to delete it.)
- The auto-complete screen's existing "vs last time" volume summary (req-84) — unchanged. Adding the
  named-win line there too is an optional consistency follow-up, not this req.
- RPE logging, any new persisted field, program model.

## Watch-outs (CC)

- Warm-up sets must be excluded from "best set" on both sides (same rule as `workoutVolume`).
- Reps can be non-numeric ("AMRAP") and duration can be absent — parse defensively; an unparseable
  axis is "no data", not a win.
- Exercise identity: match on exercise id, not name/position (an exercise can move in the routine).

## Acceptance criteria

- **Next time gone (browser):** no "Next time" on the Finish screen or history detail.
- **Fires on a real win (test + browser):** a workout that is heavier / more reps / longer on ≥1
  exercise vs the prior same-routine workout shows the named line; the name matches the improved
  exercise and axis.
- **Silent when not better (test):** no prior, no matched improvement, or an all-same/worse workout →
  no line (and never a "worse" message).
- **Per-exercise, not aggregate (test):** improving one exercise while another regresses still fires.
- **Pure function (test):** the comparison is covered by unit tests over crafted workout pairs.
- **No regression:** `./check` green; `workoutVolume`/`workoutSummaryStats` untouched (auto-complete
  still works).

## Decisions (Emilio, 2026-09-17)

- Remove "Next time" (inert without RPE) from finish + history detail.
- "Better" = per-exercise, any axis (weight / reps / duration); fire on any win, don't suppress on a
  regression elsewhere.
- Name the win in one quiet line. Multi-win phrasing = implementation default (first + "+N more"),
  iterate live.
