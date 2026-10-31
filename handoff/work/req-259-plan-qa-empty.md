**Status: READY** · **Lane: tooling** · req-159 (`plan qa`), DEC-155, L-033. After req-257 (same file `plan`).

# req-259 — `plan qa <ref> --empty`: serve a true first-time user

## Why (observed) [measured, `main` `4c1121b`, 2026-10-31]

`scripts/qa.mjs:59-67` `injectSeed` adds an inline script to the served `index.html`. On **every** load, when neither
`workout-mvp-v9` nor `workout-mvp-v8` is in localStorage, it writes the seed under v8. `start` always calls it (`:134`). The
only options are `--seed <file>` and `--node-modules` (`:120-123`; `plan:1588-1601` passes args through). So an empty origin
can't exist: clearing storage and reloading puts the seed back. Reproduction (the injected script run against a fake
localStorage):

```
node --input-type=module -e "… injectSeed(dist,'{\"v\":1}'); run the <script> …"
load 1 keys: [ 'workout-mvp-v8' ]
after clear: []
reload keys: [ 'workout-mvp-v8' ]      ← re-seeded
```

First-run screens (empty Today, create-without-days req-215, first-time help req-239) can't be QA'd on an isolated
origin. Today the only way is the dev server or a hand-built seed of an empty state, and an empty-state seed still goes
through the v8 migration path, so it isn't a first-time user either [inferred].

## Scope

1. `node scripts/qa.mjs start <ref> --empty` (and `./plan qa <ref> --empty`): build and serve exactly as today, **without**
   `injectSeed`. The served `index.html` has no seed script.
2. `--empty` together with `--seed` → refused before building: `plan qa: --empty and --seed are exclusive`.
3. The start line and `plan qa --status` say which it is: `seed: <file>` or `seed: none (--empty)`. Store it in the state
   file (`STATE_FILE`, `:33`).
4. Usage lines: `qa.mjs:3-5`, `plan help` (the `plan qa` entry), `plan:1592` usage.
5. Test: extend the existing qa tests if there are any (`grep -rn "qa.mjs" src server scripts`), else a small
   `node --test` file that builds nothing. It tests the argument parsing and that the HTML transform is skipped. Put the
   arg parsing in an exported function so this needs no vite build.

## Out of scope

- A sessionStorage marker so the default (seeded) mode stops re-seeding after a clear. Not asked for; `--empty` covers the
  first-time case.
- `scripts/smoke.mjs` (imports `buildRef`/`serveDir` and always runs seeded). Unchanged.
- `handoff/` (qa-branch skill, BUILDER.md QA text): Planner's. List what they should say in the report.

## Acceptance criteria

1. **The flag works:** `./plan qa main --empty`, then fetching `/` → the HTML contains no `workout-mvp-v8` string. In the
   browser, localStorage is empty after the first load and the app shows its first-time Today (screenshot or the
   `read_page` text in the report). `plan qa --stop` frees the port.
2. **The guard fires:** the new test's "no seed script with --empty" assertion fails against main's `qa.mjs`, where
   `--empty` is `unknown argument` (paste both runs).
3. **Failure case:** `--empty --seed x.json` → exit ≠ 0, the refusal on screen, and no build directory or server left
   behind (`plan qa --status` → none).
4. **Default unchanged:** `./plan qa main` without the flag is still seeded (the HTML contains the v8 key), and
   `node scripts/smoke.mjs` is green.
5. `./check` green.

## Checks run (WORKFLOW §Before READY)

1. DECs/L grepped (qa, seed, first-time, empty): L-033 (isolated origin), req-159. Nothing against a flag.
2. Siblings: req-257 edits `plan` (find_worktrees, ping, closeout). Build that first; here only the `qa` usage line. req-258
   edits `check`.
3. Deferral: the marker, as above. Its cost doesn't grow over time.
4. Numbers: line refs on `main` `4c1121b`; reproduction run 2026-10-31.
5. Trigger files: none. No reviewer, no backup.
6. `(unconfirmed)`: none. It's a Planner/Builder tool, and Emilio's steps don't change.

## Decisions made on Emilio's behalf

- **implementation:** a flag on the existing command, not a new command; `--empty` and `--seed` refuse together rather than
  one winning.
