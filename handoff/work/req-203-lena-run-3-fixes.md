# req-203 — Lena run 3 fixes: a done day opens its sets; Home links the session; plain backup; clearer day screen

**Status: READY** (2026-10-07). **Lane: ui.** From the Lena run on the reorganised app (DEC-110 to DEC-112), main
`e26b697`. Screenshots are in the session scratchpad `lena3/`, and Planner viewed s32 and s33. Each item is a binary fix of
something the reorganisation broke or left unclear (DEC-091/095: Planner fixes, then reports).

## Run 3 vs runs 1 and 2
- **Setup:** 22 taps, including 6 searches (5 of them search-clear refocus).
- **Workout:** 40 taps, the typo fix included. Run 2 was 46.
- **"Did it save":** 0 taps (Done ✓ on Home). But **seeing her sets took 5 taps, with a scare on the way**. Run 2 took 2.
- **Better:** the Today link was found at once, "Workouts ›" was noticed, and the week list was understood.

## Scope
1. **A done day opens its record, not the editor.**
   - On the day screen (`views/Schedule.jsx` ScheduleDay, reached from a Home week row), show at the top a row for each
     workout finished on that date: "{name} · Done ✓ ›", linking to its History detail with `?from=` this day screen.
   - Then the scheduled slots as now.
   - **Start now shows only on today and future dates.** Never on a past date, and not on today once a workout finished today
     covers that slot.
   - The day title gets the date when reached from Home: "Wednesday, Oct 7".
   - Today's Start stays in Home's today block. (Lena s33: "Where are my sets? Start now — did it not save? Remove what?!")
2. **Home's done line links.** In today's block the scheduled slot's "Done Wed, Oct 7" (`views/Today.jsx:124`) becomes a
   link, "Done ✓ — see your sets ›", to that workout's History detail with `?from=/`. This is the same pattern as req-195's
   done-today rows.
3. **The Remove confirm says what it does.**
   - The day-screen Remove reads "Take {name} off {Weekday}s? Your history is kept." When the loop is longer than 1 week:
     "…off {Weekday}s in week N?".
   - Under the day screen's title, one sub line: "Every {Weekday}", or "Every {Weekday} in week N of M". `(unconfirmed)`
4. **Backup & data is plain.**
   - The top button reads **"Back up now"**. Above it, one line: "Saves all your workouts and history to a file on this
     device. Open it with Import to restore."
   - After the download: "Backup saved — {filename}".
   - Import's button reads **"Restore from a backup"**. The import sheet's flow is unchanged.
   - The Developer group stays below. `(unconfirmed)`
5. **History › By exercise shows numbers.** Each date row on an exercise's page reads "{date} · {top set kg} × {reps}", the
   heaviest working set. Rows with no kg keep "N sets". (Lena s48; review Q5 bonus.)
6. **Search keeps focus after ×.** The picker search's clear button refocuses the input. (`activeElement` was BODY.)
7. **The rest pill after the last set** doesn't read "set 1/3" once every set of that exercise is done. It shows the next
   exercise's position, or no set count at all. (Lena s20.)

## Out of scope
These go to Emilio's list or the backlog:
- A "Move to…" day action.
- Choosing days in setup (DEC-105 starts today; Lena: "I'd rather do Tue and Fri").
- A default plan name other than "Workout".
- A sanity note on 400 kg with no history (DEC-102 has no reference).
- Auto-finish's primary button.
- One-date schedule overrides (schema).

## Acceptance
1. Browser, on an empty origin: finish today's workout, then Home → today's week row → the day screen shows "Workout · Done
   ✓ ›" and no Start now. Tap it to land on the History detail with the sets. Back returns to the day screen.
2. Browser: Home's "Done ✓ — see your sets ›" opens the History detail. Back goes to Home.
3. **Failure case:** a past date with no workout shows no Start now. A future date still has Start now, which starts it
   (receipt: `activeWorkout.routineId`). Removing on a 2-week-loop day leaves the other week's slot (receipt:
   `schedule.slots`).
4. Unit: the By-exercise row text for a session with sets 20×12, 25×10, 25×8 reads "… · 25 kg × 10".
5. Browser: after × in the picker search, `document.activeElement` is the search input.
6. Unit or browser: after the last set of an exercise, the pill text has no "set 1/" for that exercise.
7. `./check` green. **The branch's own** `scripts/smoke.mjs` is green on the committed sha (L-049); update it if a selector
   moved.

## Built — calls `(unconfirmed)`
- **The day screen knows its date only when entered from Home** (`from=/`): that weekday of the current week, if it is in
  the path's loop week. From Whole plan there is no date, no done rows, and Start now as before.
- "Week N of M" moved from the title into the sub line.
- **The pill shows no set count** for an exercise with nothing logged yet. That includes the very start of a workout (clock
  or GO only).
- The backup line was changed by Planner to "…Use Restore from a backup to bring it back."
- **Seen, not changed:**
  - `workout/overview.jsx:106` still shows a plain "Done {date}".
  - An all-skipped exercise reads "3 sets" in By exercise.
