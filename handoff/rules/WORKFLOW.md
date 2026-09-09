# Workflow

How this project gets built, and the rules for the files in `handoff/`.

**Owns:** the durable build/engineering rules and the planning micro-loop. The
two-agent build loop is in `PLANNING.md` (loop specifics in `DEC-009`); the planning
role is in `PLANNING.md`; Claude Code's operational guide is `CLAUDE.md`. This is a
**reference — load a section on demand, don't read end-to-end.** It states durable
rules, not current code-state — mechanisms and what each req changed live in the
code and `DECISIONS.md`; a copied fact drifts.

## The loop

```
talk  →  references  →  idea  →  bare-bones test  →  rescan the code
      →  write requirement  →  Claude Code builds  →  review the diff
      →  findings to log/  →  back to talk
```

Two steps earn their place and are easy to skip:

**Test before writing the requirement.** Test the *riskiest assumption* first, not
the whole feature. Here the cheap test is a unit test, a console line against the
real model, or reading the actual code.

**Rescan the code immediately before writing the requirement.** Claude Code moves
the codebase between conversations. A requirement written from memory has told a
builder to add something that already existed.

## Readiness — a requirement is not handed over until it's decided

Every requirement carries one tag on its first line. **Only `READY` reaches Claude
Code.**

```
READY              every behaviour question answered.  Safe to build.
NEEDS DECISIONS    open design or behaviour questions.  Listed at the top.
BLOCKED ON <x>     decided, but depends on something unbuilt.
BUILT AND MERGED   in main.  Carry the date and the merge commit.
SHELVED            built or buildable, deliberately not merged.  Say why.
WITHDRAWN          the premise was wrong.  Kept, not deleted.
```

**The tag is a hand-kept copy of something `git` already knows.** `check_handoff.py`
*flags* a stale tag; it doesn't rewrite it. So the rule stays mechanical: **the same
commit that merges the work updates the tag**, and `plan publish` is not run until it
does. `./plan closeout` does this flip from git, only once the merge is an ancestor
of main — never optimistically.

### The test

Sort every entry in the requirement's **Decisions made on Emilio's behalf** section
into one of two kinds:

- **implementation** — where a file lives, what a helper is called, one function or
  three. The planning session decides these freely and lists them so they can be
  reversed.
- **behaviour** — anything a user could notice. What renders, what a control does,
  how a tie resolves, what value gets prefilled, what a migration does to saved
  data. **These are Emilio's, always.**

One unanswered behaviour question makes the whole requirement `NEEDS DECISIONS`,
however complete the rest is. The open questions go **at the top**, phrased as
questions with options, so the requirement doubles as the thing that gets the
answer.

## Requirements

One file per requirement: `work/req-NN-name.md`. Split into a folder only when it
passes ~200 lines.

A requirement states: scope, what's explicitly **out** of scope, ordered steps, and
acceptance criteria. Two things are always called out — **decisions made on
Emilio's behalf** (so they can be reversed), and **whether a claim was verified
against the working tree / a test** versus recalled.

Acceptance criteria are written **before** implementation. Criteria written
afterwards describe what was built, not what should have been.

**At least one criterion must be a failure case** — not "does it do the right
thing" but *what does it do when it can't.* Four forms worth reaching for:

- **remove a dependency** — does it fail open or closed?
- **empty or absent input** — no history, no logged sets, no routine.
- **could this pass for the wrong reason?** — a criterion that greps for a string
  tests spelling, not behaviour.
- **is the right mechanism answering?** — a default value can look identical to a
  computed one; assert the source, not just the number.

A green happy path is the weakest evidence available, because it's also what a
broken thing produces most of the time.

## Write the doc for its readers, and cut everything else

One doc, padding cut — not a second machine-only copy. Claude Code reads the same
English Emilio does; the structure is what it runs on (traces, criteria, the open
questions). Keep that, drop the prose around it.

**Keep — load-bearing, never cut:** file:line traces and verified-vs-recalled tags;
acceptance criteria including the failure case; the decisions that are Emilio's;
his quotes that anchor a decision; what was rejected and why.

**Cut — carries nothing:** persuasive framing and throat-clearing; the same point
restated for emphasis; meta-commentary about the writing; editorializing that
doesn't change what gets built.

**Per-sentence test:** delete it — is any fact, trace, decision, quote, or
cross-reference gone? If nothing is gone, it was padding.

## A UI/UX requirement is not finished when it is written

Testing a UI requirement isn't verification after the fact — it's part of building
it. The parts that change are the parts nobody can know before seeing them on a
screen.

- **a UI requirement is READY when its *intent* and its *constraints* are settled**,
  not when its final appearance is described. Requiring the latter would make it
  permanently unready.
- **budget the review, not just the build.** Assume iteration rather than treating
  it as rework.
- **the requirement gets reconciled afterwards** when the build diverged.
- **this applies to UI only.** A migration, a recommendation rule, or a model change
  can and must be fully specified in advance.

## Before a requirement is tagged READY — a few checks, minutes each

Not a rundown of every old req — that costs more than it returns. What actually goes
wrong is narrower and findable in about a minute each:

**1 — Grep `log/DECISIONS.md` for the requirement's nouns.** A decision made three
entries ago may already govern the thing you're specifying.

**2 — Name every other requirement that touches the same file, model field, or
view, and state the order between them.** If two requirements touch one thing, the
ordering belongs in both documents, not in the head of whoever wrote the second.
Re-run this on a requirement's siblings whenever one of them changes — not only when
it was first written.

**3 — Re-price every deferral the requirement leans on.** Cheap-now-expensive-later
is not the same as optional. A deferral is only free while the thing it defers stays
the same size.

**4 — Ask what the numbers in the requirement were measured from.** A number with no
stated source is a number nobody has checked.

