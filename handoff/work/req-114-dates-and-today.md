# req-114 — dates and Today: local date everywhere, imported schedule anchor, midnight, two-routine hero (audit G, DEC-058)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[functional]** + **[P]**: defaults a missing `schedule.anchor`
on import and on load, with one save (DEC-057: reviewer + backup reminder before merge). No schema bump.
Revised 2026-09-23 after the spec review.

## Why [measured by the 2026-09-23 audit reviewer, scripts in scratchpad/audit-today]

1. `overview.jsx:55` uses `new Date().toISOString().slice(0,10)` (UTC). Everywhere else uses local `dateKey`, so
   between 00:00 and 02:00 in Sweden the preview shows yesterday and mints `adhoc-X@<yesterday>` (model.js ~465).
2. An imported schedule has no `anchor` (`exchange.js:109` template, `applyBackup` replaces the default), so
   `loopWeekIndex` (`schedule.js:32`) anchors on the queried date: the week index is always 0, and weeks 2–4 never
   show on Today. Measured: `0,0,0,0,0` over 5 weeks.
3. `mondayOf(new Date('YYYY-MM-DD'))` (`schedule.js:7,32`) parses the anchor as UTC midnight, so west of UTC the
   loop week flips.
4. Today reads `loopWeeks` with `Math.max(1, …)` (`Today.jsx:244`) while Schedule uses `clampLoopWeeks`. An imported
   6 shows "Week 1 of 6".
5. `Done {dateKey(finishedAt)}` prints a raw ISO date (`Today.jsx:104,132`), where other rows use `weekdayDate`.
6. **Midnight (DEC-058 §2):** `Today.jsx:257` and `workout-actions.js:44` test `dateKey(startedAt) === today`. A
   workout started 23:50 loses the hero at 00:05, and today's Start then asks to abandon it (measured).
7. **Two-routine hero (DEC-058 §3):** `Today.jsx:328-334` swaps the whole today block for `TodayHero`, so the day's
   second routine vanishes while the first is in progress (measured).

## The behaviour

1. The preview uses `dateKey(new Date())`.
2. A schedule with no `anchor` gets the Monday of the current week (the same default a new schedule gets,
   `schedule.js:41`). This happens **in `applyBackup`** and **in `loadState`**, not in `migrateState`: that would
   make it clock-dependent, and the default would reach disk only on the next write, so a read-only user would
   get a fresh "this Monday" every week. `loadState` saves once when it defaulted the anchor (a named
   single-field write). The exchange template documents `anchor`. **(unconfirmed)** An anchor-less import then
   counts "this week" as week 1.
3. The anchor, and every date-only string passed to `dateKey` / `mondayOf`, is parsed as a local `y-m-d`
   (e.g. `dateKey('2026-09-21')` returns 2026-09-20 in New York today).
4. Today clamps `loopWeeks` like Schedule does.
5. `Done` shows `weekdayDate`, like the other rows.
6. **One "current" rule, in one pure helper:** an active workout is current if it was started today **or** within
   the last 6 h. The Today hero, `startOrContinue`'s "continuing the same workout" check and
   `staleInProgressWorkouts` all use it. Wake-lock is **not** changed (out of scope: gating it would switch it off
   while someone logs a resumed stale workout).
7. **Hero plus the rest of the day:** while a current workout is the hero, today's block shows **today's date**,
   the hero (labelled in progress), and today's *other* occurrences with their own Start/Done. "Other" means
   `occurrenceId ≠ active.occurrenceId`, so today's slot of the **same routine** a pre-midnight workout came from
   counts as other. Today's `StartButton` passes the occurrenceId (it doesn't today, `Today.jsx:18-21`, so it
   silently continues yesterday's occurrence), so every other Start goes through the one-active-workout rule
   (DEC-038, abandon-on-new confirm).

## Scope

`overview.jsx`, `schedule.js`, `model.js` (`migrateState` anchor default), `exchange.js` (template string),
`Today.jsx`, `workout-actions.js`, `storage.js` (`staleInProgressWorkouts`, `loadState` anchor default),
`exchange.js` (`applyBackup` anchor default), tests. JSX logic under test goes in pure `.js` helpers (tests can't
import `.jsx`, `store.test.js:12-16`). req-38 fixed the same UTC bug in `store.jsx` but missed `overview.jsx:55`.

## Order vs siblings

req-115 (storage.js/exchange.js) → **req-114** → req-120 (storage.js/exchange.js/model.js).

## Out of scope

Re-anchoring when the loop length changes (still an open question, BACKLOG); the upcoming peek; Schedule editor UI;
wake-lock.

## Acceptance criteria

- **UTC (unit, TZ=Europe/Stockholm):** at 00:30 local, the preview's plan date is today's local date.
- **Anchor (unit):** an imported / loaded schedule without `anchor` → `loopWeekIndex` over the next 5 weeks
  cycles (e.g. `0,1,0,1,0` for 2 weeks), not all 0; `loadState` wrote the anchor once, and a second load doesn't
  write again. An existing anchor is untouched.
- **TZ (unit, TZ=America/New_York and Europe/Stockholm):** same anchor and date → same week index.
- **Clamp (unit/static):** `loopWeeks: 6` reads as 4 on Today.
- **Midnight (unit):** started 23:50, now 00:05 → current; started 5 h 59 m ago on the prior day → current;
  6 h 01 m → stale; started yesterday 08:00, now 09:00 → stale.
- **Same routine both days (puppeteer, faked clock):** routine R scheduled Tue and Wed; start R Tue 23:50; at Wed
  00:05 → the hero shows R in progress under Wed's date, and Wed's R slot shows a Start that asks before abandoning.
- **Failure case — hero plus the rest (browser/puppeteer, faked clock):** two routines today, the first in progress
  → the hero plus the second routine with its Start, under one date.
- **No regression:** `./check` green; existing schedule tests unchanged. Receipt quoted (DEC-057).

## Decisions

- 6 h window, hero plus the rest of the day (Emilio, 2026-09-23, DEC-058).
- Default anchor = Monday of the current week **(unconfirmed)**. It matches a new schedule's default.
