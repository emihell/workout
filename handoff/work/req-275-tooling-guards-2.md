**Status: READY** · **Lane: tooling** · L-068, L-071, L-072, req-257 report, req-269 review, DEC-155 §7. After req-264 and req-265 (no shared file; keeps the gate stable under them). Touches `plan`, `check`, `scripts/check_handoff.py`, `.github/workflows/deploy.yml`, `src/req-202.test.js`.

# req-275 — tooling guards 2: closeout traps, untriaged audits, unrun suites, plan/check lockstep

All measured on `main` `5798ae2`, 2026-10-31 (Planner fork). Scratch probes in the session scratchpad, not the repo.

## Why (observed)

**(a) Closeout aborts after the merge.** `plan:4` is `set -euo pipefail`. `flip_status` (`plan:782-800`) exits 1 when the
doc has no `**Status: …**` span, and it is called at `plan:1168`, after the merge has landed:
```
bash -c 'set -euo pipefail; source fs.sh; flip_status doc.md "**Status: X**"; echo after'
plan closeout: no **Status: ...** span found in doc.md      rc=1   ("after" never printed)
```
`review_warn="$(reviewer_warning …)"` (`plan:1215`, function `plan:900`): **not reproduced**. A bad dir/ref gives empty
output, rc 0 (`out=[] rc=0`), because every command inside ends in `|| true` or an echo. Hardened anyway (one `|| true`).

**(b) Untriaged audits (L-068).** Today every `F-*` id in `audits/2026-09-12.md` (20), `2026-09-24.md` (37) and
`2026-10-30.md` (25) appears in `handoff/work/` or `handoff/log/` — 0 untracked — **only because Planner triaged the 10-30
audit by hand on 10-31**. Workflow audits (`handoff/audits/workflow-*.md`) use E-ids (`**E2**`) that restart per file
(09-24: 14, 10-30: 12), so an id check can't cover them; the 10-30 "later" list was lost there.

**(c) Checks nothing runs (L-071).** The two golden *recorders* (`scripts/req-164-golden.mjs`, `req-165-golden.mjs`) broke
from req-178 to req-269 unseen; recording the current tree takes 0.08 s / 0.05 s. Worse: **the six shell suites run in
neither `./check` nor CI** (`grep -n 'test\.sh' check .github/workflows/deploy.yml` → none). Measured on main:
plan-guards 21 s · check-handoff 5 s · check-skills 3 s · plan-ledger 2 s · pre-push 2 s · check-lanes 1 s (≈34 s; the
whole `./check` is ≈9 s, req-266 report). Other `scripts/*` are tools, not checks (capture, screenshot, build-library,
link-library-ids, library-text-report, fill-routine-kg, qa, dec_index) — out of scope; `dec_split.py` is a finished
one-shot (req-271) → delete.

**(d) plan and check_handoff out of step (L-072).** `plan save` calls `"$PLANNING_DIR/scripts/check_handoff.py"`
(`plan:245`, `:299`), while closeout runs `$CODE_DIR/plan`. After a merge that changes both, the new `plan` called the old
script: `check_handoff.py: error: unrecognized arguments: --only doc-limits --worktree` (req-272 closeout, 2026-10-31).

**(e)** `check:113` still says "288 s vs 80–105 s"; the suite takes ≈9 s (req-266 report, 8.80 s on main).

**(f)** `src/req-202.test.js:94` is titled "routine row meta, History row meta; …" but asserts no History row since
req-269. The live header *is* behaviour-tested at `:100` ("History exercise header: 'with warm-up · {date}'", rendered,
`detail.jsx:134`) — the req-269 reviewer's "no behaviour test" was wrong. Only the title is stale.

## Scope

1. **(a)** `flip_status` failure never aborts closeout: catch it, print `WARNING — <doc> has no **Status:** span; flip it
   by hand`, carry on (save, publish, push). `review_warn=…` gets `|| true`.
