# req-38 — stamp `performedOn`/`plan.date` in local time, not UTC (audit F-CODE-2)

**Status: BUILT AND MERGED, 2026-09-12 — branch `req-38` (`c8eebd2`…`c8eebd2`, 1 commit).** From audit 2026-09-12 (F-CODE-2). Small correctness fix.
**Gate: functional** — a bug fix with a clear right answer; planning verifies and
merges. Note: it changes the stored date **value** for *new* workouts go-forward
(no migration of existing records) — call this out at merge so Emilio's aware.

## Why

Two sites in `store.jsx` build a day key inline as
`new Date().toISOString().slice(0, 10)` — **UTC**:
- `store.jsx:214` — `plan.date` default in `startWorkout`.
- `store.jsx:233` — `activeWorkout.performedOn`.

Everything else in the app uses the canonical **local-time** `dateKey`
(`schedule.js:15-21`, via `getFullYear/getMonth/getDate`): `workout-actions.js:6`
already stamps `dateKey(new Date())`, and `storage.js` (`completedOnDayKey`),
Start, Settings, and all schedule matching compare against it. So near midnight for
any user behind/ahead of UTC the two disagree: a workout finished in the evening in
the Americas gets a `performedOn` of **tomorrow** (UTC), while the app groups and
displays by local `dateKey` — an off-by-one-day on the persisted record. The two
store sites are the only outliers. [measured, audit F-CODE-2 / structure sweep]

## Scope

- Import `dateKey` into `store.jsx` (currently only `clampLoopWeeks` from
  `./schedule`, `store.jsx:5`).
- Replace both `new Date().toISOString().slice(0, 10)` occurrences
  (`:214`, `:233`) with `dateKey(new Date())`.
- Nothing else — no migration of existing records, no schema change.

## Out of scope

- Rewriting existing workouts already stored with a UTC `performedOn` — they keep
  their value (mixed old-UTC / new-local is acceptable; a bulk rewrite is exactly
  the invisible edit the ask-gate forbids). Go-forward only.
- Any other date handling; `dateKey` itself is unchanged and already tested.

## Ordered steps

1. Add `dateKey` to the `./schedule` import in `store.jsx:5`.
2. Swap both UTC sites to `dateKey(new Date())`.
3. Test (`node --test`): prove the store stamps a **local** `dateKey`, not the UTC
   slice. Approach is CC's call — e.g. run under a large-offset `TZ` with a
   controlled instant, or assert the stored `performedOn`/`plan.date` equals
   `dateKey(new Date())` and is `dateKey`-shaped. If a fully deterministic
   boundary test needs clock injection (a refactor beyond this fix), a lighter
   assertion + the (already-tested) `dateKey` guarantee is acceptable — say which
   you did in the report.

## Acceptance criteria (written before implementation)

- Both UTC sites are gone; `git grep "toISOString().slice(0, 10)" src/store.jsx`
  returns nothing. Paste the grep.
- `startWorkout` stamps `performedOn` and the plan `date` via `dateKey` (local).
  Command: the new/updated test, output pasted.
- `./check` green — paste the line. Existing tests stay green.

## Decisions

- **classification:** functional bug fix (planning merges); go-forward value
  change on new writes, no migration.
- **implementation (CC's call):** the test approach for proving local-vs-UTC
  (see step 3).

## Notes

At merge, note to Emilio: existing workouts keep their old (possibly UTC-off-by-one)
`performedOn`; only new workouts are stamped local. No existing record changes.
