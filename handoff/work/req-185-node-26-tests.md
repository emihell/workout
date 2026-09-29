# req-185 — the test suite passes on Node 26

**Status: BUILT AND MERGED, 2026-09-29 — branch `req-185` (`8071ff3`…`8071ff3`, 1 commit).** **Lane: bug** · test-support only, no app, store or schema change. Emilio's go: "run it" (2026-09-29).

Source: Builder, 2026-09-29, from the stale Mac: "The test suite fails on Node 26 … starting with
src/req-183.test.js:110 'Cannot read properties of undefined (reading 'clear')'". Emilio's local default is Node 26
(`node --version` → `v26.8.2` in the planning worktree, `~/.nvm/versions/node/` holds `v22.23.3` and `v26.8.2`);
CI pins 22 (`.github/workflows/deploy.yml:27` `node-version: '22'`), so Pages is unaffected — this is a local-gate bug:
`./check` is red on the machine Emilio actually uses, and every shell needs `nvm use 22` until it's fixed.

## Reproduction [measured, Planner 2026-09-29, main @ da75cf8, `git archive HEAD` + `npm ci` in a scratch dir]

```
node v22.23.3 --test   →  # tests 1222  # pass 1222  # fail 0
node v26.8.2  --test   →  ℹ tests 1222  ℹ pass 1172  ℹ fail 50
```

Two independent causes:

**A — 48 failures, `TypeError: Cannot read properties of undefined (reading 'clear')`.** Node 26 has its own
`globalThis.localStorage`: `node -e "console.log(Object.getOwnPropertyDescriptor(globalThis,'localStorage'))"` prints a
`get`/`set` pair, and the getter returns `undefined` without `--localstorage-file` (Node warns: "--localstorage-file was
not provided"). `src/test-support/render.js:29` installs a happy-dom global only when `!(key in globalThis) || key ===
'navigator'`, so `localStorage` (and `sessionStorage`, same list at `:23`) stays `undefined`. Every render-harness file
fails (req-117, 156, 162–183, route, rest-cue, wake-lock, skip-replace, workout-actions, error-boundary, …).

**B — 2 failures, "date cases pass under TZ=Europe/Stockholm / America/New_York".** `src/dates-tz.test.js:17` spawns a
child `node --test` and guards a vacuous pass with `/# pass [1-9]/` and `/# fail 0/` (`:23-24`). Those are TAP lines.
Node 26's default reporter to a non-TTY is `spec` (`ℹ pass 9`), so the child passes (exit 0) and the guard misses:
`TZ=Europe/Stockholm node --test src/dates-tz.cases.js | cat` → v22 `# pass 9 / # fail 0`, v26 `ℹ pass 9 / ℹ fail 0`.

**Bare-bones test of the fix [measured, scratch copy only, not committed]:** A = add `|| globalThis[key] === undefined`
to the `render.js:29` condition; B = `['--test', '--test-reporter=tap', cases]` at `dates-tz.test.js:17`. Result: v22
`# pass 1222 # fail 0`, v26 `ℹ pass 1222 ℹ fail 0`. Builder may shape the code differently; the criteria are what bind.

## Scope — ordered

1. **render.js (cause A).** A global the app needs is installed from happy-dom when Node doesn't define it **or defines
   it as `undefined`**. Update the comment at `:20-21` to say why (Node 26's getter). Don't blanket-replace
   `localStorage` — a future Node with a working one is still replaced only if the harness needs it replaced
   (implementation call, Builder's).
2. **dates-tz.test.js (cause B).** The child runs with an explicit TAP reporter. **The two guard regexes stay exactly as
   they are** — the fix is to the child's reporter, never to the guard.
3. **A guard test** (`src/test-support/render.test.js` or similar; `./check:54` `find src … -name '*.test.js'` picks it
   up): after importing `render.js`, `localStorage` and `sessionStorage` are usable Storages (setItem → getItem round
   trip, `clear` is a function). Passes on 22 and 26 alike, so it holds CI too.
4. **`.nvmrc`** at the repo root containing `22` — matches CI, so `nvm use` on any machine picks the CI version.
5. **README** install section (`README.md:55-56`, "# 3 — install dependencies"): one line naming the Node version — CI
   runs 22 (`.nvmrc`); 26 also passes after this req.

## Out of scope

- Changing CI's `node-version` (stays `'22'`). Moving CI to 26 is a separate call.
- `package.json` `engines` (npm only warns; `.nvmrc` is the lever for nvm machines).
- Changing Emilio's nvm default — that's his machine.
- Any `src/` file outside `test-support/` and `dates-tz.test.js`; any app, store, storage or schema change.
- Node 26's own `localStorage` in the app — the app runs in the browser; this is test-harness only.

## Acceptance criteria

1. **Fails on main, passes on the branch (Lane bug gate)** — both receipts, full suite:
   `~/.nvm/versions/node/v26.8.2/bin/node --test` on main → `fail 50`; on the branch → `fail 0`.
2. `./check` green under **Node 22** (`nvm use 22`) — the CI version is not regressed. Paste the green line.
3. `./check` green under **Node 26**. Paste the green line.
4. **Could this pass for the wrong reason?** `git diff main -- src/dates-tz.test.js` shows the regexes `/# pass [1-9]/`
   and `/# fail 0/` unchanged — the guard was not weakened. And it still fires: with the child pointed at a file with
   zero tests (temporarily, not committed), the TZ test fails on the `# pass [1-9]` assertion. Paste that output.
5. **Is the right mechanism answering?** The guard test (step 3) asserts `localStorage` round-trips a value — not just
   `!== undefined` — so an empty stub or Node's undefined getter can't satisfy it. Run it alone on 26: pass.
6. `cat .nvmrc` → `22`. No test edited except `dates-tz.test.js`'s spawn arguments; any other test edit is a deviation
   to report.

## READY checks

1. DECs/LESSONS: `grep -nE "Node (2[0-9]|version)|nvm|engines" handoff/log/DECISIONS.md handoff/log/LESSONS.md` → none.
   `git log --all -i --grep="nvmrc\|node 26"` → none; `git ls-files | grep nvmrc` → none.
2. Siblings: render.js is req-156's harness; no open req touches it or `dates-tz.test.js` (req-114's). req-184 is
   design (no code) — no order conflict.
3. Deferrals: none.
4. Numbers: 1222 / 1172 / 50 / 48 / 2 all from the runs quoted above.
5. Trigger files (`store.jsx`, `model.js`, `storage.js`, `progress.js`, `workout-log.js`, migration paths): **none
   touched** → no independent reviewer, no backup reminder. No stored data is read or written.
6. `(unconfirmed)` calls: none — nothing a user sees.

## Decisions made on Emilio's behalf (all implementation)

- Fix the harness for 26 **and** pin `.nvmrc` to 22 (rather than only pinning): Builder offered "your call on scope";
  fixing means Emilio's default Node runs the gate with no `nvm use`, and the pin keeps nvm machines on CI's version.
- The Node-version line goes in `README.md` (install section), not `CLAUDE.md` — it's setup, and README already owns
  install.
