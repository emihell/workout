# req-64 — Trim START-HERE to cold-start-only; kill the workflow-doc duplication drift

Branch `req-64` (off `main`). Gate: **infra/docs** — planning verifies by reading the
diff and merges on its own read (DEC-035); low blast radius (root docs only, no `src/`).
Built, **NOT merged**.

## Technical

### What changed (2 files, root docs only)

**`START-HERE.md`** — trimmed from 74 → 44 lines. Now cold-start-only:
- Kept: the worktree-layout snippet, the two boot prompts, the one-line "your task is
  usually…", and a single pointer to `handoff/PLANNING.md` (planning) / `CLAUDE.md`
  (build) under a new **WHERE EVERYTHING ELSE IS** heading.
- **Removed** the "HOW WE WORK — the loop" three-stage section and the "FOR THE
  ASSISTANT" read-order + hard-rules block. Both restated `handoff/` docs (coverage
  table below).

**`README.md`** — the "Planning workflow" paragraph only (~line 106). Retired "Cowork"
→ "a Claude Code \"planning\" session", and corrected a cross-reference my trim would
otherwise have made stale: it said START-HERE "has the boot prompts and the loop" — the
loop no longer lives there, so it now reads "the boot prompts and the worktree layout;
the loop itself lives in `handoff/`." Rest of README (product contract, Setup block)
untouched.

### Coverage check — every removed line has a canonical home in `handoff/`

The spec required confirming removed content genuinely lives in `handoff/` (failure
case: deleting something unique to START-HERE). It does; nothing was unique:

| Removed from START-HERE | Canonical source |
| --- | --- |
| Three-stage loop (Plan / Build / Record & close) | `PLANNING.md` "The two-agent build loop (DEC-009)" §175–277 (full 10-step cycle) + `CLAUDE.md` "How work arrives" |
| "Hand-offs are files, never pastes"; the `NOW.md` board line | `PLANNING.md` "Reports come back in `reports/`, not in `handoff/`" §362–371; board in `NOW.md` |
| Planning read order (`PLANNING.md`→`NOW.md`→`CLOSEOUT.md`→on-demand) | `PLANNING.md` §3–5 ("Read this first… then `NOW.md`") + its "Owns" block deferring to `rules/WORKFLOW.md`/`CLOSEOUT.md` |
| "never mark BUILT AND MERGED until git shows it on main; no optimistic pre-flip" | `CLOSEOUT.md` §20–21 ("stays 'NOT merged' right up until close-out. Do not pre-flip") |
| index-lock caution / "never run index-touching git" | `CLOSEOUT.md:66` (stale-lock wording) + `PLANNING.md` (`--no-optional-locks` for read-only, §30/§118) |
| "everything durable is a committed file / no session memory" | `PLANNING.md` "No auto-memory" §101–107 + `CLAUDE.md` "Memory is for you, not for the project" |
| "close-out is one fixed, lock-guarded procedure; never retype freehand" | `CLOSEOUT.md` itself (§3–4, §52) |

### Decisions I made (spec left implementation wording to the code session)

1. **Planning boot prompt re-targeted `workout-planning/START-HERE.md` → `handoff/PLANNING.md`.**
   Rationale: after the trim, START-HERE carries no planning workflow, so the real
   planning guide is `PLANNING.md`. This makes the two boot prompts symmetric (code
   already reads `CLAUDE.md` directly, not via START-HERE) and matches the spec's own
   framing ("everything else … is in `handoff/PLANNING.md` for planning and `CLAUDE.md`
   for building"). Functionally equivalent to the old indirection (old prompt → START-HERE
   → pointer → PLANNING.md), one hop shorter. **Flag for the reviewer:** if you'd rather
   the planning boot still land on START-HERE first, this is the one line to revert.
2. **Path made path-agnostic** ("two sibling worktrees, wherever you cloned them"), per
   the spec's unconfirmed-default. No machine path hardcoded in START-HERE. README's
   Setup block `mkdir -p ~/projects/workout` was left as-is (out of scope; it reads as a
   suggested location, not an assertion of where the repo is).
3. **"cloud session" wording:** step 3 said soften *if the hard-rules block survives*. It
   did **not** survive the trim — the whole "FOR THE ASSISTANT" block was removed — so the
   cloud framing is gone wholesale rather than reworded. Index-lock caution is preserved
   in its canonical home (`CLOSEOUT.md:66`).

### Verification (receipts)

Acceptance criteria run as commands:

```
$ grep -rn "Cowork" README.md START-HERE.md ; echo exit=$?
exit=1                    # no matches

$ grep -rn "cloud session" START-HERE.md ; echo exit=$?
exit=1                    # none

$ grep -rn "projects/workout" START-HERE.md ; echo exit=$?
exit=1                    # path-agnostic, no asserted path

$ git status --porcelain
 M README.md
 M START-HERE.md          # root docs only — NO handoff/ file touched
```

`./check`:
```
check: green — lint, 19 test file(s), and the build all passed.
```
(Docs don't affect the gate; run to confirm it stays green. 218 tests pass.)

## Workflow

- **Scope:** matched the spec exactly. One in-scope-adjacent fix rode along: the README
  "Planning workflow" paragraph asserted START-HERE "has … the loop", which my trim
  falsified — corrected in the same paragraph I was already editing for terminology, so
  as not to create a fresh stale cross-reference (the exact drift this req kills). Called
  out above.
- **One decision worth a second look (→ possible `DEC-`):** the planning boot prompt now
  points at `handoff/PLANNING.md` instead of `START-HERE.md`. It's an implementation
  choice the spec delegated, but it changes the documented cold-start entry for planning,
  so it's the reviewer's call to keep.
- **Nothing in `handoff/` was touched** — this was root-doc-only by design (DEC-043 /
  DEC-005 isolation: `plan save` refuses non-`handoff/` files, which is why it came to the
  code session). No `handoff/` edits attempted, so the pre-commit guard was never exercised.
- **No new `DEC-`/`L-` proposed from build friction** — the work was mechanical once the
  coverage check confirmed nothing unique was being dropped.
