# req-168 — backlog sweep: the last low-priority follow-ups before new features

**Status: BUILT — branch `req-168` (`376a01a`), NOT merged.** (2026-09-25) **Lane: bug** (mixed tooling + tests; the reviewer fires if storage/reducers are touched).
Emilio: "do it" — clear the table before features (DEC-087). **Reproduce each item on main first (L-042); an item that
doesn't reproduce is reported and dropped, not built.**

1. **Legacy drafts aren't references** (BACKLOG req-119): deleting an exercise or routine counts references in workouts +
   the active workout, not in legacy `draftWorkouts` — so one referenced only by an old draft can be hard-deleted instead of
   archived (DESIGN §3: referenced setup is archived). **Fix:** count `draftWorkouts` too. Also: the logged-sets branch of
   `exerciseInActiveWorkout` — test it, or show it's unreachable and remove it.
2. **Component tests** (req-117 a), with the req-156 render harness: History's Add set writes nothing before Save (Cancel
   leaves the workout byte-identical); `item.jsx` passes a restored duration to the form.
3. **req-161 nits:** one Import's copies share one timestamp (a reused copy doesn't split the set's ISO); add the quota →
   free space → retry → release test (the reviewer's probe, made permanent).
4. **Tooling — the pre-push fast-forward guard** (`.githooks/pre-push`) refuses a req branch just created at main's tip
   with no commits of its own (2026-09-23, req-120). **Fix:** exempt a branch with no commits beyond main; keep refusing a
   real fast-forward.
5. **Tooling — `plan publish` reads a nested agent worktree** (`workout-codebase/.claude/worktrees/agent-*`) as the code
   worktree ("code worktree is on 'req-120'"). **Fix:** resolve the code worktree by its exact path.
6. **Tooling — `npm run shot`** can't reach a state behind a click (req-105). **Fix:** `--click <text>` (repeatable) and
   `--scroll-bottom`; or, if `plan qa` + the smoke's page setup makes `shot` redundant, say so and propose removing it.

## Acceptance criteria

- Per item: the main reproduction (paste), then a test or self-test that fails on main and passes on the branch (paste
  both). Tooling guards shown firing and not firing in a sandbox/throwaway commit (L-040).
- (1): a doc whose only reference to an exercise is a legacy draft → delete archives it (stored `archivedAt` set, not
  removed).
- `./check --smoke` green (paste). Reviewer if a trigger file is touched.
