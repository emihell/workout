**Status: BUILT, NOT merged — branch `req-238` (`a2af718`)** · **Lane: tooling** · CI + Pages leftovers (DEC-135 follow-up; stage-1 fallout, DEC-143). req-236 (its
prerequisite) shipped. **Widened 2026-10-26:** every GitHub Pages leftover, not only CI (scope 6–8).

# req-238 — no GitHub Pages left: check-only CI, one build mode, README says where the app lives

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
  it"), `scripts/smoke.mjs:2-3` ("It gates the Pages deploy"), `.claude/skills/closeout/SKILL.md:3,18-20` (its
  deploy-CI-run step and the line after it — cited, not quoted: a quote trips `check_skills.py`, L-059).
- **Rescanned again 2026-10-26 (main `df367f9`)** — the Pages build mode still in code:
  `vite.config.js:29-35` (`syncEnabled`: "GITHUB_PAGES=true always wins") and `:71` (`base` `/workout/` under Pages);
  `src/sync/builds.test.js:2,22,41,49-53,56-64` builds and asserts a Pages bundle; `scripts/qa.mjs:40,49` and
  `plan:1125,1301-1302` unset `GITHUB_PAGES` defensively; `src/req-153.test.js:14` uses a `/workout/` URL as its base.
  Not Pages: `src/wake-lock.js:27` (`/workout/` there is the hash route).
- `README.md:3` "This browser-only MVP…", `:121` "Live (after GitHub Pages is set to the `gh-pages` branch):
  https://emihell.github.io/workout/", `:125` "This is the browser-only MVP… scope opens with the backend design (req-146),
  not before"; `:35` describes `localStorage` as the live store with no word of the server.

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
6. **One build mode fewer.** Drop `GITHUB_PAGES` from `vite.config.js`: `syncEnabled` is `WORKOUT_SYNC === 'true'`;
   `base` is `'/'`. Update its comment. Remove the now-dead unsets in `scripts/qa.mjs` and `plan` (comments too).
7. **`builds.test.js` keeps its guarantee, not its Pages build** (a test edit — name it in the report): the plain
   `npm run build` (no `WORKOUT_SYNC`) bundle has no login, no `/api/`, no service worker; the `syncEnabled` table drops its
   `GITHUB_PAGES` rows; the `/workout/` base assertion goes. Every marker the Pages test checked is still checked, on the
   plain build. `req-153.test.js:14` base → `http://localhost:5173/` (its fake browser reads only the hash, `:21` `hashOf`).
8. **README** says what's true: the app runs from Emilio's own server (`./server/deploy`, the `:8446` address, invite-only,
   tailnet-only), works offline, and syncs; `localStorage` is the phone's working copy (`:35`); drop the Pages "Live" line
   (`:121`); `:125` keeps "no accounts for others / sharing / training together yet" and points at req-146 stages 2–3.
   Wording only — no behaviour claim the code doesn't back (cite `server/README.md` for the details, don't copy them).

## Out of scope

- The `emihell.github.io` origin's old `localStorage` on any device (nothing to do in code; Emilio's data moved as rev 1).
- The `gh-pages` branch on origin, if it still exists — Planner checks after merge and asks Emilio before deleting it.
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

6. `grep -rn 'GITHUB_PAGES' --exclude-dir=node_modules --exclude-dir=handoff --exclude-dir=reports .` → no output (paste).
7. `npm run build` then `grep -c '/workout/assets/' dist/index.html` → `0`; `npm run build:server` still produces
   `dist-server/sw.js` (paste both).
8. **Failure case — the plain build must not grow sync code:** `builds.test.js` fails if `WORKOUT_SYNC` is ignored. Show it:
   temporarily make `syncEnabled` return `true`, run `node --test src/sync/builds.test.js` → red on the plain-build markers;
   revert → green. Paste both runs.
9. `grep -n -i 'browser-only\|github.io\|gh-pages' README.md` → no output.

## Decisions made on Emilio's behalf

- implementation: keep the file name; no paths filter; smoke stays in CI (it ran green there before); scope 6–8 added
  by Planner under DEC-143 (Pages is gone, so its build mode is fallout, not new work).
- After closeout Planner updates `handoff/CLAUDE.md` ("deploy.yml is disabled on GitHub" becomes stale) and NOW.
