# req-47 — Workout page: date above the info, today black / other dates gray

Branch: `req-47`. Status: **ready to look at** (not merged).

## Technical

**What changed**

- `src/views/Today.jsx`
  - `WorkoutInfo` no longer renders `[when] · [name] — [focus]` inline. It now
    renders a two-line stack: `when` on its own caption-size line
    (`.ui-workout-info__date`), then `name — focus` below
    (`.ui-workout-info__body`). The old ` · ` separator is gone. `focus` still
    degrades gracefully — `{focus ? \` — ${focus}\` : ''}` is unchanged, so an
    absent focus drops the `— ` with no placeholder (DESIGN §1).
  - `WorkoutInfo` gained a `today` prop. When true the wrapper gets
    `ui-workout-info--today`, which colors the body `--ui-ink` (near-black);
    otherwise the body stays `--ui-ink-2` (gray).
  - `today` is derived **from the row's date vs today**, not from the component:
    - `CompletedTodayRow`, `HistoryPeekRow`: `workoutDateKey(workout) === todayKey`
    - `UpcomingRow`: `dk === todayKey` (`dk = dateKey(date)`)
  - `todayKey` (already computed in `Today()`) is threaded to the three peek-row
    components as a prop.
- `src/ui/ui.css`: added `.ui-workout-info`, `.ui-workout-info__date`,
  `.ui-workout-info__body`, and `.ui-workout-info--today .ui-workout-info__body`.
  No new tokens — reuses `--ui-text-caption`, `--ui-ink`, `--ui-ink-2`.

**Choices left open by the spec (mine)**

- **Class names / prop vs wrapper class:** used a `today` boolean prop on
  `WorkoutInfo` that toggles a `--today` modifier class; color lives in CSS.
- **What the color keys off:** the row's date compared to `todayKey`
  (`dateKey(new Date())`), passed as a prop — so it stays correct if a component
  is ever reused for a different date, as the spec preferred.
- **The date line's color:** kept the caption date line at `--ui-ink-2` (gray)
  for every row; only the body ("name — focus") toggles black-for-today. This
  matches the spec wording ("today's row **info** black") and makes today's row
  read darker without also darkening the date label.

**Verification**

- Today block untouched — `git diff src/views/Today.jsx` shows no `+`/`-` lines
  touching `TodayWorkout`, `TodayEmpty`, `ui-today-workout*`, or "Nothing
  scheduled". [measured]
- Absent focus not invented: `WorkoutInfo` keeps the `focus ? … : ''` guard, so a
  row whose source has no `focus` renders `name` alone with no `— ` and no
  placeholder. [measured — unchanged expression]
- `./check`: `check: green — lint, 15 test file(s), and the build all passed.`
  (182 tests pass.) [measured]

## Workflow

No scope deviation — implemented exactly the two behaviours in the spec, on
`Today.jsx` + `ui.css` only, no data/model change. No mid-build decisions needed
from Emilio. One thing worth a `DEC-`/note if planning wants it: I decided the
**date caption line stays gray for all rows** and only the body toggles black for
today (see Choices above) — that's the one place the spec left the treatment of
the date line itself open.

**Not verified by me (needs Emilio's on-device look, ux-feel gate):** whether the
caption-size date + black/gray body reads the way he pictured on the real
Workout screen, and whether today's row stands out enough among the peeks.
