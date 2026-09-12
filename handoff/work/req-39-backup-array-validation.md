# req-39 — reject a malformed backup cleanly instead of a raw TypeError (audit F-RISK-4)

**Status: READY.** From audit 2026-09-12 (F-RISK-4). **Gate: functional** — the
fix is input *validation* on the import path; it only rejects bad backups earlier
and cannot make a good import worse. A round-trip test proves no false-reject; a
quick real-backup import at merge is welcome (import is a bulk write).

## Why

`unwrapBackup` (`exchange.js:141-153`), for a `kind: 'workout-mvp-backup'` payload,
only checks `payload.state && typeof payload.state === 'object'` — it does **not**
validate that the inner collection fields are arrays before `migrateState` `.map`s
them (`model.js:232` `schedule.slots`, `model.js:263` `workouts`). Measured
reproductions [audit F-RISK-4]:
- `{kind:'workout-mvp-backup',version:1,state:{workouts:'oops'}}` →
  `TypeError: (source.workouts || []).map is not a function`
- `{…,state:{schedule:{slots:'x'}}}` → same `TypeError`

Not data loss — the import sites catch it (`Today.jsx:175`, `Settings.jsx:61`) and
the pre-import safety backup already fired (`import-backup.js:37`) — but the user
sees `"map is not a function"` instead of the intended `"Not a workout database
backup."`. Root cause: under-validation in `unwrapBackup`.

## The fix — validate in `unwrapBackup`, NOT in `migrateState`

**Critical constraint:** do **not** "fix" this by array-guarding the `.map` sites
in `migrateState` (the way `plannedWorkouts`/`draftWorkouts` already are). That
would make `migrateState` *succeed* on a corrupt `workouts`/`slots` (silently
dropping them) — which on the **load** path would let req-36's corrupt-`v8` guard
think the value is readable and then **overwrite** it (silent data loss). The load
path relies on `migrateState` throwing on garbage. So harden the **import
boundary** only.

In `unwrapBackup`, after confirming `state`/the bare doc is an object, reject
(return `null`, → `applyBackup` throws the friendly `"Not a workout database
backup."`) when any expected collection field is **present but not an array**:
`exercises`, `routines`/`sessions`/`programs`, `workouts`, `plannedWorkouts`,
`draftWorkouts`, and `schedule.slots`. **Absent is fine** (a backup may legitimately
omit a field — `migrateState` defaults those); only *present-and-not-an-array* is a
reject. This must not false-reject a real `buildBackup` output.

## Scope

- Harden `unwrapBackup` (`exchange.js`) per above — for both the wrapped
  (`kind`+`state`) and bare-shape paths.
- Tests in `src/exchange.test.js` (exchange.js is pure `.js`, importable — no JSX
  constraint, L-007 doesn't bite here).

## Out of scope

- Any change to `migrateState` / `model.js` (see the constraint above).
- Any change to the happy import path, schema, or the safety-backup behaviour.
- Per-field error messages — one friendly "Not a workout database backup." is enough.

## Ordered steps

1. In `unwrapBackup`, add an "every present collection field is an array" check for
   both paths; a present non-array field → `null`.
2. Tests (`node --test`, `exchange.test.js`):
   - the two measured repros (`state.workouts='oops'`, `state.schedule.slots='x'`)
     now make `applyBackup` throw `"Not a workout database backup."` — **not** a
     `TypeError`. Assert the message.
   - a **real** `buildBackup(state)` round-trips through `applyBackup` unchanged
     (no false-reject) — the anti-regression.
   - a backup that legitimately omits a field (e.g. no `plannedWorkouts`) still
     imports.

## Acceptance criteria (written before implementation)

- The two malformed payloads throw `"Not a workout database backup."` (assert the
  message, not just that it throws). Command: the new tests, output pasted.
- A real `buildBackup` output still imports (round-trip test green) — proves no
  false-reject.
- `migrateState`/`model.js` unchanged — confirm in the report (diff touches
  `exchange.js` + `exchange.test.js` only).
- `./check` green — paste the line.

## Decisions

- **behaviour:** malformed backup → friendly reject (existing message), not a crash.
  No new message strings.
- **design (fixed by this spec, not CC's call):** validate at `unwrapBackup`, never
  by guarding `migrateState` — the latter would defeat req-36's load guard.

## Notes

At merge, a real import sanity check (export a backup, re-import it) confirms no
false-reject on genuine data. L-001 if planting anything in a real browser.
