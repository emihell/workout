# req-130 — our own exercise library (a copy of free-exercise-db, extended) + the RepDB credit

**Status: BUILT AND MERGED, 2026-09-24 — branch `req-130` (`ff3dc9e`…`5485bc0`, 2 commits).** — Phase 1 (pulled forward from Phase 3 "own exercise DB", Emilio 2026-09-24, DEC-060). Data +
catalog plumbing; the only UI is the credit line. **Gate: persisted-data (additive).** Adds one optional field to
stored exercises (`libraryId`, new adds only). **Not an ask-gate #2 case:** Emilio approved this spec 2026-09-24
("sounds good"), and it is an additive optional field written only through the normal add path, with no schema
bump, no migration and no rewrite of existing records. DEC-057 §1 **fires** (it touches `exercise-names.js`, the
record builder `store.addExercise` uses): independent reviewer + backup reminder before merge. Spec reviewed
independently 2026-09-24 (10 findings, all folded in). First of four: req-131 "How to" button, req-132 one Add
screen, req-133 content pass (BACKLOG §Exercise library).

## Why [measured 2026-09-24, planning + reviewer]

- Search fetches two live sources (`exerciseCatalog.js:3-4`): **free-exercise-db** (876 entries, 876 unique ids,
  873 with a start/end photo pair, **Unlicense**, `@main` byte-identical to commit
  `a859101d633a01c4a1a920d6a8ce41dabba0705f`) and **RepDB** (601 entries, flat illustrations; free tier = in-app
  use **with a visible credit**, no republishing a modified/derived dataset, no using its images as reference for
  generative models — `LICENSE-DATA.md` terms 2, 3, 5). Our repo is **public**.
- **The app shows no RepDB credit today**, so licence term 2 is unmet.
- `catalogItemToExercise` (`exerciseCatalog.js:124`) drops the entry's id and images, and `exerciseFromData`
  (`exercise-names.js:44-57`, called by `store.jsx:150-154`) builds the record from a fixed field list, so an
  added exercise can't be linked back to its pictures.
- Only 3 of the 22 seed exercises (`src/db.json`) match a free-db name exactly (Plank, Push-Ups→Pushups, Leg
  Press); the seed predates the catalog (`576df14` 2026-08-29 vs `e2fb330` 2026-08-30). free-db has no alternative
  names; every entry has primary muscles from a set of 17, but no coarser group.
- Load/backup already pass unknown exercise fields through: `migrateState` spreads `...exercise` (`model.js:276`);
  `buildBackup`/`applyBackup` go through the same `migrateState`.

## The behaviour

1. **Our library file** — a copy of free-exercise-db's `dist/exercises.json` at the pinned commit, provenance and
   licence recorded beside it, with `EXTRA_EXERCISES` folded in. Search reads **this** instead of the free-db CDN
   JSON. RepDB stays a live fetch, used unmodified, exactly as today. **`mergeCatalogs` dedupe stays name-only**
   (never on aliases), so RepDB's "Lat Pulldown", "Leg Extension" etc. still appear.
2. **Ids are permanent** (they become stored data): free-db entries keep free-db's `id` unchanged, extras keep
   `extra-*`, new entries of ours use `own-*` (e.g. `own-hanging-knee-raise`). An id is never renamed or reused.
3. **Added per entry (all ours):**
   - `aliases` — **this req: the 22 seed names verbatim** (table below) + the extras' existing aliases. Aliases for
     the rest of the library are req-133's content pass. English only.
   - `muscleGroups` — derived from `primaryMuscles` by one fixed table: Chest ← chest · Back ← lats, middle back,
     lower back, traps, rhomboids · Shoulders ← shoulders, neck, rear delts · Arms ← biceps, triceps, forearms ·
     Legs ← quadriceps, hamstrings, glutes, calves, abductors, adductors · Core ← abdominals. (rhomboids and rear
     delts come from the extras **(unconfirmed)**.) Derived by script/test, not hand-typed.
   - `photos` — the free-db image URLs pinned to the commit
     (`https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@a859101d633a01c4a1a920d6a8ce41dabba0705f/exercises/<path>`).
   - **No RepDB data of any kind in our file**, links included (reviewer finding 8: a committed id→image mapping
     in a public repo is arguably a derived dataset). req-131 joins RepDB pictures **at runtime** from the live
     fetch.
4. **Adding from Search saves `libraryId`** on the new exercise — **only for entries from our library file**. A
   RepDB-only hit (`repdb-*`) and manual add save **no** key (absent, never `null`/`''`). Existing exercises are
   not touched. `libraryId` is **kept on rename** **(unconfirmed)**; changing the link is req-132's "Link to
   library".
