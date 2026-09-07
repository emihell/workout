# Backlog

Things to build. **Nothing here is a requirement yet** — each becomes a
`work/req-NN-name.md` when it comes up, and only a `READY` requirement (behaviour
questions answered) goes to Claude Code (`rules/WORKFLOW.md`).

Seeded 2026-09-06; revised 2026-09-07 after the first code review. Emilio owns
priority; this is a candidate list, not an ordered plan.

## In flight

- **`req-01` guard `saveState`** — the unguarded persist path. Currently `NEEDS
  DECISIONS` (failure-surface question); see `work/req-01-guard-savestate.md`.

## Near-term candidates (from the 2026-09-07 review)

- **History recalculation from a non-latest workout.** `recalculateFuturePlans`
  writes the *edited* workout's progression onto the routine (`store.jsx` →
  `progressionFromWorkout`/`applyProgressionToRoutines`). Correcting an *old*
  session silently overwrites the routine's current loads with that older session's
  result. Matches the README contract, but is a sharp edge. Decide: apply only when
  the edited workout is the latest for that routine, or always? Behaviour call →
  spec once decided.
- **Auto-backup before a destructive import.** Import replaces all state after a
  `window.confirm` (`views/Settings.jsx`), but doesn't offer to download the current
  state first. A one-click "save current backup before importing" is a cheap safety
  net given there's no undo. (Export already exists — see below.)
- **Clean up legacy `localStorage` keys after migration.** `workout-mvp-v5..v7` are
  read for migration but never removed (`storage.js`), leaving stale copies on the
  device. Low severity; delete-after-successful-migrate.

## Larger candidates (need a decision before they're speccable)

- **Visual-design pass.** The MVP is deliberately unstyled beyond function
  (`README.md` defers it). A first pass would be its own milestone — decide the target
  (a real design language vs. light polish) before speccing.
- **A "dig deeper" / exercise-history view.** Seeing an exercise's past sets over time.
  Q: read-only history view, or does it feed anything?
- **Split the large view files.** `views/Workout.jsx` (~900 lines), `History.jsx`
  (~680), `Routine.jsx` (~510) are large enough to slow future work. Pure refactor —
  only worth doing when one of them is already being touched, and only behind its
  existing tests + the human "use it" gate.

## Explicitly deferred (out of the MVP — `README.md`)

No accounts, sharing, collaboration, sheet-import UI, insights, charts, GPS, social
features. Keep these out of scope unless Emilio reopens one deliberately; when a
feature is conceptually multi-user, leave a door in the schema but build one user
(`rules/WORKFLOW.md`, Ship order).

## Already built — do not re-spec (review check, `NOTES.md` rail 1)

- **Export / backup + AI-coaching import.** `src/exchange.js` + Settings `Export`/
  `Import` already export the full database as `workout-mvp-backup` JSON (optionally
  with an assistant prompt) and re-import it with a replace-confirm. The earlier
  "export/backup" backlog candidate was wrong — it exists. What's *missing* is only
  the auto-backup-before-import safety net, listed above.

## Current shape (for reference, not a task list)

```
src/
  model.js          entities + invariants (exercise, routine, slot, workout, snapshots)
  storage.js        localStorage load/save + v5–v8 migrations
  progress.js       load recommendation (valid increments; Easy→up, Mod/Hard→hold, Failure/miss→down)
  schedule.js       recurring week/day slots
  route.js          view routing
  workout-log.js    live workout / set logging + skipped-at-finish
  exchange.js       backup export + AI-assistant import contract
  store.jsx         the single store (all mutations) + localStorage persistence
  ids.js            id minting + enums (RPE_OPTIONS, weekdays, types, roles)
  exerciseCatalog.js / exerciseExtras.js   exercise library
  views/            Exercises, Routine, Schedule, Start, Today, Workout, History, Settings
```
