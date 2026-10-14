**Status: BUILT AND MERGED, 2026-10-14 — branch `req-224` (`8a6ae2a`…`89dbb5d`, 4 commits).** **Lane: ui** — changes the `finishedAt` one Finish writes (normal save path, one record). Touches `workout-log.js` →
independent reviewer (DEC-057); no schema change, no bulk write.

# req-224 — a workout left open saves its last set's time as the finish

DEC-125 §4 (Emilio, batch 6 I11: "I forgot to close a workout, timer is not right anymore"). Builder: throwaway agent (DEC-055).

## Facts (rescanned 2026-10-14, `main` 73cdf1e)

- Only stamp: `finishedState(state, {…}, finishedAt = new Date().toISOString())` (`workout-log.js:187`, written `:200`);
  `store.finishWorkout` passes none (`store.jsx:236-237`). Auto-complete saves through the same call (`auto-complete.jsx:72`).
- Duration is never stored: `durationLabel(startedAt, finishedAt)` (`history-queries.js:265`, History detail `:53`). Finish screen
  minutes = `Date.now() − startedAt` at mount (`finish.jsx:34-35`), shown "{name} — {minutes} min · {n} sets" (`:68-69`).
  Auto-complete summary: `workoutSummaryStats(active, prior, now)` (`history-queries.js:284`).
- `loggedAt` (req-212): ISO, written on a logged set (`item.jsx:309`) and Skip set (`:361`); **absent** on older sets and on sets
  Finish / Skip exercise record as skipped (`skippedSet`, `workout-log.js:125-141`; `exchange.js:150`).
- `finishedAt` also feeds: History sort (`workoutTime`, `history-queries.js:152`), `coveringWorkout` fallback without `scheduledFor`
  (`schedule.js:147-177`), `doneEarlier` (`:222-233`), "Done {weekday}" (`schedule-day.js:167`, `overview.jsx:108`),
  `finishedForPlan` 6 h window (`current-workout.js:55-66`). `performedOn` = start date (`state-reducers.js:349`).
- No way to edit a workout's time in History (`views/history/edit.jsx:34`; list/recalc/index not read).

## Scope

1. `lastSetAt(workout)` = the latest `loggedAt` among the workout's sets, or null.
2. On Finish (screen Save and auto-complete): if `lastSetAt` exists and **now − lastSetAt > 3 h**, save `finishedAt = lastSetAt`;
   otherwise now (as today).
3. Finish screen: minutes use the same finish time, and when the rule applies it says, under the summary line:
   "You left this workout open — saved as finished at {HH:MM}, your last set." (date added when not today).
4. Auto-complete summary uses the same finish time.

## Out of scope

Editing a workout's time in History; prompting on Home about an open workout; changing `startedAt` / `performedOn`; any old workout.

## Acceptance criteria

1. Unit: sets logged 10:00–10:50, Finish at 15:00 → `finishedAt` = 10:50's ISO; `durationLabel` = "50 min".
2. Unit: last set 10:50, Finish at 13:30 (2 h 40) → `finishedAt` = now.
3. Unit: boundary — exactly 3 h → now; 3 h + 1 s → last set.
4. **Failure case — empty / absent input:** no set has `loggedAt` (older sets, or only Finish-made skips) → now, no crash;
   a skipped set made by Finish never counts as the last set.
5. **Is the right mechanism answering?** In criterion 1, assert `finishedAt` equals the set's `loggedAt` string exactly (not just
   "some time before now").
6. Rendered: Finish screen of criterion 1 shows "50 min" and the "left this workout open" line; of criterion 2, no line.
7. Unit: a workout started Mon 18:00, last set Mon 19:00, finished Tue 08:00 → `finishedAt` Mon 19:00; its History day and
   "Done Mon" read Monday.
8. `./check` green.

## Decisions made on Emilio's behalf

- **behaviour** (confirmed, DEC-125 §4): 3 h threshold; the last set's time becomes the finish.
- **behaviour** `(unconfirmed)`: the Finish screen's wording; the rule also applies to auto-complete.
- implementation: helper lives with `finishedState` in `workout-log.js`; the time is passed into `finishedState`, whose default stays.

## READY checks

1. DECs: DEC-119 §1 (req-212 `loggedAt`), DEC-117 §4 (finish summary), DEC-125 §4. 2. Siblings: req-222 also edits `workout-log.js`
   (pill state, other functions) — build after it or rebase. 3. none. 4. 3 h = Planner's pick, confirmed by Emilio.
5. `workout-log.js` → reviewer; a single record through the normal path → no backup reminder. 6. marked.
