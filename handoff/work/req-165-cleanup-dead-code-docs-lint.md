# req-165 — cleanup: dead code, the schema doc, lint, stale comments, the README catch-up

**Status: BUILT AND MERGED, 2026-09-25 — branch `req-165` (`715eeba`…`2725986`, 10 commits).** (2026-09-25) — **Lane: tooling** (no behaviour change) — but touches storage/model → reviewer fires.
DEC-085, DEC-087. After req-163. Source: `audits/2026-09-24.md` (read each F- section named).

1. **Dead code (F-DEAD-3, F-DEAD-5, F-DEAD-6, BACKLOG Tier-3 note):** the ~40 unreachable legacy `session*` fallbacks
   (migration strips those keys — re-measure); `plannedWorkouts` (never written except pass-through/filters — confirm and
   remove its reads/writes **without dropping the key from old stored data**: loading an old doc that has it must still
   work); route.js's unread visit stack (req-153 kept `go()` identical — keep behaviour, drop the dead state); exports only
   tests use (move or delete with the tests); unreferenced scaffold assets.
2. **F-DRIFT-3:** `reference/schema.md` is planning's (handoff/) — **Builder writes the field list into its report**;
   planning updates `schema.md` from it. Every persisted v9 field (incl. `setDraft`, `seedOverrides`, `addedSets`,
   `addedMidWorkout`, `hasDuration`, `libraryId`, the unreadable copy keys), its type and who writes it.
3. **F-LINT-1:** fix the 21 oxlint warnings (or justify each kept one inline).
4. **F-BUNDLE-1:** fix the chunk-size warning (configure the limit for the lazy library chunk with a comment giving its
   measured size) and the comment that understates it.
5. **F-DRIFT-6 + F-STRUCT-7:** stale comments; the duplicate routine/exercise lookups → one each.
6. **README catch-up (DEC-087 §1):** apply `handoff/work/contract-drift-draft.md` §README.md exactly, and align
   `.cursor/rules/history-prefill.mdc` with DESIGN §1 (as now on main).

## Acceptance criteria

- `./check --smoke` green; oxlint **0 warnings** (or each kept one justified); the build prints no chunk warning (paste).
- A migration test: an old doc with `plannedWorkouts` and `session*` keys still loads to the same v9 state as on main
  (deep-equal, paste).
- Grep receipts for each removed item (0 hits in src outside tests).
- Reviewer before merge. No behaviour change: the smoke and every existing test pass unedited, or each edit is justified.
