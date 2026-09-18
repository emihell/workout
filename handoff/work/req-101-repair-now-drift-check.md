# req-101 — repair the rotted NOW.md↔status drift check + a planted-failure self-test

**Status: SPEC — READY.** Tooling only (`scripts/check_handoff.py` + a new self-test). No app code, no
persisted data. From [[L-020]] (2026-09-18): the NOW.md drift check silently matches nothing.

## The bug (measured)

`check_handoff.parse_now_md_claims` (`scripts/check_handoff.py:247`) is supposed to read NOW.md's
own claims about each req and cross-check them against the req docs' real `Status:` tags
(`check_status_lines`, `:275`; `_now_claim_disagrees`, `:263`). But its regexes expect a NOW.md format
we no longer write:
- `QUEUE_LINE_RE` (`:243`) = `^\s*\[.\]\s*(req-\d+)\b.*?\b(READY|SHELVED|WITHDRAWN|BLOCKED)\b` — a
  `[ ] req-N … READY` checkbox line. Current NOW.md uses `- \`req-N\` **name** …` bullets.
- `DONE_LINE_RE` (`:242`) = `^done \d{4}-\d{2}-\d{2}:` lines — NOW.md doesn't use these either.
- Neither knows the phrase **"NEEDS DECISION"**.

**Proof:** `parse_now_md_claims(current NOW.md)` returns `{}` — so the cross-check runs on an empty
claim set and can never fire. A shipped req (req-85, BUILT AND MERGED) sat under a "NEEDS DECISION:"
line for a whole session and the check reported clean. A rotted check is worse than none: false
confidence (L-020).

## Scope

### 1. Make `parse_now_md_claims` section-aware (robust to NOW.md's free prose)

Key off NOW.md's **stable section structure**, not a checkbox format. Forward-looking sections declare
work that is NOT yet shipped; a merged req appearing there is the drift to catch.
- Treat any `req-N` mentioned under a **forward-looking** region as a `not-merged`-class claim. The
  forward-looking regions in current NOW.md are: the **`**READY, held:**`** block, the
  **`in flight`** line/block, and the **`## Needs decisions — parked …`** section. (Match on the
  header/bold-label text, case-insensitive; don't hardcode exact punctuation.)
- Do NOT treat the top **`**Shipped: …**`** summary line, "LIVE" / "aftermath" notes, or the
  `## Where to read` / `## Milestone` sections as claims — those legitimately name shipped reqs.
- Then reuse the existing machinery: for each such claim, if the req's real tag classifies as
  `merged` (via `classify_tag`), emit a `status` finding ("NOW.md lists req-N as pending/undecided but
  its doc is BUILT AND MERGED"). Keep `_now_claim_disagrees` semantics or extend minimally.
- Preserve the conservative spirit (the docstring at `:247`): only flag a **clear** mismatch (a
  req-N under a forward-looking header whose doc is unambiguously merged). A req-N it can't confidently
  place stays silent — no false positives. Keep the DONE_LINE/queue-line handling working too if those
  formats ever return (don't delete capability, just stop depending on it exclusively).

### 2. Ship a planted-failure self-test (the durable defense)

A shell test in `scripts/` (precedent: `plan-guards.test.sh`, `plan-ledger.test.sh`; manual, not
wired into `./check`) that, in a throwaway repo/fixture:
- plants a req doc tagged `BUILT AND MERGED` and a NOW.md that lists that req-N under "READY, held"
  (and one under "NEEDS DECISION") → asserts `check_handoff` **emits a finding** (proves the check
  fires);
- plants the same req correctly (only under the Shipped summary) → asserts **no finding** (no false
  positive).
This is the guard against re-rot: if the parser silently stops matching, this test goes red.

### 3. Spot-check the sibling parsers for the same rot

While here, verify the other `check_handoff` checks still fire against the CURRENT doc formats:
`check_size_claims` (`:426`) and the section/status checks. If any also extracts nothing from the
live docs, note it in the report (fix only if trivial; otherwise flag for a follow-up — don't scope-
creep this req).

## Out of scope

- Changing NOW.md's format or authoring style (the fix adapts to the prose, not the reverse).
- Wiring the self-test into `./check` (keep the manual-shell-test precedent).
- App code, persisted data.

## Acceptance criteria

- `python3 -c 'import sys;sys.path.insert(0,"scripts");import check_handoff as c;print(c.parse_now_md_claims(open("handoff/NOW.md").read()))'`
  now returns a non-empty dict that includes the forward-looking reqs (e.g. `req-10`, `req-24`) and
  does NOT mark them merged — while a planted merged-under-READY req IS flagged (shown by the test).
- `bash scripts/<new-test>.sh` → passes, and demonstrably goes red if the parser is reverted to the
  old regex-only form (Builder: show that in the report).
- Running `check_handoff` against the live repo produces **no false positives** on the real NOW.md
  (the current NOW.md is accurate as of req-100 closeout, so the check must report clean on it).
- `plan-ledger.test.sh` + `plan-guards.test.sh` still pass; `./check` green (Python change only).

## What Builder cannot verify (for Emilio)

- Nothing device/feel. All criteria are runnable. Planner reviews + runs them and merges (DEC-035).
- Judgment call left to Builder: how to detect section boundaries (header-scan vs a small state
  machine over lines). Pick the simpler one that passes the planted-failure test; say which in the
  report.
