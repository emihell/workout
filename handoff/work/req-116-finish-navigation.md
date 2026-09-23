# req-116 — Finish: Back doesn't restart auto-finish, Feel survives, no fresh Start after finishing, empty Finish warns (audit E, DEC-058 §4)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[ux-feel]** + **[P]**: an optional field on the
active workout (stripped at finish), and touches `workout-log.js` (DEC-057: reviewer + backup reminder). Revised
2026-09-23 after the spec review. The first draft's `replace` fix couldn't work: `go()` always assigns
`location.hash` (`route.js:81-87`), and `{replace}` only rewrites the in-app visit stack.

## Why [measured, scratchpad/audit-gym/e2e.mjs]

1. When every exercise is done: summary → Edit → pick "Hard" → Back → the overview remounts with
   `autoDismissed=false` (`overview.jsx:45,126`), the 10 s summary returns and auto-finishes, and Feel is saved
   `""`. Feel lives in Finish's component state (`finish.jsx:24`), although `activeWorkout.overallFeel` already
   exists (`store.jsx:242`), and `autoFinishArgs` hard-codes `''` (`workout-note.js`).
2. After Finish, `go('/')` pushes a new entry. Browser Back reaches `/workout/:id`, the preview, whose Start
   builds a fresh workout one tap from the one just saved. More Backs reach the item screens underneath.
3. **DEC-058 §4:** Finish with nothing logged saves a workout of skipped sets and marks the day Done
   (`finishedState`, `workout-log.js`); auto-complete does too after Skip exercise ×N.

## The behaviour

1. **Feel lives on the active workout** (the existing `overallFeel`, the req-107 note pattern). Choose it on
   Finish, go Back, return, and it's still chosen. Auto-complete saves it (`autoFinishArgs` takes it;
   `workout-note.test.js` changes accordingly, named in the report).
2. **Returning from Finish never re-arms the summary.** Once it was dismissed or Edit was pressed, it stays
   dismissed for this workout, via a flag on the active workout (a reload doesn't re-arm it). `finishedState`
   **strips** the flag (as it strips `seedOverrides`), so it never lands in history.
3. **No fresh Start after finishing (guard, not routing)** **(unconfirmed)**: the workout preview for an
   occurrence that already has a finished workout today shows "Done {weekday date}" and a link to it in History,
   not Start. This holds however many times Back is pressed. `go()` / `route.js` are unchanged.
4. **Empty Finish:** "nothing logged" = no non-skipped set, warm-up sets included (a logged warm-up counts as
   logged) **(unconfirmed)**. The Finish screen says "Nothing logged", Abandon is the primary action, and
   "Save anyway" is secondary **(unconfirmed)**. The auto-complete summary never appears for an empty workout.
5. **Set counts** on Finish **and** on the auto-complete summary (`storage.js:443` `active.sets.length`) count only
   non-skipped sets.

## Scope

`finish.jsx`, `auto-complete.jsx`, `overview.jsx`, `workout-note.js` (+ test), `workout-log.js` (`anythingLogged`,
the summary gate, `finishedState` strip), `storage.js` (`workoutSummaryStats` count), tests. Pure logic in `.js`
modules (tests can't import `.jsx`).

## Order vs siblings

After req-120 and req-118. Before req-117 (same `item.jsx` / `overview.jsx` / `workout-log.js`) and req-119.

## Acceptance criteria

- **Feel (puppeteer):** all done → Edit → Hard → Back → no countdown; return to Finish → Hard still selected; Save →
  the history record has Feel Hard.
- **Flag stripped (unit):** `finishedState` output has no dismissed flag and no `seedOverrides`.
- **Summary gate (unit):** the gate is false when the flag is set, and false for an empty workout; true only for
  all-done + not dismissed + something logged.
- **Back after Finish (puppeteer):** after Finish, press history.back() **repeatedly** until off the workout routes →
  no Start for that occurrence is ever shown.
- **Failure case — empty (unit + puppeteer):** Skip exercise on every item → no auto-finish; Finish shows "Nothing
  logged" with Abandon primary.
- **Counts (unit):** 1 logged WU + 2 logged work + 1 skipped → Finish and summary both say 3 sets.
- **No regression:** `./check` green; an older active workout without the flag loads. Receipt quoted.

## Decisions

- Empty-Finish warning with Abandon (Emilio, DEC-058 §4). "Save anyway" secondary, and a warm-up counts as logged
  **(unconfirmed)**.
- Dismissed flag persisted and stripped at finish; the preview guard instead of a routing change **(unconfirmed)**.
