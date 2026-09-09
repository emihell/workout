# req-06 — remove superseded legacy localStorage keys after a confirmed v8 write

**Status: BUILT AND MERGED, 2026-09-09 — branch `req-06` (`f0c6253`…`f0c6253`, 1 commit).** — decision-free; the only behaviour rule (never delete a legacy copy
until v8 is confirmed persisted) is the requirement itself. Independent of all other reqs.

**Gate: persisted-data** (DEC-009) — deletes stored `localStorage` keys. **Always waits for Emilio's hands before merge; never auto-closed** by the planning session (CLAUDE.md migration ask-gate).

## Why

`loadState` (`src/storage.js:21-35`) reads three legacy keys to migrate forward:

```
const STORAGE_KEY = 'workout-mvp-v8'
const LEGACY_KEYS = ['workout-mvp-v7', 'workout-mvp-v6', 'workout-mvp-v5']
...
const raw = current || LEGACY_KEYS.map((key) => localStorage.getItem(key)).find(Boolean)
...
if (!current || Number(parsed.schemaVersion) !== SCHEMA_VERSION) {
  saveState(state)   // writes v8 — but the legacy key is never removed
}
```

After a migration the device holds **two copies** of the same history: the fresh
`workout-mvp-v8` and the stale `workout-mvp-v7` (or v6/v5) it came from. The legacy copy
is dead weight — never read again once v8 exists — and it eats the same finite
`localStorage` quota the live store competes for (see `req-01`: quota-exceeded is a real,
reachable save failure). Low severity, but it is dead data that only grows the surface
for a quota problem. [measured] — `loadState` reads `LEGACY_KEYS` (storage.js:5,24) and
never calls `removeItem`; `grep -n removeItem src/` returns nothing.

## The behaviour (the one hard rule)

Remove the legacy keys **only after the `workout-mvp-v8` value is confirmed persisted** —
confirmed by reading it back, not merely by `saveState` not throwing. A save that fails
*silently* (Safari/iOS Private Mode historically accepts the write and stores nothing) must
**never** trigger a legacy delete: that is the one path that could destroy the only surviving
copy of the user's history. The invariant, stated as a test:

> If `localStorage.getItem('workout-mvp-v8')` does not return the just-written value, no
> legacy key is removed.

## Scope

- After `loadState` has a v8 value **confirmed present in storage**, remove every
  `LEGACY_KEYS` entry (up to 3 keys). This covers both the fresh-migration path and a
  device where a previous cleanup was interrupted and v8 already exists alongside a legacy
  key.
- Confirm persistence with an explicit read-back of `STORAGE_KEY` before any `removeItem`.
  A bare "`saveState` didn't throw" is **not** confirmation.
- Removal is best-effort and must not break load: a `removeItem` that throws must not
  prevent `loadState` from returning usable state (it already runs inside try/catch).

## Out of scope

- Any change to the schema, `SCHEMA_VERSION`, `migrateState`, or the v8 write format — the
  happy-path v8 write stays byte-for-byte identical.
- Guarding `saveState` itself against a throw — that is `req-01`, and this req must not
  assume `req-01` is merged. This req only adds a delete *after* a confirmed write; it
  changes nothing about how the write is made.
- Pruning history / quota management (separate backlog item).

## Migration ask-gate (persisted data — read before building)

This **deletes stored records**: up to 3 legacy `localStorage` keys per device
(`workout-mvp-v7`, `-v6`, `-v5`), each holding a full historical database. Per `CLAUDE.md`
("Any change to the persisted-data schema or a bulk write to saved state"): in the report,
state plainly what is deleted and under what precondition, and ship the failure-case test
below that proves a legacy key survives a failed/silent upgrade. There is no backup and no
undo — the read-back confirmation is the entire safety mechanism, so it must be tested, not
asserted in prose.

## Ordered steps

1. In `loadState`, after obtaining `state` and performing the v8 `saveState(state)` on the
   migrate path (and on the already-v8 path where no write is needed), read `STORAGE_KEY`
   back from `localStorage`. Only if that read returns a non-null v8 value, call
   `removeItem` on each `LEGACY_KEYS` entry. Exact placement/helper is CC's call — name it
   in the report.
2. Ensure a `removeItem` or read-back that throws cannot escape `loadState` (keep it inside
   the existing try/catch, or guard locally) — a cleanup failure must degrade to "legacy
   key stays", never to "load returns emptyState and orphans the data".

## Acceptance criteria (written before implementation)

- **Happy path — migrate then clean:** with only `workout-mvp-v7` present (a valid older
  db) and no v8, `loadState` migrates, writes `workout-mvp-v8`, and **all** legacy keys are
  gone afterward. Test: mock `localStorage` (the pattern in `src/storage.test.js:33-51`),
  seed a legacy key, call `loadState`, assert `getItem('workout-mvp-v8')` is set and
  `getItem('workout-mvp-v7')` is `null`. Output pasted.
- **Failure case — throwing write (required):** with a `localStorage` whose
  `setItem('workout-mvp-v8', …)` **throws**, seed `workout-mvp-v7`, call `loadState`; assert
  `workout-mvp-v7` is **still present** afterward. The legacy copy survives a failed upgrade.
- **Failure case — silent no-op write (required, the point of the read-back):** with a
  `localStorage` whose `setItem` **does nothing and does not throw** (so `getItem('…-v8')`
  stays `null`), seed `workout-mvp-v7`, call `loadState`; assert `workout-mvp-v7` is **still
  present**. A cleanup keyed on "didn't throw" would wrongly delete here and must fail this
  test.
- **Already on v8, no legacy:** with only a valid `workout-mvp-v8` present, `loadState`
  returns it unchanged and no error is thrown (nothing to remove). Existing
  `src/storage.test.js` cases stay green.
- **No regression:** `./check` green (paste the line). The v6-flatten test
  (`storage.test.js:53`) still passes.

## Decisions

- **behaviour:** none open — "confirm-persisted-before-delete" is the requirement, not a
  choice. If CC finds a reason the read-back cannot confirm persistence on some target
  (e.g. a storage backend that lies on read too), stop and report rather than deleting.
- **implementation (CC's call, list in report):** where the read-back + `removeItem` live
  (inline in `loadState` vs a small helper); whether to also clean up on the already-v8
  path (recommended — it reclaims keys from an interrupted prior cleanup).

## Notes

Pairs with `req-01` (guarded save) and `req-07` (backup before import): all three protect
the persisted record. This one is the smallest — a delete gated behind a proof — but it
touches the same nerve, so the gate (read-back) is the whole point and the tests are on the
failure paths, not the happy one.
