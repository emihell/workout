# req-120 — loading never invents plan values from what you logged (audit C)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[P]** **Migration change** (`model.js`
`workoutSnapshot`, runs on every load and import). DEC-057 reviewer + backup reminder; **Emilio's eyes on the
migration diff before merge** (DEC-035 carve-out).

## Why [measured, scratchpad/audit-history/mig.mjs]

`workoutSnapshot` (`model.js:124-130`) fills an item's **empty** `targets` / `suggestedWeights` from that
workout's **logged** working sets, on every `loadState` and import. For a no-weight/no-target routine item:
- history: `targets [] suggestedWeights []` → after load `["8"] [40]`;
- active workout after a reload: `["6"] [50]`, and `setTargetFor` for set 2 changes from `""` to `"6"`.

So a mid-workout reload invents set 2's target from set 1's actual reps (DESIGN §1) and rewrites a frozen
snapshot (§3). The backfill exists for **legacy** records (pre-snapshot-plan data, v5–v8 era), where plan fields
were absent. It's idempotent, so today's data has already been rewritten once where it applied.

## The behaviour

1. The logged-sets backfill runs **only for legacy input**, i.e. state loaded from a pre-v9 key or a backup below
   schema 9. A v9 snapshot's empty `targets` / `suggestedWeights` stay empty.
2. `legacyRecommendations` baseline behaviour is unchanged for legacy input.
3. **No rewrite of stored data.** Values already backfilled into v9 records stay as they are. Undoing them isn't
   possible to do reliably, and they came from the user's own logged sets. **(unconfirmed)**

## Scope

`src/model.js` (`workoutSnapshot` / `migrateState` gains a legacy flag), `src/storage.js` (passes it), tests.

## Acceptance criteria

- **Failure case — v9 reload (unit):** an active workout with an item whose targets/weights are empty and one
  logged set 60×7 → after `migrateState` they're still empty, and set 2's target is `""`.
- **Legacy still upgrades (unit):** the existing v5→v9, v6, v7 and v8→v9 tests pass **unmodified**, including
  backfilled plans.
- **Identical otherwise (script):** main vs branch `migrateState` on db.json plus variants whose items all have plan
  fields → deep-equal.
- **No regression:** `./check` green. Receipt quoted.

## Decisions

- Legacy-only backfill (Planner, from DESIGN §1/§3). No cleanup of already-backfilled v9 values **(unconfirmed)**.
