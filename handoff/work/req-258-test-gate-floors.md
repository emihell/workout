**Status: READY** · **Lane: tooling** · req-114 (dates-tz), req-248 (test timeout), req-238 (CI), DEC-155, L-045.

# req-258 — the gate can't pass on tests that didn't run; CI actions to current majors

## Why (observed) [measured, `main` `4c1121b`, 2026-10-31, Node v22.23.4]

**1. The dates-tz guard passes when no date case runs.** `src/dates-tz.test.js:25` asserts `/# pass [1-9]/` on the child
run of `dates-tz.cases.js` (10 `it(` blocks today). The file that only proves the run happened always counts as one pass:

```
: > empty.cases.js; node --test --test-reporter=tap empty.cases.js | grep -E '^# (tests|pass|fail)'
# tests 1
# pass 1          ← matches /# pass [1-9]/; also true with 1 of the 10 cases left
# fail 0
TZ=Europe/Stockholm node --test --test-reporter=tap src/dates-tz.cases.js → # tests 10 / # pass 10 / # fail 0
```

**2. A test file that exits without running its tests is a green pass.** The req-248 report saw one pre-watchdog run end at
2096 of 2108 tests: req-10's 12 rendered tests were missing and no ✖ line was printed (not reproduced since). Here is what
Node does with a file that exits before its tests run:

```
a.test.js (2 tests) · b.test.js (1 test) · c.test.js = `process.exit(0)`
node --test --test-reporter=tap a.test.js b.test.js c.test.js
ok 1 - a / ok 2 - b / ok 3 - c
ok 3 - c.test.js          ← the file itself, reported as a passing test
# tests 4 / # pass 4 / # fail 0
```

A file-level `ok N - <path>.test.js` line means that file ran zero tests. On `main` the full suite (144 files,
`./check`'s file list, TAP reporter) has **none**: `# tests 2186 / # pass 2186 / # fail 0`, and
`grep -E '^(not )?ok [0-9]+ - .*\.test\.m?js$'` → no lines. So the rule "no file may run zero tests" holds today with no
exceptions. `./check:127` runs `node --test` with the default reporter and no count is captured
(`check:107` prints only the file count).

**3. CI actions are a major behind.** `.github/workflows/deploy.yml:25-26` `actions/checkout@v4`, `actions/setup-node@v4`.
The req-238 run 40354463101 warned that both are deprecated and forced onto Node 24.
`gh api repos/actions/checkout/releases/latest` → `v7.0.1` (2026-07-20); `…/setup-node/…` → `v7.1.0` (2026-10-08).

## Scope

1. **dates-tz:** assert the exact count. `dates-tz.cases.js` exports (or the test reads) the number of cases, and
   the guard asserts `# pass ${N}` and `# tests ${N}`. Adding a case must not need a second edit, so the count comes
   from the cases file, not from a literal in the test.
2. **`./check`:** add a second reporter that writes TAP to a temp file, keeping the terminal output as it is today
   (`--test-reporter=spec --test-reporter-destination=stdout --test-reporter=tap --test-reporter-destination=<tmp>`,
   or equivalent). After a green run, go RED (exit 1, through `fail`) when:
   - any line `^(not )?ok [0-9]+ - .*\.test\.m?js$` → `check: RED — <file> ran no tests (it exited before they ran).`
   - no `# tests N` line, or N = 0.
   On green, the closing line names the count: `… N test(s) in M file(s) …` (`check:162,166`).
   The temp file is removed on every exit path. The req-248 watchdog and timeout keep working (`check:113-150`).
3. **CI:** `actions/checkout@v7`, `actions/setup-node@v7`; `node-version-file: .nvmrc` and `cache: npm` kept. Check the v7
   release notes for a renamed or removed input and record what you read.

## Out of scope

- A numeric floor (a committed minimum count). It would need a bump in every req; part 2 catches the observed failure, a
  whole file silently skipped, with no number to maintain.
- A file that runs **some** of its tests and then exits 0. Not observed; say in the report whether part 2 catches it.
- The manual `scripts/*.test.sh` suites. Wiring them into `./check` is a separate item.

## Acceptance criteria

1. **The guard fires (dates-tz):** with `dates-tz.cases.js` reduced to 1 case in a temp copy, the guard test fails, and
   it passes on the real file. Main's guard passes the reduced copy (paste all three runs).
2. **The guard fires (./check):** a temp test file `src/zz-req-258-probe.test.js` containing `process.exit(0)` (plus one real
   test above it that never runs) turns `./check` RED and names the file. Main's `./check` with the same probe is green
   (paste both). The probe is deleted afterwards and is never committed.
3. **Failure case, no false RED:** `./check` on the branch is green, and its last line shows the test count
   (≈2186 + this req's own).
4. **CI:** the first push of the merge runs green on v7 with no deprecation annotation (the run id in SHIPPED, Planner's at
   closeout). The branch can't push, so the builder shows `deploy.yml` parses (`node -e` with any YAML parse available, or
   `gh workflow view` if it works) and lists the v7 notes read.
5. A hang still goes red: `WORKOUT_TEST_LIMIT=5` with a hanging probe → RED within ~10 s, and the temp TAP file is gone.

## Checks run (WORKFLOW §Before READY)

1. DECs/L grepped (dates-tz, floor, count, timeout, actions): L-045 (guards must fail on vacuous input), req-248's report,
   DEC-155. Nothing governs the reporter choice.
2. Siblings: req-257 edits `plan`, not `check`. req-248 (merged) built the watchdog that part 2 must keep.
3. Deferral: the numeric floor, re-priced above. Its cost grows with every req, while part 2's cost stays the same.
4. Numbers: 2186 / 144 / 10 cases / v7.0.1 and v7.1.0 measured 2026-10-31 (commands above).
5. Trigger files: none. No reviewer, no backup.
6. `(unconfirmed)`: none. The gate only gets stricter, and Emilio's steps don't change.

## Decisions made on Emilio's behalf

- **implementation:** catch a zero-test file instead of keeping a count floor; take the dates-tz count from the cases file;
  move to v7 now rather than "when convenient".
