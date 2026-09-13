# req-56 — Start/Edit on routine rows; Schedule into the Library segmented; drop the first-page Routines strip

**Status: BUILT AND MERGED, 2026-09-13 — branch `req-56` (`39d4dc5`…`39d4dc5`, 1 commit).** From Emilio 2026-09-13 (phone testing): *"remove routines from the
first page — instead add 'start' 'edit' buttons on the routines in the routines page.
move schedule into the library page as a third option on the top segmented — so it's:
schedule routines exercises."* "Write a req, execute directly."

**Gate: ux-feel + functional (nav).** Touches shared routing (`route.js` `activeTab` +
route table) and the global bottom-menu grouping → **independent reviewer before merge**
(DEC-035). Not persisted-data. Planning tests + merges on its own testing; Emilio's
phone look is the non-blocking after-check.

## Why

- [measured] The first page's "Routines" entry is the fixed `.ui-subbar` strip
  (`Today.jsx:322-331`, a `NavLink to="/start"`). Its only job is to open the `/start`
  picker.
- [measured] `/start` (`StartWorkout`, `Start.jsx`) is reachable **only** from that
  strip (grep: the sole `/start` link is `Today.jsx:329`). Its two jobs — "start any
  routine" and "scheduled" — are exactly what Start-on-a-routine-row and the Schedule
  tab now provide, so removing the strip orphans `/start`.
- [measured] Routine rows are plain links to the detail (`Routine.jsx:46-50`), no
  actions.
- [measured] The Library toggle is a 2-segment `SegmentedControl`
  (`Library.jsx:17-20`, Routines | Exercises); Schedule is a separate top-level route
  (`/schedule`, `Schedule.jsx`) with its own `<Back/>`.
- [measured] `activeTab` (`route.js:113-121`) groups `schedule*` under **workouts**
  (falls through to the default), so the bottom menu lights Workout on Schedule.

## The behaviour (decided)

1. **Drop the first-page Routines strip.** Remove the `.ui-subbar` "Routines" strip
   from `Today.jsx` and the `ui-screen--subbar` padding it needed; remove the now-dead
   `.ui-subbar*` CSS.
2. **Start + Edit on each routine row** (`Routines()`, `Routine.jsx:34-53`). Each
   routine shows its name (+ focus) with two buttons: **Edit** (→ the routine
   detail/manage screen, `routinePath(id)`) and **Start** (→ `startOrContinue(store,
   routine.id)` — an ad-hoc start of that routine; reuses the req-55 one-in-progress /
   abandon-on-new path). DESIGN §4 order: Edit left, **Start** the primary on the right.
3. **Schedule becomes the third Library segment.** `SEGMENTS = [Schedule, Routines,
   Exercises]` (that order). `Library` renders `<Schedule/>` when `tab === 'schedule'`;
   the segment's `onChange` routes `schedule → /schedule`. Route `schedule` renders
   `<Library tab="schedule" />` (App.jsx). Remove `<Back/>` + keep the `<Title>Schedule
   </Title>` in the Schedule **list** view (it's a primary tab now, not a pushed
   screen); the drill-down screens (`ScheduleDay`, `ScheduleDayAdd`, `ScheduleSlot`,
   `ScheduleLoop`) keep their own `<Back/>`.
4. **`activeTab`: `schedule*` → `library`** so the bottom-menu **Library** circle is
   the selected one on every Schedule screen. (route.js change → domino: `route.test.js`
   `activeTab` cases updated.)
5. **Remove the orphaned `/start`** — the `StartWorkout` view (`Start.jsx`), its route
   in `App.jsx`, and its parse/`activeTab` handling in `route.js`. Its functions are
   replaced (Start-on-routine + the Schedule tab). *(Decided on Emilio's behalf — the
   direct consequence of removing its only entry point; reversible.)*

## Scope

- `Today.jsx`: remove the `.ui-subbar` strip + the `ui-screen--subbar` class use.
- `Routine.jsx` `Routines()`: Edit + Start buttons per row.
- `Library.jsx`: 3 segments incl. Schedule; host `<Schedule/>`.
- `App.jsx`: `schedule` route → `<Library tab="schedule"/>`; remove `/start` wiring +
  `StartWorkout` import.
- `Schedule.jsx`: remove `<Back/>` from the list view only.
- `route.js`: `activeTab` `schedule*→library`; remove the `start` route.
- `Start.jsx`: deleted.
- `ui.css`: remove `.ui-subbar*`.
- Tests: `route.test.js` (`activeTab`: schedule→library; no `start`).

## Out of scope

- The Today Schedule/History **peek rows** (`Today.jsx`, req-48) — keep; they link to
  the Schedule/History surfaces (Schedule now via the Library toggle).
- Redesigning the Routines / Exercises / Schedule screens' internals.
- The in-workout flow; the in-progress hero (req-55) — unchanged.

## Ordered steps

1. `Library.jsx`: add the Schedule segment (order Schedule | Routines | Exercises);
   render `<Schedule/>` for `tab==='schedule'`.
2. `App.jsx`: `schedule` → `<Library tab="schedule"/>`; drop `/start` route + import.
3. `Schedule.jsx`: remove `<Back/>` from the list view.
4. `route.js`: `activeTab` maps `schedule*→library`; remove the `start` route/parse.
5. `Routine.jsx` `Routines()`: Edit + Start buttons per row (Start right/primary).
6. `Today.jsx`: remove the `.ui-subbar` strip + `ui-screen--subbar`; `ui.css`: drop
   `.ui-subbar*`.
7. `Start.jsx` deleted; update `route.test.js`; `./check`.

## Acceptance criteria (written before implementation)

- **First page:** no "Routines" strip; nothing links to `/start`; no leftover bottom
  gap where the strip was.
- **Routines page:** each routine shows **Edit** and **Start**; Start begins that
  routine; **interaction/failure case** — with a workout already in progress, tapping a
  routine's Start fires the req-55 "abandon the workout in progress" warning (OK
  discards + starts, Cancel keeps the current). Edit opens the routine.
- **Library segmented:** shows **Schedule · Routines · Exercises** in that order;
  tapping Schedule shows the schedule; the active segment follows the route; drilling
  into a schedule day and backing out keeps the toggle correct.
- **Bottom menu (failure case):** on any `schedule*` screen the **Library** circle is
  selected (not Workout) — assert in `route.test.js` (`activeTab('schedule')`,
  `activeTab('schedule-day')`, etc. → `library`).
- **`/start` gone:** no `start` route, no `StartWorkout`, no `to="/start"`, no
  `.ui-subbar` — grep in the report; `route.test.js` has no `start` case.
- **No regression:** `./check` green — paste the line; `route.test.js` output pasted.

## Decisions

- **behaviour (Emilio):** the three changes above (strip out, Start/Edit on rows,
  Schedule as the 3rd segment in his order).
- **behaviour (decided on his behalf, reversible):** remove the orphaned `/start`;
  Edit → routine detail; Start → ad-hoc start (reusing req-55); `schedule*→library` so
  the bottom menu reflects Schedule's new home; keep the Today peek rows.
- **implementation (CC's call):** exact button styling/placement on the row; whether
  the row keeps any tap target beyond the two buttons.
