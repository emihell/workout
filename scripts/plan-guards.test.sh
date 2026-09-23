#!/usr/bin/env bash
# req-100 — regression test for the two `plan` guards:
#   1. `plan ping req-N` refuses unless the req doc is on main AND planning is
#      fully published (main..planning empty), else prints a ready-to-paste ping.
#   2. `plan save` refuses BEFORE committing when handoff/NOW.md exceeds its own
#      ≤NOW_MD_RULE_LIMIT-line rule (limit read from check_handoff.py, not hardcoded).
#
# These paths can't be exercised against the live repo without writing to the
# planning branch, so this builds a throwaway two-worktree git repo, copies the
# real `plan` + `scripts/check_handoff.py` into it, and drives the scenarios.
# Deterministic; run: bash scripts/plan-guards.test.sh
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
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
mkdir -p scripts handoff/work
cp "$ROOT/plan" ./plan
cp "$ROOT/scripts/check_handoff.py" scripts/check_handoff.py
printf '# Now\n\nUpdated. **Shipped: req-01.**\n' > handoff/NOW.md
printf '# spec\n' > handoff/work/req-050-onmain.md
git add -A
git commit -qm init
PLAN="$CODE/plan"

PLAN_WT="$SB/planning"
git worktree add -q -b planning "$PLAN_WT"

echo "# ping — doc on main + planning published → success"
out="$(cd "$CODE" && "$PLAN" ping req-050 2>&1)"; rc=$?
{ [ $rc -eq 0 ] && printf '%s' "$out" | grep -q 'ready to hand off'; } \
  && ok "ping req-050 succeeds (exit 0, prints ping)" \
  || bad "ping req-050 should succeed — rc=$rc out=$out"

