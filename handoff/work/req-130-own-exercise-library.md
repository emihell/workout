# req-130 — our own exercise library (a copy of free-exercise-db, extended) + the RepDB credit

**Status: READY** — Phase 1 (pulled forward from Phase 3 "own exercise DB", Emilio 2026-09-24, DEC-060). Data +
catalog plumbing; the only UI is the credit line. Adds one **optional** field to stored exercises (`libraryId`,
new adds only): no schema bump, no migration, no rewrite of existing records. Touches `store.jsx` if `addExercise`
filters fields, so DEC-057 §1 applies (reviewer + backup reminder before merge). First of four:
req-131 "How to" button, req-132 one Add screen, req-133 text pass (BACKLOG §Exercise library).

## Why [measured 2026-09-24, planning]

- Search fetches two live sources (`exerciseCatalog.js:3-4`): **free-exercise-db** (876 entries, 873 with a
  start/end photo pair, **Unlicense**, commit `a859101d633a01c4a1a920d6a8ce41dabba0705f`) and **RepDB** (601
  entries, flat illustrations; free tier = in-app use **with a visible credit**, no republishing a modified
  dataset, no using its images as reference for generative models — its `LICENSE-DATA.md` terms 2, 3, 5).
- **The app shows no RepDB credit today** — licence term 2 is unmet.
- `catalogItemToExercise` (`exerciseCatalog.js:125`) keeps name/equipment/muscles/cues and drops the entry's
  id and images, so an added exercise can't be linked back to its pictures.
- Only 3 of the 22 seed exercises (`src/db.json`) match a free-db name exactly (Plank, Push-Ups, Leg Press);
  the seed predates the catalog (`576df14` 2026-08-29 vs `e2fb330` 2026-08-30). free-db has **no alternative
  names**; it has 17 specific muscles on every entry but no coarser group.

## The behaviour

1. **Our library file** — a copy of free-exercise-db's `dist/exercises.json` at the commit above, with its
   provenance and licence recorded beside it, plus `EXTRA_EXERCISES` folded in. Search reads **this** instead of
   the free-db CDN JSON. RepDB stays a live fetch, used unmodified, as today (its extra ~499 names still show).
2. **Added per entry (all ours):**
   - `aliases` — real gym names for the movement, **English only**. Must include the 22-seed
     table below. Search matches aliases (it already scores an `aliases` field, `exerciseCatalog.js:~92`).
   - `muscleGroups` — derived from `primaryMuscles` by one fixed table: Chest ← chest ·
     Back ← lats, middle back, lower back, traps · Shoulders ← shoulders, neck · Arms ← biceps, triceps,
     forearms · Legs ← quadriceps, hamstrings, glutes, calves, abductors, adductors · Core ← abdominals.
     A script/test derives it; not hand-typed.
   - **picture links** — the free-db photo URLs, pinned to the commit (`cdn.jsdelivr.net/gh/yuhonas/
     free-exercise-db@<sha>/exercises/<path>`), and, where the same movement exists in RepDB, the RepDB
     illustration URLs (start/peak) + its id. **Links only** — no RepDB text or fields enter our file. A RepDB
     link is set only on an exact name-key match or a curated pair; an ambiguous match gets **no** link (a
     wrong picture is worse than none, DESIGN §1).
