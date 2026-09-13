# req-57 — Remove the schedule preview from the front page

## Technical

**File changed:** `src/views/Today.jsx` only. No shared code, no persisted data, no tests changed.

**What was removed:**
1. The upcoming schedule preview `<List>` (the `<Row to="/schedule">Schedule</Row>`
   header + `upcoming.map(...)` items) and the following
   `{upcoming.length === 0 ? <p ...>Nothing scheduled.</p> : null}` line.
2. The `UpcomingRow` component (and its doc comment).
3. The `upcoming` variable (`remainingInLoop(routines, schedule, now).slice(0, 2)`)
   and its two-line doc comment.
4. `remainingInLoop` from the `../schedule` import — it was only used by `upcoming`.

**What was kept / touched lightly:**
- `coveringWorkout` import — still used by `TodayWorkout` (line 95), so kept.
- `StartButton` — still used by `TodayWorkout`; kept.
- `TodayHero` / `TodayWorkout` / `TodayEmpty` (the page hero), Completed-today, and
  the recent + History peek — all unchanged.
- Bootstrap `!routines.length` nav list (Routines/Schedule/History/Settings) — out
  of scope, untouched (lines 224–227).
- Trimmed the section-order comment above the hero to drop the now-gone "Upcoming›"
  bookend description and note req-57/req-56.
- Reworded the `InProgressPeekRow` comment that said "mirroring UpcomingRow's inline
  Start" — dropped the reference to the deleted component so no comment points at
  dead code.

### Grep receipt (dead-code confirmation)

After the change, across `src/`:

```
=== UpcomingRow ===
(no component/usage — only a comment mention remained, which was reworded away)
=== remainingInLoop ===
src/schedule.js:131:export function remainingInLoop(...)   # definition, used elsewhere? see below
src/views/Today.jsx:4:import ... remainingInLoop ...        # this import — now removed
```

Post-edit re-grep:
- `UpcomingRow` — no remaining references in `src/` (component + comment mention gone).
- `remainingInLoop` — the only consumer was `Today.jsx`; its import was removed.
  The `export function remainingInLoop` in `src/schedule.js` remains defined but is
  no longer imported anywhere in `src/`. Left in place: it is an exported schedule
  helper (removing it is a `schedule.js` API change outside this req's single-view
  scope); flagging it here as now-unused in case planning wants a follow-up to drop it.
- `upcoming` — no references in `Today.jsx`.

### Acceptance criteria

- **Front page (with routines):** no "Schedule" row, no upcoming-future preview, no
  "Nothing scheduled." text; hero (`TodayHero`/`TodayWorkout`) + recent/History remain.
  [verified by grep: only the render at lines 254/257/260 for the hero and 278/283 for
  recent+History remain; no `upcoming`/`Schedule`-row in the main return.]
- **Empty-today edge case:** `TodayEmpty` still renders (line 260); no leftover
  upcoming empty-state text (the `Nothing scheduled.` line is gone).
- **No stale code:** `UpcomingRow` / `remainingInLoop` removed from this view; grep
  receipt above. `remainingInLoop`'s definition kept (API scope note above).
- **No regression:** `./check` green:

```
# tests 213
# pass 213
# fail 0
check: green — lint, 18 test file(s), and the build all passed.
```

## Workflow

- No scope deviations. Change is exactly the removal + dead-code cleanup described.
- Two comments were trimmed to avoid leaving comments that reference removed code
  (the section-order comment and the `InProgressPeekRow` "mirroring UpcomingRow"
  mention). This is comment hygiene, not behaviour.
- **Surfaced for planning:** `remainingInLoop` in `src/schedule.js` is now unused
  anywhere in `src/` after this req. It was left defined because deleting an exported
  helper is a `schedule.js` API change beyond this single-view requirement. If nothing
  else will use it, a small follow-up could remove the export (and any test for it).
- Gate is `ux-feel` (planning tests + merges; Emilio's phone look is the non-blocking
  after-check). No reviewer subagent needed per the requirement.
