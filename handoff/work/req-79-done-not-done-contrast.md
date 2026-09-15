# req-79 — done/not-done contrast in the active exercise list (N6, gym-flow batch 2)

**Status: BUILT AND MERGED, 2026-09-16 — branch `req-79` (`45b402c`…`45b402c`, 1 commit).** From Emilio's 2026-09-14 notes:
*"In the exercise list for an active workout, make a bigger visual difference between exercises
that are done and those that are not, so your eye focuses on the ones not done."*

**Gate: gym-flow feel (ux-feel).**

## Why

[measured] the overview shows only a `· done` text suffix (`views/workout/overview.jsx:110`);
done and not-done rows look nearly identical, so the eye can't find the remaining work at a
glance mid-workout.

## The behaviour

Visually **de-emphasize completed exercises** (muted/dimmed) and keep **not-done exercises at
full emphasis**, so the eye lands on what's left. Order is unchanged. "Done" keeps its existing
meaning (`itemIsMarkedDone` / `plannedDone`).

## Scope

- Overview row styling only.

## Out of scope

- Reordering rows; any data change; what "done" means.

## Acceptance criteria

- **Contrast (browser):** with some exercises done, done rows read as clearly muted vs the
  not-done ones.
- **Edge:** all done → all muted (consistent); none done → all full emphasis.
- **No regression:** `./check` green.
