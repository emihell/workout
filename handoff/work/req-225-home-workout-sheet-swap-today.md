**Status: BUILT, NOT merged — branch `req-225` (`f8ab63e`…`4515a81`).** **Lane: data** — a new optional field `schedule.swaps` in saved state. CLAUDE.md ask-gate #2: Builder states what
changes and to how many records before writing; **Emilio's eyes before merge** (DEC-035 carve-out); reviewer + backup reminder.

# req-225 — tap today's workout on Home: a sheet with its exercises, Edit, Swap for today

DEC-125 §5 (Emilio, batch 6 I1: "Pressing a workout here should give me a quick overview of it … With a edit button? And switch? …
swap it for something else (but only for this day, permanent swap needs to be done in Schedule page)"). Builder: throwaway agent
(DEC-055). Last in the batch.

## Facts (rescanned 2026-10-14, `main` 73cdf1e)

- Home: `todays = slotsOn(schedule, now)` (`Today.jsx:322`); `todaySpots` (`:132-146`); `TodayPending` (`:153-169`) prints each name
  as a plain `<p className="ui-today-workout__name">` + `StartButton` / `StartChooser` (`:26-56`). Nothing opens on tapping the name.
- One-date move (req-211, DEC-117 §2): `schedule.moves: [{ id, slotId, from, to }]` (`state-reducers.js:317-325`), applied in
  `slotsOn` (`schedule.js:91-102`) via `liveMoves` (`:107-118`); normalised on load by `normaliseMoves` (`model.js:279-300`, from
  `migrateState` `:348`) — **added with no version bump** (`SCHEMA_VERSION = 9`, `model.js:6`). Exported `exchange.js:652-653`,
  documented `:66, :244, :393`; restore-routine filters to live slots `:743`; `slotRemovedState` drops a slot's moves (`:308`).
- No one-date routine swap exists (grep replace/override/swap in schedule/model/state-reducers/Schedule/schedule-day: none).
- Sheets: `askChoice` / `ConfirmSheet` (`ui/confirm.js:26-41`, `ui/index.jsx:~301-360`) take text + choice buttons only — **no
  custom content** → the exercise list needs a sheet that can hold content.
- Editor from Schedule: `/schedule/{week}/{weekday}/{slotId}` (`route.js:254-289`, `Schedule.jsx:375`).

## Scope

1. **Data:** `schedule.swaps: [{ id, slotId, date, routineId }]`, `date` 'YYYY-MM-DD'. Optional, additive, no version bump (the
   `moves` pattern): `normaliseSwaps` in `migrateState` keeps an entry only with a string id, an existing slot, a valid date, a
   `routineId` naming an existing, non-archived routine ≠ the slot's own; last per (slotId, date) wins. Exported + documented
   in `exchange.js` like `moves`; dropped with its slot (`slotRemovedState`) and on restore-routine filtering.
2. **Apply in `slotsOn`:** a slot shown on `date` (after moves) with a swap for (slotId, date) returns with `routineId` = the swap's
   and `swappedFrom` = the slot's own. Everything reading `slotsOn` (Home, Coming up, day screen, `coveringWorkout`, `doneEarlier`,
   Start options) then sees the swapped routine.
3. **Sheet on Home:** tapping a pending workout's name in today's block opens a sheet: the workout name, its exercises (name +
   sets × reps, from the routine), and **Edit** (→ the same editor Schedule opens for that slot) · **Swap for today** · Close.
4. **Swap for today:** a list of the user's other non-archived workouts → pick → swap saved for (slotId, today). Home shows the
   new name with "swapped from {original}". The sheet of a swapped workout also offers **Back to {original}** (removes the swap).
5. A swap never changes the weekly schedule; tomorrow and next week are untouched.

## Out of scope

Swapping on other dates or from the day screen; Coming up rows opening the sheet; done workouts; a sheet for an off-schedule
workout; permanent swaps (Schedule, unchanged).

## Acceptance criteria

1. Migration: a stored v9 state **without** `swaps` loads with `schedule.swaps = []`, every other field deep-equal; a v8 legacy key
   still upgrades (the existing v5→v9 tests stay green, plus one with `swaps` present).
2. Unit `normaliseSwaps`: drops unknown slot, bad date, archived / missing / same routine, non-object; last per (slotId, date) wins.
3. Unit `slotsOn`: swap on Tue → Tue returns the slot with the new `routineId` + `swappedFrom`; Wed of the same and next week unchanged.
   Swap + move: a slot moved Tue → Thu, swapped on Thu → Thu shows the swapped routine.
4. Unit: finishing the swapped-in routine on that date covers the spot (`coveringWorkout`); the original routine does not.
5. Round-trip: export → import keeps `swaps`; restore-routine of a routine whose slot is gone drops its swaps.
6. Rendered: Home → tap name → sheet lists the exercises; Edit opens the slot editor; Swap for today → pick → Home shows the new name
   + "swapped from"; Back to original → original again, `swaps` empty.
7. **Failure case — remove a dependency:** the swapped-in routine is archived after the swap → the entry is dropped on load and Home
   shows the original routine (fails closed to the schedule), no crash.
8. **Records:** the report states the write: one entry added / removed per Swap / Back tap; no existing record rewritten
   (receipt: a before/after of a seeded store).
9. Browser (`plan qa`): Swap Upper → Lower for today, Start → Lower's first exercise; reload → still swapped; tomorrow unchanged.
10. `./check` green.

## Decisions made on Emilio's behalf

- **behaviour** `(unconfirmed)`: only **today's** pending workouts on Home open the sheet; Coming up rows still open the day screen.
- **behaviour** `(unconfirmed)`: the swap list = all other non-archived workouts; a swapped spot reads "swapped from {name}" and offers
  "Back to {name}".
- **behaviour** `(unconfirmed)`: Edit edits the routine shown (the swapped-in one when swapped), via the Schedule slot editor.
- **behaviour** `(unconfirmed)`: an archived swapped-in routine silently reverts the spot to its own routine.
- implementation: no schema version bump (the `moves` precedent); the content sheet is a new UI component (not `askChoice`).

## READY checks

1. DECs: DEC-117 §2 (one-date from Home; permanent in Schedule), DEC-113/114/115 (Home), req-211, DEC-125 §5.
2. Siblings: req-213/214 own `todaySpots` / done lines (shipped); req-223 changes where Start lands (build before this one).
3. Deferral: swaps on other dates — the `(slotId, date)` shape already supports them. 4. none.
5. Trigger files: `model.js` (`migrateState`), `store.jsx`, `state-reducers.js` → reviewer + backup reminder + Emilio's eyes. 6. marked.
