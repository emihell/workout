**Status: BUILT, NOT merged — branch `req-223` (`4727c17`…`308479e`).** **Lane: ui** — the in-workout path; writes only through existing store calls (Skip, Swap).

# req-223 — Start opens the first exercise; an "Up next" bar on each arrival, 5 s, Skip / Swap

DEC-125 §2 (Emilio, batch 6 I5: "Maybe when starting a workout go straight to first ex, with a 5 seconds countdown and option to
replace/skip"; I7: going ex → ex skips the list, so swap/skip of the next exercise is out of sight). Builder: throwaway agent
(DEC-055). Build after req-222.

## Facts (rescanned 2026-10-14, `main` 73cdf1e)

- `startOrContinue` (`workout-actions.js:55-66`): a **new** workout lands on the overview `/workout/${routineId}`; continuing lands on
  `resumeTarget` (`:24-31`, first not-done item). Callers: `Today.jsx:29, :51`, `Schedule.jsx:252, :391-392`, `Routine.jsx:66`,
  preview Start `overview.jsx:120`.
- Review → `Next: {name}` → `itemLogPath(routineId, next)` (`item.jsx:796-799`); `nextNotDoneItem` (`workout-log.js:840-849`) wraps.
  "Choose exercise" → overview.
- Swap / Skip live only in the list row "⋯" (`overview.jsx:25-38`, not exported, not-done rows only): Swap → `itemReplacePath`
  (`/workout/:id/item/:key/replace`, `workout-paths.js:18`); Skip → `recordButton('skip-exercise'); store.skipItem(key)`.
  Replace screen ends with `go(itemLogPath(new), { replace: true })` (`replace.jsx:45-51`). DEC-103 §2 moved them to the list
  ("its hard to know you can swap, when its inside a ex") — this bar adds a visible place, the list keeps its own.
- Countdown pattern to copy: `auto-complete.jsx` (`COUNTDOWN_MS`, deadline in `useState`, 250 ms interval, cleared on unmount).
- No "Up next" text exists today (grep "up next|upNext").

## Scope

1. **New workout → first exercise.** `startOrContinue` for a new workout lands on the log screen of the first item (list order).
   An empty workout still lands on the overview. Continue is unchanged.
2. **"Up next" bar** on the log screen when the user **arrives** there from (a) a new Start or (b) the review's `Next:` link — and
   that exercise has no logged set. Content: "Up next: {exercise name}", "Starting in 5…" counting down, and **Skip** · **Swap**
   (· **Start now**, which hides the bar).
   - At 0, on Start now, or when a set is logged, the bar hides. Nothing is written by the countdown.
   - **Skip** = the list's Skip exercise (`store.skipItem`), then arrive at the next not-done exercise with its own bar; none left →
     the review's Finish target (auto-complete overview if armed, else `/finish`).
   - **Swap** = the list's Swap (replace screen); the replacement's log screen opens **without** a bar.
3. The bar does **not** show when arriving from a list row, the GO pill, Continue, a refresh, or Back.
4. Share the Skip / Swap choice code with `overview.jsx`'s `rowActions` (one place for the two actions).

## Out of scope

The countdown starting a timer or rest; Add exercise / workout note / Abandon on the log screen (stay on the list, DEC-125 §2);
the overview's look; auto-complete.

## Acceptance criteria

1. Rendered: Start a 3-item workout → route is item 1's `/log`, bar reads "Up next: <item 1>", after 5 s (fake timers) it's gone.
2. Rendered: log all sets of item 1 → review → tap `Next: <item 2>` → bar shows for item 2.
3. Rendered: Skip on the bar → item 2 is skipped (sets `skipped`, marked done) and item 3's log opens with its bar.
4. Rendered: Skip on the last not-done item → lands on the Finish target, no bar, no crash.
5. Rendered: Swap → replace screen → pick → replacement's log, **no** bar.
6. **Failure case — wrong trigger:** open item 2 from the list row, from the GO pill, and by reloading the bar's URL → no bar in all
   three (asserts the trigger is the arrival, not "no sets logged").
7. **Empty input:** Start a workout with 0 items → overview, as today.
8. Logging a set while the countdown runs → bar hides, the set is saved once.
9. Browser (`plan qa`): Start Upper body from Home → first exercise with the bar; Skip from the bar; Next from a review.
10. `./check` green.

## Decisions made on Emilio's behalf

- **behaviour** `(unconfirmed)`: the countdown only hides the bar ("get ready") — it starts nothing.
- **behaviour** `(unconfirmed)`: the bar shows on arrival from Start and Next only; not from the list, pill, Continue or reload.
- **behaviour** `(unconfirmed)`: Swap from the bar opens the replacement without a second bar; Skip chains to the next with a bar.
- **behaviour** `(unconfirmed)`: labels "Up next", "Starting in N…", "Skip", "Swap", "Start now".
- implementation: how arrival is marked (e.g. a route query / navigation state) is the builder's; it must not be stored.

## READY checks

1. DECs: DEC-103 §2 (swap/skip in list), DEC-076/req-76 (Continue lands on current exercise), DEC-119 §1 (review → Next), DEC-125 §2.
2. Siblings: req-222 (pill from start — build first); req-221 edits `item.jsx:789` (review effort), this edits `:796-801` and the log
   screen — rebase if both open. 3. none. 4. 5 s = Emilio's number (I5). 5. no trigger file (`workout-actions.js`, `item.jsx`,
   `overview.jsx` are not on the list). 6. marked.
