# req-196 — independent review (cold, read-only, main `166266a`, 2026-10-07)

The reviewer read the proposal, App, route, BottomMenu, Today, Library, Schedule, Routine, Exercises, Settings, history and
schedule.js, plus DESIGN, README and DECs 015/016/024/025/031/036/040/042/049/071/096–098/105/108. It measured Home seeded at
390×844 and ran node probes on `schedule.js`.

## Verdicts: all five "agree with changes"

1. **Settings off the bar, History in its slot, Backup & data at the bottom of History.**
   - **Changes:**
     - The Backup & data row shows even when History is empty.
     - The save-failed banner (`App.jsx:43`) gets its own Export button.
     - Export analytics and the dev items (Feedback notes, Components) live in Backup & data.
     - History's main screen drops its Back (DEC-015).
     - `activeTab` gets a `history` group.
     - Any backup-nudge counter goes in its own key.
   - **Reverses:** DEC-024 ("Settings always one tap"), DEC-036 (three controls) and DEC-046's "Settings → Export" path.
   - **Counter:** Export is the only backup, and one more tap means fewer backups.
2. **Home as this week.**
   - **Changes:**
     - Today first, above the fold.
     - Loop-honest labels: "Saturday · week 2 of 2", not "every Saturday".
     - A full-loop editor stays reachable when the loop is longer than 1 week.
     - Multi-routine days stay lists.
     - Past days show done from history by date.
     - The stale Continue row stays on Home.
     - The shrink-loop confirm stays.
   - **Reverses:** DEC-025, DEC-093's "Kept: home order (req-60)", DEC-024's Start-ahead, DEC-049.
   - **Counter:** Emilio has affirmed the light peek twice.
3. **Routines → "Workouts".**
   - **Changes:**
     - Pick the session's noun first.
     - About 25 strings (F9), not 15.
     - Internals and the README entity keep "routine", with a glossary line.
     - A static test keeps "routine" out of UI copy.
   - **Counter:** the collision moves rather than going away. The evidence is mostly our own copy.
4. **Library goes; the bar becomes Workouts · Today · History.**
   - **Changes:**
     - Workouts rows keep Start (the only start for a routine on no schedule).
     - The start picker is reachable on scheduled days too.
     - The circles get visible labels.
     - Decide what tapping a day row does.
   - **Reverses:** DEC-024's toggle and DEC-036's grid icon.
5. **Exercises tab → History › By exercise.**
   - **Changes:**
     - List active exercises plus every exercise in history, archived included and marked.
     - Label the block "Exercise settings".
     - Delete's copy says history is kept.
     - No Delete on an archived exercise.
     - Keep `/exercises/:id/edit`.
   - **Reverses:** DESIGN §3 ("Setup and history are separate").
   - **Counter:** Delete inside History reads as "delete history".

## Findings
- **B1 · blocker:** loop weeks 2–4 can't be edited from a this-week view, and "every Saturday" is false in a loop.
  - Slots are keyed `{week, weekday}` (`schedule.js:44-50,82-86`). Only `Schedule.jsx:48-69` shows every week.
  - Probe: `2026-10-10 loopweek 1 [B] · 10-17 loopweek 0 [A] · 10-24 loopweek 1 [B]`.
- **F2:** after a slot edit, past days lose "Done". Slots get new ids (`schedule.js:102-132`). Probe: old slot `w1`, re-add →
  `null`. Fix: done-by-date.
- **F3:** a single-choice sheet drops a day's second routine (`Schedule.jsx:57-63`, `exchange.js:48`).
- **F4:** on a Sunday, a Mon→Sun list puts today's Start at about 466–588 px. On 375×667 the dock is at about 587, so Start
  sits under it. Measured: row h 61, today block h 122, dock top 764.
- **F5:** Start-ahead (`Today.jsx:86-107`) removed without naming it. `coveringWorkout` covers only the finish date.
- **F6:** the stale Continue row (`Today.jsx:326-329,423-428`) needs a home.
- **F7:** "all active" would hide archived exercises' history (`history-queries.js:125-143` lists them today).
- **F8:** Export analytics, Feedback notes and Components need a home (`Settings.jsx:59,92,96`).
- **F9:** session-meaning "workout" strings remain:
  - `Today.jsx:277`
  - `workout-actions.js:12,98`
  - `state-reducers.js:184-186`
  - `Settings.jsx:11`
  - `auto-complete.jsx:97`
  - `error-boundary.js:54`
  - `history/detail.jsx:95`

  Routine strings:
  - `model.js:185`
  - `helpers.js:52`
  - `recalc.jsx:30`
  - `routine-update-offer.js:54`
  - `Routine.jsx:42,112,140`
  - `Exercises.jsx:324,488`
  - `Schedule.jsx:70,88,144,158`
  - `Plan.jsx:166`
  - `Library.jsx:23`
  - `Today.jsx:342,368`
  - `exchange.js:11-62`
- **F10:** icon-only circles fail the beginner test (`BottomMenu.jsx:99-121`).
- **F11:** import on a device with routines but no history needs the Backup row in History's empty state.
- **F12:** the save-failed banner says "from Settings" (`App.jsx:43`).
- **F13 · latent:** `BottomMenu.jsx:95` hides the bar for any route name starting with `workout`. Probe:
  `hide("routines") false hide("workouts") true`. Never rename the route.
- **F14 · latent:** removing the `/exercises` routes breaks `Routine.jsx:27-29` settings links and the Back parents at
  `Exercises.jsx:395,461`. `returnPathOf` drops unknown routes (`route.js:154-166`).
- **F15 · latent:** a nudge counter in `workout-mvp-v9` would be a schema change.
- **F16 · nit:** `route.test.js:193-249` and `BottomMenu.test.js` lock today's grouping, so edits to them must be named.
- **F17 · nit:** "Rename" is off-vocabulary (DEC-042).
- **F18 · nit:** the delete confirm says "schedule slots" (`Routine.jsx:214-216`), so name the days.
- **Schema:** none of the five needs a change while "just this date" stays out.

Phased order suggested: R1 bar + Backup & data → R2 rename → R3 exercises → R4 Workouts list → R5 Home week (read-only) →
R6 day editing → R7 small cuts. A Lena re-run follows R2, R5 and R6.
