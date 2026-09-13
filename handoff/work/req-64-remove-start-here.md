# req-64 — Remove START-HERE.md; fold the boot prompts into README

**Status: BUILT, NOT merged — branch `req-64` (`451d61a` trim + `42c3adf` delete, 2 commits). Verified by planning (diff + greps).** (Re-scoped trim → delete on Emilio's reframe; see Why.)

**Gate: infra/docs.** Built by the **code session** — it edits repo-root files
(`START-HERE.md`, `README.md`) that planning cannot commit (DEC-005 isolation; `plan save`
refuses non-`handoff/` files). Planning verifies by reading the diff and merges on its own
read (DEC-035); low blast radius (root docs only, no `src/`).

## Why

`req-64` first *trimmed* START-HERE to cold-start-only (DEC-043). On review, Emilio asked
the sharper question: is the file needed at all? It isn't. After the trim its only job was
"hold two boot prompts + a worktree-layout diagram" — and:

- **The root `CLAUDE.md` auto-loads every turn and already self-routes each worktree** (its
  banner: *"Are you the planning session? → read `handoff/PLANNING.md`"*). A session cold-
  started in the planning worktree reads `PLANNING.md` on its own — proven live: the
  planning session that specced this got no boot prompt at all and still loaded `PLANNING.md`
  first, via that banner. So the boot prompt is optional insurance, not the mechanism.
- **README is the conventional "read me first."** A second `START-HERE` doc is a competing
  front door holding prompts `CLAUDE.md` has made optional — the last scrap of the exact
  duplication DEC-043 set out to kill.

So delete it and move the prompts to where first-machine setup already lives (README).

## Scope (root docs only)

1. **Delete `START-HERE.md`.**
2. **Fold its still-useful content into `README.md`:** add a short **"Boot a session"**
   subsection (next to the Setup block, ~§33–87) carrying the two boot prompts and the
   one-line "your task is usually…" hint. Keep the worktree-layout line if README doesn't
   already state it. The planning prompt reads `handoff/PLANNING.md`, the build prompt reads
   `CLAUDE.md` (DEC-044). Keep it tight — prompts + hint, not a re-run of the loop (that
   lives in `handoff/`).
3. **Fix the two dangling `START-HERE` references in `README.md`:**
   - `:73` — *"To boot a session, see `START-HERE.md` for the one-line prompts"* → point at
     the new Boot-a-session subsection (or inline the prompts there).
   - `:108` — *"Start at `START-HERE.md` — it has the boot prompts and the loop"* → reword:
     the prompts are in the Setup/Boot section above, and the loop lives in `handoff/`.
4. **Do not touch the root `CLAUDE.md` banner** — it is the routing that makes cold-start
   work without START-HERE. Verify (read it) that both worktree branches of the banner still
   point correctly (planning → `handoff/PLANNING.md`, build → the CLAUDE.md guide).
5. Retire any lingering "Cowork" (the trim at `451d61a` already did README's Planning-
   workflow paragraph; re-confirm none remains).

## Out of scope

- The `handoff/` workflow docs — already the single source; do **not** copy loop/stage prose
  into README (that recreates the duplication).
- README's product contract, entity/recommendation/persistence sections, and the Setup
  *command* block content — only add the Boot-a-session subsection and fix the two refs.
- `.cursor/rules/`, the `plan` script.

## Ordered steps

1. Add the Boot-a-session subsection to README (prompts + hint); fix refs `:73` and `:108`.
2. `git rm START-HERE.md`.
3. Confirm the `CLAUDE.md` banner still routes both worktrees (read-only check).
4. `./check`.

## Acceptance criteria (written before implementation)

- **File gone:** `git ls-files START-HERE.md` → empty; the file does not exist.
- **No dangling reference:** `grep -rn "START-HERE" README.md CLAUDE.md src/ .githooks/ plan`
  → no matches (exit 1). (handoff/ history entries are expected and out of grep scope.)
- **Prompts preserved + discoverable:** README contains both boot prompts (planning →
  `handoff/PLANNING.md`, build → `CLAUDE.md`) — quote the new subsection in the report.
- **Routing intact (the load-bearing piece):** the root `CLAUDE.md` banner still self-routes
  each worktree — confirm in the report it was not changed.
- **No "Cowork":** `grep -rn "Cowork" README.md` → none.
- **No `handoff/` file touched;** `./check` green — paste the line.

## Decisions

- **content (Emilio):** delete START-HERE entirely; prompts move to README; rely on the
  `CLAUDE.md` banner for routing. → DEC-044 (updated).
- **implementation (code session):** exact placement/wording of the README Boot-a-session
  subsection, as long as both prompts are present and discoverable and nothing re-states the
  `handoff/` loop.
