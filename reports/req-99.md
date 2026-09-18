# req-99 — reach exercise settings from the routine editor

Branch `req-99`. `./check` green (lint, 21 test files / 286 tests, build). Not merged.

## Technical

**The bug.** The routine per-exercise editor (`ExerciseFields`, `src/views/Routine.jsx`)
shows the "Duration (s)" field only when the exercise is timed. An un-flagged exercise
showed no duration field and no pointer to where the Timed flag actually lives (the
exercise Details editor, `ExerciseEdit`). Dead end → fix is a link + hint, not a second
checkbox.

**Changes:**

1. **Hint + link in `ExerciseFields`** (`Routine.jsx`). Where the Duration field would be,
   when the exercise is *not* timed, a quiet line: *"Not timed. Edit exercise settings to
   add a duration."* Below it, in both the timed and not-timed cases, an
   `ui-navlink` chevron row **"Edit exercise settings →"** to the exercise's own Details
   editor. New prop `settingsLink` (null hides it). No second Timed control — the flag
   stays single-sourced on the exercise.

2. **Return-to-routine via a `?from=` param.** New helper `exerciseSettingsLink(exerciseId,
   returnPath)` builds `/exercises/<id>/edit?from=<encodeURIComponent(returnPath)>`.
   - `route.js`: `parseRoute` now splits the query off the path before parsing (so no
     branch sees the `?`), and `exercise-edit` reads a decoded `from` — added to the route
     object only when present.
   - `App.jsx`: passes `route.from` as `returnTo` to `ExerciseEdit`.
   - `ExerciseEdit` (`Exercises.jsx`): computes `back = returnTo || /exercises/<id>` and
     uses it for **Save, Cancel, and Back**. With no `from` (normal Exercises → Edit path)
     behaviour is unchanged.

3. **`settingsLink` wired from both callers**, so the return target is the *exact current
   screen* the user is on:
   - `RoutineExerciseNew` → `nav.newItem(ex.id)`
   - `RoutineExerciseEdit` → `nav.item(itemId)`

**Choice I made (spec left the return target open):** return to the **exact per-exercise
editor screen**, not the routine detail. On the edit path this is lossless (the row is
persisted; it remounts from the store, now showing the Duration field if Timed was turned
on). It also means the fix works uniformly across every flow that reuses `ExerciseFields`,
not just routines (see below).

**Scope reality the spec didn't call out:** `ExerciseFields` (via `RoutineExerciseNew/Edit`
→ `RoutineScreens`) is shared by **four** flows — routines, schedule slots, workout setup,
and history recalc. So a hardcoded `/routines/...` return would strand three of them.
Because the callers pass `nav.*` (their own base), the link + return work correctly in all
four. Confirmed the schedule-slot return target round-trips (test below).

**Verification:**
- `./check` — `green — lint, 21 test file(s), and the build all passed.`
- New `route.test.js` block (5 tests) — plain `exercise-edit` has no `from`; a routine
  `from` is surfaced decoded; a nested schedule-slot return target round-trips and itself
  parses back to the editor; the query doesn't leak into the id; `activeTab` stays Library
  with or without `from`.
- Runtime nav path (the link's actual round trip), measured:
  `toHash`/`hashPath` preserve the encoded query and `parseRoute` recovers `from` →
  `parsed.from === '/routines/rt-upper/exercise/it-1'` → true.

## Workflow

- **Decision to surface (`DEC-`/behaviour):** return lands on the *exact per-exercise
  editor*, not routine detail. Chose it because it's lossless on the edit path and makes
  the newly-set Duration field visible immediately.
- **Took the spec's default, not the narrowing:** link + hint in **both**
  `RoutineExerciseNew` and `RoutineExerciseEdit`. Max discoverability (the point of the
  req). Cost, as the spec flagged: on the *new-row* path, clicking the link loses the
  unsaved sets/reps form. Accepted per spec. The label "Edit exercise settings" reads as an
  exercise-level detour, not a routine-row action, which keeps that acceptable. If Emilio
  dislikes the loss, the narrowing (link only on the edit path, hint in both) is a one-line
  change.
- **New mechanism introduced: a `?from=` query param.** The router was previously
  pure path-segments. I added generic query stripping in `parseRoute` (harmless to all
  other routes) and only `exercise-edit` reads a param. Flagging it because it's a new
  pattern in the router worth a `DEC-` if we want to reuse it for other return flows.
- **Broader-than-stated scope:** the fix applies to all four `ExerciseFields` flows, not
  just routines — this is a feature (schedule/setup/recalc get the same signpost) but worth
  recording so it's not a surprise.
- **Possible doc drift (not touched):** root `CLAUDE.md` ask-gate cites the storage key as
  `workout-mvp-v8`; the live key is `workout-mvp-v9` (`src/storage.js:5`, v8 now a legacy
  key). No schema change here, so no ask-gate fired — just noting for whoever maintains the
  doc.
- **Could not self-verify in a real browser:** the Claude-in-Chrome extension wasn't
  connected. Covered the logic with unit tests + the measured nav round-trip instead. The
  on-device "does a first-time user now find Timed" judgement is Emilio's, as the spec says.
