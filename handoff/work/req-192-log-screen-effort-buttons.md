# req-192 — the set screen: effort buttons log the set, pill skips rest, set list on top, exercise note shown

**Status: BUILT AND MERGED, 2026-10-06 — branch `req-192` (`e35e396`…`89d34ca`, 2 commits).** (2026-10-06). **Lane: ui.** From DEC-108 §1–3, §6 (Emilio's notes G4, G8–G13). Order: **192 → 193 → 194 →
195** (192–194 touch `views/workout/item.jsx` / `ui/index.jsx`). Trigger files: `workout-log.js` / `progress.js` only if touched
→ reviewer. No schema change.

## Code today (main `4da90e1`, see req-184 §Feedback received 2026-10-06)
- Log screen order (`item.jsx:472-624`): ‹ Exercises · pill (fixed top) · title + "Add note" · note field · SetLogForm (kg,
  Reps/Duration, hints, **Effort** `SegmentedControl`, bar Previous · Skip set · **Complete**, fixed bottom) · **set list**
  (`:574-598`) · Skip rest / Remove set (`:603-620`).
- `RPE_OPTIONS` (`ids.js`): Easy 2, Moderate 3, Hard 4, Max 5; effort preselected 3 (`initialSetFields`, workout-log.js);
  stored `Number(rpe)` (`item.jsx:261`); progress.js reads rpe ≥ 5 like a missed set (`:129`, `:140`) — unchanged.
- Pill (`views/workout/rest.jsx:14-25`): tap → current exercise; `SkipRest` button (`:30-48`) on the log screen.
- Routine item `notes` (the exercise's note in the routine) show only on the done view (`item.jsx:85`, `:666`).

## Scope (ordered)
1. **Effort buttons log the set** (DEC-108 §1): replace the Effort selector + Complete with four buttons in the bottom area —
   **Easy · Medium · Hard · Failure** — each a real button (button styling, ≥44 px, full labels) that logs the set with that
   effort (rpe 2/3/4/5 as today). A small caption above them, e.g. "Log set — how did it feel?" `(unconfirmed)`, so they read
   as actions. No preselection. Sets without effort (warm-up, cardio, `showEffort` false) show one **"Done"**. Previous · Skip
   set move to a quiet row above the buttons. kg/reps validation (kg error, "Enter reps", duration) still runs before logging.
2. **Labels** (DEC-108 §2): Moderate → Medium, Max → Failure everywhere effort is shown (set edit, History, set list).
3. **Viewing a logged set** (req-186 Previous / tapped row): its effort shows as the selected button; tapping another effort
   + Save, or Next, as today — rest untouched.
4. **Pill** (DEC-108 §3): on the current exercise's own log screen a tap skips the rest (same write as `SkipRest`); elsewhere
   it opens that exercise. Remove the `SkipRest` button. Label hint while resting on its own screen: "1:12 · skip"
   `(unconfirmed)`.
5. **Set list moves up** under the exercise title (above kg/reps) `(unconfirmed)`.
6. **The routine's exercise note** (item `notes`) shows under the title on the log screen when present (read-only; edited in
   the routine as today). "Add note" (per-set) stays, available any time.

## Out of scope
Changing progress.js's reading of effort. Cardio fields (req-194). Weight step (req-193). Today (req-195).

## Acceptance
1. Browser: a weighted set → tap **Hard** → set stored with rpe 4, rest armed (receipts); no Complete button on screen.
2. A warm-up set and a cardio set show one "Done"; it logs with rpe null.
3. **Failure case:** kg box unreadable ("2,5,5") → tap Medium → inline kg error, no set stored (receipt).
4. Set edit / History / set list read "Medium" and "Failure" for stored 3 and 5 (existing records untouched — receipt: a
   record with rpe 5 renders "Failure").
5. Pill on its own exercise while resting → tap → `restEndsAt` null; same pill from the overview → opens the exercise.
6. Set list renders above the kg box (DOM order); routine note text visible on the log screen.
7. 390×844 screenshot: four effort buttons fit one row (or 2×2) with full labels, none clipped.
8. `./check` green; smoke green (update smoke's "Complete" step and say so).

## Decisions made on Emilio's behalf `(unconfirmed)`
Caption wording; button layout (row vs 2×2); "Done" for no-effort sets; "1:12 · skip" hint; set list on top; note placement.

## Built — calls `(unconfirmed)`
Caption "Log set — how did it feel?"; four buttons in one row (84×44 at 390); Previous / Skip set row above; "Done" for
no-effort sets (a commit button — DESIGN §4's ban on "Done" is for navigation); pill reads "1:30 · skip" on its own exercise
(the set count is hidden there); Enter logs nothing on effort sets; viewing a set with no rpe selects nothing. The set list
shows no effort (unchanged). `initialSetFields` still computes an unused effort 3 (workout-log.js, left untouched).
