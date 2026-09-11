# Design principles

The product and UX values, written as tests you can apply to a specific proposal —
not as adjectives. Read this before commenting on or building anything the user
sees. `README.md` is the product contract; this states how to decide the cases it
implies. Read it before a UI/UX change.

## 0. What this is for

A logging tool for one person's real training. It supports **one trustworthy loop:**
set up exercises and routines, schedule them, start a workout snapshot, log sets,
keep an editable historical record. It is not a coach, a social app, or an analytics
product — that's deferred scope (`README.md`).

**The test:** does this feature make the record more trustworthy or the loop
smoother? If it adds a number, a chart, or a suggestion the user didn't ask for and
can't fully trust, it's out of scope for the MVP.

## The values, in priority order

Earlier wins when they collide.

1. **Trust** — the record is never wrong, and the app never invents data.
2. **Functional** — the loop works end to end; every action has a clear verb.
3. **Consistent** — the same vocabulary and the same semantics everywhere.
4. **Feel** — last for the MVP (no visual-design pass yet), but it's why anyone keeps
   using it.

## 1. Trust — the app never invents data it doesn't have

This is the one that decides the hard cases.

- **A weighted exercise with no history has no invented starting weight.** Its dated
  plan explains calibration (start light, do the program reps, adjust by valid
  increments). It does not guess a number and present it as a plan.
- **Prefills come only from finished-workout history for that same field.** The one
  exception is the live set-log screen: Reps prefills from that set's target, and
  effort prefills Moderate (`.cursor/rules/history-prefill.mdc`). Nowhere else does a
  plan, a library cue, a recommendation, or a type default become a prefilled value.
- **Never invent warmup (e.g. 50% / 12 reps), rest (e.g. 90s), or notes (a copy of
  cues).** Absent is absent. Editing an existing record may show that record's saved
  values — that's history, not invention.

**The test for any prefilled or suggested value:** can you name the finished-workout
record it came from? If not, it must not appear as if the user entered it.

## 2. Recommendations are explainable, and use real increments

Completed history supplies the next load. Easy completed work moves one valid
equipment step up; missed reps or failure move one step down; moderate work holds.
Alternating stacks (e.g. 4/5 kg) use their real sequence, not a rounded increment.

- **The recommendation is computed from history and nothing else**, and its decision
  is inspectable (`progress.js`). A load you can't trace back to effort + increment
  is a bug you can't see.
- **Correcting meaningful history shows a recalculation preview** before it writes
  next kg/reps onto the routine. Nothing silently rewrites the plan.

**The test:** given the same history, does the recommendation always produce the same
explainable step? A recommendation that can't be explained from its inputs fails.

## 3. Setup and history are separate; history is immutable

- **Setup changes never rewrite historical snapshots.** A live/completed workout is a
  snapshot of the routine at Start; editing the routine later does not reach back into
  what already happened.
- **Referenced setup objects are archived, not deleted.** Only unreferenced objects
  can be hard-deleted. History keeps pointing at what it recorded.
- **Completed (non-skipped) history writes next kg/reps onto the routine** — that is
  the one direction data flows from history into setup, and it's explicit.

**The test:** after this change, can any past workout read differently than it did
when it was logged? If yes, it's wrong.

## 4. Consistent action vocabulary

The verbs mean the same thing on every screen (`README.md`):

```
Lists              browse and offer Add.
Object detail      own Edit and Delete.
Relationship pages use Add and Remove (not Edit/Delete).
Save               commits.
Cancel             returns without committing.
Back               returns to the previous screen.
```

**The test:** does this control use the verb the rest of the app uses for that action?
A "Delete" on a relationship page (should be Remove), or a "Save" that doesn't commit,
breaks the contract even if it works.

**Spatial rule (Emilio, 2026-09-10):** a control's *side* is part of its meaning.
Every **primary / forward** action — the one that moves you deeper into the flow
(Start, Save, Complete, Next, Continue) — sits on the **right**. Every **back /
previous / cancel** action sits on the **left**. This holds on every screen, so the
thumb learns one map: right advances, left retreats. **The test:** on any screen with
two actions, is the forward one on the right and the retreat one on the left? (Audited
across the app in req-29, which reordered 11 action rows.)

Two conventions from the req-29 audit:
- **Set the order in markup, never `row-reverse` in CSS.** `.ui-actions` is normal LTR flex, so DOM
  child order = visual left→right = tab/focus order. A CSS reverse would desync focus from the visual
  order (an a11y anti-pattern). New rows put the retreat child first, the primary child last.
- **A lateral action (e.g. Skip) sits between retreat and forward — never right of the primary.** Skip
  neither commits nor retreats: in the set-log it's Previous · Skip · Complete; where Skip *dismisses*
  something (the recalc screen) it reads as a retreat and goes left (Skip · Apply).

## 5. Feel — a floor, not a budget

For the MVP there is no visual-design pass, so "feel" means: the loop doesn't fight
the user. No dead ends, no lost input on a back-navigation (going back a set keeps the
values just logged), no ambiguous state about whether something was saved. That's the
floor. Decoration waits.

## Applying these when they conflict

When two pull against each other, the earlier value wins. Trust beats convenience: if
a smoother flow requires inventing or guessing a value, the flow loses. Functional
beats consistent only when a screen genuinely can't use the standard verb — and then
the requirement says so and why. Feel never overrides any of the first three.

## Reference

The authoritative contract is `README.md` (entity ownership, recommendation rules,
action vocabulary, persistence/migration). The prefill rule is
`.cursor/rules/history-prefill.mdc`. This file is how to *decide*; those two are what
is *true*.
