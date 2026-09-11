# req-28 — show completed workouts on the Today page

Branch `req-28`. From Emilio's 2026-09-10 note #7 ("to see completed routines on the main
page"). Adds a "Completed today" section to Today, listing workouts finished today, each
linking to its History detail.

## Technical

### Changes
- **`src/storage.js` — new pure `completedOnDayKey(workouts, dayKey)`.** Returns the
  workouts whose `finishedAt` falls on `dayKey` (`dateKey(finishedAt) === dayKey`),
  newest-finished first. Filters on `finishedAt` **alone** (not the history view's
  `workoutDateKey`, which prefers `performedOn`/`startedAt`) so "completed today" means
  genuinely *finished* today — a past workout re-dated to today via `performedOn` doesn't
  masquerade as completed today. No new stored field; reads existing `finishedAt`.
- **`src/views/Today.jsx`** — compute `completedToday = completedOnDayKey(store.workouts,
  todayKey)`; render a `Completed today` section (SectionHeader + List) **only when
  non-empty**, placed **below** the scheduled/Start/upcoming block and above the "Other"
  link, so the primary action stays first. New `CompletedTodayRow` links each workout to
  `/history/<id>`, labelled the same way History's list does (`program — routine`, or just
  the routine name), minus the date since every row is today.

### Reuse
Row label uses the existing history helpers `workoutRoutineId` / `workoutRoutineName` and
`findRoutine` (from `storage`) — the same label History's own list builds — rather than a
parallel implementation. The link target `/history/<id>` is the existing history-detail
route (`route.js:282`).

### Implementation choices (spec left open)
- Label **"Completed today"**; placement below scheduled/upcoming, above "Other".
- Date comparison via the existing `dateKey` (schedule.js) — the same helper the scheduled
  rows' `Done {date}` label already uses — applied to `finishedAt`.
- Row label omits the date (redundant when all rows are today); shows program prefix only
  when the workout carries a `programName`.

### No schema / no ask-gate
Read-only over `store.workouts`; no new field, no migration, no write to saved state.

## Verification

Unit (pure filter) — `src/storage.test.js`:
```
node --test --test-name-pattern="completedOnDayKey"
ok 1 - completedOnDayKey (req-28 completed today)
# tests 4   # pass 4   # fail 0
```
Covers: today's finished workouts returned newest-first; a previous-day workout excluded;
an unfinished (no `finishedAt`) workout excluded; empty/null input → empty. Timestamps and
the day key are built from local `Date` objects (like the app's
`new Date().toISOString()`), so the local↔UTC round-trip inside `dateKey` can't make the
test timezone-dependent.

Browser (dev server; seeded throwaway routine, cleared after):
- **Empty state:** fresh Today (nothing finished) → **no** "Completed today" section. ✓
- **Completed shows:** started + logged + Finished a "Push Day" workout → Today shows a
  **"Completed today"** section with a **Push Day** row, below the scheduled area. ✓
- **Links to History:** tapping the row opened `/history/wo-…` — the workout's History
  detail (Push Day, Sep 11 2026, its Chest Press set). ✓
- **Right day:** set that workout's `finishedAt` to yesterday, reload → the "Completed
  today" section is **gone** from Today (the workout still lives in History). ✓

Full gate:
```
check: green — lint, 13 test file(s), and the build all passed.
```

## Workflow
- Branched first this time (`req-28` before any commit), per the L-006 note.
- Scope held: scheduled-slot rows and their `Done {date}` label untouched; today's completed
  only (no recent/multi-day view — that's History), per the decided default.
- Added a pure `completedOnDayKey` + unit test rather than an inline filter, so the "finished
  today, not a re-dated workout" rule is pinned (the "right day" acceptance) outside the
  component.

## What I could not verify myself (feel — Emilio, DEC-009)
Whether "today's completed only" is the right scope on the main page (vs a short recent
glance), the section's placement/label, and whether a row needs more than the routine name
(e.g. a time, a set/volume summary) to feel useful at a glance.
