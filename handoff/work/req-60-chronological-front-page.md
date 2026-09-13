# req-60 — Front page reads chronologically (future at top, today middle, oldest at bottom)

**Status: BUILT AND MERGED, 2026-09-13 — branch `req-60` (`d5bff03`…`d5bff03`, 1 commit).** From Emilio 2026-09-13: *"dates should be chronological — starting
at the bottom with the oldest, going up to the top where the date most in the future
is, with today in the middle."*

**Gate: ux-feel.** Single view (`Today.jsx`), no shared code, no persisted data.
Planning builds + tests + merges on its own testing.

## Why — reproduction

The front-page column already has the macro order future → today → past top-to-bottom,
BUT the **upcoming** preview is ordered the wrong way within itself:
[measured] `remainingInLoop` returns items in **ascending** date order (nearest-future
first — the loop runs `i = 1..loop*7`, `src/schedule.js`), and `Today.jsx` renders
`upcoming.slice(0,2)` in that order. So the nearest-future workout sits at the **top**
of the upcoming list and the furthest just above today — i.e. going *down* the list
the dates *increase*, which is backwards for a chronological column.

[measured] The **recent** peek is already correct: `sortWorkoutsByDate` is
**descending** (`right.localeCompare(left)`, `history/helpers.js`), so the most-recent
past sits just below today and the oldest at the bottom.

## The behaviour (decided)

Make the whole front-page column read chronologically — **dates strictly decrease from
top to bottom**: furthest-future at the very top → nearest-future → **today (hero) in
the middle** → most-recent past → oldest at the very bottom.

The only change needed: **reverse the upcoming preview** so the furthest of the shown
upcoming items is at the top and the nearest sits just above the today hero (the two
soonest workouts are still what's shown — `slice(0,2)` — only their vertical order
flips). The recent peek stays as-is (already descending). Net top→bottom:

```
upcoming: furthest → nearest      (reversed; dates decreasing)
today hero                        (today — the middle)
completed-today                   (today)
recent: most-recent → oldest      (unchanged; dates decreasing)
History› link                     (footer nav; not a dated row)
```

## Scope

- `Today.jsx`: reverse the rendered upcoming preview order (e.g. `upcoming` =
  `remainingInLoop(...).slice(0,2)` then `.reverse()`, or map in reverse). No other
  section changes.

## Out of scope

- The recent/History peek order — already correct (descending).
- `remainingInLoop` / `sortWorkoutsByDate` themselves — leave the shared helpers as
  they are (other callers depend on their current order); reverse only at the
  front-page render.
- The `History›` footer link position — it's a nav affordance, not a dated row; leave
  it at the bottom of the recent peek.
- History and Schedule views (all-past / weekly — "today in the middle" is a
  front-page concept).

## Acceptance criteria (written before implementation)

- **Upcoming order:** in the upcoming preview the furthest-future shown workout is at
  the top and the nearest is at the bottom (just above the today hero) — confirm by
  eye + the render order in the diff.
- **Whole column chronological:** top→bottom the dates decrease — furthest future,
  then today (hero) in the middle, then most-recent, then oldest at the bottom.
- **Edge case:** with 0 upcoming, "Nothing scheduled." still shows and nothing breaks;
  with 1 upcoming, it renders correctly (reverse of one item is itself).
- **No shared-helper change:** `remainingInLoop` / `sortWorkoutsByDate` are unchanged —
  confirm in the diff (only `Today.jsx` changed).
- **No regression:** `./check` green — paste the line.

## Decisions

- **behaviour (Emilio):** chronological column, future top / today middle / oldest
  bottom.
- **implementation (CC's call):** where exactly to reverse (render-time in `Today.jsx`);
  the two-soonest-upcoming preview count is unchanged.
