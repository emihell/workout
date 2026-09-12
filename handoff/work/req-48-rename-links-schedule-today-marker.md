# req-48 — Rename Future→Schedule / Past→History, and mark today on the Schedule

**Status: READY.** From Emilio 2026-09-12: *"Future workout can be exchange for
Schedule … Schedule should have a mark on the todays day … Past workout can just be
history."*

**Gate: ux-feel** — planning builds + tests + merges on its own testing (DEC-035);
Emilio's on-device look is the non-blocking after-check.

## Why

On the Workout tab (`Today.jsx`) the two section links read **"Future workouts"**
(`Today.jsx:214`, → `/schedule`) and **"Past workouts"** (`Today.jsx:245`,
→ `/history`). The destinations are already named Schedule and History (routes,
`Schedule.jsx:37` title "Schedule"; `history` route). Emilio wants the links to use
those names directly. Separately, the Schedule day list (`Schedule.jsx:52-60`) shows
every weekday of the loop with no indication of which one is **today**, so the current
day doesn't stand out.

## The behaviour (decided)

1. **Rename the two section links** on `Today.jsx`:
   - `:214` "Future workouts" → **"Schedule"**
   - `:245` "Past workouts" → **"History"**
   (Labels only; the `to="/schedule"` / `to="/history"` targets are unchanged.)
2. **Mark today on the Schedule.** In `Schedule.jsx` the day rows are rendered per
   `(week, weekday)`; the current loop week is already computed
   (`currentWeek = loopWeekIndex(schedule)`, `:31`). Mark the single row whose
   `week === currentWeek` **and** `weekday === today's weekday` so the current day is
   visually distinct. CC picks the marker treatment (a leading dot, a "Today" tag, or
   weight) consistent with the grayscale library; iterate on the feel gate.

## Scope

- `Today.jsx:214,245`: two label strings.
- `Schedule.jsx`: compute today's weekday, mark the matching row in the current week.

## Out of scope

- The empty-state list in `Today.jsx:182-186` ("Routines / Schedule / History /
  Settings") — those already read "Schedule"/"History"; unchanged.
- The tab bar labels (Workout / Library / Settings) — that's the bottom-menu redesign
  (req-52).
- Any schedule data/model change — the marker is presentation only, derived at render.

## Ordered steps

1. `Today.jsx`: rename the two `<Row>` labels.
2. `Schedule.jsx`: derive today's weekday (map `new Date()` through the same weekday
   convention `slotsOn`/`WEEKDAY_ORDER` use); add a marker to the row where
   `week === currentWeek && weekday === todayWeekday`.
3. Style the marker minimally in `ui.css` if needed (grayscale, existing tokens).

## Acceptance criteria (written before implementation)

- **Labels:** the Workout tab shows "Schedule" and "History" as the two section
  links; tapping them still lands on `/schedule` and `/history` — confirm targets
  unchanged in the diff.
- **Marker on the right day:** on the Schedule, exactly one row is marked, and it is
  today's weekday in the current loop week — verify by opening Schedule on a known day.
- **Only one marker (failure case):** with `loopWeeks > 1`, today's weekday in a
  **non-current** week is **not** marked — assert the marker requires
  `week === currentWeek`, not just a weekday match (a weekday-only test would light the
  same day in every week).
- **No regression:** `./check` green — paste the line.

## Decisions

- **behaviour (Emilio):** rename the two links; mark today's day on the Schedule.
- **implementation (CC's call):** the marker's visual form (dot/tag/weight); how
  today's weekday is derived (reuse the schedule module's weekday helpers).
