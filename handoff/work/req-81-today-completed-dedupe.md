# req-81 — remove the duplicate "Completed today" on Today (N11, gym-flow batch 2)

**Status: READY — saved 2026-09-14, not scheduled.** From Emilio's 2026-09-14 notes:
*"On the main page, remove the 'complete today' — it becomes a duplicate."* (The broader "make
the Today list one component" idea is captured separately — see Decisions.)

**Gate: gym-flow feel (ux-feel).**

## Why

[measured] a workout finished **today** renders in **both** the "Completed today" section
(`views/Today.jsx:301`) **and** the recent peek (`:314`) — the same workout appears twice. Both
read from `store.workouts` filtered by `finishedAt`.

## The behaviour

Dedupe so a workout finished today appears **exactly once** on Today. Two directions — CC/Emilio
pick the one that keeps today's finished sessions visible once and reads cleanest:
- drop the separate "Completed today" section and let the recent peek (which already marks today)
  own them; or
- exclude today's finished workouts from the recent peek so "Completed today" owns them.

## Scope

- Today.jsx section composition only.

## Out of scope

- The broader Today unification (one-component refactor) — that is **dropped-req-32 territory**
  (DEC-025) and a separate decision, not this req.
- Any data change; the Today hero / scheduled Start blocks.

## Acceptance criteria

- **Once (browser):** a workout finished today shows exactly once on Today.
- **Edge:** nothing finished today → no empty section; the recent peek is unaffected.
- **Prior days:** a workout finished on a previous day still appears in recent/History as before.
- **No regression:** `./check` green.

## Decisions

- Which dedupe direction (CC/Emilio).
- The full one-component Today refactor is **deferred** (revives dropped req-32 — decide separately).
