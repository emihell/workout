**Status: BUILT AND MERGED, 2026-10-31 — branch `req-274` (`3bc23f4`…`608654d`, 7 commits).** · **Lane: bug** · DEC-155 §4 (Sets 1–20), DEC-155 §6 (stale `from`), DEC-096 (routine kg), req-261/262/263 review latents. Touches `src/workout-items.js`, `src/history-queries.js`, `src/model.js` → independent reviewer (WORKFLOW check 5). No migration or bulk rewrite → no backup reminder (Apply already writes the routine; this only stops it writing invented `0`s).

# req-274 — four latent workout-data bugs from the req-261/262/263 reviews

All reproduced on `main` `5798ae2` (probes in Planner's scratchpad `r274/`, `node <probe> <repo>`). The duration-target
misreads (BACKLOG "Duration targets the rule still misreads") are **not** here — see Out of scope.

## Reproduction

**(a) Sets pass 20 through "Add set" and history.** `addWorkingSetToState` (`src/workout-items.js:104`) has no cap, and
`historyPrescription` (`src/history-queries.js:230-262`) copies `sets: work.length` (`:254`) into whatever is built from
history — new routine items, swaps, mid-workout adds, routine-kg fill (callers: `state-reducers.js`, `routine-picker.js`,
`routine-kg-fill.js`, `routine-item-change.js`, `views/Routine.jsx`):

```
(a) sets after Add set on a 20-set item: 21
(a) historyPrescription sets: 21
```

The editor then refuses to save that item ("Sets must be a whole number from 1 to 20.", req-261) and `plan build` C4
refuses it when touched.

**(b) Key-less snapshot items lose their sets after a reload.** `migrateState` re-keys a set with no `routineItemId` to
`history-<workoutId>-<exerciseId>` (`src/model.js:175-179`, `:246-250`) but leaves the snapshot items key-less, so
`setsForItem` (`src/workout-items.js:14-23`) — whose key-less rule needs `!set.routineItemId` — matches nothing:

```
(b) before load: setsForItem [ 2, 1 ]
(b) after migrateState: set keys [ 'history-wk-ex-x', 'history-wk-ex-x', 'history-wk-ex-y' ] | item keys [ [undefined,undefined], [undefined,undefined] ] | setsForItem [ 0, 0 ]
```

Reached by a stored or imported workout whose routine is gone and whose items carry no id (`model.js:136`); req-262 fixed
only the in-session half.

**(c) Apply writes `suggestedWeights: [0]` on bodyweight items.** `progressionForItem` (`src/model.js:452-486`) returns the
recommendation's kg for every non-cardio item; `applyProgressionToRoutines` (`:416-438`) writes it:

```
(c) bodyweight timed: to [0] targetsTo ["45s"] writes true → routine {"targets":["45s"],"suggestedWeights":[0]}
(c) bodyweight: to [0] targetsTo ["10"] writes true → routine {"targets":["10"],"suggestedWeights":[0]}
```

The routine item had `[]`. Hidden on screen (`isWeightedType`, `src/ids.js:58-60`, hides kg for bodyweight/cardio) but it
is data the user never entered (CLAUDE.md: "the app never invents data"), the class req-262 removed for cardio.

**(d) `historyAddSetBack` returns a stale `from` unchecked.** `src/views/history/return-paths.js:72-78`: a `from` of route
`history-workout-exercise` is returned as is; req-263's `liveFrom` (`:27-33`) is not applied:

```
(d) parseRoute(from).name = history-workout-exercise
(d) historyAddSetBack("w1","i1",true, "/history/gone/exercise/i9") → /history/gone/exercise/i9
(d) liveFrom(from,[{id:"w1"}]) → null
```

Back after adding a set then lands on "Not found." when that workout was deleted. Caller: `views/history/edit.jsx:138`.

## Scope

1. **(a)** "Add set" never takes an item past `MAX_SETS` (`src/routine-item-parse.js:23`): `addWorkingSetToState`
   returns the state unchanged at the cap, and the log screen's "Add set" (`views/workout/item.jsx:942-954`) is not shown
   for an item at the cap. `historyPrescription` clamps to `MAX_SETS`: `sets`, `targets`, `suggestedWeights` keep the
   first 20.
2. **(b)** A key-less item (no `id`, no `routineItemId`) also matches a set whose `routineItemId` is migrate's fallback for
   its exercise (`history-…` prefix and `set.exerciseId === item.exerciseId`). Read-side only: no stored key is added or
   changed. Every other set↔item matcher with its own rule (e.g. `progressionForItem`'s `workSets`, `model.js:461-464`)
   uses the same helper; list them in the report.
3. **(c)** For a non-weighted exercise (`!isWeightedType(exercise.type)`), `to` is the item's own `suggestedWeights`;
   targets still come from the recommendation (bodyweight reps progression unchanged). Cardio keeps req-262's
   `writesRoutine: false`.
4. **(d)** `historyAddSetBack` takes `workouts` and runs `liveFrom` on that `from`; `edit.jsx` passes `store.workouts`.
   Without `workouts`, today's behaviour (as req-263's helpers).

## Out of scope

- **Duration-target misreads** ("45s each side", "30s/side", "60s x2", "1:30", "30 sek" not durations; "tempo 3s",
  "AMRAP 45s", "hold 30s" are). Two reasons: (1) req-256 (built, server-held for AC2) edits the same `isDurationTarget`
  (`src/progress.js:89-92`) and isn't on main yet — main still reads "12 reps" as a duration; (2) the rule is a visible
  label trade-off for Emilio. Planner's measured candidate ("a target that *leads* with a number/range + time unit, or
  m:ss") fixes the first five and the Swedish units but flips "AMRAP 45s", "hold 30s", "10 x 30s", "2 sets of 10s" to Reps
  and "3s pause", "12:30" to Duration; it changes none of `src/db.json`'s 16 distinct targets. → its own req after
  req-256 merges.
- Rewriting stored keys (b); any change to what Apply writes for weighted items; the editor's uncapped per-set row layout
  (req-261 review nit).

## Steps

1. One failing test per part, on main.
2. (a) cap + clamp; (b) the shared matcher; (c) the non-weighted `to`; (d) `liveFrom` + the caller.
3. Browser run on `plan qa` (L-069: seed current-shape data via `workout-mvp-v9`): a 20-set item shows no "Add set";
   Apply on a bodyweight workout leaves the routine's `suggestedWeights` `[]`.

## Acceptance criteria

1. **(a)** Add set on a 20-set item → 20, state identical; `historyPrescription` over 21 logged sets → `sets: 20`, 20
   targets/weights (the first 20). Fails on main.
2. **(a) failure case:** a 19-set item still gets its 20th set; an item with no `sets` still adds (counts as 1).
3. **(b)** The probe's two items → `[2, 1]` after `migrateState`. **Failure case — no false match:** a keyed item never
   takes a `history-…` set of another exercise, and two keyed items keep exactly today's counts (deepEqual against main
   over `src/db.json`'s finished workouts).
4. **(c)** Timed and plain bodyweight Apply → routine `suggestedWeights` `[]` (unchanged), targets updated as today; a
   weighted item's `to` byte-identical to main's.
5. **(d)** `from` at a deleted workout's exercise → the detail/exercise fallback, no "Not found." (rendered); a live `from`
   unchanged.
6. `./check` green (count stated), smoke green; test edits called out.

## Decisions made on Emilio's behalf

- (confirmed DEC-155 §10) (a): at 20 sets "Add set" is not shown (no message); history-built items keep the first 20 sets.
- implementation: (b) read-side matcher instead of re-keying stored items; (c) via `isWeightedType`.

## Siblings

req-256 (server-held) and the follow-up duration req touch `progress.js`; this req doesn't. req-264 (building) touches
`views/Routine.jsx` and `routine-item-change.js` — read-only here (callers of `historyPrescription`); build after it merges.
