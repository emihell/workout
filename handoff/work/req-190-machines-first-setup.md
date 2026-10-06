# req-190 — first setup starts from your machines; a new plan starts today; no silent empty day

**Status: READY** (2026-10-06). **Lane: ui.** From DEC-105 (Emilio, 2026-10-06) and req-184 §Persona run (Lena). After
**req-189** (independent screens; branch off `main` after 189 merges). Trigger files: none expected (`plan-templates.js`,
`views/Plan.jsx`, `views/Routine.jsx`, `views/Today.jsx`); if `state-reducers.js` / `store.jsx` / `schedule.js` change →
independent reviewer. Writes only through the existing routine / schedule reducers (as `planToState` does). No schema change.

## What Emilio decided
- DEC-105 §1: first setup = "Which machines do you use?" → search and tick → "How many days a week?" → the app splits them;
  the slot templates stay as "Not sure? Use a plan".
- DEC-105 §2: a newly saved plan starts today.

## Code today (main `ad04375`)
- Home first run: "Create your first routine" → `/routines/new` (`views/Today.jsx:310-321`, `isFirstRun`).
- `/routines/new` = `RoutineNew` (`views/Routine.jsx:107-125`): [Start from a plan] (primary, `/routines/new/plan`) ·
  [Blank routine] (secondary).
- Plan flow `views/Plan.jsx` + pure `plan-templates.js`: `PLAN_TEMPLATES` (`:26-50`), `week: [[weekday, routineIdx]]` fixed
  weekdays (2 days = Mon + Thu, `:34`); `planToState` (`:126-164`) — **"A routine whose slots are all skipped is not made, nor
  its schedule days"** (`:122`), so Lena's 2-day plan with day B left on "Choose" saved as Monday only, silently [measured:
  her Schedule screenshot, "Monday — Full body A", other days Rest]. The week goes on the schedule only when it is empty
  (`:156-160`), anchored by `withDefaultAnchor` (`schedule.js`).
- `ExercisePicker` (`views/ExercisePicker.jsx`): own (recent first) → whole library, staples by muscle on empty search,
  multi-select "Add N", history prescription or the shown starting plan (DEC-097 §4 — allowed at routine creation).
  Sticky Cancel/Add bar `.ui-picker-bar` (`ui/ui.css:285-292`); Lena: the last rows sat hidden under it.

## Scope (ordered)
1. **`/routines/new` order:** primary **"Pick your exercises"** (new flow, step 2); then "Not sure? Use a plan" (today's
   templates); then "Blank routine". Wording `(unconfirmed)`.
2. **Machines-first flow:**
   a. Picker screen titled "Which exercises do you do?" (ExercisePicker, multi-select, onPick — nothing written yet).
   b. "How many days a week?" 1 / 2 / 3 / 4.
   c. Days ≥ 2: "Same workout every time" (default) or "Two workouts, A and B" — A/B splits the picks alternately in pick
      order (1st → A, 2nd → B, …) `(unconfirmed)`.
   d. Save → one routine ("Workout") or two ("Workout A", "Workout B"), items with the picker's values (history or the shown
      starting plan); the week on the schedule (only if the schedule is empty, as `planToState`), alternating A/B.
   Cancel/Back at any step writes nothing.
3. **A new plan starts today (DEC-105 §2)** — both flows (machines-first and templates): the first workout day is today's
   weekday, the rest keep the template's spacing shifted (2 days: today, +3; 3 days: today, +2, +4; 4 days: today, +1, +3,
   +4) `(unconfirmed)`; Home then shows today's workout with Start.
4. **No silent empty day (template flow):** Save with a day whose slots are all unchosen → a sheet "Full body B has no
   exercises." [Leave it out] [Same as Full body A] `(unconfirmed)`; "Same as" copies A's picks into B. Never drop a day
   without this.
5. **Picker bottom rows reachable:** the list scrolls far enough that its last row sits fully above the sticky bar (plan slot
   picker, routine picker, mid-workout pickers).

## Out of scope
- An existing user's schedule (non-empty) — unchanged, as today. Plan templates' content (slots, names). Program model.
- The first-workout fixes (req-189).

## Acceptance
1. Unit: the split rule (same / A-B alternate), the start-today weekday shift for 1–4 days (with "today" injected), and
   `planToState` with an empty day + "Same as A" → B made with A's picks; "Leave it out" → today's behaviour.
2. Browser (empty first launch, `plan qa main --seed <emptyState>`; a fixed Tuesday clock): Create your first routine → Pick
   your exercises → tick Leg Press, Chest Press, Lat Pulldown → 2 days → Same → Save → Home shows **today** "Workout [Start]";
   schedule has Tue + Fri (receipt from `schedule.slots`). Count taps (Lena's was 20 + 3 searches; target fewer).
3. Same with "Two workouts" → routines "Workout A" (Leg Press, Lat Pulldown) and "Workout B" (Chest Press) (receipt).
4. **Failure case:** template flow, 2 days, day B left unchosen → Save → the sheet appears; nothing is saved until answered;
   Leave it out → 1 routine, and the sheet said so; Same as A → 2 routines, B = A's exercises (receipts).
5. **Failure case:** Cancel at the days step → no routine, no exercise record, no schedule slot written (receipt: counts).
6. Picker at 390×844 scrolled to the end: last row's bottom ≤ the bar's top (measured).
7. `./check` green; smoke green.

## Decisions made on Emilio's behalf `(unconfirmed)`
Labels and order on `/routines/new`; routine names "Workout" / "Workout A/B"; alternate split; weekday spacing; the empty-day
sheet's wording; machines-first uses the starting plan for no-history picks (DEC-097 §4) — routine creation, not mid-workout.
