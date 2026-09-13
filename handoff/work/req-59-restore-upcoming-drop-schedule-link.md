# req-59 — Restore the front-page upcoming preview; remove ONLY the "Schedule" link (corrects req-57)

**Status: READY.** From Emilio 2026-09-13: *"i didn't mean to remove the whole preview,
just the schedule option."* Corrects req-57's over-removal.

**Gate: ux-feel.** Single view (`Today.jsx`), no shared code, no persisted data.
Planning builds + tests + merges on its own testing.

## Why

req-57 removed the **entire** upcoming schedule preview from the front page (the
`<List>` with the `UpcomingRow` items + the "Nothing scheduled." line + the `<Row
to="/schedule">Schedule</Row>` header). Emilio wanted only the **Schedule nav link
row** gone (Schedule lives in Library now); the upcoming workout items — the actual
"what's next", each with an inline Start — should **stay**.

## The behaviour (decided)

Restore the front-page upcoming preview to its pre-req-57 state **except** the Schedule
link row:
- Re-add the `UpcomingRow` component, the `upcoming = remainingInLoop(routines,
  schedule, now).slice(0, 2)` computation, and the `remainingInLoop` import
  (`../schedule`) — exactly as before req-57 (`git show 558135d^:src/views/Today.jsx`
  is the pre-req-57 source).
- Re-add the upcoming `<List>` with `upcoming.map(...UpcomingRow...)` and the
  `{upcoming.length === 0 ? "Nothing scheduled." }` line.
- **Do NOT re-add** `<Row to="/schedule">Schedule</Row>` — that one nav row stays
  removed. The list is headerless (just the upcoming items).

Everything req-57 correctly kept (today hero, Completed-today, recent + History) is
already in place — leave it.

## Scope

- `Today.jsx`: restore the upcoming preview (component + data + list) minus the
  Schedule link row.

## Out of scope

- A replacement header/label for the upcoming list — leave it headerless (minimal:
  "just the schedule option" removed). If Emilio wants a non-nav label, a follow-up.
- The now-unused `remainingInLoop` export question — it's used again after this, so
  moot.
- The Library Schedule tab; the recent/History section.

## Acceptance criteria (written before implementation)

- **Preview back:** the front page again shows the upcoming scheduled workouts (each
  with its inline Start where applicable, `Done …` when covered), and "Nothing
  scheduled." when there are none.
- **Schedule link gone:** there is no `<Row to="/schedule">Schedule</Row>` / no
  "Schedule" nav row on the front page — grep.
- **Rest intact:** today's hero and the recent + History section unchanged.
- **No regression:** `./check` green — paste the line.

## Decisions

- **behaviour (Emilio):** keep the upcoming preview; remove only the Schedule nav link.
- **implementation (CC's call):** restore verbatim from the pre-req-57 source minus the
  link; headerless upcoming list.
