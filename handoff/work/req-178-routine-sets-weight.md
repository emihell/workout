# req-178 — The routine sets the workout's weight

**Status: BUILT, NOT merged** (Q1 → (a) overwrite, DEC-100 `(unconfirmed)`; Emilio's eyes waived for this batch, DEC-100 — dry run on his Export still required and pasted). **Lane: data** (bulk write of stored routines) — the
gate is the data lane's: round-trip + legacy-key tests, independent reviewer, dry run on Emilio's latest Export, backup
reminder (DEC-046), **Emilio's eyes before merge** (DEC-035 carve-out). Source: DEC-096 (don't relitigate), DEC-099 §3.
Siblings (build order): **req-178** → req-179 routine form → req-180 picker → req-181 slot templates. 179 edits the same
`ExerciseFields` (`Routine.jsx:300`); 180 adds items without the form and must use Change 2's history kg. **Planner 2026-09-26: built last**, after 179→180→181 merge, on top of them.

## Open question (Emilio)
**Q1 — the one-time fill (DEC-096 §6): what does it do to a routine item that already has a kg?**
- **(a) Overwrite with latest history** where history has a kg at that set. Planner recommends this: today the gym form
  shows history and ignores the routine (`item.jsx:348-366`), so (a) keeps the next workout's numbers identical to what
  you'd see today. Routine kg you typed but never used is replaced.
- **(b) Fill blanks only.** Items with any kg keep it, so a stale routine number becomes the workout's kg on ship day.
The dry run (step 5) prints the count for **both**, so you see the difference on your own data before choosing.

## Today [read 2026-09-26]
- **The live kg ignores the routine.** `WorkoutItemLive` seeds from `lastSetsForExercise` (`item.jsx:172`) →
  `historySetPrefill` (`item.jsx:348`) → `initialSetFields`/`setLogSeed` (`workout-log.js:522`, `:459-470`): weight =
  draft > session override (DEC-052) > carry (DEC-002, only when history has no set at that index) > history. The
  snapshot's `suggestedWeights` is only written as `targetWeight` on the logged set (`item.jsx:243-246`). The
  start-of-exercise preview uses the same chain (`setPreview`, `workout-log.js:700-730`).
- **The snapshot already carries the routine kg**: `buildPlannedWorkout` copies `suggestedWeights` (`model.js:438,455`),
  built at Start (`state-reducers.js:280`). Add set appends the last kg (`withOneMoreSet`, `workout-log.js:37-49`).
  A mid-workout replacement has `suggestedWeights: []` and relies on history (`replacementItem`, `workout-log.js:228-249`).
- **Adding an exercise to a routine already prefills kg from history**: `RoutineExerciseNew` →
  `historyPrescription(store.workouts, ex.id)` → `suggestedWeights` (`Routine.jsx:410-417`, `history-queries.js:211-229`).
  DEC-096 §2 is built; this req pins it with a test.
- **Load recommendation (`progress.js`) never reaches the live seed.** Its one importer is `model.js:2`;
  `recommendNextPrescription` runs only in `progressionForItem` (`model.js:380-407`) → `recalculatedState`
  (`model.js:419`) → History "Update?" → Apply (`recalc.jsx:41`, `store.jsx:183`). It writes kg/targets onto the routine
  (`applyProgressionToRoutines`, `model.js:344-366`) — which today changes nothing in the gym.
- **"Last time" beside the plan:** none exists (removed by req-104, `item.jsx:528`). `grep -rni "last time" src/views`
  hits only Finish's beat line (`finish.jsx:55`) and the auto-complete summary (`auto-complete.jsx:84`) — post-workout.
- **Load-time one-off pattern exists:** `withDefaultAnchor` fixes a stored value once in `loadState` and saves
  (`persistence.js:182-192`). `SCHEMA_VERSION = 9` (`model.js:5`), key `workout-mvp-v9` (`persistence.js:7`); a
  non-v9 value is treated as legacy and gets backfills (`persistence.js:180`) — so a v10 bump is not a cheap option.
