# Workout MVP product contract

This browser-only MVP supports one trustworthy loop: set up exercises and reusable routines, schedule them, start a workout snapshot, log sets, and keep an editable historical record.

## Entity ownership

- Exercise: reusable name, equipment, type, cues, muscles and valid weight increments.
- Routine: ordered exercise references plus the prescription (sets, reps, kg, rest, notes, WU set). This is next time's source of truth.
- Schedule slot: recurring week/day placement `{ id, week, weekday, routineId }`. It never owns kg or reps.
- Live workout: a snapshot of the routine at Start, plus logged and skipped sets. Extra sets stay on this snapshot only until Finish.
- Completed workout: the snapshot plus actual sets. Unopened planned sets are recorded as skipped at Finish. Completed (non-skipped) history then writes next kg/reps onto the routine.

## Recommendation rules

Completed history supplies the next load. Easy completed work moves one valid equipment step up; missed reps or failure move one step down; moderate work holds. Alternating 4/5 kg stacks use their real sequence rather than a rounded 5 kg increment.

A weighted exercise without history has no invented starting weight. Its dated plan explains calibration: start light, perform the program reps, and adjust by valid increments based on effort.

Correcting meaningful history shows a recalculation preview. Recalculation writes next kg and reps onto the routine from that workout.

## Action vocabulary

- Lists browse and offer Add.
- Object detail pages own Edit and Delete.
- Relationship pages use Add and Remove.
- Save commits; Cancel returns without committing; Back returns to the previous screen.
- Referenced setup objects are archived from active setup. Unreferenced objects can be hard-deleted. Historical snapshots are never rewritten by setup changes.

## Persistence and migration

The seed in `src/db.json` is provenance and reference only — it is not loaded at runtime; first run starts from an empty state (`emptyState()` returns empty arrays). Live state is stored in browser `localStorage` under `workout-mvp-v8`. On load, older v5–v7 keys are migrated to schema version 8: `sessions`/`programs` become `routines`, slot and workout `sessionId` becomes `routineId`, and leftover program wrapping is dropped. Existing opaque ids (`sess-…`, `si-…`) are kept.

## Setup (first time on a machine)

Clone the repo, wire up the git hooks, install deps, and create the planning worktree. The two worktrees **must be siblings** (the planning grants use `../workout-codebase` relative paths). Paste the whole block:

```sh
# 0 — a home for the two worktrees (they must be siblings)
mkdir -p ~/projects/workout && cd ~/projects/workout

# 1 — clone the code worktree
git clone https://github.com/emihell/workout.git workout-codebase
cd workout-codebase

# 2 — activate the git hooks (per-clone, not stored in the repo; guards handoff/)
git config core.hooksPath .githooks

# 3 — install dependencies (node_modules is gitignored)
npm install

# 4 — add the planning worktree (branch `planning`, sibling directory)
git worktree add ../workout-planning planning

# 5 — grant the planning session its git + ./plan permissions
#     (machine-local, gitignored by design — recreate on every machine)
mkdir -p ../workout-planning/.claude
cat > ../workout-planning/.claude/settings.local.json <<'JSON'
{ "permissions": { "allow": [
  "Bash(git add:*)",
  "Bash(git commit:*)",
  "Bash(git reset:*)",
  "Bash(git restore:*)",
  "Bash(git push:*)",
  "Bash(../workout-codebase/plan save:*)",
  "Bash(../workout-codebase/plan status:*)",
  "Bash(../workout-codebase/plan publish:*)",
  "Bash(../workout-codebase/plan closeout:*)"
] } }
JSON
```

That gives you the two-worktree layout (`workout-codebase/` on `main`, `workout-planning/` on `planning`). To boot a session, see **`START-HERE.md`** for the one-line prompts; run the app with `npm run dev` in `workout-codebase/`.

## Development

```sh
npm run dev
npm run lint
npm run build
node --test src/*.test.js
```

Dev server: a single instance at http://localhost:5173/

Live (after GitHub Pages is set to the `gh-pages` branch): https://emihell.github.io/workout/

## Deferred scope

No accounts, sharing, collaboration, sheet-import UI, insights, charts, GPS, social features, or visual-design pass are part of this MVP.

## Planning workflow

This repo uses a two-worktree planning/build loop. Start at **`START-HERE.md`** — it
has the boot prompts and the loop. In short: a Cowork "planning" session writes specs
into `handoff/` (read-only to the builder, enforced by a pre-commit hook), Claude Code
builds each `req-N` on its own branch, and `./plan` publishes/merges/closes.

```
./check          the gate: lint + tests + build (must pass before code reaches main)
./plan status    where the two worktrees stand
./plan publish   merge planning -> main
./plan closeout req-N   merge a built branch, flip its doc, publish, push, clean up
```

`handoff/` is written only by the planning session; `WORKOUT_SKIP_CHECK=1` is the one
explicit, echoed bypass of the gate. Full rules live in `handoff/` (`PLANNING.md`,
`rules/WORKFLOW.md`, `rules/CLOSEOUT.md`).
