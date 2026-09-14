# req-84 — auto-complete a finished routine (N10, gym-flow batch 2)

**Status: NEEDS DECISION — saved 2026-09-14, not scheduled.** From Emilio's 2026-09-14 notes:
*"When all exercises in a routine are done, auto-complete? A 'great job' in 10 sec showing
stats/improvements from last time, then auto-complete the whole routine but with an option to
edit … goal should be that everything is automated and user interaction is minimal — instead of
a list all done and press Done."*

**Gate: gym-flow feel (ux-feel) + behaviour (it writes a finish).**

## Why

[measured] when every exercise is done, the user still taps **Finish** (`overview.jsx:116`) →
`WorkoutFinish`. Emilio wants the finish to feel automatic: a short celebratory summary, then the
workout completes on its own with a chance to intervene.

## Open decision (Emilio)

- auto-finish **on timer expiry**, vs a **countdown-then-confirm**. *Recommended:* a ~10s
  countdown with a visible **Cancel/Edit** that **auto-commits on expiry** — minimal taps, still
  reversible before it commits.

## Data-trust note

Auto-writing a finish is an automatic persist — it **must be cancellable before it commits**, and
the summary must invent nothing: stats/improvement come only from the logged sets and prior
finished workouts (DESIGN §1).

## Scope / acceptance

Written once the direction is picked. Provisional acceptance:
- **Summary (browser):** all exercises done → a summary appears (stats + change vs last time from
  real logged data).
- **Commit:** on expiry (or confirm) the workout finishes and lands as a completed workout.
- **Escape hatch (failure case):** Cancel/Edit before expiry returns to the log **without**
  finishing — no premature persist.
- `./check` green.

## Decisions

- Auto-finish-on-expiry vs countdown-then-confirm (Emilio) — blocks READY.
