# req-30 — no invented warmup reps (audit F1) + README wording (F2)

Branch: `req-30`. Gate: `./check` green (125 tests, lint, build). **Not merged** — ux-feel, Emilio's hands first.

## Technical

The routine editor stored `{ reps: 12 }` whenever "WU set" was ticked — a rep target the user
never typed — and that 12 surfaced as the warmup target live and on skipped warmups. Fixed so a
warmup carries only reps the user entered (or a saved value when editing).

Changes:

- **`src/views/Routine.jsx`** — `ExerciseFields`:
  - Added `warmupReps` state, seeded from `item.warmup?.reps` (blank for a new warmup, the saved
    value when editing — DESIGN §1 allows showing an existing record's own saved value).
  - Render a `Field` (`type="number"`, label "Warmup reps") gated on the `warmup` checkbox —
    hidden when "WU set" is unchecked.
  - Submit changed from `warmup ? item.warmup || { reps: 12 } : null` to
    `warmup ? { reps: warmupReps } : null`. A blank entry stores `{ reps: '' }` — a warmup with no
    rep number; nothing downstream substitutes one.
- **`src/views/workout/item.jsx:179`** — `String(item.warmup?.reps ?? 12)` → `?? ''`. A warmup with
  no reps shows a blank target; the set-log Reps field then starts empty (consistent with the
  prefill rule — an absent target means an empty field).
- **`src/workout-log.js:60`** — same `?? 12` → `?? ''` in `skippedSet`'s `wu` branch. A skipped
  warmup with no reps records `targetReps: ''`.
- **`src/workout-log.test.js`** — two new cases in the `workout logging` suite: a skipped warmup
  with `{ reps: '' }` → `targetReps: ''` (the receipt for the `?? 12` removal); a skipped warmup
  with a user-entered `{ reps: 12 }` still records `'12'` (nothing rewritten). Existing
  `{ reps: 12 }` fixtures pass unchanged.
- **`README.md:31`** — reworded: `db.json` is provenance/reference only, **not loaded at runtime**;
  first run starts from an empty state (`emptyState()` returns empty arrays).

### Choice left open by the spec

The spec left the blank-warmup storage shape to me (`{ reps: '' }` vs `{}`). I store
**`{ reps: '' }`** — it keeps the field's shape stable (`item.warmup.reps` is always present) so the
`?? ''` guards and the editor re-seed read consistently, and `String('' ) → ''` / `'' || ''` give a
blank target everywhere. Warmup reps are stored as the raw string the user typed (matching how the
`targets` reps field stores strings), not coerced to a number; the `?? ''` readers handle string or
number identically, so an existing saved numeric `12` still renders `'12'`.

### Out of scope (confirmed not done)

No migration, no rewrite of stored routines — routines already saved with `{ reps: 12 }` keep it
until the user next edits that exercise. Not a schema change (`warmup` already holds `reps`; no
version bump). Left the `exchange.js` example text as-is.

## Verification (receipts)

```
$ ./check
# tests 125 / # pass 125 / # fail 0
check: green — lint, 13 test file(s), and the build all passed.
```

Acceptance-criterion grep — no invented default remains:

```
$ grep -rn "?? 12\|{ reps: 12 }\|reps: 12" src README.md
src/workout-log.test.js:149  warmup: { reps: 12 },     # test fixture: user-entered 12 still honoured
src/workout-log.test.js:197  warmup: { reps: 12 },     # new test: same
src/exchange.js:39   'null, or { reps: 12 } for a WU set: …'   # AI-import contract example (in scope: leave)
src/exchange.js:101  warmup: { reps: 12 },             # exchange example
src/exchange.test.js:26  … warmup: { reps: 12 } …      # exchange test fixture
```

No `?? 12` in production code; every remaining `{ reps: 12 }` is a test fixture or the exchange
example text (explicitly out of scope).

README claims verified `[measured]`: `grep -rn "db.json" src` (excluding tests) returns no import —
`db.json` is referenced only in comments/README; `emptyState()` (`src/storage.js:30`) returns empty
`exercises`/`routines`/`workouts` arrays.

## What I could not verify

The browser-walk (spec step 6) is the ux-feel gate and is Emilio's — I did not run it. Unit tests
cover the skipped-warmup logic; the live rendering of the new field and the blank in-gym target need
a browser and a judgement about how a blank warmup target feels.

## Workflow

- No scope added or dropped; built exactly to spec. No mid-build decisions needed with Emilio.
- One spec-left-open choice surfaced above (`{ reps: '' }` storage shape, string reps) — candidate
  for a one-line note in the req closeout / a `DEC-` if the shape matters later.
