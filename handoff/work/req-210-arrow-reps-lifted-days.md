# req-210 — progress arrow "↑ N%"; reps carry on uniform plans; Total lifted removed; setup days start empty

**Status: BUILT AND MERGED, 2026-10-07 — branch `req-210` (`e1291ba`…`4cc7d67`, 4 commits).** (2026-10-07). **Lane: ui.** From DEC-117 §1, §3, §4 and §6.

**Trigger file:** `workout-log.js` (the reps prefill). An independent reviewer runs before merge (DEC-057). Emilio sees
screenshots before merge (L-050).

## Code today (main, after req-209)
- **`src/beat-last-time.js`:** DEC-050's per-exercise axes (weighted top set / bodyweight reps / timed duration) against the
  previous same-routine workout. It is used by the finish screen's celebration line. No history and no improvement mean
  silence.
- **`src/workout-log.js:487-530`, the set-log prefill:**
  - reps = the set's target; with no target, the carry's reps (req-191).
  - A reps change never carries when there is a target (DEC-052).
- **Total lifted:**
  - `views/workout/auto-complete.jsx:89` "Total lifted (all sets added up)", plus its `delta` in the "vs last time" box.
  - `views/history/detail.jsx:57` "… kg lifted".
  - `workoutVolume` in `history-queries.js`.
- **Setup days:** `views/Plan.jsx:266-329` `suggestedWeekdays(n, now)` preselects days when the count is chosen.

## Scope
1. **Arrow.**
   - A pure `improvementPct(thisItem, lastItem)` in `beat-last-time.js`, on the same axis. It returns a whole-number % when
     improved, else null. The axis:
     - weighted: top-set kg, or reps when the top kg is the same;
     - bodyweight: reps;
     - timed: duration.
   - Render a small muted "↑ N%" next to the exercise:
     - (a) on the in-workout exercise list once that item is done;
     - (b) on the finish/auto-complete screen per exercise.
   - Never in History.
   - Same comparison source as DEC-050: the previous finished workout of the same routine, same exercise id.
2. **Reps carry on a uniform plan.**
   - In the prefill: when the item's working sets all have the **same** reps target, and a working set logged this session
     has different reps, the later unlogged working sets prefill those logged reps.
   - Per-set targets that differ (12/10/8) keep their own targets, as now (DEC-052).
   - Warm-ups are unaffected. Nothing is written to the routine; the existing "use next time?" offer is unchanged.
3. **Total lifted removed.**
   - Drop the auto-complete row and its delta.
   - Drop "… kg lifted" from the History detail header.
   - Remove `workoutVolume` if nothing else uses it, and name the test edits.
4. **Setup days start empty.** No weekday is preselected when the count is chosen. Save unlocks at exactly N, with the hint
   "Pick N days" as now.

## Out of scope
- Charts and a progress page.
- The one-date move (req-211).
- CSV.

## Acceptance
1. **Unit `improvementPct`:**
   - 30×12 → 35×11: ↑17%.
   - 35×9 → 35×11: ↑22%.
   - Bodyweight 10 → 12: ↑20%.
   - Timed 30 → 45 s: ↑50%.
   - Worse or equal → null.
   - No prior → null.
2. **Unit prefill:**
   - Targets 10/10/10, set 1 logged 14 kg × 15 → set 2 prefills reps 15.
   - Targets 12/10/8, set 1 logged × 14 → set 2 prefills 10.
   - **Failure case:** a warm-up's reps are never carried.
3. **Browser:**
   - Log an exercise beating last time → its list row shows "↑ N%". An exercise that didn't beat it shows nothing.
   - The finish screen shows the same.
   - Screenshot to `scratchpad/r210-list.png`.
4. **Browser:** no "lifted" text on the finish screen or the History detail.
5. **Browser:** setup → 2 days → no chip selected → Save disabled → tap Tue, Fri → Save enabled.
6. `./check` green. **This branch's own** smoke is green on the committed sha (L-049).

## Built — calls
- **Emilio approved the screenshots** ("do what you recommend").
- **DEC-118:** the old "↑ Heavier on X" line is removed (`beatLastTimeLine` and `.ui-beat` deleted).
- **A real gain that rounds to 0** shows "↑ 1%".
- **No arrow** when the prior is 0.
- **Changing the day count** clears the chips.
- **Independent reviewer (DEC-057, `workout-log.js`):** "No blockers."
  - It probed warm-ups, Previous, skipped sets, timed and cardio, and look-alike targets.
  - The 1 title nit is fixed.
  - **Latent:** the same exercise in two items shares one %.
