**Status: READY** · **Lane: bug** · DEC-092 (its two "limits kept"), DEC-051, DEC-155. Before req-264 (both touch `src/views/Routine.jsx`).

> **Decided (Emilio, 2026-10-31: "yes", DEC-155 §6):** DEC-155 overrides DEC-092's two "limits kept"; build as written.

# req-263 — History's routine editor keeps the Back chain; a stale `from` falls back

## Reproduction [measured, `main` `4c1121b`, 2026-10-31]

**1. Recalc → Workout → an exercise loses the chain.** The real route helpers, a workout opened from Today
(`/history/w1?from=/`) → Update? → Workout → an exercise, then Back at every step
(a throwaway Node script over `route.js` `parseRoute`/`childLink`, `routine-nav.js` `navForBase`, `history/return-paths.js`,
following each screen's Back as `recalc.jsx:17-19,62` and `Routine.jsx:224,327` compute it; step 1 makes it a test):

```
routine history-routine from /history/w1/recalculate?from=%2Fhistory%2Fw1%3Ffrom%3D%252F   ← chain intact here
item link    /history/w1/routine/exercise/i1                                               ← no from
item Back →  /history/w1/routine
routine Back → /history/w1/recalculate                                                       ← default, chain gone
recalc Back → /history/w1
detail Back → /history                                                                       ← should be / (Today)
```

Where: the routine screen links its inner screens with the bare `nav.item(id)` / `nav.edit` / `nav.pick` / `nav.change(id)`
(`src/views/routine-nav.js:6-22`; used `src/views/Routine.jsx:228,237,253,274,649`), and every inner exit goes to the
bare `nav.base` / `nav.item` / `nav.pick` (`Routine.jsx:327,336,342,365,368,374,582,599,602,616,680`).
`HistoryRoutine` then rebuilds `done` as `from || '/history/<id>/recalculate'` (`src/views/history/recalc.jsx:62-66`).
DEC-092 recorded this as a known limit; DEC-155 clears it.

**2. A stale `from` lands on "Not found.".** `historyDetailBack`, `historyExerciseBack`, `historySetBack`
(`src/views/history/return-paths.js:18-41`) return `from` unchecked:

```
historyDetailBack('/history/deleted-id') → /history/deleted-id   | parseRoute → history-detail
```

`HistoryDetail`/`HistoryRecalculate` for an unknown id render `<Missing>Not found.</Missing>` (`recalc.jsx:13`,
`views/shared.jsx:77-84`). DEC-092: "a stale id with a valid shape is accepted". Reached by a kept URL or browser history
after a Delete [inferred — no in-app link found that builds a `from` to a deleted workout].

## Scope

1. **The chain through the routine's inner screens.** When the history routine screen was entered with a `from`, every
   link from it to an inner screen (Edit, an exercise, Change exercise, Add exercise and its add/create screens) carries
   the chain (`childLink`, DEC-092), and every exit back "up" from an inner screen (Back, Save, Cancel, Remove, Change,
   Add) returns to the routine screen **with its `from`**, so the routine's Back → recalc → detail → where it was opened
   from (Today, a month, the overview, an exercise's history).
2. **The other three flows that share `navForBase`** (routine, schedule-slot, workout-setup: `routine-nav.js:1-5`) pass no
   `from` today and must produce the same paths as now.
3. **A stale `from`:** a History return helper drops a `from` whose route names a workout id that isn't in
   `store.workouts` (history-detail, -exercise, -set, -recalculate, -routine, -edit) and uses its fixed parent instead.

## Out of scope

- The active overview as a hub (Back → Today) — DEC-092 keeps it.
- `from` shapes outside History (exercise editor, schedule): unchanged.
- `history.back()` or timers (DEC-084).

## Steps

1. Tests first (fail on main): a pure test over the real helpers (as the reproduction: links + Backs from Today through
   recalc → routine → item → back to `/`), and the stale-`from` helper test.
2. Thread the routine screen's own `from` through `navForBase` (or the screens) — the shape is the builder's; a `null`
   `from` must yield today's exact strings (assert the old flows' paths unchanged).
3. The stale check, with the workouts handed in (the helpers stay JSX-free and pure).
4. Browser re-run on the branch (`plan qa`): Today → a done workout → an exercise's set → Save → Update? → Workout → an
   exercise → Back ×5 lands on Today.

## Acceptance criteria

1. **Fails on main, passes on the branch:** the chain test ends on `/` on the branch and on `/history` on main (both receipts).
2. **Every inner exit:** item Save, Cancel, Remove, Change exercise (both pick and Cancel), Add exercise (add and Cancel),
   routine Edit Save/Cancel — each lands on the routine screen whose Back then returns to the recalc *with* its `from`
   (one test row each).
3. **No change elsewhere:** for the routine, schedule-slot and workout-setup flows (no `from`), `navForBase`'s paths and
   every inner Back are byte-identical to main (assert, not eyeball).
4. **Failure case — stale `from`:** a History exercise screen at `/history/A/exercise/i?from=/history/B` with B deleted:
   Back goes to `/history/A`, not "Not found.". A `from` naming an existing workout is still honoured (both directions).
5. **Failure case — absent `from`:** a history routine screen opened with no `from` behaves as today (Back → the bare
   recalc).
6. Browser: the step-4 walk, 0 dialogs, the path after each Back pasted. `./check` green.

## Checks run

1. DECs grepped (`?from=`, req-171, Back chain): DEC-051, DEC-092 (rule + these two limits), DEC-084 (no history.back).
   This req applies DEC-092's rule where it lapsed; nothing reverses it.
2. Siblings: **req-264** edits `Routine.jsx` (Change exercise, Days row) — build this first, req-264 rebases. No other open
   req touches `routine-nav.js` / `return-paths.js`.
3. Deferrals: none leaned on.
4. Numbers: none.
5. Trigger files: none of `store.jsx` / `model.js` / `storage.js` / `progress.js` / `workout-log.js` → no reviewer
   required; `navForBase` is shared by four flows (criterion 3 is the domino guard). No stored data → no backup reminder.
6. (confirmed DEC-155 §4): below.

## Decisions made on Emilio's behalf

- **behaviour (confirmed DEC-155 §4):** a stale `from` falls back to the screen's fixed parent (the workout, or the History list),
  not to Today (`Missing`'s Back) and not a message.
- **implementation:** how `from` reaches the inner screens (an argument to `navForBase` vs per-screen `childLink`).
