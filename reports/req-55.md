# req-55 — One in-progress workout: hero-replacement, stale lifecycle, abandon-on-new

Branch `req-55` off `main`. DEC-038. Not merged, not pushed.

## Technical

### Model / store (`src/store.jsx`)
- `startWorkout` no longer stacks drafts: the `draftWorkouts: s.activeWorkout ? [...] : ...`
  push is gone. Starting overwrites `activeWorkout` directly (one-in-progress invariant).
  The `draftWorkouts` field is **kept** in the schema (legacy data) but never written again.
- Removed `resumeDraft`.
- Added `continueDraft(workoutId)` — promotes a legacy draft to the single `activeWorkout`,
  discarding any current active (no re-draft), and removes it from `draftWorkouts`.
- Added `abandonDraft(workoutId)` — removes a legacy draft from `draftWorkouts`; no finished
  record.
- `abandonWorkout()` unchanged (`activeWorkout → null`).

### Start-while-active (`src/workout-actions.js`)
- `startOrContinue` confirm changed from `"Save draft?"` to
  `"Starting a new workout will abandon the workout in progress. Continue?"`
  (exported as `ABANDON_ON_NEW_WARNING`). On OK it calls `store.abandonWorkout()` then
  `store.startWorkout(...)`; on Cancel it does nothing.
- Refined "is this a different workout" to `!continuingSame`, where `continuingSame` = same
  routine **and** (no occurrenceId given **or** same occurrence). This means starting a
  *different occurrence of the same routine* now also warns+abandons (previously it silently
  drafted the old one) — matches DEC-038 "one in-progress".
- Added `continueInProgress(store, workout)` and `abandonInProgress(store, workout)` — the
  History / recent-peek Continue and Abandon handlers. Continue on the stale *active* workout
  just navigates (already active); on a legacy draft it warns (if a different active exists)
  then `continueDraft`. Abandon routes to `abandonWorkout()` vs `abandonDraft(id)` by whether
  the workout is the current active. Abandon confirm: `"Abandon this workout? It will not be
  saved."` (spec left the exact wording open — chosen for the not-currently-open context;
  the in-workout Abandon keeps its own `"Abandon?"`).
- Changed its own imports to `./route.js` / `./schedule.js` (explicit `.js`) so the module
  loads under `node --test` — the app still resolves them via Vite. No behaviour change.

