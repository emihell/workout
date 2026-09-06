# The audit

The recurring read-only sanity check. Run it between milestones with `/audit`, not
mid-build. It reads `handoff/` and the whole codebase and writes one dated findings
report. It changes no code.

## The one rule: diagnose, don't treat

The audit **finds and records; it never fixes.** Not a rename, not a one-line tidy,
not a dead import. A fix — however small — is a change that belongs on a reviewable
branch with its own acceptance criteria, not smuggled into a read-only pass. "It was
one line" is what makes it a good backlog item, not what makes it safe to do here.

### The one exception: `README.md`

If the audit finds the README's product contract has drifted from what the code
actually does, it may note the exact discrepancy in the report — it still does not
edit the README. Reconciling the contract is Emilio's call.

## Output

One file, `audits/YYYY-MM-DD.md`, at the repository root. **If that file already
exists, add `-HHMM`** rather than overwriting — the series is the whole point: three
reports show whether the codebase is getting better or just bigger.

Not in `handoff/` — that folder is read-only to Claude Code. The audit is the one
deliverable that flows *back* toward planning: written where Claude Code owns, read by
Emilio.

Every finding carries:

```
severity   blocks-a-plan | bug | debt | nit
evidence   file:line, a test result, or a measurement — never "seems"
effort     minutes | hours | days
```

**A finding without evidence is not a finding.** "This looks slow" is worth nothing;
"`recompute()` re-reads every completed workout on each render, N² in history length,
measured 40ms at 200 sessions" is worth something.

Sort by severity. Lead with a five-line summary and the numbers that changed since the
last audit.

### Two things the report must state explicitly

**Coverage.** List which steps below were performed and which were skipped. A report
that silently covers half the checklist reads exactly like one that covers all of it
and found less. Say `step 5: partial — migration paths covered, edge inputs not`.

**Already-tracked vs new.** Cross-check every finding against `NOW.md` and
`work/BACKLOG.md` before listing it. Anything already scheduled goes in a short
*confirms existing* section, not in the findings. The count at the top is **new
findings only.**

## Step 1 — read forward before reading the code

Read `NOW.md`, then `work/BACKLOG.md`, then skim `log/DECISIONS.md` and
`log/LESSONS.md`. You are auditing against what the project *intends*, not against an
imagined ideal. A thing that looks wrong may be a recorded decision.

## Step 2 — dead weight

Unused exports, unreferenced components, `db.json` fields nothing reads, commented-out
blocks, dependencies in `package.json` nothing imports. Evidence is a grep showing no
live reference. Precision matters — a near-name (`lastSetsForExercise` vs
`lastSetForExercise`) is not the same symbol.

## Step 3 — divergence

Where does the code disagree with the README contract or `rules/DESIGN.md`? A prefill
that comes from a plan instead of history; a relationship page using Delete instead of
Remove; a setup edit that reaches into a historical snapshot; a recommendation that
doesn't use valid increments. Each is a divergence from a stated rule — cite the rule
and the file:line.

## Step 4 — drift between what's written and what's true

`handoff/` docs, the README, and code comments against the code. A `Status:` line that
git contradicts (`check_handoff.py` covers this — run it and quote the exit), a README
that describes a schema version the code has moved past, a comment asserting behaviour
the code no longer has. Do not fix — record.

## Step 5 — risk

The migration path (does an older `localStorage` key still upgrade cleanly? is there a
test?), anything that writes stored state, any place a bad input corrupts the record.
This is the highest-value step for this app, because persisted data has no backup.
Evidence is a test or a reproduction, not a worry.

## Step 6 — performance, measured

Only measured findings. Renders that recompute over all history on every keystroke,
O(n²) passes over sessions, large synchronous work on the main thread. Quote the
measurement and the input size. "Might be slow" is not a finding.

## Step 7 — structure and readability

Duplication that has drifted (two copies of a rule, one stale), a module doing three
jobs, a helper that would clarify a repeated pattern. Lowest severity; suggest, don't
prescribe.

## What the audit must not do

- edit, create or delete any file outside `audits/`
- touch anything in `handoff/` (enforced, not requested)
- fix anything, however small
- open a branch, stage, or commit
- reorganise files

## After the audit

1. Emilio reads the report.
2. Findings that survive go into `work/BACKLOG.md`, tiered.
3. Anything over a few hours becomes `work/req-NN-*.md`.
4. Recurring findings — the same thing flagged twice — go to `log/LESSONS.md`.
5. The report stays in `audits/`. The series is the point.

## Setup

Lives at `.claude/skills/audit/SKILL.md`:

```yaml
---
name: audit
description: Read-only project audit. Reads handoff/ and the whole codebase,
  writes a dated findings report to audits/. Changes no code.
disable-model-invocation: true
---
```

`disable-model-invocation: true` means Claude only runs it when you type `/audit` — it
will not decide to start an audit mid-task. The body is a pointer to this file, so
there is one source of truth:

> Follow `handoff/rules/AUDIT.md` exactly. Read it first, in full.
