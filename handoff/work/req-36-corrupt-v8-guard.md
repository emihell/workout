# req-36 — a corrupt `workout-mvp-v8` key must not be silently overwritten

**Status: BUILT AND MERGED, 2026-09-12 — branch `req-36` (`65a8023`…`65a8023`, 1 commit).** Decision made (DEC-032). Persisted-data / trust req → **Emilio's
hands before merge** (DEC-009). From audit 2026-09-12 (F-RISK-2).

## Why

`loadState` (`src/storage.js:64-80`) reads the live key, `JSON.parse`s it, and
migrates it — all inside one `try`. Any throw (a non-JSON value, or a shape
`migrateState` chokes on) falls to the blanket `catch` at `:78`, which returns
`emptyState()` — **indistinguishable from a blank device.** The store seeds from
that (`store.jsx:11`), and the **first** mutation's `saveState` (`store.jsx:16`)
then writes empty state over the corrupt-but-possibly-recoverable key. In steady
state the legacy keys have already been removed (req-06), so there is no fallback.

Net: one corrupt byte in `workout-mvp-v8` silently discards all history, with no
banner and no recovery path. This is the exact record the app exists to protect.
No test exercises a corrupt (non-JSON) `v8` value today — the suite is all
valid-JSON seeds (`storage.test.js`). [measured, audit F-RISK-2]

This mirrors req-01/DEC-001 but on the **read** side: req-01's own note ("`loadState`
already fails safe … without overwriting storage") was incomplete — it returns
`emptyState()`, and the next save is the overwrite.

## The behaviour (decided — DEC-032)

Distinguish **absent** from **corrupt-but-present**:

- **Absent** key (or genuinely empty) → `emptyState()`, app works normally, saves
  normally. **Unchanged.**
- **Present but unreadable** `v8` value (parse or migrate throws) → the app must
  **not overwrite it.** Hold saves so the raw value stays on disk and recoverable,
  and surface a **distinct, persistent banner** — separate from the save-failed
  banner — to the effect of: *"Couldn't read your saved data. Don't clear anything
  — export/seek recovery before making changes."*

## Scope

- Split `loadState` so a present-but-unreadable source key is caught separately
  from "no value", setting an **"unreadable data" signal** (parallel to the
  existing `saveFailed` signal: module flag + `get`/`subscribe`, `storage.js:12-28`).
- While the unreadable signal is set, **`saveState` must not write** (no
  `setItem`) — the corrupt key is preserved untouched; return `false`.
- Render a **distinct persistent banner** from the new signal in the app shell
  (`App.jsx`, alongside `SaveFailedBanner` at `:178`), with its own wording.
- The successful/absent/normal paths stay **byte-for-byte unchanged** (same key,
  same JSON, same `emptyState()` for a truly blank device).

## Out of scope

- An explicit "discard the unreadable data and start fresh" action, or
  auto-quarantining the corrupt value to a side key. See **Open** below — a
  follow-up once Emilio picks the recovery UX. This req is the safety net only.
- Any change to the migration logic, the schema, or the legacy-key handling.
- Retry/repair of the corrupt value.

## Ordered steps

1. Add an `unreadable`/`loadFailed` signal to `storage.js` mirroring the
   `saveFailed` trio (`setLoadUnreadable`/`getLoadUnreadable`/`subscribeLoadUnreadable`).
2. Refactor `loadState`: detect that the **source key is present** but
   `JSON.parse`/`migrateState` throws → set the unreadable signal, return
   `emptyState()`, and ensure no overwrite happens (step 3). Keep "no value →
   `emptyState()`" and the happy path exactly as they are. (Decide, and name in the
   report, whether an unreadable **legacy** key when no `v8` exists counts as
   unreadable — lean yes, since it's the only surviving copy.)
3. Guard `saveState`: while the unreadable signal is set, do **not** call
   `setItem` (return `false`); leave the raw key intact.
4. Render the distinct persistent banner in `App.jsx` from the new signal.
5. Tests (`node --test`):
   - (a) seed a **non-JSON** value into `workout-mvp-v8` → `loadState` returns
     `emptyState()`, sets the unreadable signal, and a **subsequent `saveState`
     leaves the raw stored value byte-unchanged** (assert `getItem` still returns
     the original corrupt string). This is the core anti-regression.
   - (b) absent key → `emptyState()`, unreadable signal **clear**, saves work.
   - (c) valid `v8` (and valid legacy → migrate) → unreadable signal clear,
     existing migration tests stay green.

## Acceptance criteria (written before implementation)

- **Preservation (required):** with a corrupt `v8` value on disk, loading then
  performing a mutation does **not** overwrite it — the corrupt string is still in
  `localStorage` afterward. Command: test (a), output pasted.
- **Absent unchanged:** a blank device still starts empty and saves normally —
  test (b) + existing storage tests green.
- **Right mechanism:** the test asserts the *preserved raw value*, not just "no
  throw" — a `catch {}` that still lets the overwrite happen must fail criterion (a).
- **Distinct banner:** the unreadable banner is separate from the save-failed
  banner (different signal, different wording). Verified in the browser at the
  merge gate.
- `./check` green — paste the line.

## Decisions

- **behaviour (Emilio, DEC-032):** corrupt-but-present `v8` is never overwritten;
  hold saves + distinct persistent banner. Absent = empty is unchanged.
- **implementation (CC's call, list in report):** signal plumbing; banner
  placement/markup; whether an unreadable legacy-only key counts as unreadable.

## Open (for Emilio, at the merge gate)

Holding all saves means the app **cannot persist new work** until the corrupt key
is resolved out-of-band — a dead-end if the data is genuinely unrecoverable. A
follow-up should give the user an explicit way out: either a confirmed "discard
unreadable data and start fresh" action, or auto-quarantine the corrupt value to a
side key (`workout-mvp-v8-corrupt-<ts>`) and continue on empty state (saveable).
Not built here — flag which you want and it becomes its own req.

## Notes

Human "use it" gate before merge: with a corrupt value planted in the real key
(dev tools), confirm the banner shows, history reads empty, and — critically —
that making a change does **not** wipe the planted value. Follow L-001: snapshot
the real key before planting anything.
