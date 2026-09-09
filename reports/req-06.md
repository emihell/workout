# req-06 — remove superseded legacy localStorage keys after a confirmed v8 write

Branch: `req-06-legacy-key-cleanup`. Gate: **persisted-data** (DEC-009) — deletes stored keys;
**waits for Emilio's hands before merge**, never auto-closed.

## Migration ask-gate (what is deleted, under what precondition)

**This deletes persisted data.** On a device that has been migrated, `loadState` now removes up
to **3 legacy `localStorage` keys** — `workout-mvp-v7`, `workout-mvp-v6`, `workout-mvp-v5` —
each of which can hold a full historical database. There is no backup and no undo.

**The single precondition, and the entire safety mechanism:** a legacy key is removed **only
after `localStorage.getItem('workout-mvp-v8')` returns a non-null value** — i.e. v8 is confirmed
present in storage by reading it back. `saveState` *not throwing* is explicitly **not** treated
as confirmation, because iOS/Safari Private Mode has historically accepted a write and stored
nothing. If the read-back does not confirm v8, **no legacy key is touched**. This is proved by
two failure-case tests below, not asserted in prose.

The live `workout-mvp-v8` key is never deleted, and the v8 write path is byte-for-byte unchanged.

## Technical

### What changed (`src/storage.js`)

- New helper `removeLegacyKeysIfV8Persisted()`: reads `STORAGE_KEY` back; if non-null, calls
  `removeItem` on each `LEGACY_KEYS` entry. Wrapped in its **own** `try/catch` so a throwing
  `getItem`/`removeItem` is swallowed **locally** — a cleanup failure degrades to "legacy stays",
  never to `loadState` falling through to its outer `catch` and returning `emptyState()` (which
  would orphan the just-migrated data).
- `loadState` calls it once, after the existing migrate-write block and before `return state`. It
  is only reached when the device had data (the `if (!raw) return emptyState()` early-out still
  guards the fresh-empty device).

### Choices the spec left to me (listed per the req)

- **Read-back check is non-null, not exact-string-equality.** Non-null satisfies every required
  test and the dangerous path (fresh migrate from v7 whose write fails → v8 absent → null → no
  delete). Exact `=== JSON.stringify(state)` was rejected: on the already-v8 path no write
  happens and the stored bytes need not equal a re-serialization of the migrated state, so an
  exact match would wrongly *skip* the recommended interrupted-cleanup reclaim there.
- **Cleanup also runs on the already-v8 path** (recommended in the spec). When v8 already exists
  alongside a leftover legacy key from an interrupted prior cleanup, the read-back passes and the
  legacy key is reclaimed. Covered by a test.
- **Placement:** inline helper in `storage.js` next to `loadState`, not a new module — it is
  three lines of storage-local logic.

### Out of scope, respected

No change to `SCHEMA_VERSION`, `migrateState`, or the v8 write format; `saveState` itself is not
guarded against throwing (that is req-01, not assumed merged — this req only adds a delete *after*
a confirmed write).

## Verified

`node --test src/storage.test.js` — **15 pass, 0 fail.** New `req-06 legacy-key cleanup` block:

- **happy path:** seed only `workout-mvp-v7` → `loadState` migrates, writes v8, and v7/v6/v5 are
  all `null` afterward.
- **failure — throwing write:** `setItem` throws → v8 never persists → **v7 still present**;
  `loadState` still returns usable migrated state.
- **failure — silent no-op write (the point of the read-back):** `setItem` does nothing and does
  not throw → `getItem('…v8')` stays `null` → **v7 still present**. An implementation keyed on
  "didn't throw" would delete here and fail this test.
- **already on v8, no legacy:** unchanged, nothing removed, no throw; the v8 value is untouched.
- **already on v8 + leftover legacy:** the interrupted cleanup finishes (v7 reclaimed, v8 intact).

Test helper extended with `silentSet`, `seed`, and `removeItem` (backward-compatible with the
existing req-01 save-guard and v6-flatten cases, which stay green).

`./check` — **green:**

```
# tests 96
# pass 96
# fail 0
check: green — lint, 12 test file(s), and the build all passed.
```

### Acceptance criteria → receipts

- Happy path migrate-then-clean — test above, passing.
- Failure: throwing write — test above, passing (v7 survives).
- Failure: silent no-op write — test above, passing (v7 survives).
- Already on v8, no legacy — test above, passing; existing storage.test.js cases green.
- No regression — `./check` green; the v6-flatten test still passes (now test 10 of the file).

## Workflow

- **No scope changes.** Implemented exactly the read-back-gated delete described in the req.
- **One added test beyond the spec's list:** already-v8-with-leftover-legacy, to cover the
  recommended already-v8 cleanup path I opted into. Surfaced here as a decision (non-null
  read-back + clean on already-v8) in case it should become a note in the req or a `DEC-`.
- **Required human gate (persisted-data):** this deletes real keys on a real device. Automated
  tests prove the read-back gate on mocked storage; they cannot prove Safari/iOS Private Mode
  behaviour or that a real migrated device cleans up as expected. Emilio's browser use is the
  merge gate.
