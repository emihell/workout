# req-139 — library polish: our own display names, missing staples, search = our library only, common first

**Status: BUILT, NOT merged — branch `req-139`** — Phase 1. **Gate: functional** (library data + `exerciseCatalog.js` + the Search screen; no stored-data
change — exercises already saved keep what they have). Spec reviewed independently 2026-09-24 (13 findings folded in:
§Precise rules below). Emilio 2026-09-24 (DEC-064), after planning's critical comparison
of our library vs free-db and RepDB. Runs **before** req-138 (text) and req-134 (browse), because both put these names
on screen.

## Why [measured 2026-09-24 on `main`]

- Common entries show free-db's names: "Barbell Bench Press - Medium Grip", "Rowing, Stationary", "Machine Shoulder
  (Military) Press", "Triceps Pushdown - Rope Attachment", "Running, Treadmill". req-130's rule makes free-db's `name`
  untouchable, so we can't fix them in place.
- Search merges RepDB's live list (~499 names not in ours, measured in req-130's review): untagged, unlinked, with duplicates (RepDB "Lat Pulldown"
  beside our Wide-Grip Lat Pulldown). Adding one gives an exercise the muscle filter and alternatives can't see.
- 10 of 40 staples checked are missing (none exists under another name or alias — reviewer, measured): landmine press, belt squat, pendulum squat, seal row, Meadows row, Bayesian
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
   add **up to 5** more clear staples it finds missing; list them. Keep them distinct from near neighbours (Landmine
   Linear Jammer, Kettlebell One-Legged Deadlift, Side Bridge; T-Bar Row already owns the alias "Landmine Row").
   Copenhagen plank → pattern `hip-adduction`. Each own entry gets 3–4 plain `instructions` lines (the validator
   requires legacy instructions; req-138 rewrites text later).
3. **Search = our library only.** RepDB is no longer fetched for search. (It returns in req-131 for pictures only, joined
   at runtime.) The RepDB credit leaves the **Search** screen and stays in **Settings** (pictures are coming back).
   Exercises already added from RepDB are untouched.
4. **Common first, rest on request.** Search shows **common** hits; below them, when the query also matches
   non-common entries, a **"Show N more from the full library"** button reveals those under the common ones. No
   common hit → the non-common hits show directly (never a dead end). Ranking inside each part is today's scoring.
5. **Shadowing a non-common name:** an alias/displayName on a common entry **may** equal a non-common entry's name key
   (e.g. alias "Air Bike" on Fan Bike). Search and `libraryEntryFor` then prefer the **common** entry. Two common
   entries still can't share a key.
6. **level / category are not shown or searched** (DEC-064 §6); they stay in the file as free-db provenance.
   **`category` keeps feeding `inferExerciseType` for every add until req-132** (9 common cardio entries are typed
   cardio through it).

## Precise rules (spec review 2026-09-24)

- **displayName:** set only where the free-db name isn't already the clean standard name; **never equal to `name`**
  (validator). Shown name = `displayName ?? name`. Drop any stored alias that equals its own entry's displayName.
- **Scoring/sort:** the shown name is scored on the name tiers (0/1/2) and is the alphabetical sort key; the free-db
  `name` (when a displayName exists) counts as an alias (exact 0, partial 2.5).
- **Key rules (validator + tests):** an alias or displayName key on a **common** entry may equal a **non-common** entry's
  `name`; it may never equal any common entry's name, displayName or alias. Two entries never share a displayName key.
- **Resolver `libraryEntryFor`:** unchanged order — `libraryId` → exact name key (now `name` **or** `displayName`) →
  alias → null. Exact name stays ahead of alias (a stored "Air Bike" without libraryId is free-db's crunch, not Fan
  Bike). Common-first applies to **search only**.
- **Search split:** `searchExerciseCatalog` returns `{ common, rest }` (each ranked as today, **limit 25 each**). The
  button reads "Show N more from the full library" with N = the untruncated `rest` count. Expanded state resets on every
  query change. "No common hit" = `common.length === 0` with ≥2 characters typed → `rest` shows directly (cap 25).
- **Search row "Already added"/Restore:** a stored exercise with `libraryId === item.id` first; else
  `exerciseNameMatch` on `displayName`; else on the free-db `name`. Live beats archived (req-127). `exerciseNameMatch`
  itself is unchanged (the manual-create path also uses it).
- **Failed library load:** there's no RepDB fallback any more → Search shows "Could not load." (as today when both
  sources fail), nothing cached, the next open retries.
- **Settings credit:** stays, although until req-131 it only covers exercises already added from RepDB. Update the
  `credits.jsx` comment.
- **Shots:** add a `--type "<text>"` flag to `scripts/screenshot.mjs` so the Show-more state can be captured.

## Sanctioned test edits (exactly these; every other existing test unedited)

- `req-133.test.js`: the common-count range (`:71`, source `COMMON_COUNT_RANGE`) → **170–200**; `OWN_EXERCISES.length`
  (`:222`) → the new N; the 29 top-1 queries compare **ids** instead of names.
- `exerciseLibrary.test.js`: the alias-integrity test (`:144-155`) rewritten to the key rules above, plus a passing
  shadowing fixture; the four "search via aliases" top-1 tests and the press/row/machine "top 10 identical with and
  without aliases" tests run over `library` (not the RepDB merge), "without" = stored `aliases` stripped, compared by
  ids; "RepDB Lat Pulldown/Leg Extension stay in the merged list" and "our Hanging Knee Raise is the one kept" deleted;
  "loading" asserts **0** RepDB requests; "a failed library load returns RepDB only, uncached" → asserts the error,
  not cached, retry works; "a RepDB hit and a manual add save no key" keeps only the manual half.
- `exerciseCatalog.test.js`: the two "merged catalogs" tests (pike/diamond, push-up dedupe) deleted with the merge.
- The entry-count test → `876 + extras + N own-*`.

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
- **Staples:** each of the 10 (+ ≤5) exists, is common and passes req-133's validators.
- **Library only:** `loadExerciseCatalog` makes no RepDB request (stubbed-fetch test); `fromRepdbItem`/merge code for
  search removed or unused; the Search screen shows no RepDB credit; Settings still does.
- **Common first:** "shoulder press" → a common entry first, and Shoulder Press - With Bands only after "Show more"; "air
  bike" → Fan Bike first; a query with only non-common hits (e.g. "car deadlift") shows them directly. Tests + a shot of
  the Show-more state.
- **Receipts kept:** req-133's 29 top-1 queries (+ the 4 in exerciseLibrary.test.js) resolve to the same **entry ids**;
  press/row/machine top-10 hold per the sanctioned form.
- **Already added:** a stored exercise added as "Barbell Bench Press - Medium Grip" (with or without `libraryId`) shows
  **Already added** on the "Bench Press" row (test).
- `./check` green; paste the line. Main chunk size before/after (L-026).

## Decisions made on Emilio's behalf

- confirmed 2026-09-24: own display names (copying clean names is fine); search our library only; common-first with the
  rest on request; text pass earlier; drop level/category from use.
- **(unconfirmed)**: the "Show N more" button form + N = full count + reset on query change; non-common shown directly
  when no common hit; the credit leaving Search; common wins a shadowed name **in search only**; row matching for Already
  added/Restore; a failed load now errors instead of a RepDB-only list; row order follows the shown name.
