# req-96 — remove finish "Next time", add a quiet "you beat last time" line

Branch: `req-96` (off `main`).

## Technical

### 1. New pure comparison module — `src/beat-last-time.js` (+ tests)

- `beatLastTimeWins(current, prior, exercises)` → the exercises that improved this
  workout vs the previous same-routine workout, **in workout order**. Per exercise,
  matched by **exercise id** (not name/position), comparing the **best work set**
  (warm-up `setType==='wu'` excluded, matching `workoutVolume`) on its natural axis:
  - **timed** (any work set has `durationSec > 0`): longer best hold → `longer`.
  - **weighted** (`isWeightedType(type)`): heavier top set → `heavier`; same top weight
    with more reps → `more-reps`. (More reps at a *lighter* weight is **not** a win.)
  - **bodyweight / reps**: more reps in the best set → `more-reps`.
- Fires on **any** improved exercise; a regression on another exercise never suppresses
  it. **No-invent guardrails:** no prior, an exercise absent from the prior (newly
  added), or an unparseable axis (`reps: 'AMRAP'`, absent duration → parsed as 0, "no
  data") all contribute no win — never a guess, never a "you did worse".
- `beatLastTimeLine(wins)` → the one quiet line: names the first win in workout order;
  multiple wins append a light `· +N more`. Returns `null` when nothing improved. The
  ↑ accent is added by the view, not baked into the string.
- Type is resolved from the workout's own snapshot item (`exerciseType`), falling back
  to the exercises catalog — so it stays correct even if an exercise was later edited or
  removed. Pure and inspectable per the "reasoning made visible" rule. **Does not touch**
  `workoutVolume` / `workoutSummaryStats` (req-84 auto-complete unchanged).

### 2. Removed the "Next time" surface (both screens)

- `src/views/workout/finish.jsx` — dropped the `Next time` `SectionHeader` + `List`.
  `buildFinishProgression` is **still computed and still passed to
  `store.finishWorkout({...progression})`** (line 72) — the progression is unchanged on
  the persisted record; only its display was removed. `List`/`Row` imports dropped (were
  only used by that section).
- `src/views/history/detail.jsx` — dropped the `Next time` block and the now-unused
  `formatProgressionLine` import. `workout.progression` is untouched on the record.

### 3. The win line — `src/views/workout/finish.jsx` + `src/ui/ui.css`

- Renders under the summary line: `<p class="ui-beat"><span class="ui-beat__mark">↑</span>{line}</p>`,
  only when there's a win. `.ui-beat` reads full-ink among the gray `.ui-sub` lines
  (grayscale accent = weight/darkness, not color — DEC-017); `↑` is bold.

## Verified

- `./check` green — lint, **21** test files (new `beat-last-time.test.js`), build passed.
- `src/beat-last-time.test.js`: **17 pass / 0 fail** — weighted (heavier / same-weight-more-
  reps / not-lighter-more-reps / identical-silent / warm-up-excluded), bodyweight (more
  reps / fewer-silent / AMRAP-no-data), timed (75s>60s / equal-silent), guardrails (no
  prior / newly-added), per-exercise-not-aggregate (one up while another down still
  fires; multiple wins ordered), and the line formatter (single / +N more / null).
- `grep "Next time" src/` → only comments + an unrelated `db.json` note remain; no
  rendered "Next time" on either screen.

## Could not verify from here (browser — for Emilio, ux-feel)

- The line on a real Finish screen (needs an active workout with a prior same-routine
  finished workout that was beaten). Wording/format ("Heavier on X", "Longer X than last
  time", "More reps on X", `· +N more`) and the ↑ accent are meant to iterate live — all
  isolated in `beat-last-time.js` + `.ui-beat`, trivial to nudge.

## Workflow

- **Note for a later req (as the spec asked):** after removing both surfaces, **nothing
  renders `workout.progression` anymore**. It is still *computed and persisted* on every
  finish (finish.jsx + auto-complete.jsx), and `buildFinishProgression`/`progressionForItem`
  stay live (the model recalc path at `model.js:387` still uses `progressionForItem`), so
  no logic was touched — but the persisted `progression` field is now write-only, and
  `progress.js:124 formatProgressionLine` is now **unused** (its only consumer was the
  removed history surface). Left in place per out-of-scope ("progress.js intact"); a later
  req can decide whether to delete the field + dead helper.
- Put the comparison in a **new sibling module** (`beat-last-time.js`) rather than growing
  `storage.js` — the spec allowed either; a sibling keeps it self-contained and testable.
- No other scope change. History detail deliberately gets **no** win line (past record,
  not a forward celebration — confirmed in spec).
