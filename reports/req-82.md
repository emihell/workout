# req-82 — empty-day Start = start a workout (N1)

Branch: `req-82`. Status: **READY** (planning session to merge; browser interaction is an Emilio/Planner item — Chrome extension not connectable from this session).

## Technical

**What it does.** On a day with nothing scheduled, the Today "Start" is no longer a dead
disabled control. It becomes an enabled **"Start new workout"** that navigates to the
routine picker, where picking a routine starts it off-schedule.

**How.** `views/Today.jsx` — `TodayEmpty`:
- `disabled` Start → enabled `<Button onClick={() => go('/routines')}>Start new workout</Button>`.
- Added `import { go } from '../route'`.

**Reuse (DEC-047 (a): don't invent UI).** The picker is the existing `Routines` list
(`views/Routine.jsx:35`) at `/routines` — each row already carries a **Start** button wired
to `startOrContinue(store, routine.id)` with no `scheduledFor`/`scheduleSlotId`, i.e. exactly
the off-schedule start the req asks for. No new component, no new list, no data/schema change.
Landing follows req-76: start-new lands on the workout overview `/workout/{routineId}`.

**Failure case (zero routines) is structural, not a special branch.** `TodayEmpty` is only
reachable when `routines.length >= 1` — `Today()` returns the no-data screen first when
`!routines.length` (`views/Today.jsx:240`), and that screen already links to `/routines`
(→ "Add routine"). So the picker reached from the empty-day Start is never empty, and the
zero-routines user is led to the create-a-routine path by the existing upstream branch.

## Receipts

```
# ./check
# tests 225 / pass 225 / fail 0
check: green — lint, 20 test file(s), and the build all passed.
```

Acceptance criteria:
- **Enabled + starts:** empty-day Start enabled → `/routines` picker → row Start →
  `startOrContinue(store, routine.id)` off-schedule → `/workout/{routineId}` (req-76). ✓ (code
  path; live click is the Emilio item below)
- **No routines:** handled upstream by the `!routines.length` no-data screen → `/routines` →
  Add routine. ✓ (verified by reading the guard at `Today.jsx:240`)
- **Scheduled day unchanged:** `TodayWorkout` / `TodayHero` / the scheduled Start blocks are
  untouched; only the `TodayEmpty` branch changed. ✓
- **No regression:** `./check` green. ✓

## Workflow

- **Choice left open, decided here:** which routine-list surface to reuse. Picked
  **navigation to the existing `/routines` list** over building an inline picker on Today —
  it is the cleanest existing surface (per-row Start already wired to off-schedule
  `startOrContinue`), matching Planner's steer to reuse the routine-list UI the empty-data
  fallback already points at rather than invent one. Trade-off: it's a navigate-away two-tap
  flow (Start new workout → pick a routine's Start) rather than a single-screen modal. If a
  one-tap inline picker is wanted later, it's a small follow-up; flagged here for Emilio.
- **No scope added or dropped.** No ad-hoc/blank workout (option (b) not built). No data
  change — ask-gate #2 does not apply.
- **Nothing for a DEC/L.** The zero-routines-is-handled-upstream fact is worth knowing but is
  already visible in the code; captured in this report.

## What I could not verify myself
- The live click-through in the browser (Start enabled → picker → routine starts and lands on
  the workout overview) — the Chrome extension wasn't connectable from this session. The path
  is entirely existing, tested code (`go`, `startOrContinue`, the `/routines` list); what
  remains is confirming the two-tap flow feels right on a real screen.