### Display (`src/views/Today.jsx`)
- Removed `InProgressHero` (req-53's standalone second hero). Replaced with `TodayHero`,
  rendered **in place of** today's scheduled block whenever an active workout was **started
  today** (`activeStartedToday = dateKey(mine.startedAt) === todayKey`). On finish/abandon the
  today block returns with Start. Holds for today's slot, tomorrow-started-early, or
  off-schedule (the hero reads the workout's own record, so a deleted routine's snapshot name
  survives — DESIGN §1).
- `TodayWorkout` lost its inProgress/Continue branch — today's slot block now only ever shows
  Start or `Done …`. A stale workout is never Continue-in-the-hero.
- Added `InProgressPeekRow` — a stale/unfinished in-progress workout in the recent peek with a
  secondary **Continue** (mirrors `UpcomingRow`), marked "in progress". The recent list now
  merges `staleInProgressWorkouts(store, todayKey)` with finished `store.workouts`, sorted by
  date, sliced to 2 — so a stale one appears only if it falls in the recent window.
- The bottom Routines subbar and `ui-screen--subbar` padding now key off `activeStartedToday`
  (not `mine`): a stale in-progress keeps the picker, since today looks normal.

### History (`src/views/history/list.jsx`)
- Added an **In progress** section (main History view) listing
  `staleInProgressWorkouts(store, dateKey(new Date()))` as rows with **Continue + Abandon**,
  marked "in progress". No detail link (there is no finished record to open).

### Start picker (`src/views/Start.jsx`)
- Removed the Drafts section and `resumeDraft` usage; dropped the now-unused `Button`/`go`…
  (`Button` import removed).

### Shared helper (`src/storage.js`)
- Added `staleInProgressWorkouts(state, todayKey)` (pure): the single `activeWorkout` when
  started before today, plus every legacy `draftWorkout`. Never includes an active workout
  started today (that's the hero). These live outside `workouts` and never feed `progress.js`.

### Dominoes checked (grep)
- `draftWorkouts` readers: `model.js` migration (preserves — kept), `exchange.js`
  backup/restore (kept), `storage.js emptyState` (kept). Field intentionally retained; only
  the *write* on start is gone.
- `resumeDraft` / `InProgressHero`: **zero** references after the change (grep clean).
- `startWorkout` callers: only `workout-actions.js` (updated). `startOrContinue` callers:
  `Today.jsx`, `workout/overview.jsx` — both still valid; overview passes `occurrenceId`,
  now covered by the refined `continuingSame`.
- `abandonWorkout`: the in-workout Abandon (`workout/overview.jsx`) is unchanged (out of scope).

### Spec-open choices made
- Abandon confirm wording (above).
- Legacy drafts fold into both the recent peek (merged/sliced by date) and a dedicated
  History "In progress" section, uniformly with the stale active workout.
- The in-progress visual marker reuses the existing `.ui-inprogress` eyebrow.
- Store shape after removing drafts: `draftWorkouts` field retained (drains as legacy data is
  resolved) rather than deleted — non-destructive, and a later req can drop it.

### Tests added
- `src/workout-actions.test.js` (new, 12 tests): abandon-on-new confirm+discard (OK abandons
  then starts, drafts never grow; Cancel does nothing; same-workout just navigates);
  `continueInProgress` (stale active navigates; draft promotes; warn+promote / cancel);
  `abandonInProgress` (active→abandonWorkout, draft→abandonDraft, cancel); a **source guard**
  on `store.jsx` (no `draftWorkouts: s.activeWorkout` push, `resumeDraft` gone,
  `continueDraft`/`abandonDraft`/`abandonWorkout` present) — locking the one-in-progress shape
  that can't be import-tested (store.jsx is JSX).
- `src/storage.test.js` (+2 describes): `staleInProgressWorkouts` (today-started excluded,
  prior-day included, drafts always included, empty); and the **legacy-draft migration** test
  driving the real `loadState()` path with a seeded `workout-mvp-v7` key carrying a
  `draftWorkouts` entry.

### Migration test output (`node --test`, seeded v7 → load)
```
# Subtest: req-55 staleInProgressWorkouts (surface, don't drop)
    ok 1 - an active workout started TODAY is the hero, not a stale row
    ok 2 - an active workout started a PRIOR day is surfaced as stale
    ok 3 - legacy drafts are always surfaced, alongside a stale active
    ok 4 - no active, no drafts → nothing to resolve
ok 12 - req-55 staleInProgressWorkouts (surface, don't drop)
# Subtest: req-55 legacy-draft migration is non-destructive
    ok 1 - loads the draft, surfaces it, keeps it out of finished history + recommendations, persists v8
ok 13 - req-55 legacy-draft migration is non-destructive
```
The migration test proves, through the real load path: the stored draft survives
(`state.draftWorkouts.length === 1`), is surfaced (`staleInProgressWorkouts` returns it), is
NOT in finished `workouts`, never reaches `historyPrescription` (its 999 kg set is invisible;
the prescription is the finished 40 kg workout), and is persisted to `workout-mvp-v8` intact.

### Full gate
```
# tests 211
# pass 211
# fail 0
check: green — lint, 18 test file(s), and the build all passed.
```

## Workflow

- **No scope changes.** Built to the spec + DEC-038.
- **Behaviour refinement worth a note:** start-while-active now warns+abandons for a
  *different occurrence of the same routine* too (not only a different routine). The old code
  only confirmed on a different routineId and silently drafted otherwise; with drafts gone,
  the consistent DEC-038 behaviour is to warn on any genuinely different workout. Emilio should
  confirm this feels right (it's the "one in-progress" rule applied uniformly).
- **`.js` extensions:** `workout-actions.js` previously imported `./route` / `./schedule`
  without extensions (fine under Vite, but unresolvable by `node --test`). Adding `.js` made it
  testable and matches every other test-imported module in the repo. Possible `L-`: modules we
  want to unit-test must use explicit `.js` import specifiers.
- **`draftWorkouts` field retained**, not deleted — non-destructive per the spec; it drains as
  legacy data is resolved. A future cleanup req can drop the field once no stored data carries
  it.

## Ready to look at (branch `req-55`)

**What it does.** Exactly one in-progress workout now. Starting a new one while another is in
progress warns and abandons the first (no more draft stack). An in-progress workout started
today *replaces* today's Start block as the single hero; once it's from a prior day it drops to
a Continue row in the recent peek and a Continue+Abandon row in History. Old stored drafts are
surfaced there too so you can resolve them.

**What to test.**
1. Start today's workout → it becomes the single hero (no second hero above). Finish or abandon
   → today's scheduled block returns with Start.
2. Start tomorrow's (or an off-schedule) workout today → same: it is the one hero in the today
   block, today's own slot is not shown twice.
3. With one in progress, start a *different* workout (from Upcoming / a routine / a preview) →
   the warning "Starting a new workout will abandon the workout in progress" appears. OK: the
   first is gone (not resumable anywhere). Cancel: the first stays and the new one doesn't start.
4. A workout left in progress from a previous day → NOT the hero; today's Start shows normally;
   it appears as a Continue row in the recent peek and as Continue+Abandon in History. Abandon
   there removes it and creates no history entry; Continue resumes it.
5. If you have old drafts in storage: open History → they appear under "In progress" with
   Continue/Abandon and resolve the same way. (Nothing new ever becomes a draft.)

**What I could not verify myself.** All of the above are DOM/interaction behaviours — the unit
tests cover the store/action logic and the migration, but the actual hero replacement, the
warning dialogs, and the History/peek rendering need your eyes in the browser. Also the exact
placement/feel of the "in progress" marker on the peek and History rows is a judgement call.

---

## Fix (post-review)

**Bug (independent review).** `startOrContinue` (`src/workout-actions.js`) treated the active
workout as "continuing the same" whenever it matched the routine and occurrence. The
inline Today/Upcoming **Start** buttons pass no `occurrenceId`, so `sameOccurrence` was
unconditionally true. If a STALE `activeWorkout` for routine R (started a prior day, still
unfinished) existed and R was also scheduled today, tapping today's "Start" hit
`continuingSame === true` — so it neither warned/abandoned nor started fresh, silently
navigating into yesterday's in-progress sets. On finish it filed under yesterday and today's
slot was never marked done. The label said "Start" but resumed a stale workout.

**Fix.** `continuingSame` now additionally requires the active workout was started today:
`dateKey(active.startedAt) === dateKey(new Date())`. `active.startedAt` is the ISO string set
by `store.jsx` `startWorkout`; `dateKey` is `./schedule.js`, matching the rest of the file.
When the active workout is stale, `continuingSame` is false, so the existing active-and-different
path runs: warn `ABANDON_ON_NEW_WARNING` → `store.abandonWorkout()` → `store.startWorkout(...)`.
Resuming TODAY's in-progress (same routine, started today) is unchanged — no warning, no restart.
The stale row's own `continueInProgress`/`abandonInProgress` paths are untouched.

**Tests** (`src/workout-actions.test.js`). Added two cases and hardened one existing fixture:
- STALE active (same routine, started a prior day) + Start with no `occurrenceId` → asserts
  `[ABANDON_ON_NEW_WARNING]` and calls `['abandonWorkout', 'startWorkout']` (does NOT silently continue).
- Resuming TODAY's active (same routine, started today) + no `occurrenceId` → asserts no warning
  and no store calls (just navigates) — the no-regression guard.
- The existing "continuing the SAME active workout" fixture now carries `startedAt: today`, since
  under the corrected model "same" requires started-today (fixture correction, not a weakening).

`./check` → `check: green — lint, 18 test file(s), and the build all passed.` (213 tests, 0 fail).
