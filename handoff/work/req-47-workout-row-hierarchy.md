# req-47 — Workout page: date above the info, today black / other dates gray

**Status: READY.** From Emilio 2026-09-12: *"Similar to the today row - put the date
above the workout info … use the smaller [font] we have for the dates … Today rows
workout info should be black, other dates should be gray."* Emilio-directed polish
(DESIGN §5 feel is normally deferred; this is explicitly requested).

**Gate: ux-feel** — planning builds + tests + merges on its own testing (DEC-035);
Emilio's on-device look is the non-blocking after-check.

## Why

The Workout tab (`Today.jsx`, route `/`) shows two peek lists — Upcoming and Recent —
whose rows render the shared `WorkoutInfo` as one inline line:
`[when] · [name] — [focus]` (`Today.jsx:42-49`, used by `UpcomingRow` :82-95,
`HistoryPeekRow` :65-72, `CompletedTodayRow` :54-61). The emphasized **today block**
(`TodayWorkout` :102-123) already stacks a bold date on its own line
(`.ui-today-workout__date` :111) above `name — focus`. Emilio wants the peek rows to
echo that stack — date on top in the small caption size — and wants today's rows to
read darker than other dates so the eye lands on today.

## The behaviour (decided)

1. **Date stacks above the info** in the peek rows. `WorkoutInfo` becomes two lines:
   the date (`when`) on its own line in the **caption** size (`--ui-text-caption`,
   13px — the "smaller font we have for dates"), then `name — focus` below. The old
   ` · ` separator between date and name goes away (the stack replaces it). `focus`
   still degrades gracefully — dropped when absent, never invented (DESIGN §1).
2. **Today's rows are black; other dates are gray.** A row whose date is **today**
   renders its info in `--ui-ink` (near-black); a row for any other date renders in
   `--ui-ink-2` (gray). In practice: `CompletedTodayRow` (finished today) → black;
   `UpcomingRow` (future) and `HistoryPeekRow` (past) → gray. Keying off the row's
   actual date-vs-today is preferred over keying off the component, so it stays
   correct if a component is ever reused for a different date.

**The `TodayWorkout` / `TodayEmpty` block is NOT touched** — it is the special today
row with its own rules (Emilio: *"the today row is special, do not change it"*).

## Scope

- `Today.jsx`: `WorkoutInfo` stacks date-above-info; the three peek-row components
  pass/derive a today-vs-other color.
- `ui.css`: a class (or two) for the stacked date caption line and the today/other
  ink color. No new tokens — reuse `--ui-text-caption`, `--ui-ink`, `--ui-ink-2`.

## Out of scope

- `TodayWorkout` / `TodayEmpty` (the today block) — untouched.
- The row's `value`/`action` slots (Done label, inline Start) — unchanged.
- Any data/model/store change — this is presentation only.
- The rename of the "Future workouts"/"Past workouts" section links — that's req-48.

## Ordered steps

1. `Today.jsx`: change `WorkoutInfo` to render `when` on its own caption-size line
   above `name — focus`.
2. Give the info a today-vs-other ink: today → `--ui-ink`, other → `--ui-ink-2`,
   derived from the row's date compared to today's `dateKey`.
3. `ui.css`: add the minimal class(es); reuse existing tokens only.

## Acceptance criteria (written before implementation)

- **Stack renders:** in each peek row the date sits on its own line, in caption size,
  above `name — focus` — confirm in the running app (Emilio look) and by the markup in
  the diff.
- **Today black, other gray:** a completed-today row's info is `--ui-ink`; an upcoming
  (future) and a recent (past) row's info is `--ui-ink-2` — assert the class/color is
  keyed off date-vs-today, not hardcoded per list.
- **Absent focus not invented (failure case):** a row whose source has no `focus`
  (older snapshot or deleted routine) shows `name` with no `— ` and no placeholder —
  the DESIGN §1 no-invention rule still holds after the restack.
- **Today block unchanged:** `TodayWorkout`/`TodayEmpty` markup is byte-unchanged —
  confirm in the diff.
- **No regression:** `./check` green — paste the line.

## Decisions

- **behaviour (Emilio):** date stacks above info in caption size; today black, other
  gray; today block untouched.
- **implementation (CC's call):** exact class names; whether color is a prop on
  `WorkoutInfo` or a wrapper class; the today-vs-other date comparison (reuse the
  helper Today/schedule already use, e.g. `dateKey`).
