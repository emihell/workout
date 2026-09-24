# req-142 — remove RepDB completely

**Status: BUILT AND MERGED, 2026-09-24 — branch `req-142` (`a523f2d`…`a523f2d`, 1 commit).** — Phase 1, small and mechanical. **Gate: functional**. DEC-069 + DEC-070 §1: RepDB goes once the library is
up to par, and req-151 measured it (all 601 pinned RepDB names are covered, skipped or hidden; 0 unclassified; Show-more
holds 0 rough entries). There's no spec review (it's mechanical). Planning reads the diff at the gate.

## The behaviour

Nothing RepDB remains in the app, the scripts, the tests or the repo folder:
1. **Settings credit** removed (`src/views/credits.jsx` `RepdbCredit`/`REPDB_CREDIT` and its use in `Settings.jsx`). Keep
   `ExternalLink` if anything else uses it, and delete it only if it's then unused.
2. **Scripts:** delete `scripts/library-gap.mjs` and `scripts/originality.mjs` (both exist only to compare against
   RepDB). Their npm scripts, if any, go too.
3. **`.vendor-cache/`:** delete the folder locally, and drop its `.gitignore` line.
4. **Comments and docs** in code that say RepDB "returns for pictures (req-131)" or similar: reword them to history
   ("RepDB was used until req-142; nothing of it remains") or remove them. `src/library/PROVENANCE.md` gets one line
   saying the same.
5. **Code paths:** remove any dead RepDB helpers (`fromRepdbItem`, `REPDB_URL`, `isLibraryItem`'s `repdb-` branch if it's
   now only a guard). **Keep** the handling of stored exercises whose id or `libraryId` starts `repdb-` (added before
   req-139): they must keep loading and resolving to `null` without errors.

## Sanctioned test edits

Tests that only exist for the removed pieces (credit render, originality/gap scripts, RepDB fetch stubs, `fromRepdbItem`)
are deleted or rewritten, each named in the report. **Keep** the guards `grep -ci repdb src/library/exercises.json` → 0
and "the library has no RepDB fields", as tests.

## Acceptance criteria

- `git grep -in repdb -- src scripts` returns only history comments, the kept guards, and the stored-`repdb-*` handling.
  Paste the output.
- `ls .vendor-cache` → gone, and `.gitignore` no longer lists it.
- A stored exercise with `id`/`libraryId` `repdb-x` loads and shows without error (a test).
- Settings renders without the credit (a shot via `npm run shot`).
- L-026 main chunk before/after (baseline 341.94 kB).
- `./check` green; paste the line.
