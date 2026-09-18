# req-99 — reach exercise settings from the routine editor (Timed discoverability)

**Status: SPEC — READY, held for Emilio's go.** Phase 1 gym-flow clarity. **[ux-feel]**

## Why

Emilio (2026-09-18), from real use: *"i was looking in rutines, thats why, its a bit
confusing… we might have to make it a bit more clear, maybe even able to access exercise
settings from the rutine excersie settings?"*

He couldn't find the **Timed** option because he was in the routine editor, where it does not
appear. The flag is correct where it lives — but there's no signpost pointing to it.

## The model distinction (do NOT break it)

`hasDuration` / `durationSec` are properties of the **exercise** (a plank is timed everywhere it
appears), set once on the exercise Details editor (`ExerciseEdit`, `src/views/Exercises.jsx:251`).
Sets / reps / rest / per-set durations are **routine-instance** fields, set in `ExerciseFields`
(`src/views/Routine.jsx:269`).

[measured] The routine per-exercise editor shows the **"Duration (s)"** field only when
`timed={Boolean(ex?.hasDuration)}` (`Routine.jsx` — passed at `RoutineExerciseNew` and
`RoutineExerciseEdit`). So an un-flagged exercise shows no duration field and **no hint the flag
exists elsewhere.** That dead end is the whole bug.

**Do NOT add a second `Timed` checkbox in the routine editor.** That would fork the truth and let a
routine disagree with the exercise. The fix is a *link*, not a duplicate control.

## Scope — link + hint (Emilio, 2026-09-18)

In the routine per-exercise editor (`ExerciseFields`, used by both `RoutineExerciseNew` and
`RoutineExerciseEdit`):

1. **Link to the exercise's own settings.** Add an "Edit exercise settings →" navlink (chevron
   style, matching the existing `ui-navlink` rows) that navigates to the exercise Details editor
   (`/exercises/<exerciseId>/edit`, route `exercise-edit`).

2. **Hint when the exercise isn't timed.** When `timed` is false, show one quiet line near where the
   Duration field would be, e.g. *"Not timed. Edit exercise settings to add a duration."* When
   `timed` is true, no hint (the Duration field is already shown).

3. **Return-to-routine behaviour (required).** After the user edits the exercise from this flow,
   Save **and** Cancel/Back must land them **back in the routine** they came from — not on the
   Exercises Details screen. Today `ExerciseEdit`'s Save does `go('/exercises/:id')`; that strands a
   routine user. Mechanism is Builder's choice (a return-path param, browser-history back, or an
   equivalent). It must not change the normal Exercises → edit → Save behaviour (that still returns
   to `/exercises/:id`).

## Known caveat to handle, not ignore

- **`RoutineExerciseNew` (adding a new exercise to a routine):** the sets/reps/rest form is
  unsaved component state. Navigating away to edit the exercise will lose it. Acceptable, but the
  link should be positioned/worded so it's clearly a detour (it edits the *exercise*, not this
  routine row). Builder: if a cheap guard (e.g. the link only in `RoutineExerciseEdit`, where the
  row is already persisted, plus the hint text in both) reads cleaner, that's a fine narrowing —
  say so in the report. Default is: link + hint in both, accept the unsaved-form loss on the new
  path.

## Out of scope

- Any change to the persisted schema or to what `hasDuration`/`durationSec` mean. (No ask-gate #2.)
- Inline editing of exercise-level settings from inside the routine (considered and declined
  2026-09-18 — Emilio chose link + hint over inline).
- The in-set countdown, beat-last-time, or any timed-logging behaviour (all shipped: req-85/96/98).

## Acceptance criteria

- From a routine's per-exercise editor, an "Edit exercise settings →" link opens that exercise's
  Details editor.
- When the exercise is **not** timed, the routine editor shows the hint line pointing to exercise
  settings; when it **is** timed, the Duration field shows and no hint.
- Editing the exercise via that link and pressing Save returns to the **routine**, not to
  `/exercises/:id`. Cancel/Back from that editor also returns to the routine.
- Normal path unchanged: Exercises → an exercise → Edit → Save still returns to `/exercises/:id`.
- `./check` green. A route/nav unit test covers the return-to-routine path where feasible.

## What Builder cannot verify (for Emilio)

- Whether the hint wording and link placement actually read as clear in the gym on a phone — the
  original complaint was discoverability, so the real test is: does a first-time user now find
  Timed? Emilio confirms on-device.
