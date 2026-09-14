# handoff/

Planning and reference for this project. Written by the planning session
(the sounding board), read by Emilio and by Claude Code.

**Start with `NOW.md`.** It says what's being worked on and which of these files
that task actually needs. Don't load the rest by default.

If you *are* the planning session and this is a fresh start, read
**`PLANNING.md`** first — it's the role and the rules for working here.

## The two sessions

Two persistent Claude Code sessions run in separate terminals against sibling worktrees:

- **Planner** — the planning session, `workout-planning` worktree (branch `planning`).
  Writes `handoff/`, touches no code. Starts every message with `[PLANNER]`.
- **Builder** — the code session, `workout-codebase` worktree (per-req branches).
  Writes code, treats `handoff/` as read-only input. Starts every message with `[BUILDER]`.

The tags are how Emilio tells the two terminals apart at a glance. Ephemeral build agents
Builder spawns report back to Planner, not to Emilio's terminal, and do not tag.

## Ownership

- Only the planning session (Planner) writes here. It touches no code.
- Claude Code (Builder) treats everything here as **read-only input**.
- **Enforced, not merely stated:** a permission deny rule blocks the Edit tool,
  and a pre-commit hook rejects commits that touch `handoff/` without `HANDOFF=1`.
  Reads are deliberately unrestricted.
- Planning edits happen in a **separate worktree** on branch `planning`, so what
  Claude Code reads is always the last version merged to `main`, never one being
  rewritten. See `rules/WORKFLOW.md`.

## Map

```
NOW.md                  what we're doing + which docs it needs.  Read always.
PLANNING.md             the planning session's role and rules.  Read on restart.
CLAUDE.md               rules for Claude Code.  Symlinked to the repo root.
rules/
  AUDIT.md              the recurring read-only sanity check.  /audit
  DESIGN.md             product/UX values as decidable tests
  WORKFLOW.md           how we work: the loop, and the rules for these files
work/
  BACKLOG.md            things to build, tiered
  req-NN-name.md        an active requirement, ready to build
log/
  DECISIONS.md          append-only: what we chose and why
  LESSONS.md            append-only: what went wrong
  SHIPPED.md            append-only: the narrative of what shipped
reference/
  (schema, migration behaviour, prior art — added as needed)
```

## Where does a new note go?

| It's… | Goes to |
| --- | --- |
| a thing to build | `work/BACKLOG.md` |
| a thing we chose, with reasoning | `log/DECISIONS.md` |
| a thing that went wrong | `log/LESSONS.md` |
| how something behaves (schema, migration) | `reference/` |
| a rule for all future work | `rules/` |
| what I'm doing right now | `NOW.md` |

Full conventions in `rules/WORKFLOW.md`.
