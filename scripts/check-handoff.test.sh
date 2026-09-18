#!/usr/bin/env bash
# req-101 — planted-failure self-test for check_handoff's NOW.md<->status drift
# check (parse_now_md_claims). This is the durable guard against the L-020
# re-rot: a NOW.md format change that makes the parser silently match nothing,
# so a shipped req can sit under a forward-looking section and the check stays
# green. If the parser stops matching today's prose, this test goes red.
#
# Manual; NOT wired into ./check (precedent: plan-guards.test.sh,
# plan-ledger.test.sh). Run:  bash scripts/check-handoff.test.sh
#
# check_handoff reads handoff/ via `git show <ref>:<path>`, so the fixture has
# to be a real committed git repo. We build a throwaway one, plant a req doc
# tagged BUILT AND MERGED (with a real landing commit so classify_tag sees it
# as 'merged'), and swap NOW.md between:
#   * a DRIFTED layout — the merged req listed under a forward-looking section
#     ("**READY, held:**" or "## Needs decisions") -> the check MUST fire;
#   * a CORRECT layout — the merged req only under the "**Shipped:**" summary
#     -> the check must stay silent (no false positive).
# A pending-but-not-merged control req (req-201) sits under the forward section
# in every layout and must NEVER produce a finding (the conservative bargain).
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Defaults to the checked-in check_handoff.py; override CHECK_HANDOFF to point
# at a variant (e.g. a reverted parser) to prove this test goes red on re-rot.
CHECK="${CHECK_HANDOFF:-$ROOT/scripts/check_handoff.py}"
SB="$(mktemp -d)"
trap 'rm -rf "$SB"' EXIT
fails=0
ok()  { printf 'ok   - %s\n' "$1"; }
bad() { printf 'FAIL - %s\n' "$1"; fails=$((fails+1)); }

CODE="$SB/code"
git init -q "$CODE"
cd "$CODE"
git config user.email t@example.com
git config user.name  tester
git symbolic-ref HEAD refs/heads/main
mkdir -p handoff/work

# a code file, so landing commits touch something outside handoff/ (the
# planning session's own handoff-only commits are not merge evidence).
printf 'export const app = 1\n' > app.js
# req-200: genuinely shipped — BUILT AND MERGED + a real landing commit below.
printf '# req-200\n\n**Status: BUILT AND MERGED, 2026-01-01.**\nShipped thing.\n' \
  > handoff/work/req-200-shipped-thing.md
# req-201: genuinely pending — READY, never landed. The control.
printf '# req-201\n\n**Status: READY** — not built yet.\n' \
  > handoff/work/req-201-pending-thing.md
git add -A && git commit -qm init
# the landing commit for req-200: subject names it as its own, touches code.
printf 'export const app = 2\n' > app.js
git commit -qam "req-200: ship the thing"

set_now() { printf '%s' "$1" > "$CODE/handoff/NOW.md"; ( cd "$CODE" && git add -A && git commit -qm now ); }
run_check() { python3 "$CHECK" --repo "$CODE" --ref HEAD 2>&1; }

# --- the three NOW.md layouts ------------------------------------------------
NOW_DRIFT_READY='# Now

Updated. **Shipped: req-01.**

## Next — READY, held for go

**IN FLIGHT:** nothing right now.

**READY, held:**
- `req-200` a shipped req wrongly still parked here as if pending
- `req-201` genuinely pending, never built

## Where to read

nothing
'

NOW_DRIFT_NEEDS='# Now

Updated. **Shipped: req-01.**

## Needs decisions — parked until their phase

- `req-200` a shipped req wrongly parked under a decision
- `req-201` genuinely pending

## Where to read

nothing
'

NOW_CORRECT='# Now

Updated. **Shipped: req-200.** req-201 still pending.

## Next — READY, held for go

**READY, held:**
- `req-201` genuinely pending, never built

## Where to read

nothing
'

# --- 1. drift under "**READY, held:**" -> MUST fire for req-200 --------------
set_now "$NOW_DRIFT_READY"
out="$(run_check)"; rc=$?
{ [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'req-200' \
    && printf '%s' "$out" | grep -q 'status'; } \
  && ok "merged req-200 under READY -> drift finding fires" \
  || bad "merged req-200 under READY should fire — rc=$rc out=[$out]"
# the pending control must stay silent even though it's under the same section
printf '%s' "$out" | grep -q 'req-201' \
  && bad "pending req-201 must NOT produce a finding (false positive) — out=[$out]" \
  || ok "pending req-201 under READY stays silent (no false positive)"

# --- 2. drift under "## Needs decisions" -> MUST fire for req-200 ------------
set_now "$NOW_DRIFT_NEEDS"
out="$(run_check)"; rc=$?
{ [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'req-200'; } \
  && ok "merged req-200 under Needs decisions -> drift finding fires" \
  || bad "merged req-200 under Needs decisions should fire — rc=$rc out=[$out]"

# --- 3. correct layout -> silent (no false positive) ------------------------
set_now "$NOW_CORRECT"
out="$(run_check)"; rc=$?
{ [ $rc -eq 0 ] && [ -z "$out" ]; } \
  && ok "req-200 only under Shipped summary -> check clean (no finding)" \
  || bad "correct layout should be clean — rc=$rc out=[$out]"

# --- 4. revert-proof: with the OLD regex-only parser, the drift is NOT caught.
# This is what makes case 1 load-bearing: revert parse_now_md_claims to the
# pre-req-101 form and the READY-drift finding disappears -> case 1 goes red.
set_now "$NOW_DRIFT_READY"
reverted_out="$(python3 - "$ROOT/scripts" "$CODE" <<'PY'
import sys
sys.path.insert(0, sys.argv[1])
import check_handoff as c
def old_regex_only(now_md_text):
    claims = {}
    for m in c.DONE_LINE_RE.finditer(now_md_text):
        for r in c.REQID_RE.findall(m.group(1)):
            claims[r] = "merged"
    for m in c.QUEUE_LINE_RE.finditer(now_md_text):
        claims[m.group(1)] = m.group(2).lower()
    return claims
c.parse_now_md_claims = old_regex_only
for f in c.run_checks(sys.argv[2], "HEAD"):
    if f.severity == "fail":
        print(f)
PY
)"
printf '%s' "$reverted_out" | grep -q 'req-200' \
  && bad "old regex-only parser unexpectedly caught the drift — out=[$reverted_out]" \
  || ok "old regex-only parser misses the drift (proves the fix is load-bearing)"

# ----------------------------------------------------------------------------
if [ "$fails" -eq 0 ]; then
  printf '\nall passed\n'; exit 0
else
  printf '\n%d FAILED\n' "$fails"; exit 1
fi
