# req-100 — two planning-tool guards: `plan ping` + a blocking NOW.md ≤50 pre-commit check

**Status: SPEC — READY.** Tooling only (the `plan` script + `scripts/check_handoff.py`). No app code,
no persisted-data change. Came out of the 2026-09-18 external workflow review (grade B+); turns two
prose rules that were violated this session into tool refusals — the project's own philosophy
(receipts over claims; save/publish/closeout are already guarded). See [[L-019]] and PLANNING.md
build cycle steps 1–2, 9.

## Context — why (both are "make the correct path the only easy path")

- **R1 (L-019):** Planner told Builder a req spec was "on main" while it was still unpublished in the
  planning worktree. Three prose rules already forbade it (`PLANNING.md:174–179`, `:222–223`, `:190`)
  and it happened anyway — so the fix is a tool guard, not more text.
- **R2:** NOW.md keeps breaching its own ≤50-line rule (10+ historical "trim NOW" commits). The
  finding already exists at `check_handoff.py:432` as severity **`"fail"`**, but `plan save` prints it
  **non-blocking** (it commits first, then surfaces drift — by design, because status-drift needs the
  commit to exist). So the count gets deferred and hand-fixed next pass.

## Guard 1 — `plan ping req-N` (new read-only subcommand)

A subcommand the Planner runs right before handing a req to Builder. It does NOT send anything
(SendMessage is a Claude tool, not a shell command) — it **verifies the publish receipt and prints
the ping text** to paste.

Behaviour:
1. Resolve the req doc the same way `closeout` does (`handoff/work/req-N-*.md`, file form then
   folder/README) — refuse with the same "not a requirement id" / "doc not found" messages if absent.
2. **Refuse unless the work is actually on main:**
   - the req doc exists on main (`git cat-file -e main:<path>`), AND
   - planning is fully published (`git log main..planning` empty — the same check `plan status`
     already prints as "fully published").
   On refusal: name which is missing and point to `./plan publish` (mirror how `publish` refuses when
   the code worktree isn't on main). This is the line that would have stopped R1.
3. On success: print a ready-to-paste ping — the branch name (`req-N`), "read
   handoff/work/req-N-*.md", and the four-part handover reminder (what it does / what to test / what
   you couldn't verify — from PLANNING.md's handover section). Keep it short; the Planner pastes it
   into SendMessage.
4. Read-only and safe (like `plan status`): no commits, no merges, no push.

Wire it into the subcommand dispatch (`plan` ~line 1056+, alongside `status`/`next`) and add a line
to the top-of-file usage block.

## Guard 2 — blocking NOW.md ≤50 pre-commit check in `plan save`

- In `plan save`, **before** the commit, check the working-tree line count of `handoff/NOW.md`. If it
  exceeds `NOW_MD_RULE_LIMIT` (50, already defined at `check_handoff.py:398`), **refuse the save**
  (exit non-zero, commit nothing) with a message naming the count and telling the Planner to trim
  first. Reuse the limit constant — don't hardcode 50 twice.
- Leave the existing **post-commit** drift surfacing (req-46 #1) exactly as is — status/section/size
  drift that genuinely needs the commit stays non-blocking. This guard is ONLY the NOW.md
  working-tree line count, the one drift that is always the author's to fix in the same edit.
- Do not change `check_handoff.py`'s classification (NOW.md is already `"fail"`); the change is that
  `plan save` acts on the count up front instead of after committing.

## Out of scope

- Any change to other drift severities or the post-commit drift report.
- `plan ping` actually sending a message (it can't; it prints text).
- App code, persisted data, CI.

## Acceptance criteria

- `./plan ping req-99` (already published) prints a ping with the branch + read-the-doc line and exits
  0. `./plan ping <a req whose doc is only on planning, not main>` refuses and points to `plan
  publish`. `./plan ping req-<nonexistent>` gives the not-found message.
- With `handoff/NOW.md` at 51 lines in the working tree, `./plan save "x"` refuses, commits nothing
  (`git status` still shows NOW.md modified/unstaged), and names the count. At ≤50 it saves normally.
- `./plan status`, `save` (happy path), `publish`, `closeout` behaviour otherwise unchanged.
- The `plan` usage block lists `ping`. No app tests affected; `node --test` still green.

## What Builder cannot verify (for Emilio)

- Nothing device- or feel-related. This is a self-contained tool change; the acceptance criteria are
  all runnable. Planner reviews + runs them and merges (DEC-035).
