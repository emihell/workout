**Status: BUILT, NOT merged** **Lane: ui** — rescanned 2026-10-10; decided DEC-123 §1. Builder: Builder session or throwaway agent (ux-feel).

## Decided build (DEC-123 §1, 2026-10-10) — supersedes the per-set effort steps in the original text below

1. On reaching the **first work set of a weighted or bodyweight exercise with no finished history** (`lastSetsForExercise` null,
   `history-queries.js:192`), show a prompt above the form: **"First time — [Set it up] [I'll enter it]"**. Dismiss = I'll enter
   it. Cardio / timed: no prompt. Once answered, it doesn't show again for that exercise in this workout.
2. **I'll enter it** = today's form, unchanged (routine kg → carry → blank, `workout-log.js:531-548`).
3. **Set it up** = a short guide line under the kg box: "Pick a weight you could lift about 15 times. Log the set, then tell us
   how it felt." The kg box stays as today (routine kg or blank) — **never an invented number** (DEC-012, DESIGN §1).
4. After set 1's **Done**, a one-time sheet: **"How was that? Easy · Medium · Hard"** (+ Skip). The pick **only seeds set 2's kg — it is not stored**
   (writing it as set 1's `rpe` would make later sets inherit it as the exercise effort, `item.jsx:280-284`): Easy → `moveToValidWeight(kg, ex, +1)`, Medium/Hard → same kg, and a set 1 with **missed reps**
   → one step down (`progress.js:69-82`; same thresholds as `recommendNextPrescription`, Hard holds). Weighted only; bodyweight
   moves reps ±1 the same way. Shown as an editable prefill with a reason line ("Up one step — set 1 felt easy"). Skip → normal
   carry. No valid step (`weightStep` n/a) → same kg, reason "No weight steps set for this exercise".
5. Sets 3+ carry as usual. The exercise's effort is picked on the review as today; set 1 keeps `rpe: null`.

**Acceptance (in addition to the original criteria still valid):** unit tests for the set-2 seed (Easy / Medium / Hard / missed /
no step / Alt 4/5 / Steps A/B / lightest-weight floor); browser: no-history exercise → prompt → Set it up → Done → sheet → Easy →
set 2 kg = one valid step up with the reason; **failure case:** an exercise with history shows no prompt; Skip on the sheet
leaves set 2 at the plain carry; after Easy, set 1 and set 2 still store `rpe: null`; nothing is ever prefilled on set 1 that the routine didn't have.

**`(unconfirmed)`:** the wording of the prompt, guide line and reason; "about 15 times"; the prompt shows only once per exercise
per workout.

## Rescan 2026-10-10 — what changed under this req [measured, Explore agent on `main` 98f94cf]

- "Complete" → **Done**; "Moderate" → **Medium**; Failure is no longer offered (`ids.js:21-33`). Hard (4) **keeps** the kg
  (`progress.js:201`); only missed reps (or a legacy 5) move down (`progress.js:183`).
- Work-set kg seed is now routine kg → session carry → blank (req-178, `workout-log.js:531-548`); history never seeds a work set.
  Carry: `carryForSet` (`workout-log.js:460-468`) — the seam a setup mode plugs into. Reps carry on uniform plans (req-210).
- No-history signal unchanged: `lastSetsForExercise` (`history-queries.js:192-202`), called at `item.jsx:207`.
- The component is `WorkoutItemLive` in `src/views/workout/item.jsx:203` (Workout.jsx is gone).
- `model.js:501-504` sets `calibrationRequired` / "No history yet. Find a starting load." — rendered nowhere.
- Latent: `initialSetFields` still defaults effort 3 "Moderate" (`workout-log.js:607, 616-619`) though nothing reads it now.
- Emilio 2026-10-10 frames this req as the "empty box" case ("i only care if its empty or if its a weird number").

The original text below is kept for its decided parts (DEC-012: never an invented starting kg; auto-prompt on no history; "I'll
enter it" = today's form). Steps that name per-set effort follow the answer above.

---


**Status: READY** **Lane: ui** (a new feature — after the follow-ups, DEC-087; rescan before building) — the two shaping decisions are settled (DEC-012: guided calibration, not an
invented number; auto-prompt on no-history). Remaining choices are flagged defaults below, and
this is a UI/flow req — READY on intent + constraints, appearance refined at review
(`rules/WORKFLOW.md`). Interacts with `req-02` (see Integration). Larger than most Phase-1 reqs;
expect iteration.

**Gate: ux-feel** (DEC-009) — a mobile, in-gym flow that also sits next to the core "never invent
data" rule. Planning builds + verifies the logic in the browser, then **stops for Emilio's use-it
check** before merge; the *feel* of the prompt and calibration on a phone is his to judge.

## Why

A weighted exercise with no history shows a blank kg (the core rule — the app never invents a
starting weight). First time doing an exercise, the user has to guess a starting weight cold, with
no help. Emilio wants, on a first-time exercise, an explicit choice: **pre-enter the fields
yourself**, or run a **setup flow that helps you find the starting weight** — without the app
fabricating a number.

## The behaviour (decided — DEC-012)

On reaching the **first working set of an exercise with no finished-workout history**
(`lastSetsForExercise(store.workouts, exerciseId)` is null — the same signal `req-02` uses),
auto-prompt before the normal log form:

> **First time — [ Set it up ]   [ I'll enter it ]**

- **I'll enter it** → the existing blank log form (kg blank, reps = target), plus `req-02`'s flat
  carry to later sets. No change from today. Dismissing the prompt defaults here.
- **Set it up** → guided calibration:
  1. The user picks the **first** weight themselves (the app proposes nothing — the core rule
     holds), reps default to the target, and logs the set **with an effort rating** (the existing
     Easy / Moderate / Hard / Failure scale, `ids.js`).
  2. From that set's effort, the app **suggests the next set's weight** by applying the app's
     existing rule — `moveToValidWeight(weight, exercise, ±1)` with the `recommendNextPrescription`
     thresholds: **Easy → up one valid step; Hard/Failure (or missed target reps) → down one step;
     Moderate/Hard-in-range → keep.** The suggestion is an **editable prefill** on the next set,
     **with its reasoning shown** ("felt Easy → try one step up"), never a lock.
  3. Repeat over a set or two until the effort lands in the working zone ("keep"); that is the
     working weight, carried to the remaining sets.
- **Calibration sets are logged as normal sets** — they're real sets the user did (honest; they
  become that exercise's first history, which then drives the next session via `progress.js` as
  usual).

## Scope

- Detect first-time (no-history) exercises and render the auto-prompt at the first working set,
  in-workout only (`WorkoutItemLive`, `src/views/Workout.jsx`).
- The calibration is a thin guided layer over normal set logging: reuse the effort scale, reuse
  `moveToValidWeight` + the `recommendNextPrescription` effort thresholds for the suggestion —
  **do not write a second, parallel progression rule.**
- Suggestion is an editable prefill for the next set with a short visible reason.
- **Bodyweight** exercises: calibrate **reps** instead of weight (mirror
  `recommendNextPrescription`'s bodyweight branch — Easy → +1 rep, Hard/Failure → −1). **Cardio/
  duration:** not offered (nothing to calibrate) — the prompt does not appear.

## Out of scope

- The app proposing/inventing a starting weight (DEC-012 rejected it — breaks the core rule).
- Capturing "anything else you need to start" beyond weight/reps — e.g. a personal machine setting
  (seat height) as a note. The exercise already has cues/equipment/notes; a settings-note on
  setup is a possible **later** extension, not v1.
- Warm-up sets (setup is about the working sets).
- Exercises that already have history (unchanged — they get their history prefill + `progress.js`
  progression).
- Final visual/copy design (polish, refined at the use-it review).

## Integration with req-02

`req-02` carries the entered kg+reps **flat** to the next set for a no-history exercise. In **setup
mode**, the carry to the next set is instead **effort-adjusted** (the calibration suggestion).
"I'll enter it" keeps `req-02`'s flat carry. So setup mode is an effort-aware variant of the same
carry seam — build it as one coherent seam, not two competing prefills. (If `req-02` is not yet
merged when this is built, note the dependency; as of writing `req-02` is merged.)

## Ordered steps

1. First-time detection + auto-prompt at the first working set of a no-history exercise (dismiss/
   "I'll enter it" → today's behaviour).
2. Setup mode: after a calibration set is logged with an effort, compute the next-set suggestion
   via `moveToValidWeight` + the `recommendNextPrescription` thresholds (weighted) or the reps
   branch (bodyweight); prefill the next set with it and show the one-line reason.
3. Reconcile with `req-02`'s carry so there is a single prefill path (flat when manual,
   effort-adjusted in setup mode).
4. Keep the first weight user-entered — the app never seeds set 1's weight.

## Acceptance criteria (written before implementation)

- **Prompt only on first-time exercises (the trigger):** a no-history exercise shows the "Set it
  up / I'll enter it" choice at its first working set; an exercise **with** history shows the
  normal form and **no** prompt. Prove the trigger with a unit test on the detection + a browser
  check.
- **App never seeds the first weight (core rule holds):** in setup mode, set 1's kg starts
  **blank** — the app proposes nothing until the user has logged a set. Assert in a test.
- **Suggestion uses the existing rule (right mechanism):** given a logged calibration set + effort,
  the next-set weight suggestion equals `moveToValidWeight`/`recommendNextPrescription`'s output
  (Easy → up a valid step, Hard/Failure → down, else keep) — unit-tested against the shared helper,
  not a reimplementation. Include the weightStep cases (`5`, `Alt 4/5`).
- **Editable, reasoning visible:** the suggested next weight can be overwritten before logging, and
  the reason ("felt Easy → one step up") is shown.
- **Calibration sets are real:** the trial sets appear in the finished workout's history like any
  logged set (not discarded), so next session's `progress.js` picks up from them.
- **Failure/edge:** a bodyweight exercise calibrates reps (no weight); a cardio/duration exercise
  shows no prompt. Assert both.
- `./check` green; paste the line.

## Notes

This makes the first-time-exercise experience honest *and* helpful: the app structures the user's
own trial-and-error instead of fabricating a number, using the same effort→load logic it already
applies between sessions (`progress.js`) — just applied live within the first session. Pairs with
DEC-010 (mobile-primary): the prompt and calibration must feel right one-handed in the gym, which
is exactly why the merge waits on Emilio's device.
