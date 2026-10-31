**Status: BUILT AND MERGED, 2026-10-31 — branch `req-265` (`4b7f703`…`e17b86e`, 2 commits).** · **Lane: bug** · DEC-119 §6 / req-217 (library read at display time), req-240 (`unilateral`), req-165 (the lazy chunk), DEC-155. No trigger file.

# req-265 — the log screen stops downloading the whole exercise library

**Lane: bug, not tooling** — the user pays for it: the first log-screen open of a session downloads the full library
on the gym's connection, and until it arrives the screen renders without "each side" and the rest cues (then re-renders).
The reproduction is a network request, and the fix is checked the same way.

## Reproduction [measured, `main` `4c1121b`, 2026-10-31]

- `npx vite build` (to a scratch dir): `assets/exercises-DKX5TAyB.js  1,538.31 kB │ gzip: 263.61 kB`; the main
  `index-*.js` is 140.70 kB gzip. Source `src/library/exercises.json` is 1,842,984 bytes, 944 entries.
- The log screen and its review call `useExerciseLibrary()` (`src/views/workout/item.jsx:331, 880`) →
  `loadExerciseLibrary()` (`src/views/workout/use-library.js:10-27` → `src/exerciseLibrary.js:546-557`, a dynamic
  `import('./library/exercises.json')`), so opening any exercise in a workout fetches that chunk.
  The exercise Details editor uses the same hook (`src/views/Exercises.jsx:435`).
- What those screens read from it — only through `src/library-hints.js`:
  - `isEachSide` / `libraryEachSide` → the resolved entry's `unilateral === true` (`library-hints.js:14-23`);
  - `restNotesFor` → the resolved entry's `formCues`, first `REST_CUES_MAX` = 3 non-blank strings (`:56-64`);
  - resolution is `libraryEntryFor` (`exerciseLibrary.js:588-595`): `libraryId` → name key → `displayName` key →
    alias key, via `indexFor` (`:560-584`), first entry wins per key.
- A map with just `id, name, displayName, aliases, unilateral, formCues (≤3)` measured at 142,542 bytes raw /
  **28,289 bytes gzip** (vs 261,866 gzip for the full JSON, same Node gzip).

## Scope

1. **A generated hint file** (e.g. `src/library/hints.json`): per library entry, the fields resolution and the two hints
   need (above) and nothing else. Written by `scripts/build-library.mjs` alongside `exercises.json`, from the same
   derived list — never hand-edited.
2. **`useExerciseLibrary` loads the hint file**, not `exercises.json`, so the log screen, its review and the Details
   editor resolve the same entries and show the same values from it. `library-hints.js` and `libraryEntryFor` work on
   either list unchanged (or with one shared resolver — the builder's call).
3. The picker / search / catalog (`exerciseCatalog.js:23`, `loadExerciseCatalog`) keep loading the full library.

## Out of scope

- The picker's and search's use of the full library; splitting `exercises.json` itself.
- Changing what the hints show (no new fields, no exercise `cues` — that is the Phase 1 cues req).
- The main bundle: the hint file stays a lazy chunk (see Decisions).

## Steps

1. The equality test first (criterion 2) against a generator function; then the generator in `build-library.mjs`
   (export the pure function so the test calls it on `exercises.json`).
2. Generate the file; switch the hook.
3. Build: paste the chunk lines (`exercises-*.js` and the new hints chunk, raw + gzip).
4. Browser on the branch build (`plan qa`) with the network panel.

## Acceptance criteria

1. **Fails on main, passes on the branch — the right mechanism:** on a fresh load of the `plan qa` build, Start a
   workout → open the first exercise → finish a set so rest runs: the network list has **no** request for
   `exercises-*.js` on the branch and has one on main (both receipts: the request list filtered to `assets/`). The
   hints chunk is requested instead.
2. **Same values for every entry:** a test over all 944 library entries: for each, an exercise `{ libraryId: id }`, one
   `{ name }` per name/displayName/alias, and a cardio one, gives identical `isEachSide`, `libraryEachSide` and
   `restNotesFor(item-with-and-without-note)` from the hint list and from the full list. Asserts the count too (a test
   that loops over an empty list passes for the wrong reason).
3. **Freshness:** the committed hint file equals the generator's output on the committed `exercises.json` (a test), so a
   library rebuild without regenerating fails `./check`.
4. **Failure case — the chunk fails to load:** with the hints import rejected, the log screen renders as today when the
   library is absent (plain reps, routine note alone), no error, and a later mount retries (the `libraryPromise = null`
   reset kept, `exerciseLibrary.js:551-554`).
5. Size: the hints chunk ≤ 40 kB gzip, measured from `vite build`. `./check` green, smoke green.

## Checks run

1. DECs grepped (library chunk, lazy, form cues, req-217): DEC-119 §6 (read at display time, never copied into stored
   data — still true: the hint file is read-only library data), req-165's chunk note. Nothing fixes the loading strategy.
2. Siblings: the Phase 1 **cues + notes before set 1** req (not yet specced) will read exercise `cues` on the same screen
   — it should build on this hook; order: this first. req-264 touches the picker grouping (`routine-picker.js`), not this.
3. Deferrals: none.
4. Numbers: the build and gzip lines above, 2026-10-31.
5. Trigger files: none (`exerciseLibrary.js`, `library-hints.js`, `use-library.js`, a script) → no reviewer required; no
   stored data → no backup reminder.
6. `(unconfirmed)`: none — what the user sees is unchanged (criterion 2); only when it arrives.

## Decisions made on Emilio's behalf

- **implementation:** a separate lazy chunk, not in the main bundle (+~28 kB gzip on every app load vs only on first
  log-screen open); a JSON file generated by `build-library.mjs` with a freshness test, not a Vite plugin.
- **implementation:** the Details editor (`Exercises.jsx:435`) moves to the hint file too — same hook, same values.
