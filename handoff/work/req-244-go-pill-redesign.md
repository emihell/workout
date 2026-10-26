**Status: NEEDS DECISIONS** · **Lane: ui** · batch 7 (J5). Look only; no stored-data change.

# req-244 — the workout pill, redesigned

Emilio, 2026-10-19 (log screen): "The go is a bit messy right now need a redesing."

## Open question (Emilio's — the look)

Which look? Content stays (DEC-103 §3, DEC-125 §3, DEC-108 §3 — all **E**): rest countdown, then GO; the current exercise's
set count; the whole workout's count; tap skips rest on the exercise's own screen, else opens it.

```
today      [ 1:12 · set 2/4 · 3/7 ]          two bare fractions side by side — which is which?

A  two     [  1:12                 ]          big clock / GO on top,
   lines   [  Set 2 of 4 · Ex 3 of 7 ]        words under it — nothing to decode

B  bar     [ 1:12 · Set 2 of 4     ]          the workout count becomes a thin fill line
           [ ███████░░░░░░░░░░░░░ ]          under the pill (3 of 7 done), no number

C  bare    [ 1:12 ]                           clock / GO only; "Set 2 of 4 · Exercise 3 of 7" moves to
                                              the log screen's title line. Goes against DEC-125 §3
                                              (count in the pill) — Emilio's own call to undo.
```

Planner recommends **A**: same size class as today, words instead of fractions, nothing removed.

## Code facts (rescanned 2026-10-26, `main` 103678a)

- Data: `workoutPillState` (`workout-log.js`) → `clock`, `setText` ("set 2/4"), `countText` ("3/7"), `go`
  (`views/workout/rest.jsx:12-31`). Render: `ui/index.jsx:390-415` — one line `lead · tail`, `.ui-restpill`, GO pulse
  `.ui-restpill--go`; `skip` replaces the tail with "skip" (`:396`).

## Scope (once picked)

1. Restyle `UIWorkoutPill` to the chosen look; words "Set N of M", "Ex N of M" (A) — the state helper unchanged.
2. Skip state on the own screen keeps "skip" (A: second line "Tap to skip rest").
3. Showcase (`#/components`) shows rest / GO / skip states.

## Acceptance criteria (for A; adjusted to the pick)

1. Resting: line 1 "1:12", line 2 "Set 2 of 4 · Ex 3 of 7"; rest over: line 1 "GO" with the pulse.
2. **Failure case:** first exercise, nothing logged → no set count → line 2 shows only "Ex 1 of 7" (no stray separator).
3. Planner's 390×844 screenshot: the pill covers no control on the log screen (DEC-047 refinement: visibility before merge).
4. `./check` green.

## Decisions made on Emilio's behalf

- The words "Ex" vs "Exercise" (space) `(unconfirmed)`.

## READY checks

1 DEC-103 §3, DEC-108 §3, DEC-125 §3. 2 Siblings: req-239..241 edit `item.jsx` but not the pill — independent. 3–4 None.
5 No trigger files. 6 Marked.
