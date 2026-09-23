# req-127 — exercise names, Restore archived, and small routine-editor guards (audit Tier 3, DEC-059 §3–4)

**Status: BUILT AND MERGED, 2026-09-23 — branch `req-127` (`4f06298`…`4f06298`, 1 commit).** Phase 1. **[P]**: a new store action (un-archive) in `store.jsx`
(DEC-057: reviewer + backup reminder). No schema bump.

## Why [measured, audit setup reviewer]

- `store.jsx` `addExercise` has no name fallback: a whitespace name saves `""`. Manual add never checks duplicates
  ("Bench" and "bench" both created); Search does (`Exercises.jsx:~216`).
- Search and pickers skip archived exercises (`Exercises.jsx:66,200`), so re-adding one mints a new id and splits its
  history and "last time". There is no un-archive.
- Routines-list Start on a 0-exercise routine creates an empty active workout (`Routine.jsx:~68`) and can abandon a
  real one; the preview already hides Start there (`overview.jsx:81`).
- Up on the first row and Down on the last row show but do nothing (`Routine.jsx:~156`).

## The behaviour

1. **Names:** trimmed; empty is an inline error that blocks Save (exercise and routine).
2. **Duplicate warning (DEC-059 §4):** creating an exercise whose trimmed, case-insensitive name matches an existing
   (non-archived) one shows "An exercise called X already exists" with **Use it** and **Create anyway**.
3. **Restore (DEC-059 §3):** when the name matches an **archived** exercise (in manual add and in Search), offer
   **Restore**. It clears `archivedAt` on that same exercise (same id, so its history and "last time" come back),
   then continues as if it had been picked. **(unconfirmed)** Restore brings back the exercise only, not the routine
   rows that archiving removed (`storage.js:379-386`).
3b. **Precedence:** a live match wins (Use it / Create anyway); otherwise the most recently archived match
    **(unconfirmed)**.
4. **Start on an empty routine** is hidden in the routines list and on Today (`Today.jsx:~22`), as in the preview.
5. **Edge Up/Down** are disabled (first row Up, last row Down).

## Scope

`src/store.jsx` (`restoreExercise`), `src/views/Exercises.jsx`, `src/views/Routine.jsx`, `src/views/Schedule.jsx`
(it also creates routines, `:160`), `src/views/Today.jsx`, pure helpers (name match) + tests.

## Order vs siblings

After req-126 (same `Exercises.jsx`).

## Acceptance criteria

- **Unit:** `"  "` → error; `"Bench"` vs existing `"bench"` → duplicate; vs archived `"Bench"` → restore candidate.
- **Failure case — Restore reuses the id (unit):** archive X, then add "X" → Restore → `exercises.length` unchanged, the
  same id is non-archived and shows in pickers, and continuing adds **that** id. The same flow without Restore mints a
  new id. (`lastSetsForExercise` ignores `archivedAt`, so "history still returned" alone proves nothing.)
- **Browser:** add "bench" → warning with Use it / Create anyway; archived → Restore.
- **Routine:** an empty routine has no Start in the list; edge Up/Down are disabled.
- `./check` green (receipt quoted).

## Decisions

- Warn-and-allow; Restore (Emilio, DEC-059 §3–4). Button labels **(unconfirmed)**.
