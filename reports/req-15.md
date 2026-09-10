# req-15 — styling pass (migrate the whole app onto `ui/`)

**Branch:** `req-15-styling-pass`. The entire app's screens are migrated off raw
HTML onto the `ui/` component library (grayscale, DEC-017; text sizes from the
DEC-020 tokens). Behaviour-preserving. Not merged — ux-feel gate, Emilio shapes
it on his phone.

## Technical

### Commits (one per screen-group, DEC-021)

| Commit | Scope |
| --- | --- |
| workout-flow | `Workout.jsx` — overview, live set-log, item-done, item-exercise, set-edit, finish, plan preview |
| global | grayscale links, `Select` primitive, styled `Back` / `shared.jsx` |
| Today | `Today.jsx` + `Start.jsx` |
| Settings | `Settings.jsx` |
| setup screens | `Exercises.jsx` + `Routine.jsx` |
| Schedule | `Schedule.jsx` |
| History | `History.jsx` |

Every screen now renders via `Screen` / `Title` / `SectionHeader` / `List` /
`Row` / `Button` / `NavLink` / `Field` / `NumberField` / `Select` /
`SegmentedControl` / `Checkbox` / `Textarea` / `FileButton` / `Banner` /
`RestBar` / `SetLogForm`.

### Library changes (required by the app using the components)

- **`SetLogForm` made controllable** — added `showEffort`, `repsLabel`, and
  `initialWeight/Reps/Effort/Note`. The app's domain logic (history prefill,
  carry, restore, target, the RPE default) stays in `WorkoutItemLive` and is
  passed down as seeds; the molecule holds only the in-progress values (remounted
  per set via `key`). `onComplete` returns `{weight,reps,effort,note}`; the view
  maps `effort → rpe` so `completeSet` is unchanged. Reps is a **full-keyboard
  text field**, not a decimal `NumberField`, so durations ("30 min") stay typable.
- **`Select` added** — a native `<select>` styled like `Field` with a grayscale
  caret. The library was missing a dropdown; needed for focus / role / type /
  weeks / set-type. Shown in the showcase.
- **`FileButton` resets its input value** after selection, preserving the app's
  re-import-same-file behaviour (Today + Settings import).
- **Two token-based utility classes** in `ui.css`: `.ui-sub` (subtitle/meta line)
  and `.ui-actions` (button row). Both reference the DEC-020 scale tokens.

### The two global defects from the checkpoint (fixed in the library)

1. **Links rendered browser blue / visited purple.** Base treatment in `ui.css`
   forces `a` / `:visited` / `:hover` / `:active` to `color: inherit` (grayscale).
   The nav primitives keep their explicit no-underline; plain links keep the
   underline affordance.
2. **Raw "Back" button.** `shared.jsx` reconciled onto the library: `Back` →
   `ui-btn ui-btn--quiet`, `ExercisesLink` → `ui-navlink`, `Missing` → `ui-screen`
   + `ui-sub`. Classes are applied directly (not the `Button` component) because
   `ui/index.jsx` imports `NavLink` from `shared.jsx` — keeping `shared.jsx` free
   of `ui/` imports keeps that dependency one-way. No other raw action buttons
   remain (grep below).

### Choices I made (spec left open)

- **Reps field = text, not `NumberField`** (behaviour: reps have always accepted
  durations). kg stays `NumberField` (always had `inputMode="decimal"`).
- **Clearable effort/feel** kept a leading `{value:'', label:'—'}` in the
  `SegmentedControl` (the old `<select>` had "—") — `WorkoutSetEdit`, `HistorySet`,
  `HistoryEdit`.
- **Focus/role/type/weeks** are `Select` dropdowns (too many options for a mobile
  segmented row); **set-type / effort / feel** are `SegmentedControl` (few, and
  wanted as taps).
- **"Row + trailing action button"** (Start/Resume/Remove/Up/Down/Add) is done by
  putting the `<Button>` in the `Row` `value`; the item name is an inline
  `NavLink` when the row is also navigable. `Row`'s link variant can't do both a
  chevron and a right-aligned value (findings #4).

### Behaviour preserved / verification

The migration is presentation-only — no logging, nav, state-machine, or
save/restore changes. Full gate:

```
# tests 99  # pass 99  # fail 0
check: green — lint, 13 test file(s), and the build all passed.
```

Acceptance greps:
- No raw `<section>/<h1>/<h2>/<ol>/<ul>/<li>/<select>/<textarea>/<input>` in
  `src/views/` (only two `{/* … <select> … */}` comments).
- Remaining `<a href>`: the intentional exercise-name nav link in `Workout.jsx`
  (DEC-016-legal) and the `NavLink` primitive itself in `shared.jsx`.
- No ad-hoc `font-size` in `ui.css` — every size is `var(--ui-text-*)` (DEC-020).

## Workflow

- **Scope:** the whole app, screen-by-screen, one commit per group, per the
  planning session's follow-up instruction.
- **Rode along (allowed inline):** the duplicate-function fixes (inline
  `SetLogForm` / `RestBar` → `ui/` molecules), the `SetLogForm`/`FileButton` API
  extensions needed to consume the components without changing behaviour, and the
  new `Select` primitive (a missing element type, not a refactor).
- **Observed, not done:** in `reports/req-15-findings.md`, now covering the whole
  app and re-ranked. Headlines: split `Workout.jsx` + `History.jsx`; merge the
  three set-editing forms; extract the set-log seed logic to a tested helper; let
  `Row` carry a value on link rows; formalize the action-row and clearable-segment
  patterns.
- **Possible DEC candidates for Emilio:** (a) reps text-field vs number-field
  trade-off; (b) `.ui-sub` / `.ui-actions` utilities vs a future `Subtitle`
  component; (c) `Select` as a sanctioned library primitive; (d) the base
  grayscale-link rule (first bare-element selector in `ui.css`, justified now the
  app is fully migrated).
- **Not verified by me (needs Emilio's phone):** the feel/legibility of every
  migrated screen — the point of the ux-feel gate. Expect iteration.
