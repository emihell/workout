# req-209 — Noa run fixes: hide developer tools, sets inline, one set format, last time on the exercise page, labels

**Status: BUILT AND MERGED, 2026-10-07 — branch `req-209` (`43bdaf7`…`33952e7`, 2 commits).** (2026-10-07). **Lane: ui.** From the "Noa" persona run on main `daaa957`: 27, designer, runner, new to the
gym, from an empty first launch. The findings are in `noa-run.md`. Planner viewed screenshots `65-backup-full` and
`43-done-detail`. Every item here is a binary fix (DEC-091/095). Behaviour questions went to Emilio separately.

## Scope
1. **Developer tools hidden.**
   - Backup & data shows only the explainer, "Back up now" and "Restore from a backup" by default.
   - The Developer group (Assistant prompt, Export analytics, Feedback notes, Components) shows only when a device flag is
     on: its own localStorage key, like `dev-notes.js`, never `workout-mvp-v9`.
   - The flag is set by opening `#/settings?dev=1`, and stays on for that device.
   - The Feedback-notes capture keeps working wherever it is enabled. `(unconfirmed)`
2. **The History detail shows sets inline.** Each exercise row reads "{name} — {kg} kg × {reps}, × {reps}, …" (kg once when
   all sets share it, else "12 kg × 10, 14 kg × 8"). A timed exercise shows durations, and skipped sets read "skipped". The
   row still opens the exercise.
3. **One set format: "{kg} kg × {reps}".** Use it on the History exercise page (it is "14 kg · 15 · Easy" today), By
   exercise and the log list. Feel words follow after " · ".
4. **The exercise page shows history.** `/exercises/:id` (from Your exercises) shows "Last time: {date} · {top set}" plus a
   link to its History › By exercise page. If there is no history, nothing is shown. It reads only finished history.
5. **The routine row shows the plan.** It reads "{sets} × {reps} · {kg} kg" (or "{sets} × {duration}"), so an edit to reps is
   visible. It replaces "3 sets · 14/14/14 kg", and keeps the slash form only when kg differ per set.
6. **Equipment labels** are consistent everywhere they show (picker, add-exercise, Exercises list): one display map, Title
   case, "Bodyweight" (never "body only"). The library file is not edited (DEC-061): this is a display mapping only.
7. **Schedule's today row** reads "Today · Done ✓" when a workout finished today, not "Rest · Today".

## Out of scope
- Progress charts, last-time on the set screen, one-date moves, reps carry, Total lifted, CSV, default days: those are
  Emilio's questions.
- Plank and timer layout.
- Destructive styling and a design-system pass (backlog).

## Acceptance
1. Browser: Backup & data has no "Developer" text by default. After `#/settings?dev=1` it shows the group, and still does
   after a reload. `workout-mvp-v9` is unchanged by the flag (receipt).
2. Browser: the History detail of the Noa-like workout reads "Dumbbell Calf Raise — 14 kg × 15, × 15, × 15".
3. Unit: one formatter is used by History exercise, By exercise and the log list, and gives "14 kg × 15 · Easy".
4. **Failure case:** an exercise with no history shows no "Last time" line. One with history shows "Last time: Oct 7 · 14 kg
   × 15" and its link.
5. Browser: after editing reps to 15 on a 4-set item, the routine row reads "4 × 15 · 14 kg".
6. Unit: the label map gives "Bodyweight" for both "body only" and "bodyweight".
7. `./check` green. **This branch's own** smoke is green on the committed sha (L-049). Screenshots go to
   `scratchpad/r209-*.png` for Emilio's look (L-050).

## Built — calls
- **Emilio saw the screenshot list and said "yes"** (L-050).
- **The build agent hit the usage limit after committing** (`43bdaf7`, `33952e7`) and wrote no report. Planner ran the gate,
  read the 7 existing-test edits (all format swaps: " · " → " × ", "3 sets" → "3 × …", and opening `/settings?dev=1`, none
  weakened), and took the screenshots itself.
- **The dev flag** is enabled by `#/settings?dev=1`.
