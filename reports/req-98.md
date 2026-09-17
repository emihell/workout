# req-98 — guard the transitional false-win for timed exercises

Branch: `req-98` (off `main`). One correctness guard + a test. No capture code (that
already shipped in req-85).

## Technical

- **`src/beat-last-time.js`** — in `compareExercise`'s timed branch, require duration on
  **both** sides: `return prev > 0 && cur > prev ? 'longer' : null` (was `cur > prev`).
  - Before: `isTimed` fired if *either* side had `durationSec > 0`, so a newly-flagged
    timed exercise (real `durationSec` this workout) compared against a prior logged the
    old way (free-text `reps`, no `durationSec` → `prev = 0`) produced a bogus
    `cur=75 > prev=0` → false "↑ Longer" win. The guard makes that case silent — no
    comparable prior, no invented comparison (DESIGN §1 / DEC-050).
- **`src/beat-last-time.test.js`** — added the transitional case: `cur` has
  `durationSec: 75`, `prev` has `reps: '60s'` (no duration) → no win. The existing
  both-sided "75s > 60s → win" and "equal → silent" cases stay.

## Verified

- `node --test src/beat-last-time.test.js` → **18 pass / 0 fail** (was 17); the new
  `req-98 — no win when the prior has no duration` case passes.
- `./check` green — lint, 21 test files, build all passed. Weight/reps axes unchanged.

## Could not verify from here (browser — Emilio)

- End-to-end: flag plank as Timed in the exercise editor, log two same-routine sessions
  with a longer hold the second time → Finish shows "↑ Longer plank than last time".
  Needs an active workout on device.

## Workflow

- No deviation. Scope held to the single guard + test; `SetLogForm`/`item.jsx` (capture)
  untouched, no migration (Emilio flags timed exercises manually). Editing a past timed
  set's duration in `set-edit.jsx` remains the separate BACKLOG follow-up, not this req.
