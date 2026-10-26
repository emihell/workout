**Status: READY** · **Lane: tooling** · CI (DEC-135 follow-up). **Order: after req-236** — CI runs `./check`,
which is red every Monday until req-236 ships.

# req-238 — deploy.yml becomes a check-only CI, re-enabled

Emilio, 2026-10-26: ".github/workflows/deploy.yml → check-only CI (drop the Pages deploy steps), then re-enable it."
DEC-135: Pages shut down; "Follow-up req: `deploy.yml` becomes a check-only CI gate (no Pages steps), so pushes to
`main` are tested again."

## Facts (rescanned 2026-10-26)

- `.github/workflows/deploy.yml`: name "Deploy GitHub Pages"; on push to `main`, `paths:` filter (`:6-15`, src/public/
  build files only — not `server/**`, `check`, `scripts/**` other than two); `permissions: contents: write` (`:17-18`);
  steps `npm ci` → `./check` (`:35`) → `node scripts/smoke.mjs` (`:40`) → `npm run build` with `GITHUB_PAGES` (`:41-43`)
  → `peaceiris/actions-gh-pages@v4` (`:44-47`). Node `'22'` (`:27`); `.nvmrc` is `22.23`, `engines` `>=22.16`.
- `gh workflow list --all` → `Deploy GitHub Pages  disabled_manually  346040229`; `pages-build-deployment  active`.
- Last runs: 4× success, newest `40234225874` 2026-10-25T21:10Z (`gh run list --workflow deploy.yml -L 4`) — so
  `./check` incl. the server tests (req-229) and the smoke run green on ubuntu.
- Stale "Pages" text: `check:8-10` ("main auto-deploys to GitHub Pages"), `check:21` ("the Pages deploy always runs
  it"), `scripts/smoke.mjs:2-3` ("It gates the Pages deploy"), `.claude/skills/closeout/SKILL.md:3,18-20` ("the deploy's
  CI run … a red run means the site did not ship").

## Scope

1. `deploy.yml`: name `CI`; job `check`; drop the `GITHUB_PAGES` build and the `actions-gh-pages` step;
   `permissions: contents: read`; keep `npm ci` → `./check` → `node scripts/smoke.mjs`. Node from `.nvmrc`
   (`node-version-file: .nvmrc`). **No `paths:` filter** — `./check` covers `server/**`, `scripts/**` and the
   skills check reads `handoff/` pointers, so any push can break it. Add `workflow_dispatch:` (AC 5 needs it).
2. Keep the file name `deploy.yml` (so the workflow id and `gh workflow enable` stay the same; the closeout skill's
   `--workflow deploy.yml` keeps working). Header comment: it no longer deploys; the live app is `./server/deploy`.
3. Comments: `check:8-10, :21`, `scripts/smoke.mjs:2-3` say CI, not Pages.
4. `.claude/skills/closeout/SKILL.md` step 6 (and the description's "the deploy's CI run"): "the CI run"; a red run
   means `main` is red, not that a site didn't ship.
5. **Planner, after merge:** `gh workflow enable deploy.yml`, then watch the first run.

## Out of scope

- The `GITHUB_PAGES` branch in `vite.config.js:31-34, :71` — dead now, removing it touches the build → backlog.
- `pages-build-deployment` (GitHub-managed; nothing to deploy since `gh-pages` is gone).
- Running `./server/deploy` from CI or closeout.
- Pull-request triggers (no PRs in this flow); push triggers on non-`main` branches.

## Acceptance criteria

1. `grep -n 'gh-pages\|GITHUB_PAGES\|contents: write' .github/workflows/deploy.yml` → no output; `actionlint` (or
   `npx --yes @action-validator/cli`) on the file exits 0, pasted.
2. `grep -rn 'Pages' check scripts/smoke.mjs .claude/skills/closeout/SKILL.md` → no stale "Pages deploy" text.
3. `./check` green.
4. **Planner, after merge + enable — the self-test that it fires:** `gh workflow list --all` shows `CI  active`; the
   push run is green (`gh run watch <id> --exit-status`, paste id + result, smoke step included).
5. **Failure case — does a red `./check` turn the run red?** Planner pushes a throwaway branch `ci-red-probe` (one
   deliberately failing `src/` test), `gh workflow run deploy.yml --ref ci-red-probe`, watches it → conclusion
   `failure` at the `./check` step; then deletes the branch (local + origin). Paste the run id + conclusion.

## Decisions made on Emilio's behalf

- implementation: keep the file name; no paths filter; smoke stays in CI (it ran green there before).
- After closeout Planner updates `handoff/CLAUDE.md` ("deploy.yml is disabled on GitHub" becomes stale) and NOW.
