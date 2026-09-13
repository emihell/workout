# req-53 — In-progress workout becomes the main-page hero

## Technical

### What changed

**`src/views/Today.jsx`**

- **Removed the top "In progress. [Continue]" row** (old `:205-210`). It is gone
  entirely; the resume affordance now lives in the hero block.
- **New `InProgressMark` component** — an inline "in progress" status marker
  (`<span className="ui-inprogress">`) rendered next to the routine info in both
  hero cases.
- **`TodayWorkout` — `inProgress` branch now renders the hero.** The button slot
  changed from `inProgress ? null` to a large primary full-width **Continue**
  button that resumes via `startOrContinue(store, activeRoutineId(mine))` (the
  exact call the old row used), and the name line shows `<InProgressMark />`. The
  `done` case is unchanged and still takes precedence.
- **New `InProgressHero` component** — for an active workout that matches no
  today slot. Reuses the `.ui-today-workout` block look. Name/focus/date resolve
  from the workout's own record the way the peek rows do:
  `findRoutine` + `workoutRoutineName(workout, routine)` +
  `workout.snapshot?.focus`, with `weekdayDate(workoutDateKey(workout))` for the
  date. Never invents a name — the snapshot name survives a deleted/archived
  routine. Same `startOrContinue(store, activeRoutineId(workout))` resume call.
- **`Today()` — `activeIsTodaySlot` computed** (`!!mine && todays.some(...)` with
  the same match predicate as `TodayWorkout`'s `inProgress`). Drives "render
  exactly once":
  - `mine && !activeIsTodaySlot` → the standalone `InProgressHero` renders above
    the today block(s).
  - When it matches a today slot, that slot's `TodayWorkout` carries the hero and
    no standalone hero renders.
- **`TodayEmpty` suppressed while a workout is in progress.** The empty-today
  branch changed from `: (<TodayEmpty/>)` to `: mine ? null : (<TodayEmpty/>)`.
  When `todays.length === 0`, `activeIsTodaySlot` is always false, so `mine`
  alone means the standalone hero is already leading the screen.

**`src/ui/ui.css`**

- **New `.ui-inprogress`** marker style: the existing grayscale eyebrow look
  (caption size, `font-weight:600`, `letter-spacing:0.04em`, uppercase,
  `--ui-ink-3`), inline with a `--ui-s2` left margin so it sits beside the name
  as a status, not part of it. Grayscale, existing tokens only.

### What I verified

- `./check` (lint + tests + build) — green:

```
# tests 182
# suites 49
# pass 182
# fail 0
...
check: green — lint, 15 test file(s), and the build all passed.
```

- No test asserted the old top row (grep over all `*.test.js`), so no test
  needed updating.
- Render-once logic checked against all four cases in the acceptance criteria:
  today-slot-in-progress (slot block is hero, no standalone), not-today-slot
  (standalone hero above, today blocks still Start below), nothing-scheduled
  (standalone hero, no TodayEmpty), no-active (unchanged Start / TodayEmpty, no
  marker).
- Deleted/archived routine: `InProgressHero` resolves the name via
  `workoutRoutineName` snapshot fallback, so it renders without crash and
  Continue still resumes.

### Choices the spec left open (spec §Decisions "implementation (CC's call)")

- **Marker placement/style:** inline chip next to the name, reusing the eyebrow
  grayscale look (uppercase caption, `--ui-ink-3`). Kept on the name line so it
  is literally "next to the routine info."
- **Standalone hero:** its own small component (`InProgressHero`) rather than
  generalising `TodayWorkout`, since the two resolve name/date from different
  sources (a live routine+slot vs. the workout's own snapshot record).
- **Date on the standalone hero:** the active workout's own date via
  `workoutDateKey(mine)` (same helper the peek rows use) — not invented.

## Workflow

No deviations from the spec. Scope was exactly `Today.jsx` + one `ui.css` marker
rule; no data/model/store change; `startOrContinue`, the subbar/Routines-strip
hide-when-active logic, and the in-workout screens all left untouched. No tests
needed updating (none asserted the removed row). Nothing decided with Emilio
mid-build; the open implementation choices above are noted for `log/DECISIONS.md`.

### Not verified by me (needs the browser — the ux-feel after-check)

- On-device look/feel of the marker beside the name and the Continue button in
  each of the four states; whether the marker weight/placement reads right at
  the real title scale.
