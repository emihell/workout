# CLAUDE.md

> **Are you the planning session?** If you're working in the
> `workout-planning` worktree (branch `planning`), this file is **not** your
> guide — read **`handoff/PLANNING.md`** instead, and note that for you
> `handoff/` is **yours to write**, not read-only. The "handoff/ is read-only to
> you" rule below, and everything else in this file, is **Claude Code's**, in the
> code worktree (`workout-codebase`). The two files are counterparts: this
> one is how to *build*, `PLANNING.md` is how to *plan*.

Instructions for Claude Code working in this repository.

This file is loaded on every turn, so it stays short. Everything else is loaded
on demand from `handoff/`.

**You are Builder** — the code session, in the `workout-codebase` worktree. So Emilio
can tell the two terminals apart at a glance (both are local Claude Code), **tag the
first line of every message**: your own messages (this terminal, to Emilio) → **`[BUILDER]`**
(which window this is); a **cross-session message** you `SendMessage` to Planner →
**`from [BUILDER]`** (so in Planner's window it reads as *incoming from* you). Planner
tags `[PLANNER]` / `from [PLANNER]` the same way. Throwaway build agents (Planner spawns them for batches, DEC-055) report
back to Planner, not to Emilio's terminal, and do **not** tag.

## The project

A browser-only workout app. React + Vite, no server. One trustworthy loop: set up
exercises and reusable routines, schedule them, start a workout snapshot, log
sets, and keep an editable historical record. State lives in the browser under
`localStorage` — there is no backend and no account model (`README.md` is the
product contract; read it).

**It is a logging tool built on one rule: history is the source of truth, and the
app never invents data it doesn't have.** A weighted exercise with no history has
no invented starting weight; prefills come only from finished-workout data for
that same field. That distinction decides more than it sounds like it should —
`handoff/rules/DESIGN.md` states it as a test, and `.cursor/rules/history-prefill.mdc`
is the live example.

```bash
npm run dev        # http://localhost:5173  — single dev instance
npm run lint       # oxlint
node --test        # unit tests — every *.test.js under src/ (nested included)
npm run build      # production build (what GitHub Pages deploys)
./check            # the full gate: lint + tests + build
```

Live site (Pages, `gh-pages` branch): https://emihell.github.io/workout/ — every
push to `main` triggers a build-and-deploy (`.github/workflows/deploy.yml`).

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
  rules/AUDIT.md            the /audit procedure — read-only, writes audits/
  rules/DESIGN.md           product/UX values, as tests you can apply
  rules/WORKFLOW.md         how requirements are written and built
  work/BACKLOG.md           the backlog
  work/req-NN-name.md       the requirement you are implementing
  log/DECISIONS.md          what was chosen and why — don't relitigate
  log/LESSONS.md            what went wrong before
  reference/                how things actually behave (schema, migrations)
```

## How work arrives

One requirement at a time, as `handoff/work/req-NN-name.md` (a folder of the same
name once it passes ~200 lines). It states scope, what is explicitly **out** of
scope, ordered steps, and acceptance criteria written before implementation.

You may be asked to build one by the **planning session** (a cross-session message —
the usual path now) or by Emilio directly. Either way: implement on a branch named
after the requirement, run `./check`, write `reports/req-NN.md`, and **report back to
whoever asked** (reply to the planning session's message if it pinged you). **Do not
merge, and do not start the next requirement.** Review and merge are handled for you:
the planning session tests what it can reach and merges on that (**DEC-035**) — you never
merge, and that holds even when every check is green. (The carve-outs and full model are
in DEC-035; its migration carve-out also fires your ask-gate #2 below.)

`./plan` at the repository root is the **planning session's** tool.
**Don't run `plan save`, `plan publish`, or `plan closeout`** — those are the planning
session's to run, never yours. `./plan status` is read-only and safe if you need
to know where things stand.

If a requirement contradicts the code in front of you, the code wins — stop and
report it rather than implementing the contradiction.

**When you finish, write your report to `reports/req-NN.md` in this repository.**
Not in `handoff/` — you cannot write there. Commit it on the same branch as the
work, so the report travels with the diff.

Report in the terminal too; Emilio reads that. The file is so the planning session
can read the detail without him carrying it.

**The report has two sections, always: Technical and Workflow.** *Technical* —
what changed, how, what you verified, and any choice you made that the spec left
open. *Workflow* — what deviated from the plan: scope you added or dropped, fixes
that rode along, decisions taken with Emilio mid-build, and anything that should
become a `DEC-`/`L-` or change how we work. The Workflow section is how the
planning session learns what happened instead of guessing from the diff.

**Size the report to the req.** A trivial or mechanical change gets a brief
report — both sections stay, but each can be a line or two. The point is signal,
not volume: don't pad, and never drop a real deviation from the Workflow section.

**A claim of yours labelled `[inferred]` has not been run** — check it before
building on it. `[measured]` means a query or a test produced it, and the command
is quoted.

## Rules that have been earned

**Verify, don't recall.** Any number, limit, field name, schema shape, or "that
isn't possible" is a claim to be tested, not trusted. In a browser-only app the
cheap test is a unit test or a console line against the real model — one run
beats an hour of reasoning.

**Say what you did, not what you intended.** If a tool call or a test didn't run,
it didn't run. Past tense is for completed work only.

**The shell is zsh — quote its specials.** Single-quote any argument with `=`, `*`,
`?`, `[`, `~` or `!` (`echo '---'`, `--include='*.js'`): unquoted, zsh fails the
command red (`echo ======` → `not found`; an unmatched glob → `no matches found`).
Every red error is noise Emilio has to read and judge (2026-09-25).

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
See the ask-gate below.

**Write every doc trimmed** — reports, `DEC-`/`L-` entries. Keep the file:line
traces, the acceptance criteria, the decisions that are Emilio's, his quotes,
what was rejected and why. Drop persuasive framing and restatement. Full rules in
`rules/WORKFLOW.md`.

## When to ask Emilio, and when not to

**Two cases only.** Outside these, decide it, do it, and report what you chose.

**1. A decision that isn't in `handoff/` and a user would notice.** If the answer
isn't in a requirement, a `DEC-`, or `rules/`, and getting it wrong would change
what someone sees or how something behaves — stop and ask. Implementation choices
are yours; behaviour is his.

**2. Any change to the persisted-data schema or a bulk write to saved state.**
This app's data is the user's own workout history in `localStorage`
(`workout-mvp-v9`; `v8` and older are legacy keys read for migration), and there is
no backup and no undo. A schema-version bump, a
migration, or anything that rewrites many stored records is the counterpart of an
irreversible external call: say **what will change and to how many records**
before doing it, and add a migration test that proves an older key survives the
upgrade. A read, a single edit through the normal UI path, or work against a
throwaway/mocked store needs no ask.

## You report it ready; you never merge it

**The build session does not merge — ever.** When a branch is done, do not report
that it is finished — report that it is **ready to look at**, in this shape:

```
1  what it does            two or three sentences, plain
2  what to test            numbered, each a thing to click or look at,
                           each answerable yes or no
3  what you could not      anything needing a browser, a real device, or a
   verify yourself         judgement about how it feels
```

Tell whoever asked which branch, and keep the list short enough to work through in
one sitting — if it needs fifteen items, the branch is too big. The planning session
then tests what it can reach and merges on that (**DEC-035**); Emilio feels the
untestable parts (real-device gym feel) after and flags regressions — that does not
block the merge.

**Then hand off.** Do not merge on your own initiative, ever, even when every test
passes and every criterion is met — merging is the planning session's (DEC-035), with
Emilio's eyes required only on the migration/bulk-rewrite carve-out above.

## Finishing

Report what changed and what you verified, separately. **Run each acceptance
criterion as a command or a test where one exists, and put its output in the
report** — a pasted result is a receipt, a sentence is a claim, and this project
trusts receipts (`./check`'s green line, a test's output, `check_handoff`'s exit
on a handoff-touching req). The planning session reads that output rather than
re-running it. If you chose something the requirement left open, say so
explicitly — those choices go to `log/DECISIONS.md`, and Emilio can only record
what you surface.
