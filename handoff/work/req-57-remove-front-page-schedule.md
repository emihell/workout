# req-57 — Remove the schedule preview from the front page (it lives in Library now)

**Status: READY.** From Emilio 2026-09-13: *"remove schedule from front page — as we
now have it in the library."* Follows req-56 (Schedule became a Library segment).

**Gate: ux-feel.** Single view (`Today.jsx`) — no shared code, no persisted data.
Planning builds + tests + merges on its own testing; Emilio's phone look is the
non-blocking after-check. No reviewer subagent needed.

## Why

[measured] The front page (`Today.jsx:275-281`) shows an **upcoming schedule preview**:
a `<Row to="/schedule">Schedule</Row>` header + the next scheduled workouts
(`upcoming.map(UpcomingRow …)`, each with an inline Start), and a "Nothing scheduled."
line when empty. Since req-56 moved Schedule into the Library segmented control, this
front-page preview duplicates what now lives in Library.

## The behaviour (decided)

Remove the upcoming schedule preview section from the front page:
- the `<List>` containing `<Row to="/schedule">Schedule</Row>` and the
  `upcoming.map(...)` items, and the `{upcoming.length === 0 ? "Nothing scheduled." }`
  line (`Today.jsx:275-281`).

**Keep** everything else: the greeting, the week indicator, **today's workout as the
hero** (`TodayHero`/`TodayWorkout`/`TodayEmpty` — this is the page's core, not the
schedule preview), Completed-today, and the recent + History section.

**Clean up the now-dead code** (no stale code): if `upcoming` (the `remainingInLoop`
call), the `UpcomingRow` component, and the `remainingInLoop` import are unused after
the removal, delete them. Keep `StartButton` (still used by the today hero).

## Scope

- `Today.jsx`: remove the upcoming preview section + the now-unused `upcoming` /
  `UpcomingRow` / `remainingInLoop` (verify with grep before deleting).

## Out of scope

- The recent + **History** peek row — keep (Emilio named only Schedule).
- The no-routines **bootstrap** screen's nav list (`Today.jsx`, the `!routines.length`
  branch: Routines/Schedule/History/Settings) — that's onboarding, a different screen;
  leave it.
- The Library Schedule tab (req-56) — unchanged.
- Today's scheduled workout hero — unchanged (it stays).

## Ordered steps

1. `Today.jsx`: remove the upcoming preview `<List>` + the "Nothing scheduled." line.
2. Remove `UpcomingRow` and the `upcoming`/`remainingInLoop` usage if now unused
   (grep to confirm; keep `StartButton`).
3. `./check`.

## Acceptance criteria (written before implementation)

- **Front page (with routines):** no "Schedule" row and no upcoming-future preview and
  no "Nothing scheduled." text; today's workout still shows as the hero (with Start, or
  Continue if in progress), and the recent + History section remains.
- **Empty-today (edge case):** with nothing scheduled today and nothing in progress,
  `TodayEmpty` still renders (its disabled Start) and there is no leftover upcoming
  empty-state text.
- **No stale code:** `UpcomingRow` / `remainingInLoop` are removed if unused — grep in
  the report shows no remaining reference (or a note if `remainingInLoop` is still used
  elsewhere and kept).
- **No regression:** `./check` green — paste the line.

## Decisions

- **behaviour (Emilio):** remove the schedule preview from the front page.
- **behaviour (decided on his behalf, reversible):** remove the WHOLE upcoming preview
  section (header + the upcoming items with their inline Start), not just the link —
  a headerless list of upcoming items would read oddly, and the quick-start-next now
  lives via the Schedule tab / a routine's Start. If he wanted the upcoming items kept,
  that's a one-line revert.
- **implementation (CC's call):** none beyond the removal + dead-code cleanup.