**And for a bug, a reproduction.** Any statement that the code does X — in a
requirement, a message, or a review — states how to reproduce it and shows the
output. Not the code path, not the reasoning: the command (or test) and what it
printed.

## Reviewing a branch

1. Read the report (Technical + Workflow) and the diff together.
2. Split claims by kind: run the mechanical ones only where running gives a
   different answer than reading; read the diff and real data for the judgment ones.
3. Confirm no test was weakened or deleted to go green — a test edit must be
   justified in the diff.
4. Check the failure-case criterion actually fails when it should.
5. **Emilio uses it.** The human "use it" gate is the merge gate — not automatable,
   and it does not close until he has.

Then, and only then, close out (`rules/CLOSEOUT.md`).

## Persisted data has no backup. Treat a migration like surgery.

The user's real state is their workout history in `localStorage` (`workout-mvp-v8`).
There is no server copy and no undo. `src/db.json` is seed/provenance, not the live
store.

**Before any change to the schema version or any bulk rewrite of stored records:**
state what will change and to how many records, and add a migration test that proves
an older key (v5–v7) survives the upgrade — the existing v5→v8 path is the pattern
to preserve, not break. A read, a single edit through the normal UI, or work against
a throwaway/mocked store needs none of this. This is CC's ask-gate #2 in `CLAUDE.md`;
it exists because a bad migration silently destroys data the user can't get back.

## Two worktrees

The planning session and Claude Code work in **different directories on disk**,
sharing one repository:

```
~/projects/workout-app/workout-app-codebase   Claude Code.  main + req-* branches.
~/projects/workout-app/workout-app-planning    planning session.  branch `planning`.
```

A git working tree is per-checkout, not per-branch — one folder means one
`handoff/`, so planning edits would otherwise appear in whatever branch Claude Code
was on. A second worktree separates the files while keeping one history.

**Nothing reaches Claude Code until it's merged.** Use `./plan`:

```
./plan save "message"    from the planning worktree
./plan publish           from the code worktree
./plan status            from either
```

`save` sets `HANDOFF=1` for you and refuses if anything outside `handoff/` is
staged. `publish` refuses unless the code worktree is on a clean `main` — checking
out `main` while Claude Code is mid-task on a branch swaps the files under it, and
no hook guards that. `core.hooksPath` is shared between worktrees, so the `handoff/`
pre-commit guard fires in the planning worktree too; every commit there needs
`HANDOFF=1` (which `plan save` sets).

If Claude Code says a requirement looks stale or missing, the likely cause is an
unmerged `planning`. Merge, then have it re-read.

## Branching

```
work/req-NN-name.md      the requirement
git branch req-NN-name   the work
```

Claude Code implements on the branch; the planning session reviews the diff and closes
out, merging by req type (DEC-009) — Emilio uses UX and persisted-data reqs himself
first. Git is the ticket system.

## After each requirement lands

Two lines, no ceremony: anything chosen → `log/DECISIONS.md`; anything that went
wrong → `log/LESSONS.md`. This is the cheap version of a retro, and it's where the
real bugs get found — reviewing after the fact rather than writing more carefully up
front.

### Reach a clean state before starting anything new

Before opening the next requirement: the last one is merged (git shows it on main),
its doc is tagged `BUILT AND MERGED`, its branch is deleted, `NOW.md` and
`SHIPPED.md` are updated, and `./plan status` says both worktrees are clean and
planning is fully published. A half-closed requirement is how the next one starts on
a stale base.

## No stale code

When something is replaced, the old version goes — dead helpers, superseded views,
commented-out blocks "just in case". Git holds the history; the working tree holds
only what's live. A recurring finding (the same dead thing flagged twice) is a
lesson, not an incident.

## Verify a composed sequence before you run it or hand it over

The planning session runs its own git/publish/closeout — a command you run must be
order-safe and checked *before* you run it, and its receipt is the tool output you get
back (a green `./check` line beats a claim). On the rare command you hand Emilio (a
`/clear`, or something your own grant blocks), the same rule holds: one command per
block, order-safe, verified — it's pasted and run verbatim.

## A view owns its behaviour; shared things are named

Before changing shared code — the model (`model.js`), the store (`store.jsx`,
`store-context.js`), storage/migration (`storage.js`), recommendations
(`progress.js`), routing (`route.js`), or a shared view helper (`views/shared.jsx`)
— name what depends on it and assert that still holds. A change to one of these is a
change to everything downstream; that's the domino class most bugs come from. A view
that owns only its own behaviour can change freely; a shared thing changes under a
named register of who uses it.

## Guardrails that hold as the project grows

- Run the full gate (`./check`) before claiming a branch ready — never a subset.
- Never make a test pass by weakening or deleting it; a test edit is called out and
  justified.
- Every acceptance criterion that can be a command or a test is run, and its output
  is the receipt.
- Deterministic work (a migration, a recomputation) goes in code that can be run,
  not a prose description of what it would do.

## Ship order

Emilio's own use first; other users, sharing, and a visual-design pass are deferred
scope (`README.md`). Build for the one real user and the one trustworthy loop; leave
doors in the schema where something is conceptually multi-user, but serve one user
in the code.

## Scripts over prompts, trajectory over output

Anything deterministic and repeatable — a data reshape, a recomputation, a
migration — belongs in code, not in a prompt re-typed each time. And anything that
computes a value the user sees (the load recommendation is the live example) keeps
its decision inspectable: the output can look right while the mechanism is wrong, so
the trajectory that produced it is what gets checked, not just the final number.

## The periodic audit

`rules/AUDIT.md` is the recurring read-only sanity check (`/audit`). It diagnoses,
never treats — findings become backlog items and requirements, not in-place fixes.
Run it between milestones, not mid-build.
