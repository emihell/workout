# req-172 — every screen opens at the top

**Status: BUILT — branch `req-172` (`290a306`, 2 commits), NOT merged.** (2026-09-25) **Lane: bug.** Source: beginner-persona run (req-144 prep §E, "Bug"). Binary fix, DEC-091 §4.

## Reproduction [measured by the persona agent, main `63f4554`, 390×844, empty seed; both runs]
A routine with ≥4 exercises → Add exercise → Save → the routine screen comes back at `scrollY` 58.5 (4th) / 136.5 (5th),
0 with ≤3; the next tap on "Add exercise ›" hit the Leg Press row. The exercise edit screen also opened scrolled, title cut off.
Cause [measured, grep]: nothing in `src/` scrolls on navigation — `grep -rn -E 'scrollTo|scrollIntoView|scrollRestoration' src`
→ no hits; hash navigation keeps the previous screen's scroll.

## Fix
On a route change to a **different path**, scroll the window to the top (one place — where `useHashRoute`'s path
changes, `route.js` / `App.jsx:96`). Same-path re-renders (logging a set, a rest tick) never scroll.

## Out of scope
Restoring a list's previous scroll on Back (would need stored positions; revisit only if it's missed). No stored data.

## Acceptance criteria
1. **Fails on main, passes on the branch:** a browser run of the reproduction — `scrollY` after Save is `0` on the branch,
   >0 on main (both receipts, 390×844).
2. **Failure case — no jump mid-screen:** completing a set, a rest countdown, and typing in a field on the same screen
   leave `scrollY` unchanged (a test or browser receipt).
3. `./check --smoke` green (paste).

Decisions on Emilio's behalf: **implementation** — scroll on path change in one place. **Behaviour** — Back to a list also
opens at its top (not the old position); minor, stated here so it's reversible. Siblings: req-173..175 (no shared files
expected). Trigger files: none.
