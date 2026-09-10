# req-15 — styling pass (migrate the app onto `ui/`)

**Branch:** `req-15-styling-pass`. **This report covers the FIRST screen-group
only: the in-gym workout flow (`Workout.jsx`).** The other screen-groups (Today,
setup screens, History, Settings, `shared.jsx`) are not done — held at the
checkpoint (DEC-021 / req-15 note: migrate screen-by-screen, review between).

## Technical

### What changed

**`src/views/Workout.jsx`** — every workout-flow screen migrated from raw
`<section>/<h1>/<h2>/<ol>/<input>/<button>` markup onto `ui/` components:

| Screen | Now renders via |
| --- | --- |
| Overview (`Workout`) — active, empty, and not-mine plan preview | `Screen` / `Title` / `List` / `Row` / `Button` |
| Live set-log (`WorkoutItemLive`) | `Screen` / `ExerciseTitle`→`Title` / ui `SetLogForm` / ui `RestBar` |
| Item done (`WorkoutItemDone`) | `Screen` / `SectionHeader` / `List` / `Row` / `Button` |
| Item exercise (`WorkoutItemExercise`) | `Screen` / `Title` / `Field` / `Textarea` / `Button` |
| Set edit (`WorkoutSetEdit`) | `Screen` / `Title` / `NumberField` / `Field` / `SegmentedControl` / `Button` |
| Finish (`FinishScreen`) | `Screen` / `Title` / `SectionHeader` / `List`+`Row` / `SegmentedControl` / `Textarea` / `Button` |

**Duplicate-function fixes (DEC-021 "do inline"):**

- **Inline `SetLogForm` deleted** (was `Workout.jsx`, ~100 lines of raw form
  markup). The app now uses the `ui/` `SetLogForm`. The domain logic it carried
  (history prefill, carry, restore, target, the RPE default) **stays in the
  view** — `WorkoutItemLive` computes the seed and passes `initial*` props down;
  the molecule only holds the in-progress field values (remounted per-set via
  `key`, as before). `onComplete` returns `{weight, reps, effort, note}`; the view
  maps `effort → rpe` so `completeSet` is byte-for-byte unchanged.
- **Inline `RestBar` markup deleted.** The store-connected `RestBar` wrapper
  stays (it reads `activeWorkout` rest state and returns `null` when not resting)
  but now renders the `ui/` `RestBar` molecule. **The pause/resume/+30s/next
  handlers are copied verbatim** — only the markup moved.

**`src/ui/index.jsx` — `SetLogForm` made controllable (required by the app using
it):** added `showEffort`, `repsLabel`, and `initialWeight/Reps/Effort/Note`
props (seeds local state); effort state is always present and emitted even when
the picker is hidden, so warm-up / cardio sets keep storing `rpe` exactly as
before. The reps field is a **text `Field` (full keyboard), not a decimal-only
`NumberField`** — see decision below. Showcase call unchanged (new props default).

**`src/ui/ui.css` — two token-based utility classes added:** `.ui-sub` (secondary
subtitle/meta line, `var(--ui-text-body)` + secondary ink) and `.ui-actions` (a
button row). Both reference the existing scale tokens — no new font sizes.

### Choices I made (spec left open)

- **Reps field = text, not `NumberField`.** The app's reps input has always been
  a full-keyboard `<input>` (durations like "30 min" are valid reps for cardio).
  The `ui/` `SetLogForm` originally used `NumberField` (decimal keypad) for reps.
  Using that as-is would have **removed** the ability to type durations — a
  behaviour change. So the migrated reps field keeps the big gym-legible styling
  (`ui-input--num`) but **without** `inputMode="decimal"`. kg stays a real
  `NumberField` (it always had `inputMode="decimal"`).
- **Set-edit effort** kept its clearable "—" option by prepending
  `{value:'', label:'—'}` to the `SegmentedControl` options (the old `<select>`
  had a "—"). Selecting it stores `rpe: null`, as before.
- **Overview / done rows** put the row meta ("— role · done", set line) in the
  row *text* because `Row`'s link variant can't render a right-aligned `value`
  next to its chevron (findings #4). Info preserved; alignment is a ui follow-up.
- **Left as-is this commit (they're step 5 — `shared.jsx`):** `Back` (raw
  button), `ExercisesLink`, `NavLink` (the set-edit "Cancel" link), `Missing`,
  and the one `<a href>` exercise-name link in `ExerciseTitle` (a nav link,
  DEC-016-legal). These stay unstyled until the `shared.jsx` group.

### Behaviour preserved

The migration is presentation-only. Verified the seed/RPE logic is unchanged by
the passing `setLogSeed` prefill suite and the full gate:

```
# tests 99  # pass 99  # fail 0
check: green — lint, 13 test file(s), and the build all passed.
```

Greps for the acceptance criteria:
- No raw `<section>/<h1>/<h2>/<ol>/<ul>/<li>/<input>/<textarea>/<select>/<button>`
  left in `Workout.jsx` (only a `<select>` mention inside a comment).
- No ad-hoc `font-size` in `ui.css` — every size is `var(--ui-text-*)` (DEC-020).

## Workflow

- **Scope:** exactly the workout-flow group, per the checkpoint instruction.
  Stopped before Today / setup / History / Settings / `shared.jsx`.
- **Rode along (allowed inline):** the two duplicate-function fixes (inline
  `SetLogForm` and `RestBar` markup → the `ui/` molecules), and the `ui/`
  `SetLogForm` API extension needed to consume it without changing behaviour.
- **Observed, not done:** collected in `reports/req-15-findings.md` (started now,
  will grow per group). Headlines: split the ~820-line `Workout.jsx`; extract the
  set-log seed logic to a tested helper; let `Row` show a `value` on link rows.
- **Possible DEC candidates for Emilio:** (a) the reps-field text-vs-number call
  above — it's a real behaviour-vs-look trade-off worth recording; (b) `.ui-sub`
  / `.ui-actions` as sanctioned utility classes vs. formalizing a `Subtitle`
  component later (findings #5).
- **Not verified by me (needs Emilio's phone):** the actual feel/legibility of
  the migrated flow — the point of the ux-feel gate.
