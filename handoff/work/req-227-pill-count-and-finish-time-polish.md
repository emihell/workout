**Status: BUILT, NOT merged — branch `req-227` (`31a15d9`…`ed29841`).** **Lane: ui** — display fixes; touches `workout-log.js` → independent reviewer (DEC-057).

# req-227 — GO count includes a reopened swapped exercise; Finish screen and Save agree; auto-complete says "left open"

Cleanup batch 2026-10-14 (Emilio: "A cleanup batch - do it"). BACKLOG §req-222 follow-ups (a)(b), §req-224 follow-ups (a)(c).
Builder: throwaway agent (DEC-055). After req-226.

## Facts (rescanned 2026-10-14, `main` c474c9d)

- `workoutPosition` (`workout-log.js:1187-1192`): counted = items not `itemSwappedAway`; `current = min(total, done + 1)`. A swapped-away
  item reopened by Add set on its review (`reopenItemPatch` + add set) is current (the pill points at it) but not counted → "4/4"
  with work left (reviewer probe "reopen+add set on swapped-away a → GO · 4/4"); the cap hides "5/4".
- Stale comment: `currentWorkoutItem`'s "a Skip exercise / Swap alone … shows no pill" (`workout-log.js:~1052`) — false since req-222.
- Finish screen: `const [finish] = useState(() => finishTimeFor(active, Date.now()))` (`views/workout/finish.jsx:37`) — computed at
  mount; the store recomputes at Save (`store.jsx:~239`). Open Finish 10:55 (last set 10:50), Save 15:00 → screen said "55 min", no
  line; History "50 min".
- Auto-complete: uses `finishTimeFor(active, mountNow)` (`auto-complete.jsx:56`) for Duration, shows no "left open" line.
  Text helper `leftOpenText` lives in `finish-unfinished.js` (req-224).

## Scope

1. `workoutPosition`: a swapped-away item that is **not done** counts (in total and as current). A swapped-away done item stays out.
2. Fix the stale `currentWorkoutItem` comment.
3. Finish screen: the finish time it shows is re-derived while the screen is open (e.g. a 30 s tick) and **Save saves exactly the
   time the screen shows** (one value, passed to the store; `finishedState`'s default stays now for every other caller).
4. Auto-complete summary: when the rule applied, the same "You left this workout open — saved as finished at …" line shows.

## Out of scope

req-224 follow-up (b) (`finishedForPlan` after a left-open save — arguably correct, stays in BACKLOG); the 3 h rule; pill format.

## Acceptance criteria

1. Unit: swap A→A2, open A's review, Add set → `workoutPosition` total includes A; current ≤ total; never "N/M" with N > M.
2. Unit: swap A→A2 with A not reopened → total unchanged from req-222 (A excluded).
3. Rendered (fake timers): last set 10:50, open Finish at 10:55 → "55 min", no line; advance to 15:00 → screen shows "50 min" + the
   left-open line; Save → stored `finishedAt` === the last set's `loggedAt`.
4. **Failure case — is the right mechanism answering?** In 3, assert the stored value equals the value the screen rendered (read
   from the DOM), not just "some earlier time".
5. Rendered: auto-complete summary of a left-open workout shows the line; a normal one doesn't.
6. Existing req-222 / req-224 tests stay green (any edit listed with reason).
7. `./check` green; smoke green.

## Decisions made on Emilio's behalf

- **behaviour** `(unconfirmed)`: the Finish screen's minutes and line update while it's open (follows DEC-125 §4 "said plainly").
- **behaviour** `(unconfirmed)`: auto-complete shows the same left-open line.
- **behaviour** `(unconfirmed)`: a reopened swapped-away exercise counts in "N/M".

## READY checks

1. DEC-125 §3–4. 2. Siblings: req-226 (tests) first. 3. none. 4. probes from the req-222/224 reviewers. 5. `workout-log.js`, `store.jsx`
   → reviewer; one record per Save → no backup reminder. 6. marked.
