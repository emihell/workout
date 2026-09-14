# req-68 — Name the two sessions Planner / Builder + message tags

**Status: SHIPPED 2026-09-14** — planning-owned, published to `main` (no code branch).
Was BLOCKING (Emilio, 2026-09-14): the two persistent sessions had been confused for each
other once, with consequences. Standardized the naming (matching a sibling project).

**Gate: infra/docs.** Builder for this req: **planning (Planner)** — it edits
`handoff/` files only (`PLANNING.md`, `CLAUDE.md`, `README.md`). No code-session
dispatch. Quick. Merges on Planner's own read (DEC-035).

## Why

Two persistent Claude Code sessions run in separate terminals against sibling
worktrees — planning (`workout-planning`, branch `planning`) and code
(`workout-codebase`, branch per-req). They currently have no stable handles and
no visible marker, so Emilio has mistaken one for the other; the code session
was driven as if it were planning (or vice-versa) with real consequences. A
fixed name + a first-line tag on every message makes the two unmistakable at a
glance.

## Decisions (Emilio, 2026-09-14)

- **Names** — role handles, not human names, so the sessions can reference each
  other:
  - planning session (`workout-planning` worktree) = **Planner**
  - code session (`workout-codebase` worktree) = **Builder**
- **Tag** — every message each session writes starts with its tag on the first
  line: Planner → `[PLANNER]`, Builder → `[BUILDER]`. Reason: both are local
  Claude Code in separate terminals; the tag is how Emilio tells them apart.
- **Scope of the tag** — the two **persistent** sessions only. Spawned/ephemeral
  build agents report back to Planner (not to Emilio's terminal), so they do
  **not** tag. This is about the two sessions Emilio watches.

## Scope

Edit these `handoff/` files (all Planner-owned; root `CLAUDE.md` is a symlink to
`handoff/CLAUDE.md`):

1. **`PLANNING.md`** — near the top of "## The role", add a line:
   *"You are **Planner** (the planning session, `workout-planning` worktree).
   Start every message you write with `[PLANNER]` on the first line, so Emilio
   can tell you apart from Builder at a glance."*
2. **`CLAUDE.md`** (= `handoff/CLAUDE.md`) — near the top (it loads every turn),
   add a line: *"You are **Builder** (the code session, `workout-codebase`
   worktree). Start every message you write with `[BUILDER]` on the first line,
   so Emilio can tell you apart from Planner at a glance. (Ephemeral build agents
   you spawn report back to Planner, not to Emilio's terminal, and do **not**
   tag.)"*
3. **`handoff/README.md`** — in "## Map" (or a short note beside it), name the
   two sessions: **Planner** = planning session (`workout-planning`), **Builder**
   = code session (`workout-codebase`). This is the durable session/worktree map.
4. Grep the rest of `handoff/` for other places that describe the two sessions in
   prose ("planning session" / "code session") and, where a name would remove
   ambiguity, introduce Planner/Builder — but do **not** rewrite every mention;
   the guides keep reading naturally. Minimum: the three files above.

## Out of scope

- Renaming worktrees, branches, or directories. The names are role handles used
  in text and tags only; `workout-planning`/`workout-codebase` and
  `planning`/per-req branches are unchanged.
- Tagging ephemeral/spawned agents (explicitly excluded above).
- Any code change.

## Acceptance

- `grep -n "You are \*\*Planner\*\*\|\[PLANNER\]" handoff/PLANNING.md` → the
  Planner tag instruction is present.
- `grep -n "You are \*\*Builder\*\*\|\[BUILDER\]" handoff/CLAUDE.md` → the Builder
  tag instruction is present.
- `handoff/README.md` "## Map" names Planner and Builder against their worktrees.
- `check_handoff` still passes; no `handoff/` doc contradicts the new names.
- **Published to `main`** (`plan publish` + push) so Builder loads its tag on its
  next turn — `CLAUDE.md` is read every turn, so this is how Builder picks it up.
- From this req onward, Planner starts every message with `[PLANNER]`.