- **Scale [measured on `src/db.json`, seed data, not his real store]:** a scratch script (`migrateState(db,{legacy:true})`,
  then `historyPrescription` per item) printed `{ routines: 3, items: 24, blankRoutine: 9, withHist: 15, noHist: 9,
  differ: 12 }` — 12 of 24 items would change under (a). Real counts come from step 5 on his Export.

## Change
1. **Workout kg = the snapshot item's kg for that set** (`suggestedWeights[workIndex]`, frozen at Start). New work-set
   chain: draft > session override (DEC-052) > **routine kg at that index (> 0)** > session carry (DEC-002/req-152, only
   when the routine has no kg there) > blank. History no longer seeds a work set's kg. Blank in the routine → blank.
   The preview (`setPreview`) follows the same chain. Reps unchanged (target).
2. **Adding to a routine prefills kg from latest history** — already so (`Routine.jsx:416`); keep it, test it.
3. **"Update routine" offer, inline, after an exercise's last set.** On the workout overview, under that exercise's done
   row (`overview.jsx:162-167`): e.g. **"You did 105/105/100 kg. Routine: 100/100/100. [Update Day A]"**. Shown only
   when some logged non-skipped work-set kg differs from the **live routine** item's kg at that index. One tap writes
   through the normal edit path (`routineItemUpdated`, `state-reducers.js:201`) to **that routine's item only** (§4).
   Not shown: nothing differs, all skipped, a mid-workout replacement (`addedMidWorkout`), the routine or item deleted,
   an unweighted exercise. Ignoring it changes nothing; Finish still never writes the routine (DEC-056).
4. **No "last time" beside the plan** (§5) — nothing to remove; don't add one.
5. **One-time fill** (§6, rule per Q1): a pure `fillRoutineKgFromHistory(state) → { state, changes }`, run once in
   `loadState` after migrate (the `withDefaultAnchor` pattern), guarded by a stored marker (`routineKgFilledAt`, ISO
   time) so it never runs twice; saved once. Per item: weighted exercise with `historyPrescription` kg → for each set
   `i < min(sets, history sets)` with history kg > 0, `to[i] = history[i]` (under (b): only items with no kg > 0). Other
   positions, items and fields untouched. A node script `scripts/fill-routine-kg.mjs <export.json>` runs the **same
   function** read-only and prints each change (`routine · exercise · from → to`) and totals for (a) and (b).
6. **Rule text rewritten** so docs match code on ship day (DEC-096 closing line). See step 8 for who edits which.

## Out of scope
- Showing numbers on History's "Update?" screen (DEC-056 correction). **Note for Emilio:** after this, Apply there
  changes next workout's kg (it writes `progress.js`'s step-up onto the routine), still blind. Backlog it.
- Using `progress.js` in the update offer (it offers what you did, not a step-up — see (unconfirmed) 2).
- Rewriting finished workouts, the active workout's snapshot, or `targets`/reps/rest. Schema version bump.
- The routine form's fields (req-179), the picker (req-180), templates (req-181).

## Steps
1. **Seed:** add the routine kg input to `setLogSeed`/`initialSetFields` (`workout-log.js:459,522`) with the chain
   above; pass `item.suggestedWeights[currentWorkIndex]` from `item.jsx:356` and from `setPreview`. Keep the warm-up
   branch on history (see (unconfirmed) 1). Update the existing `setLogSeed` tests whose expectation encodes "history
   kg" (`workout-log.test.js:356-440`, `req-152.test.js:36-67`) — **each edit named and justified in the report**.
2. **Replacement:** `replacementItem` gets `suggestedWeights` from the exercise's `historyPrescription` first set
   (`workout-log.js:228`, caller `state-reducers.js:125`) — the §2 rule applied to a mid-workout add.
3. **Offer:** a pure `routineUpdateOffer(active, routines, item)` → `{ routineId, index, from, to } | null` (unit-tested),
   rendered inline on the overview; a store action applies it via `routineItemUpdated`.
4. **Fill:** `fillRoutineKgFromHistory` + marker in `loadState`; confirm the marker survives `migrateState`
   (`...source`, `model.js:288`) and `buildBackup`/`applyBackup` (`exchange.js:132,264`) [inferred — verify].
