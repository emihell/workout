**Status: BUILT AND MERGED, 2026-10-26 — branch `req-248` (`0227517`…`ba91d9f`, 3 commits).** · **Lane: tooling** · the gate itself. Before req-240 (it guards the rest of batch 7).

# req-248 — a hanging test turns the gate red instead of hanging it

## The failure, observed

req-239's mutation check (`reports/req-239.md`): a regression in `setupPromptShows` made the rendered test file **hang**; it
only stopped because Builder ran it with `--test-timeout`. `./check:100` runs `WORKOUT_SERVER_TEST=1 node --test
"${testfiles[@]}"` with **no** timeout, and `.github/workflows/deploy.yml` job `check` (`:17-19`) has no `timeout-minutes`
(GitHub's default: 360 min). So the same regression would hang `./check`, which means `plan publish` and closeout hang too,
and CI would hang for 6 h instead of going red. Planner's probe, 2026-10-26: a test that never resolves under
`node --test --test-timeout=1500` → exit 1 (cancelled counts as a failure).

## Scope

1. `./check`: add `--test-timeout=<N>` to the `node --test` call. Pick N from a measurement: run the suite once, find the
   slowest single test **and** the slowest hook (`builds.test.js`'s `before` runs two `vite build`s), and set N to
   about 3× the slower of the two, rounded up. Paste the measurement. Check that the timeout covers hooks; if it doesn't,
   say how the slow hooks are bounded.
2. `deploy.yml` job `check`: `timeout-minutes:` about 3× the green run's 2 min 3 s (run 40354463101) → 10.
3. A comment at each site: why (req-239, this req).

## Out of scope

- Fixing whatever made the req-239 mutation hang (it's a mutation, not shipped code).
- Per-file timeouts or retries.

## Acceptance criteria

1. **Failure case, the guard fires:** a throwaway test that never resolves, run through `./check` (temporarily added,
   then removed) → `./check` exits non-zero within about N seconds, naming the test as cancelled/failed. Paste the tail and
   the elapsed time.
2. `./check` green on the branch, with its total time compared to main's (paste both; the timeout must not slow it).
3. `grep -n 'timeout-minutes' .github/workflows/deploy.yml` → one line.
4. **Planner, after merge:** the push's CI run is green.

## Decisions made on Emilio's behalf

- implementation: the values of N and timeout-minutes come from measurements. Nothing he sees changes.
