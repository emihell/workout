# req-120 — loading never invents plan values: backfill and baseline are legacy-only (audit C)

**Status: BUILT AND MERGED, 2026-09-23 — branch `req-120` (`6b83110`…`86144f7`, 2 commits).** Phase 1. **[P]** **Migration change** (`model.js`
`migrateState` / `workoutSnapshot` / `migrateRoutine`, which run on every load and import). DEC-057 reviewer + backup
reminder; **Emilio's eyes on the migration diff before merge** (DEC-035 carve-out). Revised 2026-09-23 after the
spec review found the first draft's gaps: it missed the baseline path, had no signal plumbing, and its criteria
were vacuous.

## Why [measured, scratchpad/audit-history/mig.mjs + specrev2/r120*.mjs]

Two paths fill **empty** plan fields on every load:
1. `workoutSnapshot` (`model.js:124-130`) fills an item's empty `targets` / `suggestedWeights` from that workout's
   **logged** working sets. An active workout with an empty item and one logged 6×50, reloaded → `["6"] [50]`,
   so set 2's target is invented from set 1's reps (DESIGN §1), and a frozen snapshot is rewritten (§3).
2. The `legacyRecommendations` **baseline** (`model.js:31-43` in `migrateRoutine`, `:115` and `:178` in
   snapshots) refills empty lists from a recorded map. With a stale entry, empty snapshot targets become
   `["10","10","10"]`, and a cleared routine Kg comes back (`["8","8"] [40,40]`).

Both exist for **legacy** records (v5–v8 era, pre-snapshot-plan data).

## The behaviour

1. `migrateState(input, { legacy })`: **both** the logged-sets backfill and the `legacyRecommendations` baseline
   (in `workoutSnapshot` **and** `migrateRoutine`) run **only when `legacy` is true**. For v9 input, empty stays
   empty.
2. **The signal is computed from the raw input before the `{...emptyState(), ...raw}` merge** (the merge injects
   `schemaVersion: 9`):
   - `loadState`: `legacy = !current || Number(parsed.schemaVersion) !== 9` (it already computes this,
     `storage.js:172`).
   - `applyBackup` (`exchange.js:192`, now in scope): `legacy = Number(raw.schemaVersion) !== 9`. A **missing**
     schemaVersion (the assistant's stateShape has none, `exchange.js:64-117`) counts as legacy **only if**
     `sessions`/`programs` are present, otherwise as v9.
   - The default when a caller passes nothing is `legacy: false` (the safe side: never invent).
3. **No rewrite of already-backfilled v9 values** **(unconfirmed)**: they came from the user's own logged sets,
   and telling them apart isn't reliable.

## Scope

`src/model.js`, `src/storage.js`, `src/exchange.js`, tests. **Test edits named:** `skip-replace.test.js:297` and
`:449` assert the v9 backfill (req-109) and change to assert its absence (a DEC-driven reversal, not a weakening).
**Third edit (added 2026-09-23, Planner, after the build stopped on it):** `model.test.js:66-84` calls `migrateState`
without options on a legacy-shaped fixture (`programs`, no `schemaVersion`). It passes `{ legacy: true }` explicitly;
the safe `legacy:false` default stays.

## Order vs siblings

After req-115 and req-114 (same `storage.js` / `exchange.js`); **before req-118** (a cleared Kg must not come back)
and req-119 (`model.js`).

## Acceptance criteria

- **Failure case — v9 reload (unit):** an active workout with an item whose targets/weights are empty, and one
  logged 60×7 → `migrateState(…, {legacy:false})` → still empty; set 2's target is `""`.
- **Failure case — stale baseline (unit):** v9 state with a `legacyRecommendations` entry and an empty routine item
  / snapshot item → both still empty.
- **Legacy still backfills (unit, new):** a **v8-key** state whose snapshot item has empty targets and logged sets →
  after `loadState` the item is backfilled (the behaviour kept for legacy). The existing v5→v9, v6, v7 and v8→v9
  tests pass unmodified.
- **Signal plumbing (unit):** `loadState` from a v9 key passes `legacy:false`; from a v8 key, `legacy:true`;
  `applyBackup` with no schemaVersion and no `sessions` → `false`, with `sessions` → `true`.
- **Identical otherwise (script, in the report):** main vs branch `migrateState` on a **v9 fixture** where every
  item has plan fields (not db.json, which is v8 and has none empty) → deep-equal.
- **No regression:** `./check` green; the three named test edits only. Receipt quoted.

## Decisions

- Legacy-only backfill and baseline (Planner, from DESIGN §1/§3); missing-version rule and `legacy:false` default
  **(unconfirmed)**.
- No cleanup of already-backfilled v9 values **(unconfirmed)**.
