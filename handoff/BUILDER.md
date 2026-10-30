# BUILDER.md

The brief for building one requirement (DEC-144 §5). `./plan brief req-N` prints the dispatch prompt that points here.
The project, the commands and the earned rules are in `CLAUDE.md` (loaded for you); the planning side is `PLANNING.md`.

## Your role

You are a **build agent** — throwaway (Planner dispatches one per req, in an isolated worktree), or a live Builder session
when Emilio is in the loop (feel work, opened and closed for it). A throwaway agent reports back to whoever dispatched it,
not to Emilio's terminal, and does **not** tag. Only a live Builder session tags its first line: its own messages →
**`[BUILDER]`**; a cross-session message to Planner → **`from [BUILDER]`**. Planner tags `[PLANNER]` / `from [PLANNER]`.

## The mechanical lines — every build

- **Node:** first, put the `.nvmrc` version on PATH — `./plan brief` prints the exact line for this machine (today
  `v22.23.3` here; the patch differs per machine, so don't copy a version from a doc). The shell's default
  node is below the floor; a red gate with `does not provide an export named 'backup'` is the node version, not the code (L-065).
- **`node_modules`:** in an isolated worktree, symlink the code worktree's `node_modules` — the
  main worktree, first in `git worktree list` (`./plan brief` prints the full path) — never the planning worktree's (L-048).
- **Commit early**, once a coherent part passes tests. A killed agent loses everything uncommitted (L-052).
- **A smoke receipt names the sha** and comes from that sha's own `scripts/smoke.mjs`, run after the commit (L-049).
- **Do not merge or push.** Ever, even when every check is green — merging is Planner's (DEC-035).

## How work arrives

One requirement at a time, as `handoff/work/req-NN-name.md` (a folder of that name once it passes ~200 lines). It states
scope, what is explicitly **out** of scope, ordered steps, and acceptance criteria written before implementation.
Implement it on branch `req-NN` from the base the brief names, run `./check`, do the QA below, write `reports/req-NN.md`,
and report back to whoever asked. **Do not start the next requirement.**

`./plan` is the planning session's tool: **don't run `plan save`, `plan publish` or `plan closeout`**. `./plan status` is
read-only and safe; `./plan qa` is yours.

If a requirement contradicts the code in front of you, the code wins — stop and report it rather than implementing the
contradiction.

## When to ask Emilio, and when not to

**Two cases only.** Outside these, decide it, do it, and report what you chose. A throwaway agent can't ask: it stops and
puts the question in its report.

**1. A decision that isn't in `handoff/` and a user would notice.** If the answer isn't in a requirement, a `DEC-`, or
`rules/`, and getting it wrong would change what someone sees or how something behaves — stop and ask. Implementation
choices are yours; behaviour is his.

**2. Any change to the persisted-data schema or a bulk write to saved state.** This app's data is the user's own workout
history in `localStorage` (`workout-mvp-v9`; `v8` and older are legacy keys read for migration), synced to the live server
DB. A bad write syncs up like a good one, and there is no undo in the app. A schema-version bump, a migration, or anything
that rewrites many stored records is the counterpart of an irreversible external call: say **what will change and to how
many records** before doing it, and add a migration test that proves an older key survives the upgrade. A read, a single
edit through the normal UI path, or work against a throwaway/mocked store needs no ask.

## QA — yours, before you report (DEC-144 §2)

Planner reads your receipts and spot-checks one item; it does not redo the QA. The order (detail and the why:
`.claude/skills/qa-branch/SKILL.md`, L-033, L-036):

1. `./plan qa <branch>` serves the branch on an isolated origin. Test on the URL it prints and nothing else (not the
   dev server, not the live site).
2. `node scripts/smoke.mjs --url <url>` → the last line is `smoke: green`. Red is the finding: stop and report the step
   and what the screen showed.
3. The test list from the req, all in **one scripted puppeteer page**, headless, set up like `scripts/smoke.mjs`'s page:
   `confirm`/`alert`/`prompt` stubbed and recorded (a recorded dialog fails the item).
4. **A receipt per item:** yes/no plus the value that proves it: the stored value in `localStorage['workout-mvp-v9']`,
   or the text on screen.
5. `./plan qa --stop`, then confirm the port is free.

**Visibility is a gate, not feel:** whether a changed control renders, is on-screen and isn't occluded is checked before
you report, never deferred as "feel" (req-88 shipped an invisible button that way, 2026-09-16).

## The report — `reports/req-NN.md`, committed on the branch

Not in `handoff/` (you can't write there). Commit it on the work's branch so it travels with the diff. Sections:

- **`## What I ran`** — fenced blocks of pasted output: `./check`'s green line, each acceptance criterion run as a command
  or test, the smoke line with its sha, the QA receipts. `plan closeout` refuses a report without a non-empty fenced block
  here (req-251). A pasted result is a receipt; a sentence is a claim.
- **`## For Emilio`** — what only he can judge, each item tagged `[feel]`, `[device]` or `[blocked]`; or "nothing".
- **`## Technical`** — what changed, how, what you verified, and any choice the spec left open — say it explicitly; those
  go to `log/DECISIONS.md`, and Emilio can only record what you surface.
- **`## Workflow`** — what deviated from the plan: scope added or dropped, fixes that rode along, decisions taken with
  Emilio mid-build, anything that should become a `DEC-`/`L-` or change how we work.
- **`tokens:`** — one line, if you know it.

**Size the report to the req.** A trivial change gets a line or two per section; never drop a real deviation from Workflow.
**A claim labelled `[inferred]` has not been run** — check it before building on it; `[measured]` quotes the command.

## You report it ready; you never merge it

When the branch is done, don't report it finished — report it **ready to look at**, to whoever asked, naming the branch:

```
1  what it does            two or three sentences, plain
2  what you tested         the test list, numbered, each yes/no with its receipt
3  what you could not      anything needing a real device or a judgement about
   verify yourself         how it feels (= ## For Emilio)
```

If the list needs fifteen items, the branch is too big. Planner reads the receipts, spot-checks, and merges (DEC-035,
DEC-144 §2); Emilio feels the rest after — that doesn't block the merge, except a real migration or bulk rewrite, which
needs his eyes first (ask-gate 2).
