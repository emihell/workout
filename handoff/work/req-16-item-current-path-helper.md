# req-16 — collapse the done/log item-path branch into one `itemCurrentPath` helper

**Status: BUILT AND MERGED, 2026-09-10 — branch `req-16` (`403cb85`…`403cb85`, 1 commit).** Pure refactor, no behaviour change, no persisted-data touch. Independent of
all other reqs. Sourced from `reports/req-15-findings.md` #9 (DEC-021 follow-up cleanup).

**Gate: code-only** (DEC-009) — no UX or persisted-data change; the planning session can review
and close it from the diff + `./check`. Emilio's hands are welcome but not the gate.

## Why

The same two-branch path expression — "if this exercise is done, go to its *done* screen,
otherwise its *log* screen" — is hand-written at five sites in `src/views/Workout.jsx`, each
spelling out both path helpers:

```
X ? itemDonePath(routineId, item) : itemLogPath(routineId, item)
```

[measured] the five sites (`grep -n "itemDonePath\|itemLogPath" src/views/Workout.jsx`):

- `:189` — workout overview row, `X = completed`
- `:218–220` — inside `itemSetsPath(routineId, item, workout)`, `X = itemLoggingState(workout, item).plannedDone`
- `:247` — `WorkoutItem` redirect effect, `X = completed`
- `:565–566` — exercise-setup form **Save** navigation, `X = itemLoggingState(active, item).plannedDone`
- `:590–591` — exercise-setup form **Cancel** navigation, `X = itemLoggingState(active, item).plannedDone`

The boolean differs by caller — sometimes `completed` (marked-done **or** plannedDone), sometimes
`plannedDone` alone — so the branch cannot compute its own condition. But the *branch itself* (same
two paths, same order) is identical every time. It is the kind of duplicated shared-path logic where
a later edit to one path (a route rename) silently misses the other four.

## The change

Add one helper next to the existing `itemLogPath` / `itemDonePath` (`Workout.jsx:208–214`):

```js
function itemCurrentPath(routineId, item, done) {
  return done ? itemDonePath(routineId, item) : itemLogPath(routineId, item)
}
```

Replace the five branch sites with `itemCurrentPath(routineId, item, <the existing boolean>)`,
passing each caller's **existing** condition unchanged (`completed` at :189/:247;
`itemLoggingState(...).plannedDone` at :218/:565/:590). `itemSetsPath` (:216–221) becomes a
one-liner that computes `plannedDone` and delegates to `itemCurrentPath`.

That is the whole req. No new behaviour, no route strings changed, no component boundaries moved.

## Scope

- Add `itemCurrentPath(routineId, item, done)` in `Workout.jsx`.
- Rewrite the five sites above to call it, preserving each site's boolean **exactly** — do not
  "unify" the differing conditions (`completed` vs `plannedDone`); that would change navigation.
- Keep `itemLogPath` and `itemDonePath` as the primitives `itemCurrentPath` delegates to.

## Out of scope

- Finding #10 (merge `ExerciseTitle` + `ExerciseSetupHeader`) — **rejected on inspection**: the two
  are not always rendered together (`WorkoutItemLive` renders the setup header separately, gated on
  `!resting`, with `showNotes={false}` + a cues line), so a merged component fits only one of two
  call sites and removes no duplication. Do not attempt it here.
- Any change to route strings, `route.js`, `itemKey`, or what any screen renders.
- Any change to how `completed` / `plannedDone` are computed.
- The other req-15 findings (file splits #1, set-edit form merge #2, seed extraction #3, `Row` value
  #4, etc.) — each is its own follow-up.

## Ordered steps

1. Add `itemCurrentPath` beside `itemLogPath`/`itemDonePath`.
2. Replace the five branch sites; at each, pass that site's existing boolean verbatim.
3. Collapse `itemSetsPath` to delegate to `itemCurrentPath`.
4. Run `./check`.

## Acceptance criteria (written before implementation)

- **No behaviour change — receipts:** `./check` green (paste the line). `grep -n "itemDonePath\|itemLogPath" src/views/Workout.jsx` afterward shows them referenced **only** inside `itemCurrentPath` (and the two function definitions) — paste the output to prove all five call sites were converted.
- **Navigation unchanged (Emilio's hands, in-browser):** from an active workout —
  1. Tapping an **incomplete** exercise on the overview opens its **log** screen (not the done screen).
  2. Completing an exercise's last set returns to the overview, and re-tapping that now-**done** exercise opens its **done** screen.
  3. On the exercise-setup screen, **Save** and **Cancel** both return to the same screen (log if not planned-done, done if planned-done) they returned to before this change.
- **No regression:** existing tests stay green (the `./check` line covers it); no test edits.

## Decisions

- **behaviour:** none — this is a pure extraction; if CC finds any site whose behaviour would change
  by using the shared helper, **stop and report** rather than altering navigation to fit the helper.
- **implementation (CC's call, note in report):** exact placement of `itemCurrentPath`; whether to
  also route any *other* incidental `itemDonePath`/`itemLogPath` pair it discovers through it (only
  if the boolean-varies rule above still holds).

## Notes

Smallest possible tidy-up: one helper, five call sites, zero behaviour. Its whole value is that the
next route rename touches one line instead of five. Paired originally with finding #10, which was
dropped — see Out of scope.
