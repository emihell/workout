# req-56 — Start/Edit on routine rows; Schedule into the Library segmented; drop the first-page Routines strip

## Technical

### Files changed
- `src/views/Library.jsx` — 3-segment toggle **Schedule · Routines · Exercises** (that
  order). `onChange` routes via a `SEGMENT_ROUTES` map (`schedule → /schedule`,
  `routines → /routines`, `exercises → /exercises`). Renders `<Schedule/>` when
  `tab === 'schedule'`, else Exercises / Routines.
- `src/App.jsx` — route `schedule` now renders `<Library tab="schedule" />` (was bare
  `<Schedule/>`). Removed the `StartWorkout` import and the `start` route line. Dropped
  `Schedule` from the `./views/Schedule` import (only the drill-down screens are used
  directly now; the list view is reached through `Library`).
- `src/views/Schedule.jsx` — removed `<Back/>` from the top-level `Schedule()` list view
  only; kept `<Title>Schedule</Title>`. `ScheduleLoop`, `ScheduleDay`, `ScheduleDayAdd`,
  `ScheduleSlot` and their `<Back/>` untouched (import still used by those).
- `src/route.js` — `activeTab`: `schedule*` now maps to `library` (added
  `name.startsWith('schedule')` to the Library branch); comment updated. Removed the
  `start` route from `parseRoute`.
- `src/views/Routine.jsx` `Routines()` — each row now carries two actions in the plain-row
  `action` slot: **Edit** (a `NavLink` to `routinePath(routine.id)`, styled
  `ui-btn ui-btn--secondary`) on the LEFT, **Start** (a `<Button variant="primary">`
  calling `startOrContinue(store, routine.id)`) on the RIGHT. Added the
  `startOrContinue` import from `../workout-actions`.
- `src/views/Today.jsx` — removed the `.ui-subbar` "Routines" strip (the fixed
  `NavLink to="/start"` block) and the `ui-screen--subbar` className on `<Screen>`;
  removed the now-unused `NavLink` import. `activeStartedToday` is still used by the hero
  conditional, so it stays. Today Schedule/History peek rows kept.
- `src/ui/ui.css` — removed `.ui-subbar`, `.ui-subbar__link`, `.ui-screen--subbar`, and
  the `--ui-subbar-h` token; scrubbed the stale "Routines strip" mention from the
  `--ui-dock` comment.
- `src/views/Start.jsx` — **deleted** (`git rm`), orphaned once `/start` is gone.
- `src/route.test.js` — moved `schedule`, `schedule-loop`, `schedule-day`,
  `schedule-day-add`, `schedule-slot` from the WORKOUTS inventory to LIBRARY; removed
  `start`. Added explicit assertions `activeTab('schedule' | 'schedule-day' |
  'schedule-slot') === 'library'`. The applyVisit/applyBack stack test that used `/start`
  as an arbitrary path now uses `/schedule` (a still-live path).

### Dominoes checked
- **`start` route / `StartWorkout`**: grep confirmed the only `/start` link was
  `Today.jsx:329` and the only `StartWorkout` users were `App.jsx` (import + route) and
  `Start.jsx` itself. All removed; `Start.jsx` deleted. Post-change grep clean (below).
- **`route.js` callers**: `activeTab` and `parseRoute` are consumed by `App.jsx` (route
  dispatch) and `BottomMenu`/`route.test.js`. The removed `start` name had one dispatch
  site (App.jsx, removed). No other reference to a `start` route name.
- **`.ui-subbar` / `--ui-subbar-h`**: grep confirmed both lived only in `ui.css` +
  `Today.jsx`; `--ui-subbar-h` was used only by `.ui-screen--subbar`. All removed.
- **`Schedule` import in Schedule.jsx / App.jsx**: `Back` still used by the three
  drill-down screens (kept import); `Schedule` still imported by `Library.jsx` (new).
- **`startOrContinue` import path**: confirmed exported from `src/workout-actions.js:14`
  (same module `Today.jsx` already imports it from). Called with just
  `(store, routine.id)` for an ad-hoc start — no scheduled slot — which is the same path
  the req-55 hero's Continue uses.

### Grep receipts (post-change, all empty)
```
-- to="/start" / '/start' / name 'start' --   (none)
-- StartWorkout / views/Start --              (none)
-- ui-subbar --                               (none)
-- ui-subbar-h / ui-screen--subbar --         (none)
```

### `./check`
```
check: green — lint, 18 test file(s), and the build all passed.
```
`node --test` totals: `# tests 213 # pass 213 # fail 0`.
`route.test.js` alone: `# tests 13 # pass 13 # fail 0`.

### Spec-open choices
- **Edit is a link, not a button.** DEC-016 (nav = link, action = button): Edit navigates
  to the routine detail, so it's a `NavLink` styled with `ui-btn ui-btn--secondary` (the
  same link-styled-as-button pattern as the bottom-tab links and `Back`). Start, a state
  change, is a real `<Button>`. Both sit in the row's `action` slot in DOM order Edit →
  Start = visual left → right (DESIGN §4: retreat left, primary right — no CSS reverse).
- **Row has no separate tap target beyond the two buttons** — the name/focus is plain
  text; Edit is the affordance that opens the routine (spec left this to CC's call).
- **Segment→route via a lookup map** rather than nested ternaries, for the 3rd option.

## Workflow

- No scope added or dropped; built exactly to the ordered steps.
- One tidy-up beyond the letter of the spec: scrubbed a stale "Routines strip" phrase from
  the `--ui-dock` CSS comment (it described the now-deleted strip). Cosmetic, comment-only.
- No decisions needed from Emilio mid-build — every behavioural choice was already pinned
  in the requirement's Decisions block (remove `/start`, Edit→detail, Start→ad-hoc via
  req-55, `schedule*→library`).
- Nothing that should become a new `DEC-`/`L-`; the `activeTab` grouping change
  (`schedule*→library`) is a documented update to DEC-024 and is asserted in the test.

## For Emilio to look at (branch `req-56`)

1. **First page (Today):** the bottom "Routines ›" strip is gone; no leftover gap above
   the dock; nothing links to a Start picker. Schedule/History peek rows still there.
2. **Library toggle:** shows **Schedule · Routines · Exercises**; tapping Schedule shows
   the schedule (no Back arrow on that list); the active segment follows the route.
3. **Drill into a schedule day and back out:** the toggle stays on Schedule; the
   drill-down screens still have their own Back.
4. **Bottom menu:** on any Schedule screen the **Library** circle is lit (not Workout) —
   asserted in tests, worth an eyeball.
5. **Routines page:** each routine shows **Edit** (left) and **Start** (right, primary).
   Start begins that routine; Edit opens the routine detail.
6. **Failure case (needs a browser):** with a workout already in progress, tapping a
   routine's **Start** fires the req-55 "abandon the workout in progress" confirm — OK
   discards + starts the new one, Cancel keeps the current. Can't verify the `window.confirm`
   dialog from here.
