# req-48 — Rename Future→Schedule / Past→History, mark today on the Schedule

Branch: `req-48` (off main). Status: **ready to look at** (not merged).

## Technical

**What changed**

- `src/views/Today.jsx` — two label strings only:
  - `<Row to="/schedule">Future workouts</Row>` → `Schedule`
  - `<Row to="/history">Past workouts</Row>` → `History`
  - Targets (`to="/schedule"`, `to="/history"`) unchanged.
- `src/views/Schedule.jsx` — mark today:
  - Derived `const todayWeekday = new Date().getDay()` (0=Sun..6=Sat — the same
    convention `slotsOn` uses: `new Date(date).getDay()`).
  - Each weekday row now computes
    `isToday = week === currentWeek && weekday === todayWeekday` and passes
    `value={isToday ? 'Today' : null}` to `Row`.

**Choices left open by the spec (mine)**

- **Marker treatment:** used the existing `Row` `value` slot to render a **"Today"**
  tag (renders as `.ui-row__value`, gray, before the chevron). Reuses the library
  primitive — no new markup, no CSS, grayscale by construction. I chose an explicit
  text tag over a leading dot or bold weight because it's unambiguous and needs no
  new style.
- **Weekday derivation:** reused `getDay()` (matching `slotsOn`) rather than
  `WEEKDAY_ORDER`; `WEEKDAY_ORDER` is only the display order of rows, while the row's
  `weekday` value is the raw 0–6 day, which is what today must match against.

**Verification**

- Targets unchanged: diff shows only the two label text tokens changed on those
  `<Row>` lines; `to=` attributes untouched. [measured]
- Only-one-marker (failure case): the marker requires **both**
  `week === currentWeek` **and** `weekday === todayWeekday`, so with `loopWeeks > 1`
  today's weekday in a non-current week is not marked (a weekday-only test would
  light that day in every week). This is enforced by the `&&` in `isToday`;
  `currentWeek = loopWeekIndex(schedule)` is a single value, so exactly one
  (week, weekday) row can match. [measured — code]
- `./check`: `check: green — lint, 15 test file(s), and the build all passed.`
  [measured]

## Workflow

No scope deviation, no data/model change (marker derived at render), no mid-build
decisions needed from Emilio. The one open item is the marker's **visual form** —
I picked a "Today" text tag in the value slot (see Choices); the spec explicitly
left dot/tag/weight to me and flagged it as feel-gate iterable.

**Not verified by me (needs Emilio's on-device look, ux-feel gate):**
- That "Schedule" / "History" read right as the two section links on the Workout
  tab.
- That the "Today" tag on the Schedule reads the way he wants (vs a dot or bold),
  and lands on the correct day when opened on a known weekday — best confirmed by
  opening Schedule today.
