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
- **The workout's work-set kg comes from the routine** (DEC-096): the user typed or confirmed it. Adding an exercise to a
  routine prefills its kg from that exercise's history; after the exercise, a confirmed "Update routine" offer carries the
  logged kg back to that routine only — never automatic (DEC-056). Routine kg blank → the set starts blank.
- **Every other prefill comes only from finished-workout history for that same field.** Sanctioned exceptions, all the
  user's own input rather than invented data: (1) the live set-log screen prefills Reps from that set's target, and Effort Moderate
  **only where Effort is shown** (warm-up/cardio carry no effort, req-156); (2) the **kg** the user just entered this
  session carries to the next working set when the routine has **no kg at that index** — a no-history exercise (DEC-002),
  an Add set, or a routine that grew (req-152); reps never carry (DEC-052); (3) an in-session kg change carries to the
  remaining sets (DEC-052); (4) an unsaved draft restores what was typed (req-125). Nowhere else does a library cue, a
  recommendation, or a type default become a prefilled value.
- **Never invent warmup (e.g. 50% / 12 reps), rest (e.g. 90s), or notes (a copy of
  cues).** Absent is absent. One exception (DEC-097 §4): adding a no-history exercise to a routine shows a
  **starting plan** ("3 × 10, 90 s rest — change any time"), visible and accepted by adding — never a kg. Editing an existing record may show that record's saved
  values — that's history, not invention.

**The test for any prefilled or suggested value:** can you name the record it came from — a
finished workout, or the routine value the user set? If not, it must not appear as if the user entered it.

## 2. Recommendations are explainable, and use real increments

Completed history supplies the next load. Easy completed work moves one valid
equipment step up; missed reps or failure move one step down; moderate work holds.
Alternating stacks (e.g. 4/5 kg) use their real sequence, not a rounded increment.
A target that isn't a single number (a range, AMRAP, a duration, text), and any assisted exercise, hold — same kg,
same target (DEC-075/076).

- **The recommendation is computed from history and nothing else**, and its decision
  is inspectable (`progress.js`). A load you can't trace back to effort + increment
  is a bug you can't see.
- **Correcting meaningful history offers an update** (Apply / Skip) before anything
  is written onto the routine. Nothing silently rewrites the plan.

**The test:** given the same history, does the recommendation always produce the same
explainable step? A recommendation that can't be explained from its inputs fails.

## 3. Setup and history are separate; history is immutable

- **Setup changes never rewrite historical snapshots.** A live/completed workout is a
  snapshot of the routine at Start; editing the routine later does not reach back into
  what already happened.
- **Referenced setup objects are archived, not deleted.** Only unreferenced objects
  can be hard-deleted. History keeps pointing at what it recorded.
- **History reaches the routine only by a deliberate step.** Finishing never changes the routine
  (DEC-056); correcting history offers an update, and only Apply writes that workout's kg/reps onto it. That is
  the one direction data flows from history into setup.

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

**Navigation vs. action treatment (Emilio, 2026-09-13; req-62 / DEC-042).** The vocabulary has
two treatments, and a control must wear the one that matches what it does:
- **Navigation** (changes screen, commits nothing) wears the **link** treatment — the `NavLink`
  primitive with a chevron: `‹` for back, `›` for forward. It reads as a *place*, and uses only the
  §4 verbs. `Back` is a `‹ Back` link, not a button (DEC-016).
- **Action** (commits/changes state) wears the **Button**, with only the §4 verbs.
- **No off-vocabulary verb.** "Done" (reads like it commits when nothing does) and "Correct"
  (an action-y one-off for what is really *Edit*) are the caught examples — removed in req-62.
- A navigate-only control may take the *button look* where it sits beside a real Button (DEC-040),
  but it stays a link (no `go()` handler). **The test:** is every screen-change a chevron link and
  every state-change a Button, and does each use a §4 verb — no "Done", no "Correct"?

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
