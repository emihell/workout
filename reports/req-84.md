# req-84 — auto-complete a finished routine — report

Branch: `req-84` (off `c0efb62`). `./check` green (lint + 254 tests + build).

## Technical

**What changed**

- `src/views/workout/auto-complete.jsx` (new) — `AutoCompleteSummary`. The "great job"
  screen: three stats (volume/duration/sets, each with a signed delta when a prior
  same-routine workout exists), a UI-only ~10s countdown, and Edit/Cancel. On expiry it
  auto-commits via the existing `store.finishWorkout({ overallNote:'', overallFeel:'',
  progression })`. Countdown is a `deadline + 250ms setInterval` (the `useRestCountdown`
  pattern) — **not** the persisted `restEndsAt`. `committedRef` guards double-commit.
  Optional `defaultBeep()` cue at commit.
- `src/views/workout/overview.jsx` — the `Workout` overview computes `allDone`
  (`items.every(i => itemIsMarkedDone(active,i) || itemLoggingState(active,i).plannedDone)`,
  the same per-item test the list rows already run) and, when true and not dismissed,
  renders `AutoCompleteSummary` instead of the list. `useState` `autoDismissed` is set by
  Cancel so the summary stays down while everything is still done; a fresh visit remounts
  and re-arms it. `allDone` is only reached with `items.length > 0` (the empty-items case
  returns earlier), so it never fires on an empty workout.
- `src/storage.js` — two pure helpers next to `workoutVolume`/`durationLabel`:
  - `workoutSummaryStats(active, prior, now)` → `{ volume, duration, sets, deltas|null }`.
    Volume = `workoutVolume` (working sets only), duration = minutes from `startedAt` to
    `now` (matches `finish.jsx:26`), sets = `sets.length`. **No prior → `deltas: null`**
    (no-invent, DESIGN §1). Prior duration uses its stored `finishedAt`.
  - `previousSameRoutineWorkout(active, workouts, routines)` → the most recent finished
    same-routine workout or `null`. Reuses `groupWorkoutsByRoutine`'s exact key by grouping
    `[active, ...workouts]` and returning `active`'s group neighbour at index 1 (workouts
    are newest-first). No duplicated grouping key.
- `src/model.js` — `buildFinishProgression(exercises, active)`: extracted verbatim from
  `finish.jsx`'s progression map so the manual Finish screen and the auto-commit pass
  **byte-identical** progression to `store.finishWorkout`. `finish.jsx` now calls it.
- `src/rest-cue.js` — `defaultBeep` exported (was module-private) for the commit cue.
- `src/storage.test.js` — 6 tests: stats no-prior (null delta), stats with deltas, warmup
  excluded from volume but counted in sets; selection returns most-recent same-routine,
  null when none, null on empty history.

**Choices left open by the spec**

- **Summary lives on the overview, not a route** (spec allowed either). Rendered as a
  full-screen replacement of the list when `allDone` — simplest, and the overview is the
  stated trigger point. Trade-off: navigating away and back re-arms the countdown (a fresh
  10s). That reads as correct ("still all done → offer to finish"); flagged in case the
  gym-feel check wants it to stay dismissed across visits.
- **Cancel dismisses for the current mount only** (local `autoDismissed`). After Cancel the
  user is on the normal overview and can tap Finish or re-enter an exercise.
- **Delta formatting**: `+N`/`-N`/`0`, shown as e.g. `Volume — 1000 kg  (+500 kg)`.
- **`recordButton` events** added: `auto-finish-workout`, `auto-finish-edit`,
  `auto-finish-cancel` (mirrors the manual `finish-workout` event).

## Verification (receipts)

- `./check` → `check: green — lint, 20 test file(s), and the build all passed.` (254 pass, 0 fail)
- `node --test src/storage.test.js` → `ok 12 - req-84 workoutSummaryStats`,
  `ok 13 - req-84 previousSameRoutineWorkout`
- No persisted-data change: no schema bump, no new stored field. `finishWorkout` is called
  with the same shape the Finish screen already uses.

Acceptance criteria mapping:
- Summary on all-done, first-time no-delta, warmup handling → unit tests above (pure helper).
- Auto-commit / Cancel-no-persist / Edit / not-premature → wired in `overview.jsx` +
  `auto-complete.jsx`; **needs a browser to feel** (see below).

## Workflow

- **No scope change.** Everything in the spec; nothing added or dropped.
- **One refactor rode along**: extracted `buildFinishProgression` from `finish.jsx` into
  `model.js` so the auto-commit can't drift from the manual finish. `finish.jsx` behaviour
  is unchanged (same helper, same output) — worth a glance in review since it touches the
  finish path. Candidate `DEC`/note only if we want the "one builder for the finish
  progression" rule recorded.
- **Exported `defaultBeep`** from `rest-cue.js` (spec said to reuse it; it was private).
- No decisions taken with Emilio mid-build; no ask-gate triggered (read-only stats + the
  existing finish path).
