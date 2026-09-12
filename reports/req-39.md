# req-39 — reject a malformed backup cleanly, not a raw TypeError (audit F-RISK-4)

Branch `req-39`. Functional gate (planning merges). Not merged.

## Technical

A backup whose `state.workouts` (or `state.schedule.slots`, etc.) was present but not
an array reached `migrateState` and threw a raw `TypeError: … map is not a function`
instead of the intended `"Not a workout database backup."`. Root cause:
`unwrapBackup` (`exchange.js`) only checked `state` was an object, not that its
collection fields were arrays.

**`src/exchange.js`** — hardened `unwrapBackup` (no `migrateState`/`model.js` change,
per the spec's critical constraint):
- New `COLLECTION_FIELDS = [exercises, routines, sessions, programs, workouts,
  plannedWorkouts, draftWorkouts]` and a `collectionsAreArrays(root)` helper: a field
  that is **present but not an array** → reject; **absent is fine**. `schedule.slots`
  checked via `root.schedule?.slots` (optional chaining keeps a non-object/absent
  schedule safe; only a present non-array `slots` rejects).
- Applied on **both** paths: the wrapped `{kind, state}` path (validates `state`) and
  the bare-document path (validates `payload` — the bare path never checked `workouts`
  before, so a non-array `workouts` used to sail through to the TypeError).
- A reject returns `null`, so `applyBackup` throws the existing friendly
  `"Not a workout database backup."`. No new message strings.

**Why not guard `migrateState`** (spec's fixed design): array-guarding the `.map`
sites would make `migrateState` *succeed* on corrupt `workouts`/`slots` (silently
dropping them). On the **load** path that would let req-36/DEC-032's corrupt-`v8`
guard think the value is readable and then overwrite it — silent data loss. The load
path depends on `migrateState` throwing on garbage; only the import boundary is
hardened.

**`src/exchange.test.js`** — new `req-39 malformed-backup validation` describe:
- the two measured repros (`state.workouts:'oops'`, `state.schedule.slots:'x'`) now
  throw with `message === 'Not a workout database backup.'` (asserts the message via a
  validator fn, not just that it throws — a TypeError would fail it).
- every present-but-non-array collection field rejects (loops all seven).
- a bare document with non-array `workouts` also rejects (the previously-unchecked path).
- **anti-regression:** a real `buildBackup(base)` output round-trips through
  `applyBackup` unchanged (no false-reject).
- a backup omitting collections (no workouts/plans/drafts/slots) still imports.

### Verification
New tests green:
```
# Subtest: req-39 malformed-backup validation
    ok 1 - the two measured repros throw the friendly message, not a TypeError
    ok 2 - rejects every present-but-non-array collection field
    ok 3 - rejects a non-array collection on a bare (unwrapped) document too
    ok 4 - a real buildBackup output still round-trips (no false-reject)
    ok 5 - a backup that omits collection fields still imports (absent is fine)
```
`exchange.test.js`: `# tests 9 # pass 9 # fail 0`.
`./check` green:
```
check: green — lint, 15 test file(s), and the build all passed.
```
Diff scope (only the two files; `model.js` untouched):
```
 src/exchange.js      | 32 ++++++++++++++++++++++++--
 src/exchange.test.js | 66 ++++++++++++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 96 insertions(+), 2 deletions(-)
```

Acceptance criteria: both malformed payloads throw the friendly message (asserted) ✅;
real `buildBackup` still imports ✅; `migrateState`/`model.js` unchanged ✅; `./check`
green ✅.

## Workflow

- Built to spec. Validation added at `unwrapBackup` only; `migrateState` deliberately
  left throwing (protects req-36's load guard).
- **One thing I hardened beyond the two named repros** (in scope per the spec's field
  list): the **bare-document path** also now validates collections. The spec's repros
  were both wrapped (`kind` present), but the bare path — used for raw `db.json`-style
  imports (`applyBackup(base)`) — checked only `exercises` + a routine-family array and
  would have thrown the same TypeError on a non-array `workouts`. Covered and tested.
- No decisions needed from Emilio; functional gate, no persisted-data write in the fix
  itself (it only rejects earlier).
- **Merge sanity check for Emilio** (import is a bulk write): export a real backup from
  the app and re-import it — confirm it still imports (no false-reject on genuine
  data). L-001 if planting a malformed file in a real browser.
</content>
