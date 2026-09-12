# req-34 — close the gate holes: run the full gate in CI, and fix the test glob

**Status: READY, not built — functional gate.** Re-scan `deploy.yml`, `check`, and the test-file
layout against live code before sending to CC.

**Gate: functional** (DEC-009) — planning verifies + merges; no gym-test needed.

## Why

The green gate (`./check` = lint + tests + build) is enforced **only** locally by
`plan publish`/`plan closeout`. Two holes:

1. **CI doesn't gate.** [measured] `.github/workflows/deploy.yml` runs only `npm ci && npm run
   build` on push to `main` — no lint, no tests. So anything reaching `main` around `plan` (a plain
   `git push origin main`, or `WORKOUT_SKIP_CHECK=1`) deploys **live** as long as it *builds*, even
   with a red suite. There is no backstop once `plan` is bypassed.
2. **The gate doesn't run all tests.** [from NOW.md, verify] `./check` globs only top-level
   `src/*.test.js`; tests in subfolders (e.g. `src/views/history/`) silently never run — in the
   local gate *or* in any CI that copies that invocation. A gate with a blind spot is worse than a
   visible gap.

Both are "the gate has holes," so fix them together.

## The behaviour (decided)

- **CI runs the real gate before deploy.** In `deploy.yml`, before `npm run build`, run the same
  lint + tests the local gate runs (ideally invoke `./check` itself so there is one source of
  truth, or mirror its exact steps). A red suite must fail the workflow and **block the Pages
  deploy**. Keep the existing `paths:` filter.
- **Fix the test glob** so every `*.test.js` under `src/**` runs (update the `node --test` pattern
  in `check` — and anywhere else it's duplicated — to recurse, e.g. a glob that finds nested test
  files). After the fix, confirm the previously-skipped subfolder tests actually execute.

## Scope

- `.github/workflows/deploy.yml`: add the lint+test gate ahead of build/deploy.
- `check`: broaden the test-file selection to include nested `src/**` test files.
- Wherever the `src/*.test.js` pattern is hardcoded elsewhere (grep first), fix consistently.

## Out of scope

- Changing what the tests assert, or adding new tests (except that nested ones now run).
- PR-based CI / branch protection rules (solo flow; not now).
- Removing the `WORKOUT_SKIP_CHECK=1` local bypass — it stays (echoed, deliberate); CI is the
  backstop for when it's used.

## Acceptance criteria

- **CI gates (measured):** a branch with a deliberately failing test, merged to `main`, makes the
  deploy workflow **fail** and does not publish to Pages. (Show the failing run, then revert.)
- **All tests run (measured):** before — a nested `src/**/*.test.js` does not run under `./check`;
  after — it does. Paste the `node --test` file count before and after.
- **Green still deploys:** a normal green push to `main` builds and deploys as today.
- **No regression:** `./check` green locally; `plan publish` still runs it and refuses on red.

## Notes

- Hole #1 confirmed by reading `deploy.yml` in the 2026-09-12 session. Hole #2 is the "small
  follow-up" already noted in `NOW.md`; folded here because CI would inherit the same blind spot.
