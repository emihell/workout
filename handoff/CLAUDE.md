# CLAUDE.md

Building? Read `handoff/BUILDER.md`. Planning? `handoff/PLANNING.md` (for you `handoff/` is yours to write, not read-only).
Coaching? `handoff/coach/COACH.md` (DEC-145: you read the DB and the repo, write only in `~/dev/workout/workout-data/coach/`).

Instructions for Claude Code working in this repository.

This file is loaded on every turn, so it stays short. Everything else is loaded
on demand from `handoff/`.

## The project

A workout app: React + Vite in the browser, offline-first, synced to Emilio's own server (`server/`, Node + SQLite,
invite-only login, tailnet-only; rules in `handoff/rules/BACKEND.md`). One trustworthy loop: set up
exercises and reusable routines, schedule them, start a workout snapshot, log
sets, and keep an editable historical record. The phone's working copy lives in
`localStorage`; `src/sync/` pushes it to the server, which stores it per user as revisions (`README.md` is the
product contract; read it).

**It is a logging tool built on one rule: history is the source of truth, and the
app never invents data it doesn't have.** A weighted exercise with no history has
no invented starting weight. **The workout's kg comes from the routine** — a number the user
typed or confirmed (DEC-096); the routine's kg is prefilled from history when an exercise is added, and a
confirmed "Update routine" offer carries new kg back. Every other prefill comes only from finished-workout
data for that same field. That distinction decides more than it sounds like it should —
`handoff/rules/DESIGN.md` states it as a test, and `.cursor/rules/history-prefill.mdc`
is the live example.

```bash
npm run dev        # http://localhost:5173  — single dev instance
npm run lint       # oxlint
node --test        # unit tests — every *.test.js under src/ (nested included)
npm run build      # production build
./check            # the full gate: lint + tests + build
```

Live app: Emilio's own server (`./server/deploy` from `main`), `https://macbookpro-intel-2017.tail58ea74.ts.net:8446`.
GitHub Pages is shut down (DEC-135); `.github/workflows/deploy.yml` is now check-only CI (`./check` + smoke on every push to `main`, req-238).

## handoff/ is read-only to you

`handoff/` is written by a separate planning session and is **input, not
output**. Read anything in it. Do not create, edit, move or delete anything
there — including this file. If something in it is wrong or stale, say so in
your reply; don't fix it in place.

**Enforced by one thing: `.githooks/pre-commit`**, which refuses any commit
touching `handoff/` and prints the recovery
(`git restore --staged --worktree handoff/`). No settings rule blocks the edit earlier
(audit 2026-09-24), so the commit is the layer that holds.
Every read works and always will.

The planning session writes from a **separate git worktree** on a `planning`
branch, so what you see here is the last version merged to `main` — never one
being edited right now. If a requirement looks stale, incomplete, or refers to
something absent, say so: the likely cause is an unmerged `planning` branch, and
Emilio needs to merge it before you continue. Don't work around it.

Everywhere else in the repository is yours.

## No auto-memory — everything lives in the repo

**Don't save anything to auto memory** (Emilio, 2026-09-24: "dont save anything in memory - EVERYTHING should be in
the repo - nothing outside of it - if you need to save anything - give it to planner"). Auto memory is machine-local,
in no git history, and nobody reviews it. If the harness offers a memory tool, don't use it.

**Anything worth keeping goes to the planning session**, in your reply or a cross-session message: a rule, a
decision, a gotcha, a habit that worked, a correction about your own output. Planning records it in `handoff/` (a `DEC-`,
an `L-`, a req, or this file). A fact held in two places is worse than a fact held in neither.

**The one carve-out is licensed third-party data that must not enter git** (none today; RepDB was removed in req-142). If
it's ever needed again, it lives in the repo folder under a **gitignored** directory, never in git history (DEC-068).

## Start here

**`handoff/NOW.md`** — what's being worked on, in what order, and which documents
that specific task needs. Read it first, then load only what it points at.

`handoff/work/BACKLOG.md` is an **index**, not the backlog. Load the one section
you need; never all of it.

```
handoff/
  NOW.md                    current work + what to load.  Always read.
  BUILDER.md                the brief for building a req (QA, report)
  rules/AUDIT.md            the /audit procedure — read-only, writes audits/
  rules/DESIGN.md           product/UX values, as tests you can apply
  rules/WORKFLOW.md         how requirements are written and built
  work/BACKLOG.md           the backlog
  work/req-NN-name.md       the requirement you are implementing
  log/DECISIONS.md          what was chosen and why — don't relitigate
  log/LESSONS.md            what went wrong before
  reference/                how things actually behave (schema, migrations)
```

## Rules that have been earned

**Verify, don't recall.** Any number, limit, field name, schema shape, or "that
isn't possible" is a claim to be tested, not trusted. In this app the
cheap test is a unit test or a console line against the real model — one run
beats an hour of reasoning.

**Say what you did, not what you intended.** If a tool call or a test didn't run,
it didn't run. Past tense is for completed work only.

**Deterministic work goes in a script or a test**, not a prose description — a
migration, a recomputation, a data reshape. If it can be run, run it and paste
the output.

**Anything that computes a value the user sees gets its reasoning made visible.**
The load recommendation (`progress.js`) decides next kg/reps from history; a
recommendation that can't be explained from its inputs is a bug you can't see.
Keep such logic testable and its decisions inspectable, the way the prefill rule
is.

**Guard against the domino effect.** Before changing shared code (the model, the
store, storage/migration, a shared view helper), name what depends on it and
assert that still holds. Never make a test pass by weakening or deleting it — a
test edit is called out in the diff and justified. Run the full gate (`./check`)
before you claim a branch is ready.

**Persisted data is the user's real history — treat a migration like surgery.**
See ask-gate 2 in `handoff/BUILDER.md`.

**Write every doc trimmed** — reports, `DEC-`/`L-` entries. Keep the file:line
traces, the acceptance criteria, the decisions that are Emilio's, his quotes,
what was rejected and why. Drop persuasive framing and restatement. Full rules in
`rules/WORKFLOW.md`.
