# req-124 — Replace exercise lands on the new exercise (audit Tier 3, DEC-059 §1)

**Status: BUILT AND MERGED, 2026-09-23 — branch `req-124` (`81fe2ca`…`81fe2ca`, 1 commit).** Phase 1. **[ux-feel]** + **[P]**: `store.replaceItem` changes its return (DEC-057: reviewer + backup reminder). Revised
2026-09-23 after spec review.

## Why [measured, audit gym reviewer]

After picking a replacement, `replace.jsx:43` goes to the overview (`go('/workout/:r', {replace:true})`), costing one
extra tap before logging it. The replacement stays 1 blank set (DEC-059 §1).

## The behaviour

After a successful Replace, go straight to the new exercise's log screen (`itemLogPath`), replacing the picker in
history (as now). Cancel on the picker is unchanged. **Mechanism:** `store.replaceItem` (`store.jsx:~266-281`) creates
the new id inside the setState updater and returns nothing; it now generates the id **before** the updater and
**returns** it, so `replace.jsx` can navigate to it.

## Scope

`src/views/workout/replace.jsx`, `src/store.jsx` (`replaceItem` returns the new key), a unit test of that return.

## Acceptance criteria

- **Failure case — lands on the new one (puppeteer):** Replace → pick → the URL is `/item/<new key>/log` and the title
  is the new exercise's name (not the overview, which is where main lands).
- **Unit:** `replaceItem` returns the key of the inserted item, and that item exists in the snapshot.
- Cancel still returns to the original's log screen.
- `./check` green (receipt quoted).
