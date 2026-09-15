# req-76 — Continue resumes into the current exercise

Branch: `req-76`. `./check` green (lint + 224 tests / 19 files + build).

## Technical

On Continue/resume of an in-progress workout, routing now lands on the **current
exercise's log page** — the first item that is not done — instead of the overview.
Resume routing only; no data change.

**New pure helper** `resumeTarget(workout)` in `src/workout-actions.js`:
- "current" = first item where `!(itemIsMarkedDone(workout, item) || itemLoggingState(workout, item).plannedDone)`
  — the exact `completed` definition the overview uses (`overview.jsx:105`).
- A fully-**skipped** exercise reaches `plannedDone` (its skipped sets fill its set
  count), so it counts as done and is passed over — matching the decision that
  completed **and** skipped are both "not-current".
- If every exercise is done (or there are no items), it returns the overview
  `/workout/:routineId` (Finish visible) rather than a broken/empty item page.

**Wired into both resume entry points:**
- `startOrContinue` — only the *continuing-same* branch uses `resumeTarget(active)`;
  start-new keeps the overview as its landing (out of scope). The `replace` decision
  stays tied to the workout base, so behaviour for start-new is unchanged.
- `continueInProgress` — both the already-active and the promoted-draft paths route
  via `resumeTarget`.

**Supporting refactor (to honour "exact route via the existing `itemCurrentPath`"):**
`workout-actions.js` is loaded by `node --test`, which can't parse JSX, and
`itemCurrentPath` lived in `views/workout/helpers.jsx` (a JSX module). I extracted the
three pure path builders (`itemLogPath`, `itemDonePath`, `itemCurrentPath`) into a new
JSX-free module `src/workout-paths.js`; `helpers.jsx` now imports and **re-exports**
them, so its callers (`setup.jsx`, `item.jsx`, `overview.jsx`) are unchanged. One
source of truth for the item routes, and the action module can share it.

**Tests** (`workout-actions.test.js`, `resumeTarget` exported for this): nothing done →
first item; first item marked-done → next; first item planned-done → next; fully-skipped
→ passed over; all done → overview; no items/snapshot → overview; plus an integration
check that `startOrContinue` on the same active workout sets the hash to the current
item's log path with no restart.

**Domino check:** `resumeTarget` reuses the overview's own done-derivation, so the two
can't drift. The path-builder move is a re-export (callers unchanged), verified by the
green build + existing workout-screen tests. Store untouched.

**Acceptance criteria:**
- *Resume lands on current (browser)* — `resumeTarget` returns the first not-done log
  path; wired into both resume paths. Browser confirmation below.
- *Failure/edge: every exercise done → overview with Finish* — unit-tested
  (`resumeTarget(all-done) === '/workout/rtn-x'`).
- *No regression* — `./check` green.

## Workflow

- Followed the decision "current = first not-done (completed and skipped both count as
  not-current)"; confirmed skipped exercises are already `plannedDone`, so the single
  `completed` check covers them — no special skip handling needed.
- Deviation to flag: the req decision said "via the existing `itemCurrentPath`". Calling
  it directly from `workout-actions.js` is impossible (JSX module, and the action module
  is loaded by `node --test`), so I extracted the pure path builders into
  `src/workout-paths.js` and re-exported from `helpers.jsx`. Same function, now shared
  from a JSX-free home — the diff touches `helpers.jsx` but leaves its callers unchanged.
- Could not run the browser check (Chrome extension not connected in this session); the
  resume-lands-on-current behaviour is covered by unit + integration tests instead.
- No schema/data change; no `DEC-`/`L-` warranted (the path-module extraction is an
  implementation detail, already explained here).
