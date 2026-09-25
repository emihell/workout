# req-159 — `plan qa`: an isolated browser build of any branch, and a scripted smoke test that gates deploy

**Status: BUILT — branch `req-159` (`75b5f82`), NOT merged.** (2026-09-24) — tooling. DEC-085 §5 + planning's list. Gate: tooling (run it, paste output). Source:
`audits/workflow-2026-09-24.md` (recommendation 1), L-033, L-036. Builds on `scripts/capture.mjs` / `screenshot.mjs`
(puppeteer already in devDependencies — verify).

1. **`./plan qa <ref>`** (read-only to both worktrees): `git archive <ref>` into a temp dir, borrow `node_modules`, `vite
   build`, serve on a free `127.0.0.1` port (its own origin — never the dev or live data), seed `src/db.json` under the v8
   key (or `--seed <file>`), print the URL; `--stop` tears it down. Safe to run from the planning worktree.
2. **A smoke script** (`scripts/smoke.mjs`, headless) against that server: native `confirm/alert/prompt` stubbed to
   *record* (any call fails the run); the core loop by real clicks — Start today's routine → log a set typed "22,5" → skip
   an exercise → Finish → Save → stored workout has 22.5 kg and the skipped sets → Back never renders "Not found." → History
   shows the workout. Exit non-zero on any failure, with the step and the DOM text.
3. **Gate deploy on it:** the Pages workflow (`.github/workflows/deploy.yml`) runs the smoke test before publishing; a red
   smoke blocks the deploy. (Local `./check` may call it behind a flag; don't make every `./check` slow — say the timing.)

## Acceptance criteria

- `./plan qa main` prints a URL; the page loads with the seed; `--stop` frees the port (paste).
- `node scripts/smoke.mjs` green on main (paste); make it fail once on purpose (e.g. break the "22,5" parse in a temp copy)
  and paste the red output.
- The deploy workflow shows the smoke step (paste the YAML diff); a local run of the workflow steps is enough.
