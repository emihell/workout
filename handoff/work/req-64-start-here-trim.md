# req-64 — Trim START-HERE to cold-start-only; kill the workflow-doc duplication drift

**Status: READY** (one default made on Emilio's behalf — the worktree path, marked
unconfirmed below).

**Gate: infra/docs.** Built by the **code session** — it edits repo-root files
(`START-HERE.md`, `README.md`) that planning cannot commit (DEC-005 isolation; `plan
save` refuses non-`handoff/` files). Planning verifies by reading the diff and merges on
its own read (DEC-035); low blast radius (docs only, no `src/`).

## Why

`START-HERE.md` re-states the build loop and its three stages — content that already
lives, canonically, in `handoff/PLANNING.md` + `handoff/rules/WORKFLOW.md`. **A fact kept
in two files is the drift engine** (the project's own rule: "a fact in two places is worse
than in neither"). The rot is already visible: the doc still says "**Cowork**" (a tool we
no longer use — only Claude Code now), still frames the planning session as a "cloud
session," and still points at `~/projects/workout/` while the repo actually lives at
`/Users/emilio/dev/workout/`. Fixing the words treats the symptom; the disease is the
duplication. Single-source the workflow in `handoff/` and shrink the root doc to what only
it can provide: the cold-start entry point (you read it *before* `handoff/` is loaded).

## Scope (root docs only)

1. **Trim `START-HERE.md` to cold-start essentials:** the worktree-layout snippet, the two
   boot prompts, the one-line "your task is usually…", and a single pointer — *"everything
   else (the loop, the gates, close-out) is in `handoff/PLANNING.md` for planning and
   `CLAUDE.md` for building."* **Remove** the "HOW WE WORK — the loop" section (the three
   stages) and the "FOR THE ASSISTANT" read-order + hard-rules block: both restate
   `handoff/PLANNING.md`/`WORKFLOW.md`/`CLOSEOUT.md`. Keep it short enough that it changes
   almost never.
2. **Retire "Cowork"** everywhere it remains → "planning session" / "Planning (Claude
   Code)". Sites: `START-HERE.md` (layout line, the `### Cowork` prompt header, the task
   bullet — any that survive the trim) and `README.md:~109` (the "Planning workflow"
   paragraph). Leave the rest of `README.md` — the product contract, entity/recommendation/
   persistence sections, and the Setup block — untouched.
3. **Soften the "cloud session" wording** in `START-HERE.md`'s hard-rules (if that block
   survives the trim): planning is a local Claude Code session now, not cloud. Keep the
   index-lock caution. Match the reword already merged in `handoff/rules/CLOSEOUT.md:66`
   ("an interrupted session may have left a stale lock").
4. **Reconcile the worktree path.** The docs say `~/projects/workout/`; the actual machine
   uses `/Users/emilio/dev/workout/`. **Decision (Emilio, unconfirmed):** make the doc
   **path-agnostic** — "two sibling worktrees, wherever you cloned them (`workout-codebase`
   + `workout-planning`)" — rather than hardcode either machine path. The README Setup
   block's `mkdir -p ~/projects/workout` may stay as a *suggested* location; just don't let
   the cheat-sheet assert a path that isn't true. If Emilio prefers hardcoding the real
   path, do that instead.

## Out of scope

- The `handoff/` workflow docs themselves — they are already the single source; do **not**
  copy loop/stage prose into them (that would recreate the duplication elsewhere).
- `README.md`'s product contract / Setup block content (only the terminology in the
  "Planning workflow" paragraph, and the path per step 4).
- `.cursor/rules/`, `plan`'s in-script comments — not this req.

## Ordered steps

1. Trim `START-HERE.md` per step 1; retire "Cowork" and soften "cloud session" in whatever
   survives.
2. Retire "Cowork" in `README.md`'s Planning-workflow paragraph.
3. Apply the path decision (step 4) to both docs.
4. `./check` (docs don't affect it, but run it — it must stay green).

## Acceptance criteria (written before implementation)

- **No "Cowork":** `grep -rn "Cowork" README.md START-HERE.md` → no matches (exit 1).
- **No duplication (the point):** `START-HERE.md` no longer contains the three-stage loop
  prose or the read-order/hard-rules that live in `handoff/PLANNING.md`/`WORKFLOW.md`/
  `CLOSEOUT.md` — it points to them instead. Show the before/after in the report; the
  reviewer confirms the removed text is genuinely covered by the `handoff/` docs (failure
  case: content deleted that lived *only* in START-HERE — quote anything unique before
  removing it).
- **No stale "cloud session":** `grep -rn "cloud session" START-HERE.md` → none (or
  reworded to drop the cloud framing while keeping the lock caution).
- **Path reconciled:** the cheat-sheet no longer asserts a worktree path that isn't the
  real one (per step 4).
- **No `handoff/` file touched by this req** — it is root-doc-only. `./check` green — paste
  the line.

## Decisions

- **content (Emilio):** START-HERE is cold-start-only; the workflow is single-sourced in
  `handoff/`. Retire "Cowork"; drop the "cloud session" framing.
- **path (Emilio, unconfirmed — default path-agnostic):** see step 4.
- **implementation (code session):** the exact trimmed wording of START-HERE, as long as it
  stops duplicating `handoff/` and still works as a pre-`handoff/` entry point.
