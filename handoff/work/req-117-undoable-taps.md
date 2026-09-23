# req-117 — taps you can take back: extra set removable, timed Previous keeps its time, History Add set on Save (audit F)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[ux-feel]** + **[P]**: touches `workout-log.js`
and the history write path (DEC-057: reviewer + backup reminder).

## Why [measured, scratchpad/audit-gym/pure.mjs; history item from a code read]

1. "Add set" on a done exercise grows the snapshot's set count right away and un-marks it
   (`item.jsx:469-478`, `workout-log.js:26-57`); there is no remove. Leaving it unlogged makes the workout "not
   done" and writes a skipped set at Finish (`['8','8','skipped']`). The button is the first control on the done
   view, above the title.
2. Previous on a timed set: `restoreFromLoggedSet` doesn't restore `durationSec` (`item.jsx:132-142`), and the form
   starts from the target (`:400`), breaking DESIGN §5.
3. History "Add set" (`history/helpers.js:81-120`) writes a placeholder set (`weight: last?.weight || 0,
   reps: ''`) before the edit form opens. Cancel never removes it, so it counts in "N sets" and feeds prefill
   (reps `''` isn't "skipped").

## The behaviour

1. An **extra set that hasn't been logged yet** shows a **Remove set** control on its log screen **(unconfirmed)**.
   "Extra" is persisted: Add set increments a snapshot-item field (e.g. `addedSets`, carried through
   `migrateState` → `workoutSnapshot` by its spread, WORKFLOW check 5). Remove pops the last set **and** the target
   and weight `withOneMoreSet` appended (`workout-log.js:26-36`), decrements the field, and the done state is
   recomputed (all remaining planned sets logged → done). Only the last, unlogged, added set can be removed.
2. The done view puts the exercise title above Add set (a markup order fix, BACKLOG req-104 follow-up).
3. Previous on a timed set restores the logged duration.
4. History "Add set" opens the form **without writing**, on a new route (today's `/history/:id/set/:index` needs an
   existing set, `helpers.js:119`). The set and snapshot item are created only on Save. Cancel leaves the record
   unchanged.

## Scope

`item.jsx`, `workout-log.js`, `ui/index.jsx` (SetLogForm initial duration if needed), `history/helpers.js`,
`history/edit.jsx`, `set-edit.jsx`, `route.js` + `App.jsx` (the new History add route), tests. Logic under test goes
in pure `.js` helpers (`restoreFromLoggedSet` moves out of `item.jsx`).

## Order vs siblings

After req-116 (same `item.jsx` / `overview.jsx` / `workout-log.js` / `route.js`), before req-119.

## Acceptance criteria

- **Remove (unit + browser):** done exercise → Add set → Remove set → the exercise is done again; Finish writes no
  skipped set for it.
- **Timed Previous (unit):** log 50 s → Previous → the form shows 50 s, not the target.
- **Failure case — History Cancel (unit):** Add set → Cancel → the workout deep-equals before.
- **History Save (unit):** Add set → enter 40×8 → Save → exactly one new set.
- **No regression:** `./check` green. Receipt quoted.

## Decisions

- "Remove set" on an unlogged extra set **(unconfirmed)**: the lightest undo; no timer toast.
