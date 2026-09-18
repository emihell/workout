# req-102 — finish the rotted-check sweep: retire check_backlog_index, fix classify_tag, narrow the NOW-scan

**Status: SPEC — READY.** Tooling only (`scripts/check_handoff.py` + its self-test). No app code, no
persisted data. Closes out the L-020 family surfaced by req-101 item #3 (Builder) + the ledger. Each
fix ships with a self-test assertion so it can't silently re-rot.

## Context

req-101 repaired the NOW.md↔status check and added `scripts/check-handoff.test.sh`. In doing so Builder
found two more rotted/wrong checks, and Planner hit a third (over-claim) while writing the ledger. All
three are the same class as [[L-020]]: a check that no longer does what it claims.

## Fix 1 — RETIRE `check_backlog_index` (Emilio's call, 2026-09-18)

`check_backlog_index` validates a BACKLOG structure that **was deliberately abandoned**: its
`TIER_DIR handoff/work/backlog/` no longer exists, and BACKLOG.md dropped the `## Sections` / `**§N.N**`
/ `### N.N` model — it is now a prose index (CLAUDE.md: "BACKLOG.md is an index, not the backlog"). So
the check scans nothing and can never fire; unlike req-101's check, the thing it enforced is gone **by
design**, so we retire rather than repair (Emilio, 2026-09-18).
- Remove `check_backlog_index` and any constants/regexes used ONLY by it (`TIER_DIR`, the `§N.N` /
  section regexes, `BACKLOG_PATH` if unused elsewhere — grep before deleting each; leave anything a
  live check still uses).
- Remove its call site in the top-level runner and any now-dead imports.
- Do NOT delete other checks. Do NOT restructure BACKLOG.md.

## Fix 2 — `classify_tag`: match "NEEDS DECISION" singular AND plural

`classify_tag` (`check_handoff.py` ~:214) matches `\bNEEDS DECISIONS\b` (plural), but every doc writes
"NEEDS DECISION" (singular), so a parked req classifies `unknown` instead of `not-merged`. Widen the
pattern to match both (e.g. `NEEDS DECISIONS?`). Low-risk; it only ever makes a parked req classify as
not-merged, which is what the downstream conservative checks already expect.

## Fix 3 — NOW-scan claims the bullet's SUBJECT req, not every mention

The section-aware scan (req-101) claims **every** `req-N` on a forward-looking line, so an incidental
cross-reference false-positives. Real case from the req-101 ledger: a `**READY**` bullet
`- \`req-102\` … (from req-101 item #3)` made the scan claim `req-101` (merged) as `pending` → a false
finding. Narrow it: **per forward-looking line, claim only the first `req-N` token (the subject** —
in practice the backticked one that opens the bullet); ignore later incidental mentions on the same
line.
- Keep the section-boundary logic from req-101 unchanged (headers / `FORWARD_LABEL_RE` / blank-line and
  non-forward-bold closing). Only change which req-N on a scanned line becomes a claim.
- Accept the rare tradeoff (a single bullet that legitimately introduces two new reqs claims only the
  first) — note it in a comment; it's the right call vs. false positives on cross-refs.

## Self-tests (extend `scripts/check-handoff.test.sh`)

- **Fix 1:** after retirement, `check_handoff` imports and runs clean on the live repo (exit 0), and
  `grep -n check_backlog_index scripts/check_handoff.py` finds only... nothing (function gone, no
  dangling call). Assert both.
- **Fix 2:** a doc tagged `Status: NEEDS DECISION` (singular) classifies `not-merged` (assert via a
  small `classify_tag` call, or via a planted fixture where a singular-tagged req under a forward
  section produces NO finding — consistent — while the OLD plural-only regex would have left it
  `unknown`, also no finding, so prefer the direct `classify_tag` assertion to actually prove the fix).
- **Fix 3:** a `**READY**` bullet `- \`req-AAA\` … (from req-BBB item #3)` where req-BBB's doc is
  BUILT AND MERGED → assert the scan claims req-AAA (`pending`) and does NOT claim req-BBB, and
  `check_handoff` produces NO finding about req-BBB. (This is the exact ledger false-positive; it must
  go red on today's parser and green after Fix 3.)

## Out of scope

- Repairing or restructuring BACKLOG.md or restoring the retired check's structure.
- Wiring the self-test into `./check` (keep the manual precedent).
- App code, persisted data. Any check beyond these three (req-101 already spot-checked
  `check_size_claims` — leave it).

## Acceptance criteria

- `grep -c check_backlog_index scripts/check_handoff.py` → 0. `python3 scripts/check_handoff.py` on the
  live repo → exit 0, no output.
- `classify_tag` returns not-merged for a `NEEDS DECISION` (singular) tag (shown by the self-test).
- The Fix-3 self-test proves req-BBB is not claimed from an incidental cross-ref; it goes red on the
  pre-req-102 parser and green after (Builder: show both, as with req-101's reverted-parser proof).
- `bash scripts/check-handoff.test.sh`, `plan-guards.test.sh`, `plan-ledger.test.sh`, `./check` all
  green.

## What Builder cannot verify (for Emilio)

- Nothing device/feel; all criteria runnable. Planner reviews + runs them and merges (DEC-035).
