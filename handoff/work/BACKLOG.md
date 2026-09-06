# Backlog

Things to build. **Nothing here is a requirement yet** — each becomes a
`work/req-NN-name.md` when it comes up, and only a `READY` requirement (behaviour
questions answered) goes to Claude Code (`rules/WORKFLOW.md`).

Seeded 2026-09-06 from the current app and `README.md`. Emilio owns priority; this is
a candidate list, not an ordered plan.

## Near-term candidates

*(empty — fill from real friction as it comes up. The app works today; there is no
standing bug list under this workflow yet. When something breaks or annoys, it lands
here first, then becomes a req.)*

## Larger candidates (need a decision before they're speccable)

- **Visual-design pass.** The MVP is deliberately unstyled beyond function
  (`README.md` defers it). A first pass would be its own milestone — decide the target
  (a real design language vs. light polish) before speccing.
- **A "dig deeper" / exercise-history view.** Seeing an exercise's past sets over time.
  Q: read-only history view, or does it feed anything?
- **Export / backup of `localStorage` state.** Persisted data has no backup today
  (`rules/WORKFLOW.md`, Persisted data). A manual export/import would be a real safety
  net. Q: JSON download + restore, or something richer?

## Explicitly deferred (out of the MVP — `README.md`)

No accounts, sharing, collaboration, sheet-import UI, insights, charts, GPS, social
features. Keep these out of scope unless Emilio reopens one deliberately; when a
feature is conceptually multi-user, leave a door in the schema but build one user
(`rules/WORKFLOW.md`, Ship order).

## Current shape (for reference, not a task list)

```
src/
  model.js          entities + invariants (exercise, routine, slot, workout)
  storage.js        localStorage load/save + v5–v8 migrations
  progress.js       load recommendation (valid increments, effort-based)
  schedule.js       recurring week/day slots
  route.js          view routing
  workout-log.js    live workout / set logging
  exchange.js       (import/exchange helpers)
  exerciseCatalog.js / exerciseExtras.js   exercise library
  views/            Exercises, Routine, Schedule, Start, Today, Workout, History, Settings
```
