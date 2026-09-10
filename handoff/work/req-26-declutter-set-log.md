# req-26 — declutter the live set-log screen (notes #2 + #3)

**Status: READY** (two small decided-defaults below; ux-feel gate catches any redirect). From
Emilio's 2026-09-10 gym-flow notes (`work/BACKLOG.md`): *"Remove information under the buttons, add a
previous button if you pause"* and *"Hide notes, should be a button to click then add."*

**Gate: gym-flow feel** (DEC-009) — how the in-gym screen feels; **Emilio uses it before merge.**

## Why

The live set-log screen (log a set) carries more than a one-handed lifter needs mid-set:
- [measured] Below the Complete/Skip buttons, `WorkoutItemLive` renders an equipment line +
  form-cues line (`src/views/workout/item.jsx:287–292`, `ExerciseSetupHeader` + `{ex.cues}`). Emilio:
  remove the info under the buttons.
- [measured] The **Note** field is always shown, between Effort and the buttons
  (`SetLogForm`, `src/ui/index.jsx:343`). Emilio: hide it behind an "Add note" button.

## The changes

**(A) Hide the note behind an "Add note" affordance** — `SetLogForm` (`ui/index.jsx`). Replace the
always-visible Note `<Field>` with an **"Add note"** button; tapping it reveals the note field
(focus it). If `initialNote` is non-empty (a restored/seeded note), start expanded showing the note.
The submitted value is unchanged (empty when never opened). Keep it a plain-row/quiet button.

**(B) Remove the info block under the buttons** — `item.jsx:287–292`. Remove the always-on equipment
+ cues block below the form. **Decided default:** cues stay reachable — the exercise **Title is
already a link** to the exercise editor (which shows cues), so form guidance is one tap away, not
lost. (If Emilio wants cues fully gone or behind their own toggle, the feel-gate catches it.)

**(C) "Previous when paused" (note #2b) — investigate, don't assume.** [measured] a **Previous**
button already renders during rest (`item.jsx:285–290`, when `canGoBack`) and in the SetLogForm
(`canGoBack`). Before building, reproduce the paused state and check whether Previous is missing
*specifically when the rest is paused*. If it is, add it there; if Previous is already reachable when
paused, **report that** and drop this part rather than adding a duplicate.

## Scope

- `SetLogForm` gets an "Add note" reveal (A).
- Remove the below-buttons equipment/cues block (B).
- Only if reproduced as missing: a Previous control in the paused state (C).

## Out of scope

- The rest-timer bug (req-25) and the upcoming-weight note (req-27) — separate.
- Changing what a note stores, or the effort/kg/reps fields.
- Removing the exercise Title link (it's how cues stay reachable after B).

## Acceptance criteria

- **Note hidden by default (Emilio, in-browser):** the log screen shows no Note field until "Add
  note" is tapped; tapping reveals + focuses it; a set with a pre-existing note opens expanded.
  Completing without opening it saves an empty note (unchanged).
- **Screen decluttered:** no equipment/cues text under the Complete/Skip buttons; cues still reachable
  by tapping the exercise Title.
- **Paused Previous:** report says whether Previous was already present when paused; added only if it
  was genuinely missing.
- **No regression:** `./check` green; the SetLogForm change doesn't alter what Complete submits;
  Showcase (if it demos SetLogForm) still renders.

## Decisions

- **behaviour (decided defaults, Emilio may redirect at the feel-gate):** cues reachable via the
  Title link rather than deleted (B); note starts expanded only when a note already exists (A).
- **implementation (CC's call):** "Add note" button styling/placement; whether the reveal state lives
  in `SetLogForm` local state.
