**Status: BUILT AND MERGED, 2026-10-26 — branch `req-236` (`fbc383c`…`fbc383c`, 1 commit).** · **Lane: bug** · test-only

# req-236 — src/req-200.test.js fails every Monday: pin its clock

Emilio, 2026-10-26: "Fix src/req-200.test.js:93, which fails every Monday … pin the clock in the test."
Until this ships, `plan publish` needs `WORKOUT_SKIP_CHECK=1` on Mondays (`./check` runs this file).

## Reproduction (main, 2026-10-26, a Monday)

```
$ node --test src/req-200.test.js        # in workout-codebase, branch main
✖ from /schedule: Back stays /schedule (and the Today link shows)
  Error: render: click target not found
      at tap (src/req-200.test.js:49:14)
      at TestContext.<anonymous> (src/req-200.test.js:95:11)
ℹ tests 6 · pass 5 · fail 1
```

## Facts (rescanned 2026-10-26)

- `src/req-200.test.js:95` taps `link('Monday — Upper Body›')`; `link` matches the whole row text with whitespace
  removed (`:44-45`).
- `src/views/Schedule.jsx:94-95` marks today's row: `isToday` → `scheduleRowText(…)` gives `value: 'Today'`
  (`src/req-209.test.js:175` pins that output), so on a Monday the row reads `Monday — Upper BodyToday›` and the
  exact match finds nothing. Correct app behaviour; the test assumes "not Monday".
- The file reads the real clock everywhere. Other tests in it were written weekday-robust (`:102-106` comments).
- The pattern in use: `mock.timers.enable({ apis: ['setInterval', 'Date'], now: new Date(2026, 9, 7, 10, 0) })`
  with `mock.timers.reset()` in teardown (`src/req-210.test.js:147-150`, `src/req-214.test.js:54-58`). `setTimeout` is
  left real, which `flush()` (`:20`) needs.

## Scope

1. In the `:93` test only, pin `Date` to a fixed **non-Monday** local date (a Wednesday) with `mock.timers`, as in
   req-210; reset it after the test (also when it fails).
2. A test-edit comment at the pin: why (Schedule marks today's row, req-209), so nobody "un-pins" it.

## Out of scope

- Pinning the other tests in the file, or any other weekday-dependent test found on the way → name it in the report.
- Any change to `Schedule.jsx` / `scheduleRowText` — the "Today" mark is correct (req-209).
- Changing `link()` to a prefix match — it would weaken every caller.

## Acceptance criteria

1. **Fails on main, passes on the branch:** the reproduction above (main, run on 2026-10-26) and
   `node --test src/req-200.test.js` on the branch → 6/6 pass. Paste both.
2. **Failure case — could it pass for the wrong reason?** Temporarily set the pin to each of the 7 dates Mon–Sun
   (one run each), paste the 7 results: every one except the Monday one passes, and the Monday one fails with
   "click target not found" (proves the pin is what answers, not the machine's date). Ship the Wednesday pin.
3. The pin doesn't leak: the next test in the file sees the real clock (`Date.now()` within a few seconds of
   wall time) — assert it, or show it in the report.
4. `./check` green.

## Decisions made on Emilio's behalf

- implementation: pin only the one test, not the file; a Wednesday, not a Monday-proof selector.
