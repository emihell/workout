# req-62 — Kill the action/navigation label ambiguity

**Status: BUILT AND MERGED, 2026-09-13 — branch `req-62` (`e5737f8`…`e5737f8`, 1 commit).**

**Gate: ux-feel.** Built from an in-session scan + Emilio's direction on the demo (no
pre-written READY spec); planning assigned the number and recorded it on close-out.

## Why

From Emilio, on the demo: the nav links read ambiguously against buttons/rows — "is
*Done* really done?". A scan measured every clickable against the app's own vocabulary
(DESIGN §4). Most labels were already correct; the ambiguity came from **off-vocabulary
verbs** and from **Back being a button when it is navigation**.

## The rule (now DESIGN §4 / DEC-042)

Navigation wears the **link** treatment (chevron `‹` back / `›` forward) and uses only
the §4 verbs; actions wear the **Button** and use only §4 verbs. No off-vocabulary verb,
no navigation dressed as a button.

## Changes (3)

1. **Back → the `NavLink` primitive everywhere.** `Back` (`shared.jsx`) was a
   `<button class="ui-btn ui-btn--quiet">` calling `go(to)`; it is navigation, so per
   DEC-016 it is now `<NavLink to={to} className="ui-navlink" chevron="back">Back</NavLink>`
   → `‹ Back`, matching `ExercisesLink` and the forward `›` links. One component ⇒ every
   Back site changes at once. **Behaviour unchanged** — same `to` targets from req-49;
   navigation is now a declarative `<a href>` instead of an imperative `go()` (dropped the
   now-unused `go` import). *Completes the "fold Back into the component treatment" req-50
   deferred.*
2. **Removed "Done".** `RoutineDetail` and `ScheduleDay` had a bottom `Done` link → the
   parent list. Off-vocabulary, read like it commits (it doesn't — edits are live), and now
   100% redundant: req-49 made **Back** go to that exact same list. Removed both.
3. **"Correct" → "Edit".** The workout-detail linked to its feel/note editor as "Correct" —
   an action-y one-off. Renamed the link **and** the destination screen title
   (`history/edit.jsx` `<Title>`) to "Edit" (an object detail owns *Edit*, §4).

Left unchanged (verified vocabulary-correct): Add routine / Add exercise / Add set / Add
exercises, Edit, By exercise, Routine, Cancel, Skip, and all true-action Buttons. Deferred
(Emilio's optional, not done): "Create exercise"→"New exercise"; the "Already added"
status-link.

## Acceptance criteria

- **No off-vocabulary verbs:** `grep -rn ">Done<" src/views/` → none; `grep -rn "Correct"
  src/views/` → none. [both measured green in reports/req-62.md]
- **Back is a link, not a button:** `src/views/shared.test.js` asserts `<NavLink to={to}
  className="ui-navlink" chevron="back">Back</NavLink>`, import `{ toHash }`, and Back is
  not a `<button>` doing `go(to)`; `route.test.js` (back()/applyBack removed in req-49)
  still holds.
- **No behaviour change:** Back keeps req-49's `to` targets; `./check` green (lint green ⇒
  dropped `go` import left nothing unused).
- **Feel (Emilio, browser):** `‹ Back` reads right everywhere, removing "Done" leaves no
  screen without an exit, "Edit" fits the workout-detail. → **met on the demo.**

## Decisions

- **behaviour/vocabulary (Emilio):** navigation = link treatment + §4 verbs; actions =
  Button; no off-vocabulary verbs. → DEC-042, DESIGN §4.
- **implementation (CC):** Back via the NavLink primitive (DEC-016); "Done" removed as
  redundant with req-49's Back; "Correct"→"Edit" on link + screen title.
