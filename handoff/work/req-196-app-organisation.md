# req-196 — app organisation: where things live, what goes

**Status: NEEDS DECISIONS** (2026-10-07). **Lane: design**: no code. Output is `DEC-`s plus build reqs.
Emilio, 2026-10-07: "how we can remove clutter, and non logical organisation … do we need a button for settings that is always
easy access? … merge in the schedule in the existing list? … should rutines be rutines? or workouts instead? … do we need
access to excercises? could thay be baked into rutines/workouts? … lena is the most imrpotant user, becouse to be beginner
freindly is the best base".

## Input: UI/IA tester run, 2026-10-07 (agent, main `779304b`, 390×844)
- **Pass 1:** empty first launch, played as Lena.
- **Pass 2:** the `src/db.json` seed (13 workouts, 3 routines, 22 exercises), played as an experienced lifter.
- Screenshots are in the session scratchpad `ia-review/shots/` (`e*` = empty pass, `s*` = seeded pass).
- Planner re-checked these claims:
  - Settings contents (`Settings.jsx:31-57`).
  - First-run Home repeats the bar (`Today.jsx:367-372`).
  - The "Warm-up set · Oct 13, 2025" header (s04).
  - 18 Up/Down buttons on the routine page (s07).
  - The DEC-025 history.

**Current map:**
- **Bar:** Library (icon, opens `/routines`), Workout (oval, opens `/`), Settings (icon). It is hidden in a workout.
- **Library** is a segmented control: Schedule | Routines | Exercises. The bar opens the middle segment.
- **History** has no bar slot. It is reached only from Home.
- **Duplicate doors [measured]:**
  - The routine editor has 4 doors: Library, Schedule › day › routine, `/workout/:id/setup` and `/history/:id/routine`.
  - Exercise settings have 3 doors: the Exercises tab, the routine item's "Edit exercise settings ›", and the log screen's title.
  - "Start new workout" lands in Library (`Today.jsx:276`).
  - Home has 3 names: "Workout", "Today" and "Good morning".
  - "Exercises" means 3 things: the tab, the routine section header, and the in-workout "‹ Exercises" back link.

**Taps [measured] (typing a field = 1 tap):**

| Task | Taps |
|---|---|
| Lena: plan from 6 machines | 11 |
| Lena: start today's workout | 1 |
| Lena: log 6 exercises × 3 sets | 36 |
| Lena: open what she did today | 3 (the "Done" row on Home can't be tapped, e13) |
| Last session's numbers for one exercise | 2 / 4 (By exercise shows no kg, s03) |
| Edit a routine kg | 5 (list "Edit" opens the routine; its "Edit ›" only renames) |
| **Move a routine Fri → Sat** | **9 taps, 6 screens** (no move action) |
| Add an exercise mid-workout | 3 |
| Export | 2 |

**Lena cross-check [measured]:** "settings" appears 0 times in req-184, 189, 190 and 191. Her runs show no visit to Settings,
Library or the Exercises tab. She lived on Home → setup → workout → "did it save?".

## Open questions (each → a DEC-)
1. **Settings off the bar?**
   - **Tester:** yes. Settings holds no actual settings, only Export, Import, Export analytics, the Assistant-prompt checkbox,
     and the dev-only Components and Feedback notes.
   - **Proposal:** History gets the bar slot instead. A "Backup & data ›" row goes at the bottom of History. Possibly a
     "back up" nudge every N workouts.
   - **Cost:** Export goes from 2 taps to 3. The save-failed banner copy (`App.jsx:42`) must change.
   - **History:** this reverses DEC-024/DEC-036, which kept Settings one tap away.
2. **Home becomes the schedule?**
   - **Tester:** yes. Show this week as 7 dated days, rest days included, with today dominant and the only row with Start.
   - **Tap a day:** a sheet opens with "Every Saturday: [routine] / Rest", plus the loop length. The Schedule segment goes.
     Moving a day drops from 9 taps to about 4 [inferred].
   - **History:** this reverses **DEC-025**. Emilio: "the light peek is the right way to go; showing more needs a new
     component and a new idea". That allows it as a *new* component, not a revival of req-32.
   - **Model:** slots are `{week, weekday, routineId}` with no per-date override. So edits read "every Saturday". A "just
     this date" option would be a schema change (CLAUDE.md ask-gate #2).
3. **Routines → "Workouts"?**
   - **Tester:** yes, as a vocabulary change. The beginner setup already says "Same workout every time" and "My workout A/B"
     (`Plan.jsx:287,291`, `plan-templates.js:140`).
   - **Collisions where "workout" means the session:**
     - The bar's "Workout" button → rename it "Today".
     - "This workout" on the summary.
     - The import summary "…N workouts…".
     - The history fallback name.
     - The offer sentence, which Lena run 2 #7 flagged.
   - **Scope:** about 15 strings, README and DESIGN vocabulary. No schema change. It must land in one req.
4. **Where routines live:** Home's day rows link to their routine, and "Start a workout" opens a picker sheet. If a bar slot
   stays, it holds the plain list with no segments. Library's three-jobs-behind-a-toggle goes.
5. **Exercises tab removed?**
   - **Tester:** yes. Every field is already reachable from the routine item or the log screen, and the pickers browse the
     library.
   - **Fixes needed first:**
     - Delete exists only on the tab's detail page. Move it to the History › By exercise page.
     - By exercise lists only exercises with history. It must list all active ones.
     - Show the top set per date.
6. **Smaller cuts:**
   - Make the "Done" row on Home tappable.
   - Routine page: tap the name to open it, "Edit ›" → "Rename", Up/Down behind a "Reorder" mode.
   - History: a flat list under month headers instead of month buckets.
   - Hide the bar during first setup.
   - Drop the "Warm-up set ·" prefix leak in the history header (s04: a bug, can be built now).
   - "‹ Exercises" → the routine's name.
   - "Loop ›" hidden until needed.
   - "Total lifted" on the summary (Lena disbelieved it).
   - Abandon next to Finish (req-77, paused).

## Tester's proposed structure (not decided)
```
Bar: [ Workouts ] [ Today ] [ History ]        hidden in a workout and during first setup
Today    this week as 7 days → day sheet (Start · every-weekday routine/Rest · loop) · done today → that workout
Workouts the list → workout (exercises, Rename, Reorder, Delete) → item → Exercise settings ›
History  recent (month headers) · By exercise (all; top set; settings + delete) · Backup & data ›
```
Unchanged: today's Start = 1 tap, add mid-workout = 3. Better: move a day 9 → about 4, open today's workout 3 → 1.
Worse: Export 2 → 3.

## Acceptance
- Emilio answers Q1–Q6, each recorded as a `DEC-`.
- The result is split into READY build reqs. The vocabulary rename goes in one req. Any schedule schema change goes through
  ask-gate #2.
- Persona QA re-run as Lena on each build.
- Nothing is built from this req itself.
