# req-64 — Remove START-HERE.md; fold the boot prompts into README

Branch `req-64` (off `main`), built on top of the earlier trim commit `451d61a`. Gate:
**infra/docs** — planning verifies by reading the diff and merges on its own read (DEC-035);
low blast radius (root docs only, no `src/`). Built, **NOT merged**.

**Re-scoped mid-req** from "trim START-HERE to cold-start-only" to "delete START-HERE
entirely" on Emilio's reframe (DEC-044 updated): after the trim, START-HERE's only job was
to hold two boot prompts + a worktree-layout line — a redundant second front door, since the
root `CLAUDE.md` banner auto-routes each worktree and README is the conventional entry.

## Technical

### What changed (2 files, root docs only)

**`START-HERE.md`** — **deleted** (`git rm`). It previously held the two boot prompts, a
worktree-layout diagram, and (before `451d61a`) the loop/hard-rules prose. The loop prose was
already removed in the trim; its remaining content (the prompts) is now in README.

**`README.md`** — three edits:
1. **New `## Boot a session` subsection** (after the Setup block, before Development, §89–101)
   carrying both boot prompts and the "your `<task>` is usually…" hint. The worktree layout
   was *not* re-stated — README's Setup already asserts it ("That gives you the two-worktree
   layout …"), so restating it would recreate the duplication this req kills.
2. **`:73`** (in Setup) — *"To boot a session, see `START-HERE.md` for the one-line prompts"*
   → now links to `[Boot a session](#boot-a-session)` below.
3. **`:108`** (Planning workflow) — *"Start at `START-HERE.md` — it has the boot prompts and
   the worktree layout"* → reworded to point at the Boot-a-session subsection above (prompts)
   and Setup (layout); the loop still lives in `handoff/`.

The `451d61a` trim had already touched `:106/:108` and retired "Cowork" from that paragraph;
this reconciles it so no `START-HERE` reference remains anywhere.

### The new README subsection (quoted — acceptance: prompts preserved + discoverable)

```
## Boot a session

Paste one of these as a session's first message, with your task where it says `<task>`:

- **Planning:** `Planning session for workout-app. Read handoff/PLANNING.md, then: <task>.`
- **Build (Claude Code):** `Claude Code session for workout-app. Read CLAUDE.md, then: <task>.`

Your `<task>` is usually one of:

- Planning — *"what's next?"*  ·  *"spec a req for <idea>"*  ·  *"process and close req-N"*
- Build — *"build req-N"*

These prompts are the fast way in, not the mechanism: the root `CLAUDE.md` banner
auto-loads every turn and routes each worktree on its own (planning → `handoff/PLANNING.md`,
build → `CLAUDE.md`), so a session cold-started in either worktree finds its way without one.
```

Both prompts match DEC-044: planning → `handoff/PLANNING.md`, build → `CLAUDE.md`.

### Routing intact — the load-bearing piece (acceptance: CLAUDE.md banner unchanged)

The root `CLAUDE.md` banner is what makes cold-start work without START-HERE. **It was not
touched** (`git status --porcelain CLAUDE.md` → empty). Read to confirm both worktree branches
still route correctly:
- planning worktree → *"read `handoff/PLANNING.md` instead … `handoff/` is yours to write"*
- code worktree → the CLAUDE.md build guide (the rest of the file)

### Verification (receipts)

```
$ git ls-files START-HERE.md ; echo exit=$?
exit=0                    # no output → file no longer tracked

$ ls START-HERE.md
ls: START-HERE.md: No such file or directory   # gone from disk too

$ grep -rn "START-HERE" README.md CLAUDE.md src/ .githooks/ plan ; echo exit=$?
exit=1                    # no matches (handoff/ history out of scope)

$ grep -rn "Cowork" README.md ; echo exit=$?
exit=1                    # none

$ git status --porcelain CLAUDE.md
                         # empty — banner unchanged

$ git status --porcelain
 M README.md
D  START-HERE.md          # root docs only — NO handoff/ file touched
```

`./check`:
```
check: green — lint, 19 test file(s), and the build all passed.
```
(218 tests pass. Docs don't affect the gate; run to confirm it stays green.)

## Workflow

- **Scope:** matched the re-scoped spec exactly — deleted START-HERE, added the Boot-a-session
  subsection, fixed both dangling refs (`:73`, `:108`), left the `CLAUDE.md` banner and
  README's product/Setup content untouched.
- **Reconciled with the earlier trim (`451d61a`):** that commit had already reworded the
  Planning-workflow paragraph (killing "Cowork" and the "loop lives here" claim). This req's
  `:108` edit builds on that so the paragraph now carries no START-HERE reference at all.
- **One implementation choice (spec delegated placement/wording):** put `## Boot a session`
  between Setup and Development — the prompts sit next to first-machine setup, where a new
  reader already is. Did **not** re-state the worktree layout there (README already asserts it
  in Setup); a bare pointer avoids reintroducing the duplication DEC-043/DEC-044 target.
- **Nothing in `handoff/` was touched** — root-doc-only by design (DEC-005 isolation; `plan
  save` refuses non-`handoff/` files, which is why this comes to the code session). The
  pre-commit guard was never exercised.
- **No new `DEC-`/`L-` from build friction** — mechanical once the trim had already confirmed
  nothing unique was being dropped. The content decision (delete vs. keep) is Emilio's,
  recorded as DEC-044.