5. **One resolver** `libraryEntryFor(exercise, library)`: `libraryId` found in the library → that entry; not found
   → fall through to exact name key → alias key → `null`. Keys compare with `catalogNameKey`. No fuzzy/closest
   guess. The 22 seed names resolve per this table (confirmed 2026-09-24):

   Rowing → Rowing, Stationary · Chest Press → Leverage Chest Press · Lat Pulldown → Wide-Grip Lat Pulldown ·
   Shoulder Press → Machine Shoulder (Military) Press · Biceps Curl → Machine Bicep Curl · Triceps Press → Dip
   Machine · Ab Machine → Ab Crunch Machine · Plank → Plank · Push-Ups → Pushups · Stairs → Stairmaster · Leg
   Press → Leg Press · Leg Extension → Leg Extensions · Leg Curl → Seated Leg Curl · Abduction → Thigh Abductor ·
   Adduction → Thigh Adductor · Calf Raises (Leg Press) → Calf Press On The Leg Press Machine · Incline DB Press →
   Incline Dumbbell Press · One-Arm DB Row → One-Arm Dumbbell Row · Overhead DB Press → Dumbbell Shoulder Press ·
   Pull-Ups (BW) → Pullups · Dips (BW) → Dips - Triceps Version · Hanging Knee Raises → **"Hanging Knee Raise",
   a new entry of ours** (`own-hanging-knee-raise`, alias "Hanging Knee Raises"), with instructions **written by
   us** (free-db's Hanging Leg Raise as the base, adapted to bent knees), so it doesn't replace RepDB's entry in
   Search with an empty one.
6. **Search matches aliases properly.** Fix the existing quirk (`exerciseCatalog.js:97` splits aliases on
   whitespace, so a multi-word alias equal to the query never scores as an exact alias hit): an alias key equal to
   the query key scores like an exact name.
7. **RepDB credit** — the exact line "Exercise data by RepDB (repdb.co)", linked to https://repdb.co, in
   **Settings** (the licence's "about/credits screen") and on the **Search** screen.

## Scope

`src/exerciseCatalog.js` (+ tests), `src/exerciseExtras.js` (folded in), the new library file(s) + derive script,
`src/exercise-names.js` `exerciseFromData` (copy `libraryId` only when present), `src/views/Exercises.jsx` (pass
`libraryId` on add, credit), `src/views/Settings.jsx` (credit), `vite.config.js` if the chunk warning needs it.
Load with `import('./<file>.json', { with: { type: 'json' } })` — the plain form throws
`ERR_IMPORT_ATTRIBUTE_MISSING` under `node --test`; avoid `public/` + `fetch` (no `import.meta.env.BASE_URL` in
node tests). Expect a ~870 kB (≈163 kB gzip) separate chunk and a >500 kB warning: raise `chunkSizeWarningLimit`
for it or accept the warning, and say which.

## Out of scope

- The "How to" button, any picture on screen, the runtime RepDB picture join (req-131). The merged Add screen and
  "Link to library" (req-132). Aliases beyond the 22 + extras, descriptions, tips, rewritten instructions (req-133).
- Our own images (BACKLOG). Copying the 1,746 photos into the repo (link to the pinned CDN).
- Back-filling `libraryId` on stored exercises (a bulk write; the resolver makes it unnecessary).
- Swedish names.

## Ordered steps

1. Copy the pinned free-db JSON + provenance; fold in the extras; point `loadExerciseCatalog` at it (lazy chunk).
2. Derive `muscleGroups`; add the 22 aliases; add `own-hanging-knee-raise` with our instructions; add `photos`.
3. Alias scoring fix in `searchExerciseCatalog`.
4. `libraryId` through `catalogItemToExercise` → `exerciseFromData`; resolver + tests.
5. RepDB credit on Settings + Search.

## Acceptance criteria (written before implementation)

- **Own copy:** every free-db entry at the pinned commit is present with its `id` and free-db fields unchanged
  (test compares against the pinned source); count = 876 + extras + 1; provenance + Unlicense recorded.
  `loadExerciseCatalog` makes **no** request to the free-db CDN JSON (stubbed-fetch test).
- **Ids:** unique across the library; extras `extra-*`, ours `own-*`. Test.
- **Search:** `exerciseCatalog.test.js` passes **unedited** (any edit called out and justified). Queries that fail
  today and must pass via aliases (test): "ab machine" → Ab Crunch Machine first; "stairs" → Stairmaster first;
  "biceps curl" → Machine Bicep Curl first; "triceps press" → Dip Machine first; "leg curl" → Seated Leg Curl
  first; "hanging knee raises" → Hanging Knee Raise first. RepDB "Lat Pulldown" and "Leg Extension" still in the
  merged list.
- **Alias integrity:** an alias key is on at most one entry and never equals another entry's name key. Test.
- **Groups:** the table covers every `primaryMuscles` value in the library, extras included (test fails on an
  unmapped one); every entry with a primary muscle has ≥1 group.
- **Resolver:** all 22 seed names → the table above; unknown name → `null`; a found `libraryId` wins over the
  name; an unknown `libraryId` falls through to name/alias. Test.
- **No RepDB data:** the library file contains no `repdb` ids, no `repdb` URLs and no RepDB fields
  (`description_*`, `tips_*`, `instructions_*`, `name_*`). Test.
- **Stored data:** add from a library hit saves `libraryId`; a RepDB hit and manual add save no key;
  `migrateState` output for the same input store is identical on `main` and on the branch (deepEqual over a store
  with and without `libraryId`); `buildBackup` → `applyBackup` round-trips `libraryId`. Test.
- **Credit:** visible in Settings and on Search (`npm run shot` screenshots).
- **Bundle:** `npm run build` output pasted: the library in its own chunk, main chunk size before/after.
- `./check` green; paste the line.

## Decisions made on Emilio's behalf

- behaviour, confirmed 2026-09-24: English-only; the muscle-group table; the 22-name table; a new Hanging Knee
  Raise entry; credit on Search + Settings.
- behaviour **(unconfirmed)**, from the spec review: rhomboids → Back, rear delts → Shoulders; `libraryId` kept on
  rename; aliases for the whole library moved to req-133 (sizing); RepDB pictures joined at runtime (req-131)
  instead of stored links (no visible difference).
- implementation: file location/shape, the derive script, chunk-warning handling — builder's call.

## Notes

The line with RepDB (DEC-060): read for **what kinds of fields** are worth having, never for content; nothing from
RepDB is committed. Our text comes from free-db's public-domain instructions + general training knowledge.
Reviewer's alternatives, not taken (the table is confirmed): Parallel Bar Dip for Dips, Step Mill for Stairs,
Lying Leg Curls for Leg Curl, Leverage Shoulder Press for Shoulder Press.
