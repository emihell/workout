# req-18 — merge the set-edit forms into a shared `SetEditForm`

## Technical

New `src/views/set-edit.jsx` exports `SetEditForm` — the kg / reps / effort / note
editor shared by `WorkoutSetEdit` (active workout) and `HistorySet` (finished
workout). It owns the field state (`weight`/`reps`/`rpe`/`note`/`setType`) and the
`<form>` layout; the two callers pass their differences as props.

### Where it lives, and why not `shared.jsx`

`shared.jsx` deliberately imports **no** `ui/` primitives — `ui/index.jsx` imports
`NavLink` from `shared.jsx`, and that comment (shared.jsx:21–23) keeps the dependency
one-way. `SetEditForm` needs `Button`/`Field`/`NumberField`/`SectionHeader`/
`SegmentedControl` from `ui/`, so putting it in `shared.jsx` would make the cycle
`shared → ui → shared`. A new view-layer file (`views/set-edit.jsx`) that imports
from `ui/` and `shared/` — exactly as `Workout.jsx`/`History.jsx` do — is the clean
home. (Spec offered this option.)

### Prop shape (my call)

- `set` — seeds the field state.
- `showLoad` / `showEffort` — booleans gating the kg and effort controls.
- `setTypeOptions` — when passed, renders the History-only set-type toggle above the
  fields. Chose a named options prop over a generic `extraField` slot: it's the one
  known difference and keeping it named lets the form seed `setType` from the set and
  keep the toggle in the right position.
- `onSave(values)` — receives the **raw** field state; the caller coerces and mutates.
- `cancelTo` — the Cancel route.

### The real differences, expressed as props (not papered over)

I compared the two forms field-by-field. They differ in exactly these ways, all now
props:

| | WorkoutSetEdit | HistorySet |
|---|---|---|
| kg field | only if `usesLoad` (not cardio/bodyweight) | always | → `showLoad` |
| effort toggle | only if `usesRpe` (not warm-up/cardio) | always | → `showEffort` |
| set-type toggle | — | wu/work | → `setTypeOptions` |
| empty-weight on save | `'' → 0` | `'' → ''` | → each caller's `onSave` |
| save mutation | `updateActiveSet(index, …)` | rebuild `sets[]` + `updateWorkout` | → `onSave` |
| route after save | `itemPath` | `…/recalculate` | → `onSave` |
| Cancel target | `itemPath` | `…/exercise/…` | → `cancelTo` |

The `weight === '' ? 0 : Number` vs `'' : Number` difference is the one that would be
easy to paper over — I kept it in each caller's `onSave` so the form emits raw values
and neither path's save behaviour changes. The `rpe` coercion (`'' → null : Number`)
is identical in both, but stays per-caller for the same reason (form emits raw). Set
type is only consumed by History's `onSave`; Workout's ignores it.

Everything outside the `<form>` stays in the wrappers: `Screen`/`Back`, Workout's
`RestBar`, each header sub-line, `Title`, and History's separate **Remove** button.

### Both callers now thin wrappers

- `Workout.jsx` `WorkoutSetEdit` — gathers set/item, computes `usesLoad`/`usesRpe`/
  `itemPath`, renders `<SetEditForm showLoad={usesLoad} showEffort={usesRpe} …>`.
- `History.jsx` `HistorySet` — renders `<SetEditForm showLoad showEffort setTypeOptions=… …>`
  plus the Remove button below.

Removed now-unused imports (lint would fail otherwise): `NumberField` + `rpeOptionValue`
from `Workout.jsx`; `NumberField`, `Field`, `RPE_OPTIONS`, `rpeOptionValue` from
`History.jsx`. `useState`/`NavLink`/`SegmentedControl` stay — still used by other
screens in those files (History's Feel toggle at :432, feel-edit `useState`, etc.).

### req-22 `clearable`

The effort toggle in `SetEditForm` uses the `clearable` prop (req-22), not a
hand-rolled `—`, as instructed.

### SetLogForm — left out (spec), one note

The live `SetLogForm` (logging a new set) stays separate: it lives in `ui/index.jsx`
and carries skip/previous + req-17 seeding + a different lifecycle. Its field block is
similar, but sharing it would mean crossing the ui/↔views boundary (SetEditForm is
view-layer, owns no store calls but sits in `views/`; SetLogForm is a `ui/` component
taking an `effortOptions` prop). Not a clean fit — leaving it is right per scope; a
future unification would need to decide that boundary first. Noted as a follow-up, not
built.

### Receipts

Field JSX defined once — `grep -rn 'label="Reps"\|label="kg"' src/views`:

```
src/views/Routine.jsx:294:  <Field label="Reps" …/>   ← routine-TEMPLATE target field, unrelated form
src/views/set-edit.jsx:56:  <NumberField label="kg" …/>
src/views/set-edit.jsx:58:  <Field label="Reps" …/>
```

The set-edit kg/Reps fields exist only in `set-edit.jsx`; the Routine hit is the
routine-template editor (a different form, not a logged-set editor). No kg/Reps/effort
field JSX remains in `WorkoutSetEdit`/`HistorySet`.

`./check`:

```
# tests 105 ... # pass 105 # fail 0
check: green — lint, 13 test file(s), and the build all passed.
```

Lint green confirms no dangling unused imports; build green confirms both view files
and the new module compile; the 105 tests (incl. History/Workout) unchanged, none
weakened or edited.

## Workflow

No deviation from scope. The forms differed only in ways expressible as props, so no
stop-and-report was needed — but I want the two behavioural differences on record for
the diff review: **empty-weight saves as `0` in the active workout and `''` in
history**, and the two use **different store mutations + post-save routes**. Both are
preserved verbatim in each caller's `onSave`; the shared form is deliberately
mutation-agnostic.

Implementation choices (spec left open): `SetEditForm` lives in a new
`views/set-edit.jsx` (not `shared.jsx` — cycle); the set-type toggle is a named
`setTypeOptions` prop, not a generic slot; `onSave` receives raw field values so each
caller keeps its own coercion.

No test edits, no persisted-data schema touch (History's save still writes the same
`sets[]` shape via the same `updateWorkout`).

Could not verify myself (needs a browser — planning's gate): (1) in an active workout,
editing a logged set's kg/reps/effort/note saves the same values; (2) in a finished
workout, editing kg/reps/effort/note **and set-type** saves the same and the type
toggle still works; (3) the field-visibility rules still hold (kg/effort hidden for
cardio/bodyweight/warm-up in the active path, always shown in history).
