**Status: READY** · **Lane: bug** · DEC-146, DEC-151, DEC-154 (Phase 1 order, first). Touches `src/progress.js` → reviewer (WORKFLOW check 5).

# req-256 — "12 reps" is read as a duration

## Reproduction [measured, `main` `6b801bc`, 2026-10-31]

`isDurationTarget` (`src/progress.js:89-92`) returns true for any target whose text, spaces removed, ends in "s":

```
node -e "import('./src/progress.js').then(m=>console.log(['12 reps','12','30s','45 sec','10-12','AMRAP','3 sets'].map(v=>v+' → '+m.isDurationTarget(v)).join('\n')))"
12 reps → true      ← wrong
12 → false
30s → true
45 sec → true
10-12 → false
AMRAP → false
3 sets → true       ← wrong
```

What follows from a wrong `true` (all callers, `grep -rn isDurationTarget src server`):
- the log screen labels the field **Duration** instead of Reps (`src/views/workout/item.jsx:496, 832`);
- `countableReps` returns null, so the load recommendation skips that set (`src/progress.js:98-101`);
- `plan build` C6 refuses the target (`server/plan-build.mjs:125-129`).

**Exposure today: none in Emilio's data** [measured, rev 79]: every target the function reads as a duration in his
routines and 25 workouts is a real one (`5 min`, `5-8 min`, `5–8 min`, `8 min: 1 min snabbt / 1 min lugnt`, `20 min`, `60s`,
`60 sec`). It bites the first time someone types "8 reps" / "3 sets" — a latent bug, cheap to close.

## Scope

1. `isDurationTarget`: a trailing "s" counts only right after a digit (`45s`, `45 s`). Keep `min` / `sec` anywhere as now.
   Everything listed above as a real duration in his data stays `true`.
2. Tests in `src/progress.test.js` (the req-44 block, `:5-17`): add `12 reps`, `8 reps`, `3 sets`, `10 reps each` → false;
   `45 s`, `60s`, `5-8 min`, `5–8 min`, `8 min: 1 min snabbt / 1 min lugnt`, `60 sec` → true. Existing assertions unedited.
3. `server/req-254.test.mjs:200` uses `"12 reps"` as C6's refused example [measured]: switch it to a real duration
   (`"60s"`) so C6 still fires — a test edit, called out in the report.

## Out of scope

- The other half of the BACKLOG entry: range/AMRAP targets prefilling Reps and being logged as typed
  (`src/workout-log.js:613-615`). Separate, needs a behaviour call.
- `src/req-150.progress-main.fixture.js:49` — a frozen copy of an old `main`; leave it.
- Any change to what counts as a duration beyond the trailing "s".

## Acceptance criteria

1. **Fails on main, passes on the branch:** the new `false` assertions fail against `main`'s `progress.js` and pass on the
   branch (both receipts in the report).
2. **No regression on real data:** run `isDurationTarget` over every target in rev 79's routines and workouts (read-only,
   a copy of the state) — the set of `true` values is identical before and after (paste both).
3. **Right mechanism:** `countableReps('12 reps')` → 12 on the branch (null on main); a log screen with target "12 reps"
   shows **Reps**, not Duration (browser re-run on an isolated origin, `plan qa`).
4. **Failure case:** `plan build` with a target "12 reps" on a non-timed item → no C6 refusal, the "not a plain number"
   warning instead (`server/plan-build.mjs:141-143`); with "60s" → still refused.
5. `./check` green.

## Checks run

1. DECs grepped (duration, target, isDurationTarget): DEC-146, DEC-151 (C6 lives on this function); none fixes the rule.
2. Siblings: req-255 (READY) edits `itemProblems` in `plan-build.mjs` (C5); this req edits only its test (step 3). Either order; a rebase at most.
3. Deferrals: the range/AMRAP half stays in BACKLOG §Phase 1.
4. Numbers: from the commands above, 2026-10-31.
5. Trigger file `progress.js` → independent reviewer. No stored records written → no backup reminder.
6. `(unconfirmed)`: none — the field label follows the fixed rule; no new behaviour.

## Decisions made on Emilio's behalf

- **implementation:** digit-before-"s" as the rule (not a list of unit words); the range/AMRAP half split off.
