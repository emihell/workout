# req-144 — creation design: how beginners and advanced users create exercises, routines and programs

**Status: NEEDS DECISIONS** — **a design req, no code.** It's owned by planning + Emilio, working live, and its output is
a design doc, `DEC-`s and the build reqs that follow. Opens Phase 2 (BACKLOG §Phase 2: "Define the model first, then the
creation UX"). Emilio 2026-09-24: creating exercises and routines is "the hardest thing to simplify… the difference
between a first time gym goer and an advanced user are so far apart… but i want support for both". It absorbs `req-10`
(first-time exercise setup) and the DEC-056 "review and update the routine" step as inputs.

## Open questions (answered in the sessions, each becoming a DEC-)

1. **Personas:** who exactly are we designing for? (Draft: first-timer with no plan · someone ~1 year in with a routine
   from a friend · advanced lifter running a program with % and progression.)
2. **The simplicity rule:** e.g. "an advanced feature never costs a beginner a tap or a decision." Its exact wording,
   and how we test a feature against it.
3. **Parameters:** for each one (exercises, sets, reps, weight, rest, warm-ups, supersets, tempo, RPE/%, progression,
   schedule, deload…), which persona must see it, which gets a default, and which stays hidden until asked for.
4. **Flows:** step by step, how each persona creates a routine, and (later) a program. Where do beginners start: a goal,
   a template, or a blank routine?
5. **Model:** program vs routine vs schedule (the old `programs` remnants in `model.js`/`storage.js`). What must the
   routine model hold that it can't today?
6. **Library asks:** what creation needs from the exercise library. Does "difficulty" mean skill or safe loading? Do
   we need "easier / harder version" relations? Is "staple" the beginner default list?
7. **Real people:** can Emilio get one real beginner and one experienced lifter to try creating a routine (paper or the
   current app) while he watches?

## Prep (planning, before session 1) — DONE 2026-09-24: `work/req-144-prep.md`

- **Current model audit** [to measure]: what the routine/schedule model holds today (fields, per-set targets, warm-ups,
  rest, duration, anything superset-like), and what the old program layer looked like.
- **Prior art:** how 3–4 well-known apps handle beginner vs advanced creation, and where users complain (cumbersome,
  too many fields). Evidence and quotes, not opinions.
- **Draft parameter table** for Emilio to react to.

## Deliverables

- `work/req-144-creation-design/` (a folder, since this will pass 200 lines): personas, the rule, the parameter table,
  flow sketches (rough screens), model + library gaps.
- A `DEC-` per answered question.
- The build reqs it spawns (library/model gaps first, then creation screens), each READY on its own.

## Acceptance (for a design req)

Every open question above is answered by Emilio and recorded as a `DEC-`. Each flow is walked through once end to end for
each persona. The gap list is turned into numbered reqs. Nothing gets built from this req itself.

## Relation to the library work (DEC-070 + 2026-09-24 talk)

The library batches continue alongside this, on fields whose meaning is stable (names, aliases, muscles, pattern,
equipment, logAs, text). **No new library fields**, and difficulty/staple aren't treated as final, until this design says
what they're for.
