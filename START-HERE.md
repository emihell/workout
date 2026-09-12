# START HERE — workout-app

Your cheat sheet. **Two prompts** boot a session — paste one as the first message
and put your task where it says `<task>`. Everything after is reference.

```
~/projects/workout/
  workout-codebase/   code     (branch main)     — Claude Code builds here
  workout-planning/   planning (branch planning) — Cowork writes handoff/ here
```

---

# ▐ PROMPTS

### Cowork (planning)   ← this cold-starts Cowork
```
Planning session for workout-app. Read workout-planning/START-HERE.md, then: <task>.
```

### Claude Code
```
Claude Code session for workout-app. Read CLAUDE.md, then: <task>.
```

**Your `<task>` is usually one of:**
- Cowork — *"what's next?"*  ·  *"spec a req for <idea>"*  ·  *"process and close req-N"*
- Claude Code — *"build req-N"*

Reading START-HERE / CLAUDE.md pulls in the rest (the loop, the board, the build
and close-out rules), so the prompt stays one line and the how-to stays in the
files.

---

# ▐ HOW WE WORK — the loop

Three stages. **Deviate only when something needs a human** — ideating, a product
call, or testing how it feels.

1. **Plan** (Cowork) — shape the req. Planning writes `handoff/work/req-N.md`,
   marks it READY in `NOW.md`, publishes it (`./plan publish`) so CC can read it
   on `main`. The req doc IS the build spec.
2. **Build** (Claude Code, *"build req-N"*) — CC builds on branch `req-N`, asks
   only about decisions, leaves it built + human-verified + **unmerged**, and
   writes `reports/req-N.md` (Technical + Workflow).
3. **Record & close** (Cowork, *"process and close req-N"*) — planning reads the
   report, updates `handoff/`, asks you anything open, and hands you the close-out
   block. You run it → merged, published, pushed. Loop restarts.

**Hand-offs are files, never pastes.** CC → planning is `reports/req-N.md`;
planning → CC is `handoff/` (published to `main`). `NOW.md` is the board:
**Next — READY** → the `req-N` branch → **Built — awaiting merge** → shipped.

---

# ▐ FOR THE ASSISTANT — skip this if you're Emilio

**Planning read order (do NOT scan the repo):** `handoff/PLANNING.md` (authority)
→ `handoff/NOW.md` (board) → `handoff/rules/CLOSEOUT.md` (before any merge/close-out)
→ on demand: `rules/WORKFLOW.md`, `rules/DESIGN.md` (before any UI/UX), `log/*`,
`work/req-*`, and `reports/req-N.md` in workout-codebase when CC just built.

**Hard rules:**
- A req is never marked `BUILT AND MERGED` until git shows it on `main`. No
  optimistic pre-flip.
- Never run index-touching git from a cloud session (`status`/`checkout`/`merge`/
  `add`/`commit`) — it can leave a stale `.git/index.lock` that blocks Emilio.
  Read-only plumbing only (`log`/`rev-parse`/`merge-base`/`show`).
- Everything durable is a committed file in these folders. Fresh chats and machine
  switches don't carry session memory. Not committed here = gone.
- Close-out is one fixed, lock-guarded procedure (`handoff/rules/CLOSEOUT.md`).
  Never retype it freehand.
