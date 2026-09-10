# req-15 — the styling pass: migrate the whole app onto the component library (+ findings report)

**Status: READY** — approach settled (DEC-021). The big one. Behaviour-preserving visual migration;
a large diff and heavy iteration expected.

**Gate: ux-feel** (DEC-009) — it restyles the entire app. Emilio judges the look, on his phone, and
merges — and this **will iterate**. Migrate screen-by-screen so it's reviewable and can be shaped in
passes.

## Why

req-13 built the `ui/` component library (grayscale, tap-friendly, Apple-inspired) but **only the
NavBar is wired into the app** — every screen is still raw, unstyled HTML. This req migrates the
whole app onto the library. That is what turns "works" into the flawless, one-handed, in-gym
experience Phase 1 is about (DEC-010).

## Scope — migrate every screen onto `ui/`

Replace each screen's raw markup with the library components (`src/ui/`): `Screen`, `Title` /
`SectionHeader`, `List` / `Row`, `Button` (primary/secondary/quiet), `NavLink`, `Field`,
`NumberField`, `SegmentedControl`, `Checkbox`, `Textarea`, `FileButton`, `Banner`, and the molecules
`RestBar` / `SetLogForm`. Every text size comes from the type scale (DEC-020); grayscale only
(DEC-017 — no color yet).

Screens (all of `src/views/`), **migrate screen-by-screen, one commit per group**:
1. **In-gym workout flow first** (`Workout.jsx`) — overview, item-log / set-log, rest, item review,
   item-exercise, set-edit, finish, setup/preview. Use the `ui/` `RestBar` and `SetLogForm`
   (replacing the app's inline versions — a duplicate-function fix).
2. **Today** (`Today.jsx`).
3. **Setup screens** — `Routine.jsx`, `Exercises.jsx`, `Schedule.jsx` (lists, details, new/edit,
   pickers).
4. **History** (`History.jsx`), then **Settings** (`Settings.jsx`).
5. `shared.jsx` helpers reconciled onto the library where they overlap.

The app shell (`App.jsx` NavBar) is already migrated (req-13) — leave it.

## What to change vs what to only report (DEC-021)

**Do inline, during this req:**
- The migration itself (raw markup → `ui/` components).
- **Small, unintrusive** tweaks that fall out of using the components.
- Changes **required** because the app now uses the components (prop shapes, wiring).
- Fixing **logical or duplicate functions** — e.g. the inline RestBar/SetLogForm → the `ui/` ones,
  obviously-duplicated helpers, dead code the migration exposes.

**Observe and write to the report — do NOT do here:**
- Anything **bigger**: what could be **merged**, **separated**, or **restructured** (components,
  files, state, data flow, routing). Structural refactors, splitting large files, consolidating
  patterns across screens, model/store reshapes.
- These are captured in a **findings report** (see below) for Emilio to review; we then spec
  follow-up req(s). **Resist doing them mid-styling** — the value of this req is a clean migration,
  not a refactor.

## The findings report (a required deliverable)

At the end, in addition to the normal `reports/req-15.md`, write an **improvement findings report**
(e.g. `reports/req-15-findings.md`) capturing the bigger observations surfaced while migrating:
- **Merge** candidates — near-duplicate components/logic/screens that could become one.
- **Separate** candidates — oversized files/components that should be split.
- **Restructure** candidates — better organization of components, state, routing, the store, etc.
- For each: where (file:line), what, why it'd help, and rough size. Ranked by value.
This is the point of the "observe don't do" rule — deliver the list so Emilio reviews it and we make
req(s) for the worthwhile ones (possibly one big cleanup req, possibly several).

## Out of scope

- **Any behaviour change** — the migration is presentation-only; logging, navigation, the state
  machine, save/restore all behave exactly as before. (The inline small/duplicate fixes above are
  the only allowed code changes; they must not change behaviour.)
- **Color / theme / dark mode** — grayscale only (DEC-017), a later pass.
- **The bigger refactors themselves** — observed and reported, not done (DEC-021).
- **The menu redesign** (req-14) and **native alert/confirm → inline UI** (separate items).

## Acceptance criteria (written before implementation)

- **Every screen uses the library:** after the pass, screens render via `ui/` components, not raw
  `<section>/<button>/<input>` markup; text sizes come from the type-scale tokens. Spot-check each
  screen-group in the browser (planning session) + Emilio's use-it on his phone.
- **Behaviour preserved:** start a workout, log warm-up + working sets, rest, skip, finish, save;
  create/edit a routine and exercise; schedule; view + edit history; import/export — all behave as
  before. The full test suite stays green (`./check`); paste the line.
- **Discipline held:** the diff contains the migration + only small/necessary/duplicate fixes — no
  large structural refactor rode along. The bigger ideas are in the findings report instead.
- **Findings report delivered:** `reports/req-15-findings.md` lists the merge/separate/restructure
  observations, ranked, with locations.
- **Grayscale + tokens:** no color introduced; a grep shows text sizes reference `var(--ui-text-*)`.

## Notes

Big, iterative, and Emilio's to shape on his phone — expect several review rounds, ideally
screen-group by screen-group rather than all-at-once at the end. The findings report is how the
refactor opportunities this surfaces become deliberate follow-up work instead of scope-creep here.
Pairs with req-14 (menu redesign) and precedes any color/theme pass.
