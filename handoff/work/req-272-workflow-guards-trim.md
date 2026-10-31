**Status: READY** · **Lane: tooling** · DEC-144 §4 (moved to now by DEC-155 §7), DEC-085, L-032, req-100 (NOW limit), req-250. After req-271 (same files: `scripts/check_handoff.py`, `plan`).

# req-272 — grants trimmed, hook text fixed, a size ratchet on the rule docs

## Why (observed)

Workflow audit 2026-10-30 §9: "**Fix L-032 at the root.** Change the hook text. Remove `git commit:*`/`git reset:*` from
the grants **and** from `plan doctor`'s canonical list, which today enforces them. **[Emilio: grants]**". §E2: the hook
"still says `HANDOFF=1 git commit …`"; "`plan doctor` lists both as *canonical* … and reports `FIX: grants` if either is
removed. So the tool enforces what DEC-085's planning list said to remove." §D1: the nine rule docs grew 3,211 → 4,287
lines in 36 days (+33.5%). The workflow plan's "later" row adds a "doc-size ratchet".

[measured 2026-10-31]
- `.githooks/pre-commit:3` "Emilio lands planning changes with: HANDOFF=1 git commit ..."; `:16-17` "If this is
  intentional planning work: HANDOFF=1 git commit ...". L-032: "never a raw `git commit`, never a hand-set `HANDOFF=1`";
  `./plan save` is the path (it sets `HANDOFF=1` itself, `plan:258`).
- Grants (planning worktree `.claude/settings.local.json`, gitignored `.gitignore:32`): 10 entries incl.
  `Bash(git commit:*)`, `Bash(git reset:*)`. The same 10 are hard-coded in `plan doctor` (`plan:1283-1294`, set-equality,
  `FIX: grants` on any difference) and in README §Setup step 5 (`README.md:71`, the printf Emilio pastes).
  Code worktree `.claude/settings.json` denies `Edit(.claude/settings.local.json)` — a build agent can't change the file.
- `plan save` runs `git reset` / `HANDOFF=1 git commit` inside the script (`plan:252,258`); a permission grant applies to
  the Bash call (`… plan save:*`), not to commands inside it [inferred from how grants match; prove in AC1].
- Also found: the grants name `../workout-codebase/plan …`, but Planner runs `./plan …` from the planning worktree (this
  session, 2026-10-31) — the granted form isn't the one used.
- Rule docs today (`wc -l`): PLANNING 393 · WORKFLOW 342 · BACKLOG 226 · PAGES 192 · schema 159 · DESIGN 149 · README 145 ·
  AUDIT 143 · CLAUDE 128 · CAPABILITIES 118 · EVIDENCE 118 · COACH 111 · BUILDER 102 · CLOSEOUT 80 · GOALS 59 · BACKEND 40
  · coach/LESSONS 29. NOW.md has its own ≤50 rule, enforced before commit (`plan:220-232`, `check_handoff.py:478`).

## Scope

1. **Hook text** (`.githooks/pre-commit:3,16-17`): planning work goes through `./plan save "msg"`; no line suggests a
   hand-set `HANDOFF=1`. The `HANDOFF` bypass itself stays (plan save needs it).
2. **Grants:** remove `Bash(git commit:*)` and `Bash(git reset:*)` from README §Setup step 5 and `plan doctor`'s canonical
   list; add the `./plan save|status|publish|closeout:*` forms Planner actually uses (keep the `../workout-codebase/` ones
   while either is in use). Doctor's `FIX:` message prints the exact new line to paste.
3. **Doc-size ratchet** in `check_handoff.py`: a limits table (one place, e.g. `scripts/doc_limits.json`) with each rule
   doc's ceiling = its line count at merge. A doc over its ceiling → **fail** (blocks `plan publish`), naming the file,
   count, ceiling, and how to raise it. Raising = edit the table in the same commit with a `reason` field (non-empty,
   required). A doc ≥ 10 % under its ceiling → a warning "tighten to N" (never auto-edited — check_handoff's no-auto-
   correction rule). Covers the docs listed above; excludes `log/` (append-only, req-271), `work/req-*` and `reports/`.
4. `plan save` refuses before commit when a ceiling is exceeded, as it does for NOW.md (`plan:220-232`), reading the
   limit from the table (never restated).

## Out of scope

- Capping reports or SHIPPED entries (audit decision 5 options; SHIPPED ≤3 already warns, req-252).
- Shrinking any doc now — the ratchet freezes growth; trimming is Planner's, case by case.
- The `core.hooksPath` absolute-path note (audit E11).

## Steps

1. Hook text; a test that the refusal message names `./plan save` and no `HANDOFF=1` instruction.
2. README + doctor list; extend `plan-guards.test.sh` for doctor's grant check.
3. Limits table + check + `plan save` refusal; tests with fixture docs.
4. Report the one line Emilio pastes to update his grants file.

## Acceptance criteria

1. **Grants:** with `git commit:*` / `git reset:*` removed from a sandbox grants file, `./plan doctor` prints
   `ok grants`; with the old file it prints `FIX: grants` and the new line. Planner then runs `./plan save` with the new
   grants live and pastes it committing (proves the internal git calls don't need the grants).
2. **Guard fires — hook:** staging a `handoff/` file in a sandbox repo → refused; the message names `./plan save`, and
   `grep -n 'HANDOFF=1 git commit' .githooks/pre-commit` → nothing.
3. **Guard fires — ratchet:** a fixture doc grown 1 line past its ceiling → `check_handoff` fails naming it; `plan save`
   refuses before staging (working tree untouched, as the NOW.md guard).
4. **Failure case — a raise with no reason:** ceiling raised with an empty `reason` → fails. With a reason → passes.
5. **Failure case — missing table / unknown doc:** the table missing or a listed path gone → a clear failure, not a pass.
6. Shrinking doc → "tighten" warning, exit 0.
7. `./check` green; the test count read and stated (L-067).

## Decisions made on Emilio's behalf

- `(unconfirmed)` **Grants** (audit: "[Emilio: grants]"): option (a) — remove `git commit:*`/`git reset:*`; add the `./plan`
  forms. **His step changes:** he re-pastes one grants line (the report gives it), because the file is his and build
  agents can't edit it.
- `(unconfirmed)` **Ratchet blocks, not warns:** growth past a ceiling stops `plan publish` until the ceiling is raised
  with a reason. Planner's habit changes, not Emilio's.
- Implementation: the table format, the 10 % tighten threshold, which docs are covered.

## Siblings

After req-271 (both edit `check_handoff.py`, `plan`; the ratchet excludes the new `log/decisions/`). req-257 changed
`plan` doctor-adjacent code (`find_worktrees`); req-266 changed `check`. BACKLOG "untriaged audit findings check" also
lands in `check_handoff.py` — order it after this.
