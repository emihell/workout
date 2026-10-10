**Status: READY** **Lane: bug** — test-only; no product code.

# req-218 — req-178 / req-182 rendered tests flake since req-217 (provider remount, L-051)

Found by the deploy of req-217: run `38082387254` failed at `./check` (`# fail 2`), so **req-217 is on `main` but not on the live
site** (last good deploy `38081307463`, req-212). Builder: throwaway agent.

## Reproduction [measured, 2026-10-10]

- CI: `not ok 1 - routine kg 50, history 40 → … Update routine → routine 55` (`src/req-178.test.js:405`) and `not ok 1 - Chest
  Press, routine [30], logged [32.5] → … Update routine → v9 [32.5]` (`src/req-182.test.js:39`).
- Local, `main` c0728c6, `node --test src/req-178.test.js src/req-182.test.js` ×5 → fail 0, 1, 1, 0, 1.
- Same command ×8 on bc4f013 (before req-217) → fail 0 every time.
- Product is fine: the routine-kg sheet's Yes on a `plan qa` build of c0728c6 wrote the routine 4/4 (`[32.5,32.5,32.5]`).
- Cause (L-051, req-217 report): these harnesses mount a fresh `StoreProvider` per screen; the sheet is answered after the log
  screen's provider unmounted, and the write only landed via React's eager-state path. req-217's library hook adds a render
  (async chunk load) that turns it off. req-217 already fixed `src/req-187.test.js` the same way.

## Scope

1. Change the harnesses in `src/req-178.test.js` and `src/req-182.test.js` to keep one `StoreProvider` and swap the screen inside
   it (as req-187.test.js now does). Assertions unchanged.
2. Grep every other rendered test for the same per-screen provider remount followed by a store write; fix any found the same way
   and list them.

## Out of scope

Product code; test assertions; the library hook.

## Acceptance criteria

1. **Fails on main, passes on the branch:** `for i in $(seq 20); do node --test src/req-178.test.js src/req-182.test.js; done`
   — paste the fail counts on `main` (≥1 failure) and on the branch (0 failures in 20).
2. No assertion changed (diff shows harness lines only) — called out per file.
3. `./check` green; smoke after commit.

## Decisions made on Emilio's behalf

- **implementation:** test harness only; no user-visible change.