3. **Adding from Search saves `libraryId`** (the entry's id) on the new exercise. Manual add saves none.
   Existing exercises are **not** touched; req-131 resolves them at read time (below).
4. **One resolver** `libraryEntryFor(exercise, library)` — `libraryId` → exact name key → alias → `null`.
   No fuzzy/closest guess. The 22 seed names resolve per this table (picks marked `?` were planning's, confirmed):

   Rowing → Rowing, Stationary · Chest Press → Leverage Chest Press · Lat Pulldown → Wide-Grip Lat Pulldown ? ·
   Shoulder Press → Machine Shoulder (Military) Press · Biceps Curl → Machine Bicep Curl · Triceps Press → Dip
   Machine ? · Ab Machine → Ab Crunch Machine · Plank → Plank · Push-Ups → Pushups · Stairs → Stairmaster ·
   Leg Press → Leg Press · Leg Extension → Leg Extensions · Leg Curl → Seated Leg Curl ? · Abduction → Thigh
   Abductor · Adduction → Thigh Adductor · Calf Raises (Leg Press) → Calf Press On The Leg Press Machine ·
   Incline DB Press → Incline Dumbbell Press · One-Arm DB Row → One-Arm Dumbbell Row · Overhead DB Press →
   Dumbbell Shoulder Press · Pull-Ups (BW) → Pullups · Dips (BW) → Dips - Triceps Version ? · Hanging Knee
   Raises → **a new entry of ours, "Hanging Knee Raise"** (free-db has only Hanging Leg Raise; no photos).
5. **RepDB credit** — the exact line "Exercise data by RepDB (repdb.co)", linked, on the **Search screen** and
   in **Settings**.

## Scope

`src/exerciseCatalog.js` (+ tests), the new library file(s) and a build/derive script, `src/views/Exercises.jsx`
(save `libraryId`, credit), `src/views/Settings.jsx` (credit), `store.jsx` only if `addExercise` drops unknown
fields. Check export/import (`exchange.js`, `import-backup.js`) carries `libraryId`.

## Out of scope

- The "How to" button and any picture on screen (req-131). The merged Add screen / "Link to library" (req-132).
- Rewriting instructions, descriptions, tips (req-133).
- Our own images (BACKLOG).
- Copying the photos into the repo (1,746 files) — link to the pinned CDN.
- Back-filling `libraryId` on stored exercises (that would be a bulk write; the resolver makes it unnecessary).
- Swedish names, unless Emilio says so.

## Ordered steps

1. Copy the pinned free-db JSON + provenance; fold in `EXTRA_EXERCISES`; point `loadExerciseCatalog` at it
   (loaded lazily — not in the main bundle).
2. Derive `muscleGroups` by script; add `aliases`; add the new "Hanging Knee Raise" entry.
3. Add picture links (free pinned URLs; RepDB exact/curated only). Report counts.
4. `libraryId` on add-from-search; resolver + the 22-name test.
5. RepDB credit on Search + Settings.

## Acceptance criteria (written before implementation)

- **Own copy:** the library holds every free-db entry at the pinned commit (876) + extras + new entries, free-db
  fields unchanged; provenance + Unlicense recorded. Test counts it. `loadExerciseCatalog` makes **no** request
  to the free-db CDN JSON (test with a stubbed fetch).
- **Search didn't regress:** `exerciseCatalog.test.js` passes **unedited** (any edit called out and justified).
  "leg curl" finds Seated Leg Curl; "lat pulldown" finds Wide-Grip Lat Pulldown (alias). Test.
- **Groups:** the table covers all 17 muscles (test fails on an unmapped one); every entry with a primary muscle
  has ≥1 group.
- **Resolver:** all 22 seed names resolve to the table above; an unknown name → `null`; `libraryId` wins over
  the name. Test.
- **Links, not content:** every entry with free images has pinned full URLs; RepDB-linked count reported
  `[measured]`; a test asserts the file carries no RepDB text fields (`description_*`, `tips_*`,
  `instructions_*`, `name_*`).
- **Stored data:** add-from-search saves `libraryId`; manual add doesn't; an existing store loads byte-identical
  exercises (no rewrite); export → import round-trips `libraryId`. Test.
- **Credit:** visible on Search and in Settings (screenshot via `npm run shot`).
- **Bundle:** `npm run build` output shows the library in its own chunk, main chunk size before/after pasted.
- `./check` green; paste the line.

## Decisions made on Emilio's behalf

- behaviour: English-only aliases; the muscle-group table; the `?` picks above; a new "Hanging
  Knee Raise" entry rather than mapping to Hanging Leg Raise; credit on Search + Settings.
- implementation: file location/shape, lazy loading, the derive script, link URL form — builder's call.

## Notes

The line with RepDB (DEC-060): we read it for **what kinds of fields** are worth having (tips, description, body
part, one-sided) — never for content. Our text comes from free-db's own public-domain instructions + general
training knowledge. Storing RepDB image **links** for in-app display is in-app use; if a reviewer reads the licence
differently, drop the RepDB links and keep the rest.
