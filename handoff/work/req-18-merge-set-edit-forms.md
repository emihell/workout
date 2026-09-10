# req-18 — merge the near-duplicate set-edit forms into one shared `SetEditForm`

**Status: READY.** Behaviour-neutral consolidation of the most-duplicated surface in the views.
Sourced from `reports/req-15-findings.md` #2 (DEC-021).

**Gate: code-only** (DEC-009, functional) — no user-visible change; planning browser-verifies both
edit paths and merges.

**Build order:** after req-17 (seed extraction) and after the ui/ primitive reqs (req-20/21/22),
**before** the file-split (req-19). It edits both `Workout.jsx` and `History.jsx`, so land it while
those files are still single files.

## Why

Three places edit the same set fields (kg / reps / effort / note) with small differences:

- `WorkoutSetEdit` (`src/views/Workout.jsx:701`) — edit a logged set inside the active workout.
- `HistorySet` (`src/views/History.jsx:521`) — edit a set in a finished, historical workout.
- the live `SetLogForm` (`Workout.jsx`, used by `WorkoutItemLive`) — log a new set; adds
  skip/previous + the seeding from req-17.

`WorkoutSetEdit` and `HistorySet` are **near-duplicates** — same four fields, same layout idiom, the
only real difference being that `HistorySet` adds a set-type toggle (`SegmentedControl` with the
leading `—`, `History.jsx:432`). The finding's target: at minimum extract a shared **`SetEditForm`**
that both use, so a change to how a set is edited happens in one place.

## The change

Extract a `SetEditForm` component (its home is CC's call — `views/shared.jsx` or a small
`views/set-edit.jsx`; **not** `ui/` unless it's fully presentational) that renders the kg / reps /
effort / note fields and their handlers, with props for the differences:

- a `setType` prop-pair (value + onChange) rendered only when passed (the history set-type toggle);
- field labels/units driven by props (`repsLabel`, `weighted`) as the current forms already are.

`WorkoutSetEdit` and `HistorySet` then become thin wrappers: gather the set, render `<SetEditForm …>`,
wire submit to their respective store mutation.

**The live `SetLogForm` is explicitly out of scope for the merge** — it carries skip/previous +
seeding and a different lifecycle. The finding says "at minimum `WorkoutSetEdit` and `HistorySet`";
do exactly that. If, while extracting, the shared form turns out to also fit `SetLogForm`'s field
block cleanly, **note it in the report as a follow-up** — do not force it in here.

## Scope

- New `SetEditForm` shared by `WorkoutSetEdit` and `HistorySet`.
- Both call sites reduced to wrappers; each keeps its own store-mutation submit and its own routing.
- The set-type toggle stays a `HistorySet`-only prop.

## Out of scope

- Folding in `SetLogForm` (live logging) — different lifecycle; leave it.
- Any change to what a save writes, validation, or which store mutation runs — behaviour identical.
- Splitting the files (req-19) or the `SegmentedControl` clearable prop (req-22) — separate. If
  req-22 lands first, `SetEditForm` should use its `clearable` prop for the set-type toggle; if not,
  keep the current `[{value:'',label:'—'}, …]` idiom. Don't block on it.

## Acceptance criteria (written before implementation)

- **Both edit paths unchanged (planning, in-browser):**
  1. In an **active** workout, editing a logged set's kg/reps/effort/note saves and shows the same
     values as before.
  2. In a **finished** workout (History), editing a set's kg/reps/effort/note **and its set-type**
     saves the same as before; the set-type toggle still works.
- **One form, two callers:** `grep` shows the kg/reps/effort/note field JSX defined once (in
  `SetEditForm`) and no longer duplicated across `WorkoutSetEdit` and `HistorySet` — paste it.
- **No regression:** `./check` green (paste the line); no test weakened; existing History/Workout
  tests stay green.

## Decisions

- **behaviour:** none — the two forms must behave exactly as today. If they differ in any handler in
  a way that can't be expressed as a prop without changing behaviour, **stop and report**; don't
  paper over a real difference.
- **implementation (CC's call, note in report):** where `SetEditForm` lives; its prop shape; whether
  the set-type toggle is a generic `extraField` slot or a named `setType` prop.
