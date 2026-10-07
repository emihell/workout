# req-199 — Library goes: the bar's left tab is the plain workouts list, with "Your exercises ›" and "Whole plan ›"

**Status: READY** (2026-10-07). **Lane: ui.** From DEC-110 §3. Builds after req-198 (same `BottomMenu.jsx` / `route.js`) and
before req-200 (Home week).

## Code today (main `166266a`)
- **`views/Library.jsx`** is the segmented control [Schedule | Routines | Exercises]. The bar opens `/routines`, the Routines
  segment.
- **Routines rows** have [Edit] [Start] (review s16). "Edit" opens the routine detail, whose own "Edit ›" only renames.
- **Exercises screens** are in `views/Exercises.jsx`. Fixed Back parents are `/exercises/:id` and `/exercises` (`:395,461`).
- **The routine item's** "Edit exercise settings ›" links to `/exercises/:id/edit?from=` (`Routine.jsx:24-29`).
- **"Start new workout"** on Home goes to `/routines` (`Today.jsx:276`).
- **History › By exercise › exercise** (`history/list.jsx:148`) has no link to the exercise's settings.

## Scope
1. **`/routines`** renders without the segmented control. It shows:
   - "Add routine ›".
   - The routine list. Tap the **name** to open it; **Start** stays on each row. The row's "Edit" button goes.
   - Below the list, two rows: **"Your exercises ›"** → `/exercises`, and **"Whole plan ›"** → `/schedule`.
2. **`/schedule` and `/exercises`** render as normal screens with a Back to `/routines`. Today they are segments.
3. **Every `/exercises/*` and `/schedule/*` route stays** (review F14). Only the segment UI goes.
4. **No bar (DEC-112).** `/routines` is reached from Home's top "Workouts ›" link (req-198) and has Back → "/".
5. **History › By exercise › exercise:** add **"Exercise settings ›"** → `/exercises/:id/edit?from=<this page>`.
6. **Home's "Start new workout"** still → `/routines`. Starting from the list stays 2 taps.

## Out of scope
- Renaming (req-201).
- The Home week and day screens (req-200).
- Reorder mode (req-202).
- Moving exercise Delete.

## Acceptance
1. Browser: Home → Workouts › shows no segment control, the list with Start, and both rows. "Your exercises ›" opens the
   Exercises list. Back returns to `/routines`.
2. Browser: a routine that is on **no schedule** starts in ≤2 taps from Home. Receipt: `activeWorkout` set in v9.
3. **Failure case:** Routine item → "Edit exercise settings ›" → Save lands back on the routine item, not Today. The same
   from History › By exercise › "Exercise settings ›" back to that page.
4. `./check` green, and the smoke test passes.
