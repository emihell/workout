# req-27 — show (and edit) the upcoming set's weight during rest

Branch `req-27`. From Emilio's 2026-09-10 gym-flow note #1. The hardest of the notes.

## Technical

### The seam I chose (flagged, per spec)
**A per-set override on `activeWorkout`: `nextSetWeight = { itemId, workIndex, weight }`**,
consulted by the seed pipeline through a pure `pendingWeightFor(pending, { itemId,
workIndex })` in `workout-log.js`.

- **Scoped to exactly one set.** `pendingWeightFor` returns the override weight only when
  *both* `itemId` and `workIndex` match the set being seeded; otherwise `null`. This is the
  no-leak guarantee — an edit can never pre-fill another set or a different exercise, even
  if their indices coincide (itemId differs).
- **Consumed, then cleared.** `initialSetFields` takes an optional `weightOverride`; when
  present (and weighted, and not a restore) it replaces the computed seed *weight only*
  (never reps, never effort/note). On completing/skipping a set the override is cleared
  (`nextSetWeight: null` folded into the completion patch); `previousSet` clears it too
  (going back changes which set is upcoming). The scope guard alone already prevents leaks;
  clearing is hygiene so `activeWorkout` doesn't carry stale state.
- **Persists across reload.** `nextSetWeight` rides on `activeWorkout`, which
  `model.workoutSnapshot` preserves via `{ ...workout }` (same way `restEndsAt` survives a
  reload). No schema-version bump, no migration, no bulk write — it's a transient field on
  the active workout, absent on older saved states (→ `undefined` → no override), gone when
  the workout is finished/abandoned. So **no ask-gate triggered.**

Rejected the "reuse `restore`" option: `restore` is component-local `useState` (lost on
reload) and models "un-log and re-log a past set" (weight+reps+effort+note), not "pre-set
the next set's weight". A persisted, weight-only, forward override is a cleaner fit and
keeps `restore` doing its one job.

### History-is-truth kept intact
The override is only ever a value the lifter typed — `initialSetFields` still computes the
weight from history/carry/blank exactly as req-17 does, and the override replaces it *only
when present*. `weightOverride = null` (no edit) leaves the computed weight untouched, so a
no-history weighted exercise still shows a blank upcoming weight, never a guess. An explicit
blank edit (`''`) is distinct from `null` and is honoured (blanks the field).

### Files
- `src/workout-log.js` — `initialSetFields` gains `weightOverride`; new pure
  `pendingWeightFor`.
- `src/views/workout/item.jsx` — resolve `weightOverride` via `pendingWeightFor`; compute
  the change-emphasis (`upcomingChanged`/`upcomingDirection`, comparing the upcoming seed
  weight to the just-logged working set); new `RestUpcoming` presentational component shown
  in the resting branch when `weighted && !plannedDone`; `setUpcomingWeight` writes the
  scoped override; clear the override on complete/skip/previous.
- `src/ui/ui.css` — `.ui-upcoming` styles.
- `src/workout-log.test.js` — tests for `weightOverride` and `pendingWeightFor`.

### Change-emphasis
`RestUpcoming` shows `Next [kg input] × reps`, and marks it `Next ↑` / `Next ↓` when the
upcoming weight differs from the set just completed. Both sides must be real numbers to
compare, so a no-history blank upcoming (or a skipped last set) is never flagged. Because
the comparison uses the *seed* weight (which reflects the override), editing the upcoming
weight up/down shows the marker live too. Exact emphasis/placement is the feel-gate's.

## Verification

Unit (pure layer):
```
node --test src/workout-log.test.js  →  # tests 43  # pass 43  # fail 0
```
Covers: override beats computed history weight; explicit `''` blanks; `null` leaves a
no-history blank blank (no-invent); ignored on restore; ignored when not weighted; and
`pendingWeightFor` scope (match → weight; itemId mismatch → null; workIndex mismatch →
null; no pending → null; `''` preserved).

Browser (dev server; seeded throwaway routines, cleared after) — a 3-set weighted routine:
- Complete set 1 @ 40kg → rest screen shows **`Next  [40]  × 8`**, editable, no marker
  (40 carried = 40 logged). ✓
- Edit upcoming to **45** → marker becomes **`Next ↑`**, input shows 45. ✓
- Press **Next** (end rest) → set 2 form opens **pre-filled 45** (the edit, not the
  computed carry 40). ✓
- Complete set 2 → `[measured]` store `nextSetWeight === null` (override cleared); set 3
  upcoming shows **45** from the computed carry, **no marker** (45==45) — the edit did not
  leak. ✓
- Set 1's kg field opened **blank** (no-invent for a no-history exercise). ✓

Bodyweight routine:
- During rest, RestBar + Previous show but **no upcoming weight panel** — the `weighted`
  gate hides it (no weight field during rest for non-weighted). ✓

Full gate:
```
check: green — lint, 13 test file(s), and the build all passed.
```

## Workflow
- **Seam decision is mine** (`nextSetWeight` per-set override + `pendingWeightFor`), flagged
  above — candidate for a short `DEC-` (where the pending-weight override lives; scoped by
  `{itemId, workIndex}`; weight-only; cleared on complete/skip/previous; persisted on
  activeWorkout, no migration).
- **No schema/migration ask needed** — reasoned above (transient field on activeWorkout,
  preserved by the existing snapshot spread, absent-safe on old data).
- Scope held: reps/effort not editable during rest; only the immediate next set; seed
  computation (req-17) unchanged as the default source.

## What I could not verify myself (feel — Emilio, DEC-009)
The emphasis treatment (`↑`/`↓` + label) and the panel's placement/size mid-set — whether
the change is obvious enough at a glance, whether editing the weight one-handed during rest
feels right, and whether showing the upcoming line *always* (vs only when it changes) is the
right call. All refinable at the feel-gate without touching the seam.
