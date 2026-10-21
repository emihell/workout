**Status: BUILT, NOT merged** **Lane: tooling**

# req-228 — the test suite gives the same result on any machine locale

## The failure, observed (2026-10-21)

On Emilio's Mac (`LANG=en_GB.UTF-8`) `./check` is RED on `main` (`dcacdf2`), so every `plan publish` needs
`WORKOUT_SKIP_CHECK=1`. [measured]

```
$ node --test           → ℹ tests 1940 · pass 1936 · fail 4
$ LANG=en_US.UTF-8 node --test   → pass 1940 · fail 0
```

Failing: `src/req-200.test.js:76`, `src/req-203.test.js:90`, `src/req-209.test.js:114`, `:121` — e.g. actual
`'Last time: 7 Oct · 14 kg × 15'`, expected `'Last time: Oct 7 · 14 kg × 15'`. CI (en-US) is green.

## Scope

Make the suite locale-independent. **The app's own date output is unchanged** (the phone's locale still decides what the user
sees) — this is a test-harness fix, not a behaviour change. How (pin the locale for the run in `./check` *and* plain
`node --test`, or have the tests pass an explicit locale) is Builder's choice; state it in the report.

## Out of scope

Any change to how the app formats dates. The other tests.

## Acceptance criteria

1. `LANG=en_GB.UTF-8 ./check` → green. `LANG=en_US.UTF-8 ./check` → green. `LANG=de_DE.UTF-8 node --test` → fail 0. Paste all three.
2. **Failure case — the guard fires:** temporarily change one of the four expectations to the en-GB form; the suite fails on
   every locale (proves the test still checks the text rather than being skipped). Paste the red line, then revert.
3. No app source file under `src/` other than tests/test helpers changes (`git diff --stat main`).
