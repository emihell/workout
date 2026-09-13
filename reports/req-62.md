# req-62 — Kill the action/navigation label ambiguity

Branch `req-62-nav-vocabulary` (off `main`). Gate: **ux-feel** — Emilio's phone look
(via the demo) is the merge gate. Not merged. **Number provisional — planning to
confirm/spec** (built from an in-session scan + Emilio's direction, not a pre-written
READY spec).

## Why

From Emilio (on the demo): the nav links read ambiguously against buttons/rows — "is
*Done* really done?". A scan measured every clickable against the app's own vocabulary
(DESIGN §4: *Lists offer Add · Object detail owns Edit/Delete · Relationships Add/Remove
· Save · Cancel · Back*). Most labels were already vocabulary-correct; the ambiguity came
from **off-vocabulary verbs** and from **Back being a button when it is navigation**.

## The rule applied

Navigation wears the **link** treatment (chevron: `‹` back / `›` forward) and reads as a
place; actions wear the **Button** and use only the DESIGN §4 verbs. No off-vocabulary
verb, no navigation dressed as a button.

## Changes (3)

1. **Back → a nav link everywhere.** `Back` (`shared.jsx`) was a `<button class="ui-btn
   ui-btn--quiet">` calling `go(to)`. It is navigation, so per DEC-016 it is now the
   `NavLink` primitive: `<NavLink to={to} className="ui-navlink" chevron="back">Back</NavLink>`
   → renders `‹ Back`, the counterpart of the forward `›` links and matching
   `ExercisesLink`. One component ⇒ every Back site changes at once. **Behaviour
   unchanged** — same `to` targets from req-49; navigation is now a real `<a href>`
   (declarative) instead of an imperative `go()`. Dropped the now-unused `go` import.
   *(This completes the "fold Back into the component treatment" that req-50 had
   deferred.)*
2. **Removed "Done".** `RoutineDetail` and `ScheduleDay` had a bottom `Done` link → the
   parent list. Off-vocabulary, and it read like it *commits* (it doesn't — edits are
   live). It is also now **100% redundant**: req-49 made **Back** go to that exact same
   list. Removed both; Back is the single, consistent exit.
3. **"Correct" → "Edit".** The workout-detail (an object detail, which the vocabulary
   says owns *Edit*) linked to its feel/note editor as "Correct" — a one-off action-y
   verb. Renamed the link **and** its destination screen title (`history/edit.jsx`
   `<Title>`) to "Edit" so link and screen stay coherent.

Left unchanged (verified vocabulary-correct): Add routine / Add exercise / Add set / Add
exercises (lists offer / relationships use *Add*), Edit, By exercise, Routine, Cancel,
Skip, and all true-action Buttons (Save/Start/Remove/Delete/Up/Down/Continue/Abandon/Apply).
Not touched (flagged optional earlier, awaiting Emilio): "Create exercise"→"New exercise",
the "Already added" status-link.

## Verification (receipts)

- `./check` → **green**: `check: green — lint, 19 test file(s), and the build all passed.`
  (Lint green ⇒ the dropped `go` import left nothing unused.)
- **[measured]** `grep -rn ">Done<" src/views/` → none; `grep -rn "Correct" src/views/` → none.
- `shared.jsx` no longer imports/uses `go` (only a comment mentions the word).
- Updated `src/views/shared.test.js` for the new Back: asserts `<NavLink to={to}
  className="ui-navlink" chevron="back">Back</NavLink>`, import is `{ toHash }`, and Back
  is not a `<button>` doing `go(to)`. `route.test.js` (back()/applyBack removed) still holds.
- **[measured]** served on the demo over Tailscale: local `127.0.0.1:4173` → 200, ts.net → 200.

## What could not be verified here

The feel — does `‹ Back` read right everywhere, does removing "Done" leave any screen
feeling like it lacks an exit, does "Edit" fit the workout-detail. Emilio's phone check.

## Workflow

- ux-feel, presentation/label only; no route or data change (Back keeps req-49's targets).
- **Number/spec:** built without a planning READY spec (in-session scan + Emilio's go);
  planning to assign the real number and record it.
- **Candidate `DEC-`/DESIGN note:** the rule above — *navigation = link treatment
  (‹/› chevrons) with DESIGN §4 verbs; actions = Button; no off-vocabulary verbs
  (no "Done"/"Correct")*. Worth adding to `rules/DESIGN.md` so it holds on future screens.
- **Predecessors still owe planning close-out** (I can't run `./plan closeout`): req-49,
  req-50 (+ its chevron follow-up), and the demo gate are merged to `main` but unclosed
  and unpushed.
