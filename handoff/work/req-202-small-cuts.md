# req-202 — small cuts from the organisation review

**Status: READY** (2026-10-07). **Lane: ui.** From req-196 Q6 and review F17. After req-201. Each item is independent.

## Scope
1. **Routine detail** (`Routine.jsx`): the Up/Down buttons (18 for 9 exercises, review s07) hide behind a **"Reorder"** toggle.
   The toggle shows them and becomes "Done".
2. **In-workout back link** "‹ Exercises" (review e09) → "‹ {workout name}".
3. **History header tag** "Warm-up set · {date}" (`history/detail.jsx:132`, `helpers.js:21`): the item's warm-up flag reads as if
   the page shows one warm-up set. It becomes "with warm-up · {date}" `(unconfirmed)`. The routine row's "Warm-up set ·"
   prefix gets the same treatment.
4. **Hide the bar during first setup** (the plan / machines steps from first-run Home), as it hides in a workout.
5. **Routine detail's "Edit ›"** (renames only) stays named "Edit" (DEC-042, F17) but moves next to the title.

6. **Delete the dead bottom bar** (DEC-112, left over from req-198): `src/ui/BottomMenu.jsx`, `src/ui/BottomMenu.test.js`, `activeTab`
   in `route.js` and its block in `route.test.js`, and any CSS left for `.ui-dock`. If deleting the files is refused by the
   permission system, stop and report it. Don't work around it.

7. **Slot detail Back from a Home-opened day** (req-200 loose end): a slot page reached from `/schedule/W/D?from=/` returns to
   that same day URL (keeping `from`), so the chain ends on Home.

8. **Wording from req-201:**
   - Home's "Start a session" → **"Start a workout"** (it opens your workouts).
   - The import summary's "N slots" → "N scheduled days". `(unconfirmed)`

## Out of scope
- History month buckets.
- "Total lifted".
- Abandon placement (req-77).

## Acceptance
1. Browser: the routine detail shows no Up/Down until Reorder is tapped. A reorder persists. Receipt: the item order in v9.
2. Browser: the in-workout back link shows the workout name.
3. **Failure case:** first setup's steps show no bar. Leaving setup through its own Back still works, and the bar returns on
   Home.
4. `./check` green, and the smoke test passes.

## Built — calls `(unconfirmed)`
- **Item 4 was not built.** My spec was stale: DEC-112 had already removed the bar. The setup steps show Back plus the Today
  link.
- **The Reorder toggle** sits right of "Add exercise ›", hidden for fewer than 2 exercises. It reads "Done" while active,
  which is an off-vocabulary verb (DEC-042), but it ends a mode and commits nothing.
- "Edit ›" is right-aligned in the title row.
- The back link falls back to "Workout".
- The in-workout overview row also reads "with warm-up".
- **"N scheduled days"** counts distinct days (`summary.scheduledDays`).
- **Item 7** keeps `from` on the slot page only; its sub-screens go back to the bare slot page.
- **Loose end:** a warm-up-role row reads "Warm-up · 1 set" just above rows reading "with warm-up · 3 sets".
