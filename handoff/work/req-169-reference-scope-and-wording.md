# req-169 — finished snapshots count as references; a draft-only reference is worded truthfully

**Status: READY** (2026-09-25) **Lane: bug** (small; the reviewer fires — state-reducers.js). DEC-089 (refines DEC-031,
DEC-058 §5, req-168). Reproduce both on main first (L-042).

1. `exerciseDeletionImpact` (`state-reducers.js` ~:34) counts finished workouts by their **sets** only; an exercise listed
   in a finished workout's `snapshot.items` with zero logged sets is hard-deleted. **Fix:** also count finished workouts'
   `snapshot.items` (`exerciseId`). Check `routineDeletionImpact` for the same gap (a finished workout names its routine by
   `routineId` / `snapshot.routineId`) and close it if present.
2. `deletionConfirmHead` (~:140) gives a draft-only reference "has past workouts…". **Fix:** the impact reports the draft
   reference separately (e.g. `inDraft`), and the head reads, in this order: in the current workout → has past workouts →
   **"{name} is in an unfinished workout and will be archived (kept)."** → `Delete {name}?`. The reducer's archive-vs-delete
   decision is unchanged (any of the three archives).

## Acceptance criteria

- (1) a doc where the only reference is a finished workout's zero-set snapshot item → delete archives (`archivedAt` set);
  fails on main (hard-deleted), passes on the branch. Same for a routine if the gap exists.
- (2) a test per wording case, incl. draft-only; the confirm text and the reducer read the same impact.
- Browser via `./plan qa`: both cases with the sheet text and the stored result pasted. `./check --smoke` green. Reviewer.
