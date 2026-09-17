# req-98 — make "beat last time" work for timed exercises (the capture already exists; guard the transitional false-win)

**Status: READY.** **Gate: functional (correctness guard) + a doc note.** From Emilio 2026-09-17
(item-2 of the req-96 review): capture = editable actual defaulting to target; adoption = "I'll change
them manually".

## Key finding — item 2 is ALMOST already built (verify-don't-recall win)

I first specced a whole capture feature. Then I read req-85's code: **the editable-actual capture Emilio
chose (option A) already exists.**
- **Live logging** — a timed set (`ex.hasDuration && work set`, `item.jsx:263`) renders `SetLogForm`'s
  `DurationTimer` (`ui/index.jsx:303`): an **editable** `NumberField "Duration (s)"` that defaults to the
  target and whose value at Complete is stored as the set's `durationSec` (`ui/index.jsx:353`,
  `item.jsx:205`). Edit it to what you actually held → the actual is logged. That IS option A.
- **Exercise editor** already has the "Timed (count down a duration)" checkbox + default duration
  (`Exercises.jsx:296`). So Emilio can flag plank/rowing/stairs himself — **no migration, no data edit**
  (his "I'll change them manually").
- **Comparison** — req-96's `beat-last-time.js` already compares `durationSec` (longest work set) and
  has a passing "75s > 60s" test.

So once Emilio flags his timed exercises and logs two same-routine workouts, "↑ Longer … than last
time" works **end-to-end with no new capture code.**

## The ONE real bug to fix

[measured] `beat-last-time.js` `isTimed(curSets, prevSets)` returns true if **either** side has a
`durationSec > 0`. The first workout after Emilio flags an exercise has a real `durationSec`, but its
**prior** same-routine workout was logged the old way (free-text `reps`, no `durationSec`). So the timed
branch compares `cur=75` vs `prev=0` → fires a **false "↑ Longer"** win against a record that has no
comparable duration. That invents a comparison it doesn't have (DESIGN §1 / DEC-050's no-invent line).

**Fix:** in the timed branch, only a win when the **prior side also has real duration data** — i.e.
`prev > 0` (both sides comparable). No prior duration → `null` (silent), same as any other "no data on
this axis" case. Add a unit test: cur has `durationSec`, prev has none → **no win**; keep the existing
both-sided "75s > 60s" → win.

## Scope

- `src/beat-last-time.js` — guard the timed branch (`prev > 0`, i.e. require duration on both sides).
- `src/beat-last-time.test.js` — add the transitional-no-win case.

## Out of scope

- Any new capture UI (already exists — req-85). No change to `SetLogForm`/`item.jsx`.
- Adoption/migration — Emilio flags exercises manually via the existing editor checkbox.
- **Editing a past timed set's duration in `set-edit.jsx`** — genuinely missing (history edit has no
  duration field; the NOW.md req-85 v1 gap). Left as a separate small follow-up (see BACKLOG), NOT this
  req — this req only unblocks the "beat last time" comparison.
- Duration progression (increasing the target next time) — still future (req-85 deferred).

## Acceptance criteria

- **Guard (test):** an exercise with `durationSec` this workout and none in the prior same-routine
  workout → **no** "longer" win (silent). The existing both-sided longer-hold case still wins.
- **End-to-end (browser, Emilio):** flag plank as Timed, log it two same-routine sessions with a longer
  hold the second time → Finish shows "↑ Longer plank than last time". *(Needs an active workout; Emilio
  confirms on device.)*
- **No regression:** `./check` green; the other beat-last-time axes (weight/reps) unchanged.

## Decisions (Emilio, 2026-09-17)

- Capture = editable actual defaulting to target — **already shipped in req-85**; no rebuild.
- Adoption = manual (flag exercises in the editor); no migration.
- Fix the transitional false-win so a newly-flagged exercise doesn't claim a bogus duration win vs an
  old unstructured record.
