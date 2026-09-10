# req-29 — button-placement audit: forward=right, back/previous=left (note #4)

**Status: READY.** Applies the spatial rule Emilio set on 2026-09-10, now recorded in
`rules/DESIGN.md §4`: *every primary/forward action (Start, Save, Complete, Next, Continue) sits on
the right; every back/previous/cancel sits on the left.*

**Gate: gym-flow feel** (DEC-009) — a whole-app consistency pass the user will feel; **Emilio uses it
before merge.**

## Why

The rule is new (DESIGN §4) and stated to apply **retroactively**. Current screens don't all follow
it. [measured] a clear violation on the most-used screen: the live set-log form
(`SetLogForm`, `src/ui/index.jsx:344–350`) renders **Complete (primary) on the LEFT**, then Skip, then
Previous — so the forward action is left and the retreat (Previous) is rightmost. The rule wants
Previous (retreat) on the left and Complete (forward) on the right.

## The change

Audit **every screen with two or more actions** and order them so the forward/primary action is
right-most and any back/previous/cancel is left-most. Known surfaces to check (not exhaustive — CC
enumerates):
- `SetLogForm` (Complete/Skip/Previous) — the confirmed violation.
- `RestBar` (Pause/+30s/Next) — Next is already the right-most primary (DEC-013); confirm it still
  holds.
- `SetEditForm` (Save/Cancel) and the exercise-setup form (Save/Cancel).
- Finish, Abandon, and any Start/Back pairing.
- The `ui-actions` / `ui-setlog__actions` action rows generally.

Where an action isn't cleanly "forward" or "back" (e.g. **Skip**), place it between, keeping the
forward action right-most and any retreat left-most — CC applies judgment and lists each decision in
the report.

## Scope

- Reorder action controls across screens to satisfy DESIGN §4. Presentation/order only — **no
  behaviour, label, or handler change.**
- Add the rule to `ui/Showcase.jsx` action-row examples if useful, so future screens follow it.

## Out of scope

- Changing what any button does, its label, or its styling beyond position.
- The `action`-slot/`Row` work (req-23) — that's the trailing-action pattern, not the
  forward/back ordering; leave it unless a specific row violates §4.
- Introducing new actions.

## Acceptance criteria

- **Rule holds everywhere (Emilio, in-browser):** on every two-action screen, the forward/primary
  control is on the right and any back/previous/cancel is on the left. Spot-list in the report:
  SetLogForm, SetEditForm, setup form, RestBar, Finish.
- **SetLogForm fixed:** Complete is right-most; Previous is left-most.
- **No behaviour change:** each reordered control does exactly what it did before; `./check` green.
- **Report enumerates** every screen touched and, for ambiguous controls (Skip), where it was placed
  and why.

## Decisions

- **design:** the rule is DESIGN §4 (Emilio). Ambiguous-control placement is CC's judgment, reported.
- **implementation (CC's call):** whether ordering is done in markup or with CSS; how Skip is placed
  relative to Complete/Previous.