echo "# ping — bad id / missing doc"
out="$(cd "$CODE" && "$PLAN" ping foo 2>&1)"; rc=$?
{ [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'not a requirement id'; } \
  && ok "ping foo → 'not a requirement id'" || bad "ping foo — rc=$rc out=$out"
out="$(cd "$CODE" && "$PLAN" ping req-999 2>&1)"; rc=$?
{ [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'no requirement doc'; } \
  && ok "ping req-999 → 'no requirement doc'" || bad "ping req-999 — rc=$rc out=$out"

echo "# ping — doc committed on planning but NOT on main (R1/L-019) → refuse"
( cd "$PLAN_WT" && printf '# spec\n' > handoff/work/req-060-unpublished.md \
    && git add -A && git commit -qm "req-060 spec" )
out="$(cd "$CODE" && "$PLAN" ping req-060 2>&1)"; rc=$?
{ [ $rc -ne 0 ] \
    && printf '%s' "$out" | grep -q 'refusing' \
    && printf '%s' "$out" | grep -q 'not on main' \
    && printf '%s' "$out" | grep -q './plan publish'; } \
  && ok "ping req-060 refuses, names 'not on main', points to publish (exit $rc)" \
  || bad "ping req-060 should refuse+point to publish — rc=$rc out=$out"

echo "# ping — doc uncommitted in planning worktree, planning published → refuse"
( cd "$CODE" && git merge -q planning --no-edit )
( cd "$PLAN_WT" && git merge -q --ff-only main \
    && printf '# spec\n' > handoff/work/req-070-uncommitted.md )
out="$(cd "$CODE" && "$PLAN" ping req-070 2>&1)"; rc=$?
{ [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'not on main'; } \
  && ok "ping req-070 (uncommitted doc, planning published) refuses on 'not on main' (exit $rc)" \
  || bad "ping req-070 should refuse — rc=$rc out=$out"
( cd "$PLAN_WT" && rm -f handoff/work/req-070-uncommitted.md )

echo "# save — NOW.md over the limit → refuse, commit nothing, working tree untouched"
before="$(cd "$PLAN_WT" && git rev-parse HEAD)"
( cd "$PLAN_WT" && printf 'line %d\n' $(seq 1 51) > handoff/NOW.md )
out="$(cd "$PLAN_WT" && "$PLAN" save "should be blocked" 2>&1)"; rc=$?
after="$(cd "$PLAN_WT" && git rev-parse HEAD)"
status="$(cd "$PLAN_WT" && git status --porcelain handoff/NOW.md)"
{ [ $rc -ne 0 ] \
    && printf '%s' "$out" | grep -q 'refusing' \
    && printf '%s' "$out" | grep -q '51 lines' \
    && [ "$before" = "$after" ] \
    && printf '%s' "$status" | grep -q '^ M handoff/NOW.md'; } \
  && ok "save refuses at 51 lines, no new commit, NOW.md still modified/unstaged (exit $rc)" \
  || bad "save should block at 51 lines — rc=$rc same_head=$([ "$before" = "$after" ] && echo y || echo n) status='$status' out=$out"

echo "# save — NOW.md at exactly the limit (50) → proceeds and commits"
before="$(cd "$PLAN_WT" && git rev-parse HEAD)"
( cd "$PLAN_WT" && printf 'line %d\n' $(seq 1 50) > handoff/NOW.md )
out="$(cd "$PLAN_WT" && "$PLAN" save "at limit ok" 2>&1)"; rc=$?
after="$(cd "$PLAN_WT" && git rev-parse HEAD)"
{ [ $rc -eq 0 ] && [ "$before" != "$after" ] && printf '%s' "$out" | grep -q 'committed'; } \
  && ok "save at 50 lines commits normally (exit $rc)" \
  || bad "save at 50 lines should commit — rc=$rc out=$out"

echo "# publish — a build agent's worktree NESTED in the code worktree, on req-120 (req-129)"
# The real layout: workout-codebase/.claude/worktrees/agent-*/ on a req branch,
# listed after the code + planning worktrees. Before req-129 the last listed
# non-planning worktree won, so publish refused "code worktree is on 'req-120'".
# ./check is stubbed green (the fixture has no app); .claude/worktrees/ is
# ignored as in the real repo, so the nested checkout doesn't dirty main.
( cd "$CODE" && printf '#!/usr/bin/env bash\necho "check: stub green"\n' > check && chmod +x check \
    && printf '.claude/worktrees/\n' > .gitignore && git add -A && git commit -qm "check stub" )
mkdir -p "$CODE/.claude/worktrees"
git -C "$CODE" worktree add -q -b req-120 "$CODE/.claude/worktrees/zz-agent-req120"
# L-020: prove the fixture reproduces the bug — the pre-req-129 rule ("last
# non-planning branch worktree wins") must pick the nested one here.
old_pick="$(git -C "$CODE" worktree list --porcelain | awk '
  /^worktree /{p=substr($0,10)} /^branch refs\/heads\//{ if ($2!="refs/heads/planning") c=p } END{print c}')"
case "$old_pick" in */.claude/worktrees/zz-agent-req120) ok "fixture: the old last-wins rule picks the nested req-120 worktree (bug reproduced)";;
  *) bad "fixture: old rule should pick the nested worktree, got '$old_pick'";; esac
( cd "$PLAN_WT" && printf '# doc\n' > handoff/work/req-080-nested.md && git add -A && git commit -qm "req-080 spec" )
out="$(cd "$PLAN_WT" && "$PLAN" publish 2>&1)"; rc=$?
{ [ $rc -eq 0 ] \
    && ! printf '%s' "$out" | grep -q "is on 'req-120'" \
    && printf '%s' "$out" | grep -q 'plan publish: merged' \
    && git -C "$CODE" cat-file -e main:handoff/work/req-080-nested.md; } \
  && ok "publish picks the top-level code worktree on main, skips the nested req-120 one (exit $rc)" \
  || bad "publish should skip the nested worktree — rc=$rc out=$out"
out="$(cd "$CODE" && "$PLAN" status 2>&1)"; rc=$?
[ $rc -eq 0 ] && ok "status also runs with the nested worktree present (exit $rc)" || bad "status — rc=$rc out=$out"
git -C "$CODE" worktree remove --force "$CODE/.claude/worktrees/zz-agent-req120"

echo
if [ "$fails" -eq 0 ]; then echo "plan-guards: all checks passed."; else echo "plan-guards: $fails FAILED"; exit 1; fi
