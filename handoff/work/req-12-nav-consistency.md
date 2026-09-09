# req-12 — navigation consistency: nav is links, buttons are actions; one shared nav component

**Status: BUILT AND MERGED, 2026-09-10 — branch `req-12` (`c735e47`…`c735e47`, 1 commit).** — decision settled (DEC-016). A code + UI-semantics consistency pass, no design.
Touches most view files but is behaviour-preserving (navigation still navigates).

**Gate: functional** (DEC-009) — behaviour-preserving (each converted control still goes to the same
screen); the planning session browser-verifies nav still works across the converted screens and
closes it. **Note the one visible side-effect:** a "Cancel"/"Skip" that becomes a link renders as
link text instead of a button until the styling pass — expected and intended (they'll be styled
consistently later). If any converted control feels wrong to Emilio, it's caught at that pass.

## Why

The 2026-09-09 consistency audit found the app already semantically sound in most respects — actions
are all `<button>` (no fake-button `<div>`s), lists use `<ul>/<ol>/<li>`, screens are `<section>`s
with `<h1>`/`<h2>`. The one real inconsistency: **navigation is done two ways** — `<a href="#/…">`
links in some places, `<button onClick={() => go(…)}>` in others (9 "Cancel" buttons + Skip /
screen-nav across Exercises, History, Schedule, Routine, Workout). Settling this now — before the
styling pass — means styling lands on one consistent semantic (links vs buttons style differently).

## The rule (DEC-016)

- **Pure route navigation → `<a href>` link.** "Go to another screen" with no state change.
- **`<button>` is reserved for state changes / submits** — Complete, Save, Delete, Add, Pause/Resume,
  +30s, Next (ends rest), Import, applyBackup, addWorkingSet, patchActive, form `type="submit"`, etc.
- **Only PURE-navigation buttons convert.** A button whose handler *also* mutates state (or is a form
  submit) stays a `<button>`. When unsure, if the handler is exactly `() => go(X)` (or `location.hash`)
  and nothing else, it's pure navigation → link.

## Scope

- Add **one shared nav-link component** — e.g. `NavLink({ to, children })` rendering
  `<a href={toHash(to)}>{children}</a>` (reuse `toHash` from `route.js`). Put it with the other
  shared view helpers (`src/views/shared.jsx`, alongside `Back`/`ExercisesLink`). Generalize or
  align `ExercisesLink` (req-11) so there is one nav-link primitive, not several ad-hoc ones.
- **Convert the pure-navigation buttons to that component.** Starting candidates (CC to verify each
  is pure-nav, i.e. handler only navigates):
  - `Exercises.jsx:195, 368` (Cancel → hub / exercise)
  - `History.jsx:448, 607` (Cancel), `History.jsx:658` (Skip — verify it doesn't also mutate)
  - `Schedule.jsx:106, 148` (Cancel / nav)
  - `Routine.jsx:166, 232` (nav / Cancel)
  - `Workout.jsx:843` (Cancel in a set-edit form — a link; the sibling `Save` is a submit `<button>`)
  - plus any others matching `onClick={() => go(…)}` with no state change.
- **Leave everything else as-is** — action buttons, existing `<a href>` nav links, lists, headings,
  section wrappers (all already consistent per the audit).

## Out of scope

- Any styling / design (the app stays zero-CSS; this is semantics + code only).
- Replacing native `alert`/`confirm` with inline UI (separate backlog item).
- Restructuring screens, headings, or list markup (audited as already consistent).
- Changing what any control *does* — behaviour is identical; only the element/type changes for
  pure-nav controls.

## Ordered steps

1. Add the shared `NavLink` (or equivalent) to `shared.jsx`; reconcile `ExercisesLink` so there's one
   nav-link primitive.
2. Find pure-navigation buttons (`onClick={() => go(…)}`/`location.hash` with no other statement) and
   convert each to the nav-link component. List every conversion in the report.
3. Confirm no `onClick` on non-button elements was introduced, and no action button was wrongly
   converted (a mutate-then-navigate handler must stay a button).

## Acceptance criteria (written before implementation)

- **One nav pattern:** after the pass, "go to a screen" is always an `<a>` (the shared component);
  `<button>` is only ever an action/submit. Prove with a grep in the report: no
  `onClick={() => go(` (or bare navigation-only onClick) remains on a `<button>`.
- **Behaviour preserved (the point):** every converted control navigates to exactly the same screen
  as before. Browser-verify a sample across screens (a Cancel, a Skip, a hub link) — each lands where
  it did. `./check` green.
- **No wrongful conversion (right mechanism):** a control whose handler mutates state and then
  navigates (if any) stays a `<button>` — assert none of those were turned into links. Call out in
  the report any handler that both mutates and navigates and how it was classified.
- **Nothing else changed:** lists, headings, section wrappers, and action buttons are untouched
  (diff shows only the nav conversions + the new shared component).
- `./check` green; paste the line.

## Notes

Pairs with req-11 (which introduced `ExercisesLink`, the first semantic nav link) — this generalizes
that idea across the app. Deliberately done before the styling pass so the design work applies to one
consistent set of semantics. The audit's other findings (actions-are-buttons, lists-are-lists,
sections/headings) needed no change and are recorded in DEC-016 as the consistency baseline.
