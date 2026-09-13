# START HERE — workout-app

Your cheat sheet — and the one doc you read *before* anything else is loaded. It
only gets a session on its feet. Everything about **how we work** — the loop, the
gates, close-out — lives in `handoff/`, not here, on purpose (a fact kept in two
files is the one that goes stale).

Two sibling worktrees, wherever you cloned them:

```
workout-codebase/   code     (branch main)     — Claude Code builds here
workout-planning/   planning (branch planning) — the planning session writes handoff/ here
```

---

# ▐ BOOT A SESSION

Paste one as the first message and put your task where it says `<task>`.

### Planning (Claude Code)
```
Planning session for workout-app. Read handoff/PLANNING.md, then: <task>.
```

### Claude Code (build)
```
Claude Code session for workout-app. Read CLAUDE.md, then: <task>.
```

**Your `<task>` is usually one of:**
- Planning — *"what's next?"*  ·  *"spec a req for <idea>"*  ·  *"process and close req-N"*
- Claude Code — *"build req-N"*

---

# ▐ WHERE EVERYTHING ELSE IS

This file stops here by design. The moment a session boots, the rest loads itself:

- **Planning** → `handoff/PLANNING.md` (authority), then `handoff/NOW.md` (the
  board). The loop, the merge gates, and close-out live there and in
  `handoff/rules/` (`WORKFLOW.md`, `CLOSEOUT.md`, `DESIGN.md`).
- **Building** → `CLAUDE.md`, which pulls in the pieces of `handoff/` each req needs.