2. **(b)** `check_handoff` check: every `F-[A-Z]+-[0-9]+` id in `audits/*.md` must appear in `handoff/work/`, `handoff/log/`
   or a later `audits/*.md`; else `[fail] audit: <file> — F-X-N untriaged`. Every audit file (`audits/*.md`,
   `handoff/audits/*.md`) must be named on a `Triaged: <file> YYYY-MM-DD` line in `log/AUDIT-TRIAGE.md` (new; root `audits/`
   is code-side, and BACKLOG is size-capped by req-272's ratchet, so the marker lives in an append-only handoff log). **Grandfather:** files dated before 2026-10-31 are
   exempt from the marker (their F-ids are still checked).
3. **(c)** CI (`deploy.yml`) runs all six shell suites after `./check`. `./check` runs a suite only when the diff vs
   `main` (or the working tree) touches what it tests: `plan`, `scripts/*`, `.githooks/*`, `.claude/skills/*`. A new
   `src/` test runs both golden recorders on the current tree (temp dir, `git archive`-free: in-process or a copy) and
   asserts they exit 0 and record all three docs. Delete `scripts/dec_split.py`.
4. **(d)** `plan` calls the `check_handoff.py` that sits next to it: `"$(dirname "${BASH_SOURCE[0]}")/scripts/check_handoff.py"
   --repo "$PLANNING_DIR"` (lines 245, 299; check 354/379 already use `$CODE_DIR`). Caller and script then always match.
5. **(e)** Rewrite `check:111-114` with the measured numbers (slowest test, suite time) and keep the 60 s rationale.
6. **(f)** Retitle `req-202.test.js:94` to what it asserts ("routine row meta; a real warm-up set keeps 'Warm-up set'").

## Out of scope

- Workflow audits' E-ids (not unique; covered by the `Triaged:` line instead).
- Running the six suites on every local `./check` (≈34 s, would quadruple it).
- The tools listed in (c).

## Steps

1. (a) + (d) in `plan`, each with a `plan-guards.test.sh` case. 2. (b) in `check_handoff.py` + `check-handoff.test.sh`.
3. (c) CI + `./check` selection + recorder test + delete `dec_split.py`. 4. (e), (f). 5. `./check --smoke`; all six suites.

## Acceptance criteria

1. **(a) fires:** a sandbox closeout on a req doc with no Status span → merge lands, WARNING printed, publish and push still
   run, exit 0. Fails on main's `plan` (exit 1 after the merge). A `reviewer_warning` stub returning 1 → no abort.
2. **(b) fires:** fixture audit with an F-id nowhere else → `[fail] audit: …`; a fixture workflow audit dated 2026-11-01
   not named in `log/AUDIT-TRIAGE.md` → fail; one dated 2026-10-30 → pass (grandfather). On real main: 0 fails (state the count).
3. **(c):** CI log shows all six suite names passing; `./check` with a touched `plan` runs plan-guards + plan-ledger
   (printed), with only `src/` touched runs none. **Failure case:** break `plan-ledger.test.sh` in a sandbox → CI-equivalent
   run red. Recorder test fails on a tree where a recorder throws (inject a non-JSON key other than the fill key).
4. **(d) fires:** a sandbox where the planning worktree's `check_handoff.py` lacks a flag the code-side `plan` passes →
   `plan save` via the code-side `plan` still works (fails on main's `plan`, as in L-072).
5. `check:111-114` cite measured numbers; `req-202.test.js:94` title matches its assertions; `scripts/dec_split.py` gone.
6. `./check --smoke` green; all six suites green; no existing assertion weakened (fixture additions called out).

## Decisions made on Emilio's behalf

- Implementation: suites in CI always, locally only when their subject changed; `Triaged:` line + grandfather date;
  `plan` uses its sibling script. His steps don't change.

## Siblings

req-257/266/271/272 shaped these files; none open. BACKLOG §Tooling items (a)–(f) → this req.