5. **Dry run:** `scripts/fill-routine-kg.mjs` against `src/db.json` in the report; Planner runs it on Emilio's latest
   Export (kept outside git) and shows him the output **before merge** (ask-gate #2).
6. `README.md` §Recommendation rules / model lines (`README.md:14,19`) and the assistant text `exchange.js:50` ("Finish
   never changes the routine; only an explicit History recalculation writes…") — add the offer.
7. `./check`.
8. **Rule text — every place it is stated:** Builder rewrites `.cursor/rules/history-prefill.mdc` (whole file) on the
   branch. Planner rewrites at closeout (handoff/ is read-only to Builder): `CLAUDE.md:32-37` (a symlink to `handoff/CLAUDE.md`), `rules/DESIGN.md:33-48`
   (§1 bullet 2 and "The test"), `rules/DESIGN.md:143-144`, `rules/AUDIT.md:78`, `PLANNING.md:442-444`, and the
   DECISIONS index line 52 (DEC-052/082 "never the routine's number"). New wording: *the workout's kg is the routine's
   kg, a number the user typed or confirmed; the routine gets it from history when an exercise is added, and from the
   user's confirmed update after an exercise.*

## Acceptance criteria
1. Seed: routine `[60,65,70]`, history `[50,50,50]` → sets 1–3 seed `60/65/70` (unit, through `initialSetFields`).
2. **Right mechanism:** routine kg `70` and history kg `70` agree — a test sets history `50` to prove the routine answers.
3. **Failure — empty input:** routine kg blank, history `[80]` → set 1 kg blank; log `40` → set 2 seeds `40` (carry/override).
4. Preview lines equal each set's form seed for the same inputs (unit).
5. Offer: logged `[105,105,100]` vs routine `[100,100,100]` → offer `to [105,105,100]`; applying changes Day A's item
   only, Day B's same exercise unchanged. Equal kg / all skipped / replacement / deleted routine → `null`.
6. Fill: a v9 state without marker → changes as specified, marker set; loaded again → no changes (idempotent).
7. **Migration test:** a `workout-mvp-v8` key loads → migrated, filled, saved to v9; every workout and set equal before
   and after (deepEqual), only `suggestedWeights` of listed items changed; the v8 key is removed only after read-back.
8. **Failure — no history:** an exercise never logged, and a bodyweight exercise → untouched by the fill (unit).
9. `node scripts/fill-routine-kg.mjs src/db.json` output pasted; counts match the scratch measure above (12 under (a)).
10. Browser (`plan qa`): routine kg 50, history 40 → Start → set 1 shows 50; log 55 → overview offers the update →
    tap → routine shows 55. `./check --smoke` green.

## Decisions left to Builder (implementation)
Helper names/files; marker name; where the offer's store action lives; the script's output format.

## Planner's behaviour calls — (unconfirmed), on Emilio's list
1. **Warm-up set kg stays from history** — the routine holds no warm-up kg (`warmup: {reps}`), so otherwise it's
   always blank. DEC-099 §3 stops new warm-up sets anyway.
2. **The offer carries back the kg you logged**, not `progress.js`'s next step ("carries a new weight back", DEC-096 §3).
3. **Session carries stay layered over the routine kg** (DEC-052 override, DEC-002 carry) — DEC-096 is silent on them.
4. **Replacement exercise's kg from its history** (step 2); **added set beyond the routine's length** takes the
   appended last kg (`withOneMoreSet`) unless overridden.
5. Offer wording and placement (ui; iterates in QA). Offer compares to the live routine, not the Start snapshot.
6. The fill runs on first load of the new build on each device; a live workout across the update keeps its old
   snapshot — Planner's backup reminder also says "finish or abandon any live workout first".

READY checks: DECs grepped — 002, 052, 056, 082 §2, 093, 096–099. Trigger files: `workout-log.js`, `persistence.js`,
`store.jsx` (+ `model.js` if touched) → **independent reviewer + backup reminder** before merge. Bulk write → ask-gate #2:
dry-run counts shown to Emilio first. Deferral re-priced: History "Update?" now affects the gym (Out of scope note).
