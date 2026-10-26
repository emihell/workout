**Status: BUILT AND MERGED, 2026-10-26 — branch `req-239` (`975b938`…`975b938`, 1 commit).** · **Lane: ui** · batch 7 (J2). No stored-data change.

# req-239 — first-time exercise: no question, a "Help me find it" link

Emilio, 2026-10-16 (Back Extension, first time): "Do i need two buttons to press? Enter it? Can't i just enter it?"
Decided → **DEC-138** (option B, "your rec"). Amends DEC-012 / DEC-123 §1.

## Code facts (rescanned 2026-10-26, `main` 103678a)

- The prompt: `views/workout/item.jsx:682-696` renders `SETUP_TEXT.prompt` ("First time") with [I'll enter it] (`'manual'`)
  and [Set it up] (`'setup'`), via `answerSetupPrompt(mode)` (`:565-568`, writes `activeWorkout.firstTimeSetup[exerciseId]`).
- The set form renders regardless (`:705-708`, only `plannedDone` hides it), so logging already works without answering;
  the prompt disappears once a work set is logged (`setupPromptShows`, `first-time-setup.js:65-69`, `workLogged.length > 0`).
- Texts: `first-time-setup.js:26-35`. Guide line `:699-701` shows only in `mode: 'setup'`.

## Scope

1. Replace the prompt block with one quiet link-styled button under the set form, text **"Not sure what weight? Help me
   find it"**, shown exactly when `setupPromptShows(...)` is true today (same conditions, unchanged function).
2. Tapping it = today's [Set it up]: `answerSetupPrompt('setup')`. Everything after (guide line, "How was that?" sheet after
   set 1, set-2 seed with reason) is unchanged.
3. No `'manual'` entry is written any more. Stored entries with `mode: 'manual'` (an in-progress workout from before) keep
   reading as today (prompt hidden for that exercise).
4. `SETUP_TEXT.prompt` / `.manual` go if unused; analytics button name `setup-start` kept.

## Out of scope

- The guided-setup maths and the sheet (DEC-123 §1). Timed/cardio (never offered, `setupApplies`).
- Any change to which exercises count as "first time".

## Acceptance criteria

1. A no-history weighted exercise, first work set: no "First time" text and no "I'll enter it" button; the link shows under
   the form; typing kg/reps and Done logs set 1 with **no** `firstTimeSetup` entry written (assert the stored state).
2. Tapping the link → the guide line shows; after set 1's Done the "How was that?" sheet appears (existing req-10 tests
   still pass, adjusted only for the trigger — each test edit called out).
3. **Failure case:** an exercise **with** history, a timed exercise, and set 2 of a new exercise → no link (assert absent).
4. **Right mechanism:** an active workout carrying `firstTimeSetup: {ex: {mode: 'manual'}}` → no link for that exercise.
5. `./check` green.

## Decisions made on Emilio's behalf

- Link wording "Not sure what weight? Help me find it" and its place (under the form) `(unconfirmed)` — behaviour (copy).
- Link styled as a quiet button (DEC-042: it changes state, so a Button, quiet look) — implementation.

## READY checks

1 DECs: DEC-012, DEC-123 §1, DEC-138. 2 Siblings: req-240 and req-241 also touch `item.jsx` — order 239 → 240 → 241.
3 No deferral. 4 No numbers. 5 Trigger files: none (`item.jsx`, `first-time-setup.js`) → no reviewer, no backup.
6 Unconfirmed marked above.
