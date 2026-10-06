# req-194 — cardio sets: stopwatch, Level, Distance

**Status: READY** (2026-10-06). **Lane: ui.** From DEC-108 §4 (G1 "Timer for duration only exercises?", G3 "Add level for
machines like stairs, row, cross fit"; Emilio picked Stopwatch, Level, Distance). After **req-193**. Set records gain optional
fields — **no migration, no rewrite**; older sets simply lack them. Trigger files: `workout-log.js` / `model.js` /
`exchange.js` if touched → reviewer.

## Code today (main `4da90e1`)
- Cardio (type 'cardio', no `hasDuration`, e.g. Stairs `db.json:95-102`) logs a typed **"Duration"** text into `reps`
  (`item.jsx:380`); no kg, no effort. Timed exercises (`hasDuration`) get a **countdown** `DurationTimer`
  (`ui/index.jsx:414-462`), logging the target. No level / distance anywhere; Emilio's data keeps distance in the note
  ("1500/6:50").
- Set record fields: weight, reps, durationSec (timed only), rpe, note (`item.jsx:252-266`). Check `exchange.js` import /
  export and History rendering pass unknown-but-valid fields through.

## Scope (ordered)
1. **Cardio set form:** **Duration** with a **stopwatch** (Start / Stop; the running time fills the duration; editable by
   hand), **Level** (optional number, e.g. 8), **Distance** (optional, with unit; m or km `(unconfirmed)`).
2. Stored on the set: duration in seconds (`durationSec`, as timed sets), `level`, `distance` (+ unit) — optional; blank →
   absent. The old typed text path: a cardio set from before keeps its `reps` text and renders as today.
3. History / set list / set edit show them ("12:30 · level 8 · 1.5 km").
4. The stopwatch survives leaving the screen and a reload (store its start time on the active workout's draft, not a
   component timer) — or, if that needs a new `activeWorkout` field, name the load path (`migrateState` → `workoutSnapshot`)
   and test a reload.

## Out of scope
Pace/calories, heart rate, a running workout clock, the timed-exercise countdown (unchanged).

## Acceptance
1. Browser: Stairs → Start → wait ~3 s → Stop → duration ≈ 3 s shown → Level 8 → Done → stored `durationSec`, `level: 8`
   (receipt).
2. Reload while the stopwatch runs → still running from the same start (receipt: elapsed keeps counting).
3. **Failure case:** Level "abc" → inline error, nothing stored; all optional fields blank + a typed duration → stored with
   no level/distance keys.
4. An old cardio set (`reps: "20 min"`, no durationSec) still renders "20 min" in History.
5. Export → Import round-trip keeps `level` / `distance` (unit test via `exchange.js`).
6. `./check` green.

## Decisions made on Emilio's behalf `(unconfirmed)`
Distance unit; display format; stopwatch persistence approach.
