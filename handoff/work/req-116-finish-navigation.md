# req-116 — Finish: Back doesn't restart auto-finish, Feel survives, no Start after finishing, empty Finish warns (audit E, DEC-058 §4)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[ux-feel]** + **[P]**: an optional field on the
active workout, and touches `workout-log.js` (DEC-057: reviewer + backup reminder).

## Why [measured, scratchpad/audit-gym/e2e.mjs]

1. When every exercise is done: summary → Edit → pick "Hard" → Back → the overview remounts with
   `autoDismissed=false` (`overview.jsx:45,126`), the 10 s summary returns and auto-finishes, and Feel is saved
   `""`. Feel lives only in Finish's component state (`finish.jsx:24`).
2. After Finish, `go('/')` pushes a history entry, so browser Back lands on `/workout/:id`, a working Start for the
   routine just saved.
3. **DEC-058 §4:** Finish with nothing logged saves a workout of skipped sets and marks the day Done
   (`workout-log.js` `finishedState`); auto-complete does too after Skip exercise ×N.

## The behaviour

1. **Feel is kept on the active workout** (like the note, req-107): choose it on Finish, go Back, return, and it's
   still chosen; auto-complete saves it.
2. **Returning from Finish never re-arms the summary.** Once the summary was dismissed or Edit was pressed, it
   stays dismissed for this workout (persisted on the active workout, so a reload doesn't re-arm it).
3. **Finish, Abandon and auto-finish navigate with `replace`**, so browser Back can't land on a Start for the
   routine just saved.
4. **Empty Finish:** if no set was actually logged (all skipped or none), the Finish screen says "Nothing logged",
   Abandon is the primary action, and Save is a secondary "Save anyway" **(unconfirmed)**. The auto-complete summary
   doesn't appear for an empty workout; the overview shows as normal.
5. Finish's "N sets" counts only logged (non-skipped) sets.

## Scope

`finish.jsx`, `auto-complete.jsx`, `overview.jsx`, `workout-note.js` (or a sibling module for Feel),
`workout-log.js` (an "anything logged" helper), `store.jsx` if needed, tests.

## Acceptance criteria

- **Feel (browser/puppeteer):** all done → Edit → Hard → Back → no countdown; return to Finish → Hard still
  selected; Save → the history record has Feel Hard.
- **No re-arm after reload (unit):** a dismissed flag on the active workout survives `migrateState`, and the summary
  gate respects it.
- **Browser Back (puppeteer):** after Finish, history.back() does not show a Start for that routine.
- **Failure case — empty (unit + browser):** Skip exercise on every item → no auto-finish; Finish shows "Nothing
  logged" with Abandon primary.
- **Count (unit):** 2 logged + 1 skipped → "2 sets".
- **No regression:** `./check` green; an older active workout without the new fields loads. Receipt quoted.

## Decisions

- Empty-Finish warning with Abandon (Emilio, DEC-058 §4). "Save anyway" kept as secondary **(unconfirmed)**.
- Dismissed flag persisted (Planner **(unconfirmed)**: otherwise a reload re-arms a 10 s auto-save).
