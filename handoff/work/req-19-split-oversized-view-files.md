# req-19 — split the two oversized view files into per-screen folders

**Status: READY.** Mechanical file reorganisation, no behaviour change. Sourced from
`reports/req-15-findings.md` #1 (DEC-021).

**Gate: code-only** (DEC-009, functional) — pure move; planning verifies the app still renders every
screen and merges.

**Build order:** do this **last** of the refactor batch. It moves the same code req-17 and req-18
edit, so let those land first, then split the settled files. Building it earlier guarantees conflicts.

## Why

Two view files are far past the size where one file per screen-group would read better, and they are
the files this app edits most (the live workout + the history record):

- [measured] `src/views/Workout.jsx` — **859 lines** (`wc -l`), ~9 screens + `RestBar` +
  `useRestCountdown` + ~8 path/header helpers.
- [measured] `src/views/History.jsx` — **656 lines**, ~9 screens + date/month grouping +
  `addSetToWorkout`.

Everything else in `views/` is a single reasonable file; these two are the outliers.

## The change

Turn each into a folder with one module per screen-group plus a helpers module, preserving the public
exports so importers don't change (or updating imports mechanically if a barrel is cleaner):

```
views/workout/    index.jsx (or barrel) — re-exports the screens currently exported from Workout.jsx
                  screens split by group (overview / item-live / item-done / set-edit / finish …)
                  rest.jsx      RestBar + useRestCountdown
                  paths.js      itemLogPath / itemDonePath / itemCurrentPath (req-16) / itemSetsPath
views/history/    index.jsx — re-exports History's screens
                  grouping.js   date/month grouping helpers
                  (addSetToWorkout beside the screen that uses it, or in a helpers module)
```

**Exact split boundaries are CC's call** — group screens the way the routes group them; keep helpers
next to their sole user, shared helpers in a `paths.js`/`helpers.js`. The **only** hard rule: no
behaviour or route change, and every symbol currently imported from `views/Workout.jsx` /
`views/History.jsx` resolves to the same thing afterward.

## Scope

- `Workout.jsx` → `views/workout/…`; `History.jsx` → `views/history/…`.
- Update all importers (`route.js`, `App.jsx`, tests, anything that imports these screens) to the new
  paths, or keep the old paths working via a barrel — CC's call, state which in the report.
- Move helpers/hooks/components to sit beside their users; no logic edits during the move.

## Out of scope

- Any logic change, rename, or signature change — this is `git mv`-shaped, not a rewrite. A diff that
  shows moved lines is right; a diff that shows *changed* lines needs a reason in the report.
- The other findings (seed extraction req-17, form merge req-18) — assume those are already merged;
  build on the post-merge files.

## Acceptance criteria (written before implementation)

- **Every screen still renders (planning, in-browser):** walk the routes that hit these files —
  Today → Start → live Workout (overview / log a set / rest / done / finish) and History (list /
  month / a finished workout / edit a set). No blank screen, no missing import, no route 404.
- **Pure move, provable:** the report names the split boundaries and states that no logic changed;
  spot-check that a representative moved function is byte-identical (or explains any forced change,
  e.g. an import path inside a moved file).
- **Imports resolve:** `npm run build` succeeds (no unresolved import); `grep -rn "views/Workout\|views/History" src` shows only intended references (paste it).
- **No regression:** `./check` green (paste the line); all existing tests green with only import-path
  edits, no test logic weakened.

## Decisions

- **behaviour:** none — a behaviour change here is a bug. If a clean split is impossible without
  changing something a user sees, **stop and report** the boundary that forces it.
- **implementation (CC's call, note in report):** the folder layout and split boundaries; barrel
  re-export vs updated import paths; where `addSetToWorkout`, `RestBar`, `useRestCountdown`, and the
  path helpers land.
