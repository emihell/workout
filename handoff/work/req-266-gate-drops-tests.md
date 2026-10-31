**Status: READY** · **Lane: tooling** · L-067, req-248 (timeout + force-exit), req-258 (zero-test files), DEC-155. Before req-259..265: every later merge trusts this gate.

# req-266 — the gate counts every test on every run

## Why (observed)

`./check` passes with tests missing. Main `9f3fcf8`, same files, 5 runs [measured 2026-10-31, Planner]:

```
node --test --test-timeout=60000 --test-force-exit --test-reporter=tap   (check's flags)
run 1 exit=0 # tests 2187 # fail 0
run 2 exit=0 # tests 2161 # fail 0
run 3 exit=0 # tests 2167 # fail 0
run 4 exit=0 # tests 2187 # fail 0
run 5 exit=0 # tests 2187 # fail 0
```

req-258's own closeout gate (`dcb3ad2`) printed `2175 test(s) in 144 file(s)` and passed; the branch measured 2187.
The req-258 builder saw a different file cut off partway each time (`storage.test.js`, `req-220.test.js`,
`req-139.test.js`), no `not ok`, exit 0. Without `--test-force-exit` its counts were complete 6/6, but
`src/req-203.test.js` and `src/req-220.rendered.test.js` keep a handle open → the 60 s timeout → exit 1.
Cause [inferred, builder's]: force-exit ends a file's child process before all its output reaches the runner.
`check:132` runs `WORKOUT_SERVER_TEST=1 node --test --test-timeout=60000 --test-force-exit …`.

## Scope

1. Find the cause (prove it: a run that loses tests and why). Fix it at the root — e.g. close the open handles in the
   two files and drop `--test-force-exit` — or whatever the evidence shows. Not a retry loop.
2. Keep req-248's guarantee: a test that hangs still turns `./check` red within the timeout, never hangs it.
3. Keep req-258's guard (a file that runs no tests → red).

## Out of scope

- A numeric test-count floor (rejected in req-258: needs bumping every req).
- Changing what any test asserts.

## Steps

1. Reproduce on main: 10 runs of check's exact `node --test` line, `# tests` per run.
2. Find and prove the cause; fix it.
3. 10 runs on the branch.
4. Re-run req-248's hang probe and req-258's zero-test probe on the branch.

## Acceptance criteria

1. **Fails on main, passes on the branch:** 10 runs each of check's test line. Main shows ≥ 2 distinct `# tests` values
   (or say so if it doesn't reproduce in 10 — then 20). Branch: 10/10 identical, equal to the sum of tests per file
   (run each file alone once and add them — the source, not just a stable number).
2. **Failure case — a hang still goes red:** a temp test file that never resolves (and one that keeps a handle open)
   → `./check` exits non-zero within the timeout and names the file. Probe deleted, not committed.
3. **Failure case — zero-test file:** req-258's `process.exit(0)` probe still → red.
4. `./check --smoke` green; total `./check` time before/after stated.
5. CI on the merge push: green, its `./check` count equal to the local one.

## Decisions made on Emilio's behalf

- Implementation only: how the cause is fixed, which flags `check` uses. Nothing a user sees; his steps don't change.

## Siblings

req-248 added `--test-force-exit`; req-258 added the TAP file and zero-test guard (`check:132-170`). No open req touches `check`.
