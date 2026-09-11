# req-27 — show (and let you change) the upcoming set's weight during rest (note #1)

**Status: BUILT AND MERGED, 2026-09-11 — branch `req-27` (`f99ad52`…`5a09046`, 2 commits).** (behaviour decided below; ux-feel gate confirms the feel). From Emilio's 2026-09-10
gym-flow notes: *"If weight changes, show 'upcoming' so you can change the weights while resting."*

**Gate: gym-flow feel** (DEC-009) — **Emilio uses it before merge.** The hardest of the note reqs;
budget iteration.

## Why

While resting, the lifter is deciding the next set's load. Today the rest screen shows only the
countdown (`RestBar`); the next set's prescribed weight isn't visible until rest ends and the log form
appears, and it can't be adjusted during the rest. Emilio wants the **upcoming weight surfaced during
rest, and editable then** — so a progression bump (or a planned change) is seen and can be corrected
before the set starts.

[measured] the next set's seed already exists: `initialSetFields`/`setLogSeed` (`workout-log.js`,
req-17) computes the upcoming weight/reps from history + suggestedWeights. The rest UI is the
persistent `RestBar` (`views/workout/rest.jsx`); the live flow is `WorkoutItemLive`
(`views/workout/item.jsx`).

## The behaviour (decided)

- **When rest is running and there is a next set for this exercise**, show the upcoming set's
  prescribed **weight** (and reps) near the RestBar — e.g. "Next: 40 kg × 5".
- **Surface it prominently when the weight changes** from the set just completed (a progression bump
  or a planned step) — Emilio's "if weight changes". Showing it always is fine too; the *changed* case
  is the one that must not be missed. **Decided:** always show the upcoming line during rest, and mark
  it when it differs from the last logged set (e.g. an "up"/"down" or bold treatment). Feel-gate
  refines the exact emphasis.
- **Editable during rest:** the upcoming weight is an input; changing it sets the weight the **next
  set's form is pre-filled with** (an override that beats the computed seed for that one upcoming set).
  Leaving it unedited keeps the computed seed.
- Only for the **weight** (and only when the exercise uses weight). Reps editing during rest is out of
  scope unless it falls out naturally.

## Implementation notes (CC's call — flag the seam)

The non-trivial part is persisting the "pending next-set weight" so the next set's form reads it. The
seed pipeline is `initialSetFields(...)`. Options: stash a per-item override on `activeWorkout` (e.g.
`nextWeightOverride`) that `initialSetFields`/the form consults before the computed seed, cleared once
that set is logged; or reuse the existing `restore` mechanism. **CC decides**, but keep the
history-is-truth rule intact: the override is an explicit user edit, not an invented value, and it
must not leak into other sets/exercises. State the seam in the report.

## Scope

- Rest-time upcoming-weight display (weight + reps) tied to the next set of the current exercise.
- Editable weight during rest that pre-fills the next set.
- The change-emphasis when upcoming ≠ last logged.

## Out of scope

- Editing reps/effort during rest; editing weights for sets beyond the immediate next one.
- The rest-end cue, and the last-set rest fix (req-25).
- Any change to how the seed itself is computed (req-17 stays the source of the default).

## Acceptance criteria

- **Upcoming visible during rest (Emilio, in-browser):** complete a set of a weighted exercise with a
  rest → the rest screen shows the next set's weight (and reps).
- **Change is obvious:** when the next set's prescribed weight differs from the one just logged (e.g. a
  progression bump), that difference is visibly marked.
- **Edit carries forward:** change the upcoming weight during rest → when the next set's form opens, it
  is pre-filled with the edited weight, not the computed seed. Editing does not affect any other set or
  exercise, and an un-edited rest leaves the seed unchanged.
- **History-is-truth intact:** a weighted exercise with **no history** still shows no invented weight;
  the upcoming field is blank, not a guess (DESIGN rule).
- **No regression:** `./check` green; non-weighted/cardio exercises show no weight field during rest.

## Decisions

- **behaviour:** decided above; the emphasis treatment and exact placement are the feel-gate's to
  confirm.
- **implementation (CC's call, report it):** where the pending-weight override lives and how
  `initialSetFields` consults it without breaking the no-invent rule.
