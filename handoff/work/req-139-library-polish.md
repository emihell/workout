# req-139 — library polish: our own display names, missing staples, search = our library only, common first

**Status: READY** — Phase 1. **Gate: functional** (library data + `exerciseCatalog.js` + the Search screen; no stored-data
change — exercises already saved keep what they have). Emilio 2026-09-24 (DEC-064), after planning's critical comparison
of our library vs free-db and RepDB. Runs **before** req-138 (text) and req-134 (browse), because both put these names
on screen.

## Why [measured 2026-09-24 on `main`]

- Common entries show free-db's names: "Barbell Bench Press - Medium Grip", "Rowing, Stationary", "Machine Shoulder
  (Military) Press", "Triceps Pushdown - Rope Attachment", "Running, Treadmill". req-130's rule makes free-db's `name`
  untouchable, so we can't fix them in place.
- Search merges RepDB's live list (499 names not in ours): untagged, unlinked, with duplicates (RepDB "Lat Pulldown"
  beside our Wide-Grip Lat Pulldown). Adding one gives an exercise the muscle filter and alternatives can't see.
- 10 of 40 staples checked are missing: landmine press, belt squat, pendulum squat, seal row, Meadows row, Bayesian
  curl, Z press, Copenhagen plank, bird dog, single-leg RDL (free-db has only a kettlebell one-legged deadlift).
- 724 of 887 entries are untagged (old coarse data, strongman/odd moves) and rank beside the staples:
  "shoulder press" → Shoulder Press - With Bands first; "air bike" → free-db's crunch named "Air Bike".

## The behaviour

1. **Our own display name** — new own-field `displayName` on every common entry: the standard gym name ("Bench Press",
   "Incline Bench Press", "Rowing Machine", "Treadmill Run", "Triceps Pushdown (Rope)"…). Chosen on merit; **copying a
   clean name that RepDB (or anyone) uses is fine** — Emilio: "repdb does not own naming of exercises". Pick names per
   entry; don't bulk-import RepDB's name list (DEC-064 §1). The free-db `name` stays unchanged underneath and becomes a
   searchable alias automatically (not stored twice). The app **shows** `displayName ?? name` everywhere the library
   name appears (Search rows; the name saved on add). Display names are unique by name key across the library.
2. **Missing staples as `own-*`** — at least the 10 above (single-leg RDL as its own dumbbell entry), fully tagged per
   req-133 (common, muscles, pattern, equipmentList, logAs, unilateral, family, aliases) + legacy fields. The builder may
   add up to ~15 more clear staples it finds missing; list them in the report.
3. **Search = our library only.** RepDB is no longer fetched for search. (It returns in req-131 for pictures only, joined
   at runtime.) The RepDB credit leaves the **Search** screen and stays in **Settings** (pictures are coming back).
   Exercises already added from RepDB are untouched.
4. **Common first, rest on request.** Search shows **common** hits; below them, when the query also matches
   non-common entries, a **"Show N more from the full library"** button reveals those under the common ones. No
   common hit → the non-common hits show directly (never a dead end). Ranking inside each part is today's scoring.
5. **Shadowing a non-common name:** an alias/displayName on a common entry **may** equal a non-common entry's name key
   (e.g. alias "Air Bike" on Fan Bike). Search and `libraryEntryFor` then prefer the **common** entry. Two common
   entries still can't share a key.
6. **level / category are ignored by our readers** (DEC-064 §6): nothing shows or searches on them; they stay in the file
   only as free-db provenance. (`inferExerciseType` still uses category for non-common adds until req-132.)

## Scope

`src/library/common.js` / `own-exercises.js` (displayName, new entries, aliases), `src/exerciseLibrary.js` (displayName
field, validators, resolver preference), `src/exerciseCatalog.js` (library-only load, displayName in search +
`catalogItemToExercise`, common-first split), `src/views/Exercises.jsx` (Show more button, credit removed),
regenerated `exercises.json`, tests.

## Out of scope

Text (req-138). Browse/muscle filter (req-134). Pictures (req-131). Renaming free-db `name`. Stored exercises. Tagging
non-common entries.

## Acceptance criteria (written before implementation)

- **Display names:** every common entry has `displayName`; unique by name key; the report lists old → new for all.
  Searching the old free-db name still finds the entry (test, e.g. "barbell bench press - medium grip" → Bench Press).
- **Shown:** a Search row and a saved exercise use `displayName` (test on `catalogItemToExercise` + `npm run shot`).
- **Staples:** each of the 10 exists, is common and passes req-133's validators; count test updated to the new N (a
  sanctioned edit).
- **Library only:** `loadExerciseCatalog` makes no RepDB request (stubbed-fetch test); `fromRepdbItem`/merge code for
  search removed or unused; the Search screen shows no RepDB credit; Settings still does.
- **Common first:** "shoulder press" → a common entry first, and Shoulder Press - With Bands only after "Show more"; "air
  bike" → Fan Bike first; a query with only non-common hits (e.g. "car deadlift") shows them directly. Tests + a shot of
  the Show-more state.
- **Receipts kept:** req-133's 25 top-1 queries still resolve to the same **entries** (their displayed names may change)
  — the test compares ids; the press/row/machine top-10 tests stay green (edit only to compare ids if names changed;
  called out).
- `./check` green; paste the line. Main chunk size before/after (L-026).

## Decisions made on Emilio's behalf

- confirmed 2026-09-24: own display names (copying clean names is fine); search our library only; common-first with the
  rest on request; text pass earlier; drop level/category from use.
- **(unconfirmed)**: the "Show N more" button form; showing non-common directly when no common hit; the credit leaving
  Search; common wins a shadowed name.
