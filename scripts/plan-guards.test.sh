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
SB="$(cd "$(mktemp -d)" && pwd -P)"   # physical path: `git worktree list` prints it so (req-253)
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
# req-257: PLAN_SRC=<path> runs the suite against another copy of `plan` (the self-test
# against main's). Default: this checkout's.
PLAN_SRC="${PLAN_SRC:-$ROOT/plan}"
cp "$PLAN_SRC" ./plan
cp "$ROOT/scripts/check_handoff.py" scripts/check_handoff.py
cp "$ROOT/scripts/dec_index.py" scripts/dec_index.py   # req-271: check_handoff imports it; plan save runs it
cp "$ROOT/.nvmrc" .nvmrc   # req-257: ping now prints `plan brief`, which reads .nvmrc
printf '# Now\n\nUpdated. **Shipped: req-01.**\n**Next:** build req-050 (fixture)\n' > handoff/NOW.md
printf '# spec\n' > handoff/work/req-050-onmain.md
# req-272: the doc-size ratchet's table (missing = a failure); one fixture rule doc, 3 lines, ceiling 3.
mkdir -p handoff/rules
printf 'a\nb\nc\n' > handoff/rules/RULE.md
printf '{ "docs": { "handoff/rules/RULE.md": { "ceiling": 3, "reason": "fixture baseline" } } }\n' > scripts/doc_limits.json
git add -A
git commit -qm init
PLAN="$CODE/plan"

PLAN_WT="$SB/planning"
git worktree add -q -b planning "$PLAN_WT"

echo "# next — both worktrees clean, planning published (req-250) → CLEAN POINT + NOW.md's Next text"
out="$(cd "$CODE" && "$PLAN" next 2>&1)"; rc=$?
{ [ $rc -eq 0 ] \
    && printf '%s' "$out" | grep -q '^CLEAN POINT — good time to /clear. Then paste:$' \
    && printf '%s' "$out" | grep -qF '  Planner: resume from handoff/NOW.md (Next: build req-050 (fixture))'; } \
  && ok "next, clean + published: prints CLEAN POINT and the Next line from main (exit $rc)" \
  || bad "next should print CLEAN POINT — rc=$rc out=$out"
printf '%s\n' "$out" | sed 's/^/    | /'

# req-253: the Next is a paragraph. Each case commits a NOW.md to main (main ahead of planning
# is still a clean point) and resets main back afterwards.
next_with_now() {  # $1 = NOW.md text; prints `plan next`'s output
  ( cd "$CODE" && printf '%s' "$1" > handoff/NOW.md && git commit -qam "now fixture" )
  ( cd "$CODE" && "$PLAN" next 2>&1 )
  git -C "$CODE" reset -q --hard HEAD~1
}
echo "# next — req-253: a two-line Next paragraph is joined, up to the blank line"
out="$(next_with_now $'# Now\n\n**Next:** a b\ncontinued c\n\n## X\nnot this\n')"
printf '%s' "$out" | grep -qxF '  Planner: resume from handoff/NOW.md (Next: a b continued c)' \
  && ok "next, two-line Next: prints '(Next: a b continued c)'" \
  || bad "next two-line Next — out=$out"
printf '%s\n' "$out" | grep 'Planner:' | sed 's/^/    | /'
echo "# next — req-253 failure case: the paragraph stops at a '- ' bullet or a '**' line"
out="$(next_with_now $'**Next:** a b\ncontinued c\n- bullet\nmore\n')"
printf '%s' "$out" | grep -qxF '  Planner: resume from handoff/NOW.md (Next: a b continued c)' \
  && ok "next stops before '- bullet'" || bad "next must stop at '- bullet' — out=$out"
printf '%s\n' "$out" | grep 'Planner:' | sed 's/^/    | /'
out="$(next_with_now $'**Next:** a b\ncontinued c\n**Other:** no\n')"
printf '%s' "$out" | grep -qxF '  Planner: resume from handoff/NOW.md (Next: a b continued c)' \
  && ok "next stops before '**Other:**'" || bad "next must stop at '**Other:**' — out=$out"
printf '%s\n' "$out" | grep 'Planner:' | sed 's/^/    | /'
out="$(next_with_now $'**Next:** a b\ncontinued c\n# Heading\n')"
printf '%s' "$out" | grep -qxF '  Planner: resume from handoff/NOW.md (Next: a b continued c)' \
  && ok "next stops before '# Heading'" || bad "next must stop at '# Heading' — out=$out"

echo "# next — planning tree dirty (req-250 failure case) → no CLEAN POINT"
( cd "$PLAN_WT" && printf 'scratch\n' > handoff/scratch.md )
out="$(cd "$CODE" && "$PLAN" next 2>&1)"; rc=$?
{ [ $rc -eq 0 ] && printf '%s' "$out" | grep -q 'planning has unsaved edits' \
    && ! printf '%s' "$out" | grep -q 'CLEAN POINT'; } \
  && ok "next, dirty planning: 'unsaved edits', no CLEAN POINT" \
  || bad "next with dirty planning must not print CLEAN POINT — rc=$rc out=$out"
printf '%s\n' "$out" | sed 's/^/    | /'
rm -f "$PLAN_WT/handoff/scratch.md"

echo "# next — planning commit not on main → no CLEAN POINT"
( cd "$PLAN_WT" && printf '# x\n' > handoff/unpub.md && git add -A && git commit -qm unpub )
out="$(cd "$CODE" && "$PLAN" next 2>&1)"; rc=$?
{ printf '%s' "$out" | grep -q 'not on main' && ! printf '%s' "$out" | grep -q 'CLEAN POINT'; } \
  && ok "next, unpublished planning: points to publish, no CLEAN POINT" \
  || bad "next with unpublished planning must not print CLEAN POINT — rc=$rc out=$out"
( cd "$PLAN_WT" && git reset -q --hard HEAD~1 )

echo "# ping — doc on main + planning published → success"
out="$(cd "$CODE" && "$PLAN" ping req-050 2>&1)"; rc=$?
{ [ $rc -eq 0 ] && printf '%s' "$out" | grep -q 'ready to hand off'; } \
  && ok "ping req-050 succeeds (exit 0, prints ping)" \
  || bad "ping req-050 should succeed — rc=$rc out=$out"

echo "# ping — req-257: success prints 'ready to hand off' + plan brief's prompt, byte for byte"
ping_out="$(cd "$CODE" && "$PLAN" ping req-050 2>/dev/null)"
brief_out="$(cd "$CODE" && "$PLAN" brief req-050 2>/dev/null)"
printf '%s\n' "$ping_out" | head -1 | grep -qxF 'plan ping: req-050 is on main and planning is fully published — ready to hand off.' \
  && ok "ping first line: 'ready to hand off'" || bad "ping first line — got [$(printf '%s\n' "$ping_out" | head -1)]"
[ -n "$brief_out" ] && [ "$(printf '%s\n' "$ping_out" | tail -n +2)" = "$brief_out" ] \
  && ok "ping after its first line == plan brief req-050, byte for byte" \
  || { bad "ping body differs from plan brief:"; diff <(printf '%s\n' "$ping_out" | tail -n +2) <(printf '%s\n' "$brief_out") | sed 's/^/    | /'; }
printf '%s' "$ping_out" | grep -qF 'handoff/BUILDER.md' \
  && ok "ping names handoff/BUILDER.md" || bad "ping must name handoff/BUILDER.md"
n_mech="$(printf '%s\n' "$ping_out" | grep -c 'PATH=\|node_modules\|commit early\|do not merge')"
[ "$n_mech" = 4 ] && ok "ping carries the four mechanical lines (grep -c = 4)" || bad "ping mechanical lines: $n_mech, want 4"
printf '%s\n' "$ping_out" | sed 's/^/    | /'

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
( cd "$PLAN_WT" && { printf 'line %d\n' $(seq 1 49); printf '**Next:** fixture\n'; } > handoff/NOW.md )  # 50 lines; req-250's Next line keeps later `status` drift-clean
out="$(cd "$PLAN_WT" && "$PLAN" save "at limit ok" 2>&1)"; rc=$?
after="$(cd "$PLAN_WT" && git rev-parse HEAD)"
{ [ $rc -eq 0 ] && [ "$before" != "$after" ] && printf '%s' "$out" | grep -q 'committed'; } \
  && ok "save at 50 lines commits normally (exit $rc)" \
  || bad "save at 50 lines should commit — rc=$rc out=$out"

echo "# save — req-272: a rule doc 1 line past its ceiling → refuse before staging, working tree untouched"
before="$(cd "$PLAN_WT" && git rev-parse HEAD)"
( cd "$PLAN_WT" && printf 'd\n' >> handoff/rules/RULE.md )
out="$(cd "$PLAN_WT" && "$PLAN" save "should be blocked" 2>&1)"; rc=$?
after="$(cd "$PLAN_WT" && git rev-parse HEAD)"
status="$(cd "$PLAN_WT" && git status --porcelain handoff/rules/RULE.md)"
{ [ $rc -ne 0 ] && [ "$before" = "$after" ] \
    && printf '%s' "$out" | grep -q 'plan save: refusing — the doc-size ratchet' \
    && printf '%s' "$out" | grep -qF 'handoff/rules/RULE.md — is 4 lines, over its ceiling of 3' \
    && [ "$status" = ' M handoff/rules/RULE.md' ] \
    && [ -z "$(git -C "$PLAN_WT" diff --cached --name-only)" ]; } \
  && ok "save refuses at ceiling+1: no commit, nothing staged, RULE.md still ' M' (exit $rc)" \
  || bad "save should refuse past the ceiling — rc=$rc status='$status' out=$out"
printf '%s\n' "$out" | sed 's/^/    | /'

echo "# save — req-272: the ceiling raised with an empty reason → refuse; with a new reason → commits table + doc"
( cd "$PLAN_WT" && printf '{ "docs": { "handoff/rules/RULE.md": { "ceiling": 4, "reason": "" } } }\n' > scripts/doc_limits.json )
out="$(cd "$PLAN_WT" && "$PLAN" save "should be blocked" 2>&1)"; rc=$?
{ [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'empty "reason"'; } \
  && ok "save refuses a raise with an empty reason (exit $rc)" || bad "empty reason should refuse — rc=$rc out=$out"
( cd "$PLAN_WT" && printf '{ "docs": { "handoff/rules/RULE.md": { "ceiling": 4, "reason": "fixture baseline" } } }\n' > scripts/doc_limits.json )
out="$(cd "$PLAN_WT" && "$PLAN" save "should be blocked" 2>&1)"; rc=$?
{ [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'ceiling raised 3 → 4 with the old "reason"'; } \
  && ok "save refuses a raise that keeps the old reason (exit $rc)" || bad "same-reason raise should refuse — rc=$rc out=$out"
( cd "$PLAN_WT" && printf '{ "docs": { "handoff/rules/RULE.md": { "ceiling": 4, "reason": "fixture: a 4th rule line" } } }\n' > scripts/doc_limits.json )
out="$(cd "$PLAN_WT" && "$PLAN" save "raise RULE ceiling" 2>&1)"; rc=$?
files="$(git -C "$PLAN_WT" show --name-only --format= HEAD)"
{ [ $rc -eq 0 ] && printf '%s' "$out" | grep -q 'committed' \
    && printf '%s\n' "$files" | grep -qx 'scripts/doc_limits.json' \
    && printf '%s\n' "$files" | grep -qx 'handoff/rules/RULE.md'; } \
  && ok "save with a reasoned raise commits the table and the doc together (exit $rc)" \
  || bad "a reasoned raise should commit — rc=$rc files=$files out=$out"

echo "# save — req-272: scripts/ files other than doc_limits.json are still refused"
( cd "$PLAN_WT" && printf 'x\n' > scripts/other.txt )
out="$(cd "$PLAN_WT" && "$PLAN" save "should be blocked" 2>&1)"; rc=$?
{ [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'scripts/other.txt' && ! printf '%s' "$out" | grep -q 'doc_limits'; } \
  && ok "save still refuses scripts/other.txt outside handoff/ (exit $rc)" || bad "other scripts/ file should refuse — rc=$rc out=$out"
( cd "$PLAN_WT" && rm -f scripts/other.txt )

echo "# doctor — req-272: grants without git commit/reset → ok; the old ten-grant file → FIX + the line to paste"
mkdir -p "$PLAN_WT/.claude"
new_line="$(grep -E "^printf '%s\\\\n' '\\{ \"permissions\"" "$ROOT/README.md")"
( cd "$PLAN_WT" && eval "${new_line/..\/workout-planning\/.claude\/settings.local.json/.claude/settings.local.json}" )
out="$(cd "$CODE" && "$PLAN" doctor 2>&1)"
printf '%s\n' "$out" | grep -q '^ok   grants — .* matches all 12 canonical grants' \
  && ok "doctor: README's grant line (no git commit/reset) → ok grants" \
  || bad "doctor should accept README's grant line — $(printf '%s\n' "$out" | grep grants)"
printf '%s\n' "$out" | grep 'grants' | sed 's/^/    | /'
printf '%s\n' '{ "permissions": { "allow": [ "Bash(git add:*)", "Bash(git commit:*)", "Bash(git reset:*)", "Bash(git restore:*)", "Bash(git push origin planning:*)", "Bash(git push origin main planning:*)", "Bash(../workout-codebase/plan save:*)", "Bash(../workout-codebase/plan status:*)", "Bash(../workout-codebase/plan publish:*)", "Bash(../workout-codebase/plan closeout:*)" ] } }' > "$PLAN_WT/.claude/settings.local.json"
out="$(cd "$CODE" && "$PLAN" doctor 2>&1)"
paste="$(printf '%s\n' "$out" | grep -A2 '^FIX: grants' | tail -1 | sed 's/^     //')"
{ printf '%s\n' "$out" | grep -q '^FIX: grants — missing: Bash(./plan closeout:\*)' \
    && printf '%s\n' "$out" | grep -q 'extra: Bash(git commit:\*), Bash(git reset:\*)' \
    && [ "${paste%% > *}" = "${new_line%% > *}" ]; } \
  && ok "doctor: the old file → FIX: grants, and the printed paste line carries README's JSON" \
  || bad "doctor old grants — paste=[$paste] out=$(printf '%s\n' "$out" | grep -A2 grants)"
printf '%s\n' "$out" | grep -A2 '^FIX: grants' | sed 's/^/    | /'
( cd "$PLAN_WT" && eval "$paste" )
out="$(cd "$CODE" && "$PLAN" doctor 2>&1)"
printf '%s\n' "$out" | grep -q '^ok   grants' \
  && ok "doctor: running the printed paste line → ok grants" || bad "the printed line should fix it — $(printf '%s\n' "$out" | grep grants)"
rm -rf "$PLAN_WT/.claude"

echo "# save — req-271: a changed handoff/log/decisions/ file → the DEC index is regenerated into the commit"
( cd "$PLAN_WT" && mkdir -p handoff/log/decisions \
    && printf '# Decisions\n\n## Current rules digest\n\n- a rule → **DEC-001**\n\n---\n\n## Decision index\n\n(stale)\n' > handoff/log/DECISIONS.md \
    && printf '## DEC-001 — a fixture rule  (2026-10-31)\n\nBody.\n' > handoff/log/decisions/DEC-001-050.md )
out="$(cd "$PLAN_WT" && "$PLAN" save "dec fixture" 2>&1)"; rc=$?
idx="$(git -C "$PLAN_WT" show HEAD:handoff/log/DECISIONS.md)"
{ [ $rc -eq 0 ] && printf '%s' "$out" | grep -q 'dec_index: wrote the index' \
    && printf '%s\n' "$idx" | grep -qxF -- '- DEC-001 · 2026-10-31 · a fixture rule · live' \
    && ! printf '%s' "$idx" | grep -q '(stale)' \
    && [ -z "$(git -C "$PLAN_WT" status --porcelain)" ]; } \
  && ok "save regenerated the index and committed it (exit $rc)" \
  || bad "save should regenerate the DEC index — rc=$rc out=$out idx=$idx"

echo "# save — req-271 failure case: a malformed range-file heading → refuse, commit nothing, index untouched"
before="$(cd "$PLAN_WT" && git rev-parse HEAD)"
( cd "$PLAN_WT" && printf '\n## DEC-2 — two-digit id  (2026-10-31)\n' >> handoff/log/decisions/DEC-001-050.md )
out="$(cd "$PLAN_WT" && "$PLAN" save "should be blocked" 2>&1)"; rc=$?
after="$(cd "$PLAN_WT" && git rev-parse HEAD)"
{ [ $rc -ne 0 ] && [ "$before" = "$after" ] \
    && printf '%s' "$out" | grep -q 'DEC-001-050.md:5: malformed heading' \
    && printf '%s' "$out" | grep -q 'plan save: refusing' \
    && [ -z "$(git -C "$PLAN_WT" status --porcelain handoff/log/DECISIONS.md)" ] \
    && [ -z "$(git -C "$PLAN_WT" diff --cached --name-only)" ]; } \
  && ok "save refuses on a malformed DEC heading: no commit, nothing staged, DECISIONS.md unchanged (exit $rc)" \
  || bad "save should refuse a malformed DEC heading — rc=$rc out=$out"
( cd "$PLAN_WT" && git checkout -q -- handoff/log/decisions/DEC-001-050.md )
# The later cases' fixture has no DEC log: remove it, or check_handoff's DEC checks report every
# DEC id in the copied `plan` as dangling against this one-entry fixture.
( cd "$PLAN_WT" && git rm -rq handoff/log && git commit -qm "drop dec fixture" )

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

echo "# publish — req-272: a planning commit past a ceiling (committed around save) → refuse, nothing merged"
( cd "$PLAN_WT" && printf 'e\n' >> handoff/rules/RULE.md && git add -A && HANDOFF=1 git commit -qm "grow past ceiling" )
before="$(git -C "$CODE" rev-parse main)"
out="$(cd "$PLAN_WT" && "$PLAN" publish 2>&1)"; rc=$?
{ [ $rc -ne 0 ] && [ "$before" = "$(git -C "$CODE" rev-parse main)" ] \
    && printf '%s' "$out" | grep -q 'plan publish: refusing — the doc-size ratchet failed on planning' \
    && printf '%s' "$out" | grep -qF 'RULE.md — is 5 lines, over its ceiling of 4'; } \
  && ok "publish refuses past a ceiling, main unmoved (exit $rc)" || bad "publish should refuse — rc=$rc out=$out"
printf '%s\n' "$out" | grep -A1 'ratchet' | sed 's/^/    | /'
( cd "$PLAN_WT" && git reset -q --hard HEAD~1 )

echo "# save — local planning BEHIND origin/planning (req-249) → refuse, commit nothing; level → commits"
# A fake origin (bare repo in the sandbox) and a second clone that pushes one commit to its
# planning: the sandbox's local planning is then one behind after save's own fetch.
ORIGIN="$SB/origin.git"
git init -q --bare "$ORIGIN"
git -C "$CODE" remote add origin "$ORIGIN"
git -C "$CODE" push -q origin main planning
OTHER="$SB/other"
git clone -q -b planning "$ORIGIN" "$OTHER"
( cd "$OTHER" && git config user.email t@example.com && git config user.name tester \
    && printf '# other session\n' > handoff/work/req-090-other.md && git add -A && git commit -qm "other session" && git push -q origin planning )
before="$(cd "$PLAN_WT" && git rev-parse HEAD)"
( cd "$PLAN_WT" && printf '# mine\n' > handoff/work/req-091-mine.md )
out="$(cd "$PLAN_WT" && "$PLAN" save "should be blocked: behind" 2>&1)"; rc=$?
after="$(cd "$PLAN_WT" && git rev-parse HEAD)"
staged="$(cd "$PLAN_WT" && git diff --cached --name-only)"
{ [ $rc -eq 1 ] && [ "$before" = "$after" ] && [ -z "$staged" ] \
    && printf '%s' "$out" | grep -q '1 commit(s) BEHIND origin/planning' \
    && printf '%s' "$out" | grep -q 'git log --oneline planning..origin/planning' \
    && printf '%s' "$out" | grep -q 'plan save: refusing — local planning is 1 commit(s) behind'; } \
  && ok "save refuses when planning is 1 behind origin/planning: exit 1, no commit, nothing staged" \
  || bad "save should refuse when behind — rc=$rc same_head=$([ "$before" = "$after" ] && echo y || echo n) staged='$staged' out=$out"
printf '%s\n' "$out" | sed 's/^/    | /'
( cd "$PLAN_WT" && git merge -q --ff-only origin/planning )
before="$(cd "$PLAN_WT" && git rev-parse HEAD)"
out="$(cd "$PLAN_WT" && "$PLAN" save "level with origin" 2>&1)"; rc=$?
after="$(cd "$PLAN_WT" && git rev-parse HEAD)"
{ [ $rc -eq 0 ] && [ "$before" != "$after" ] && printf '%s' "$out" | grep -q 'committed'; } \
  && ok "save commits once level with origin/planning (exit $rc)" \
  || bad "save level with origin should commit — rc=$rc out=$out"
printf '%s\n' "$out" | sed 's/^/    | /'
( cd "$PLAN_WT" && git reset -q --hard HEAD~2 )   # behind origin/planning by one again
out="$(cd "$CODE" && "$PLAN" status 2>&1)"; rc=$?
{ [ $rc -eq 0 ] && printf '%s' "$out" | grep -q 'BEHIND origin/planning'; } \
  && ok "status, 1 behind, still only warns (exit $rc)" || bad "status should only warn — rc=$rc out=$out"

echo "# brief — req-251: the dispatch prompt (req path, base, BUILDER.md, the four mechanical lines)"
# A fake HOME with three installed nodes: .nvmrc "22.23" must resolve to the highest v22.23.x
# (v22.23.4), never v22.230.0 (a prefix of the string, not of the version).
FAKEHOME="$SB/home"
mkdir -p "$FAKEHOME/.nvm/versions/node/v22.23.1" "$FAKEHOME/.nvm/versions/node/v22.23.4" "$FAKEHOME/.nvm/versions/node/v22.230.0"
( cd "$CODE" && printf '22.23\n' > .nvmrc && git add -A && git commit -qm "nvmrc" )
out="$(cd "$CODE" && HOME="$FAKEHOME" "$PLAN" brief req-050 --base main 2>&1)"; rc=$?
count="$(printf '%s\n' "$out" | grep -c 'PATH=\|node_modules\|commit early\|do not merge')"
{ [ $rc -eq 0 ] && [ "$count" -eq 4 ] \
    && printf '%s' "$out" | grep -qF 'handoff/work/req-050-onmain.md' \
    && printf '%s' "$out" | grep -qF 'git checkout -b req-050 main' \
    && printf '%s' "$out" | grep -qF 'Read handoff/BUILDER.md first and follow it' \
    && printf '%s' "$out" | grep -qF 'export PATH="$HOME/.nvm/versions/node/v22.23.4/bin:$PATH"' \
    && printf '%s' "$out" | grep -qF "ln -s $CODE/node_modules node_modules" \
    && printf '%s' "$out" | grep -qF "no deps dir in $CODE"; } \
  && ok "brief req-050: 4 mechanical lines (no-deps warning included), req path, base main, BUILDER.md, node v22.23.4, main worktree's path (exit $rc)" \
  || bad "brief req-050 — rc=$rc count=$count out=$out"
printf '%s\n' "$out" | sed 's/^/    | /'
echo "# brief — req-253: an extra top-level worktree on another branch, listed after main, is not the code dir"
EXTRA="$SB/extra"
git -C "$CODE" worktree add -q -b scratch "$EXTRA" main
mkdir "$CODE/node_modules"   # untracked here: the fixture has no .gitignore, so cleaned up below
out="$(cd "$EXTRA" && HOME="$FAKEHOME" "$PLAN" brief req-050 --base main 2>&1)"; rc=$?
count="$(printf '%s\n' "$out" | grep -c 'PATH=\|node_modules\|commit early\|do not merge')"
{ [ $rc -eq 0 ] && [ "$count" -eq 4 ] \
    && printf '%s' "$out" | grep -qF "ln -s $CODE/node_modules node_modules" \
    && ! printf '%s' "$out" | grep -qF "$EXTRA" \
    && ! printf '%s' "$out" | grep -q 'no deps dir'; } \
  && ok "brief from the extra worktree names main's path, no warning with deps present (exit $rc)" \
  || bad "brief with extra worktree — rc=$rc count=$count out=$out"
printf '%s\n' "$out" | grep 'ln -s' | sed 's/^/    | /'
rmdir "$CODE/node_modules"
git -C "$CODE" worktree remove --force "$EXTRA" && git -C "$CODE" branch -q -D scratch
out="$(cd "$CODE" && HOME="$FAKEHOME" "$PLAN" brief 050 --base planning 2>&1)"; rc=$?
{ [ $rc -eq 0 ] && printf '%s' "$out" | grep -qF 'git checkout -b req-050 planning'; } \
  && ok "brief 050 --base planning: names the base (exit $rc)" || bad "brief --base — rc=$rc out=$out"
out="$(cd "$CODE" && "$PLAN" brief 999 2>&1)"; rc=$?
{ [ $rc -eq 1 ] && printf '%s' "$out" | grep -q 'no requirement doc'; } \
  && ok "brief 999 → exit 1, 'no requirement doc'" || bad "brief 999 — rc=$rc out=$out"
out="$(cd "$CODE" && "$PLAN" brief 050 --base no-such-ref 2>&1)"; rc=$?
[ $rc -eq 1 ] && ok "brief --base no-such-ref → exit 1" || bad "brief bad base — rc=$rc out=$out"

echo "# closeout — req-251: refuse BEFORE merging unless reports/req-N.md has its receipts"
# Planning level with origin again (the save scenario left it one behind), the req doc on
# planning, and a req-095 branch whose report is rewritten per case. main must not move on a
# refusal; the complete report proceeds past the check (and, in this fixture, all the way).
( cd "$PLAN_WT" && git merge -q --ff-only origin/planning \
    && printf '# req-095 — receipts fixture\n\n**Status: READY**\n' > handoff/work/req-095-receipts.md \
    && git add -A && git commit -qm "req-095 spec" )
git -C "$CODE" checkout -q -b req-095
( cd "$CODE" && mkdir -p reports && printf 'feature\n' > feature.txt && printf '# req-095\n' > reports/req-095.md \
    && git add -A && git commit -qm "req-095 work" )
git -C "$CODE" checkout -q main
set_report() {  # $1 = the report text, or ABSENT to delete it; amends req-095's tip, back on main
  git -C "$CODE" checkout -q req-095
  if [ "$1" = ABSENT ]; then
    git -C "$CODE" rm -q reports/req-095.md
  else
    mkdir -p "$CODE/reports" && printf '%s' "$1" > "$CODE/reports/req-095.md"
    git -C "$CODE" add reports/req-095.md
  fi
  git -C "$CODE" commit -qm "report" --amend
  git -C "$CODE" checkout -q main
}
FENCE='```'
refuse_case() {  # $1 label, $2 report text, $3 expected stderr fragment
  set_report "$2"
  local before after out rc
  before="$(git -C "$CODE" rev-parse main)"
  out="$(cd "$CODE" && "$PLAN" closeout req-095 2>&1)"; rc=$?
  after="$(git -C "$CODE" rev-parse main)"
  { [ $rc -eq 1 ] && [ "$before" = "$after" ] && printf '%s' "$out" | grep -qF "$3" \
      && printf '%s' "$out" | grep -q 'main untouched' \
      && git -C "$CODE" rev-parse --verify -q refs/heads/req-095 >/dev/null; } \
    && ok "closeout, $1: exit 1, main unchanged ($before), branch kept" \
    || bad "closeout, $1 — rc=$rc main $before -> $after out=$out"
  printf '%s\n' "$out" | sed 's/^/    | /'
}
refuse_case "report has no fenced block" \
  $'# req-095\n\n## What I ran\n\n./check was green.\n\n## For Emilio\n\nnothing\n' \
  '`## What I ran` has no fenced block with output in it'
refuse_case "fenced block is empty" \
  $'# req-095\n\n## What I ran\n\n'"$FENCE"$'\n\n'"$FENCE"$'\n\n## For Emilio\n\nnothing\n' \
  '`## What I ran` has no fenced block with output in it'
refuse_case "no For Emilio section (its heading only inside a fence)" \
  $'# req-095\n\n## What I ran\n\n'"$FENCE"$'\ncheck: all green\n## For Emilio\n'"$FENCE"$'\n' \
  'no `## For Emilio` section'
refuse_case "empty report" "" 'reports/req-095.md:'
refuse_case "report file absent" ABSENT 'no reports/req-095.md on req-095'
set_report $'# req-095\n\n## What I ran\n\n'"$FENCE"$'\ncheck: all green\n'"$FENCE"$'\n\n## For Emilio\n\nnothing\n'
before="$(git -C "$CODE" rev-parse main)"
out="$(cd "$CODE" && "$PLAN" closeout req-095 2>&1)"; rc=$?
{ printf '%s' "$out" | grep -qF 'reports/req-095.md has its receipts' \
    && printf '%s' "$out" | grep -qF 'merging req-095 into main' \
    && [ "$(git -C "$CODE" rev-parse main)" != "$before" ] \
    && git -C "$CODE" cat-file -e main:feature.txt; } \
  && ok "closeout with receipts: passes the check and merges (exit $rc)" \
  || bad "closeout with receipts should merge — rc=$rc out=$out"
printf '%s\n' "$out" | sed 's/^/    | /'

echo "# closeout — req-252: the last line is the DEPLOY line iff the merge touches a served path"
# $1 req id, $2 slug, $3 the path the branch changes (besides its report).
closeout_deploy_case() {
  local id="$1" slug="$2" path="$3" out rc last
  ( cd "$PLAN_WT" && printf '# %s — deploy fixture\n\n**Status: READY**\n' "$id" > "handoff/work/$id-$slug.md" \
      && git add -A && git commit -qm "$id spec" )
  git -C "$CODE" checkout -q -b "$id"
  ( cd "$CODE" && mkdir -p "$(dirname "$path")" reports && printf 'change\n' > "$path" \
      && printf '# %s\n\n## What I ran\n\n%s\ncheck: all green\n%s\n\n## For Emilio\n\nnothing\n' "$id" "$FENCE" "$FENCE" > "reports/$id.md" \
      && git add -A && git commit -qm "$id work" )
  git -C "$CODE" checkout -q main
  out="$(cd "$CODE" && "$PLAN" closeout "$id" 2>&1)"; rc=$?
  last="$(printf '%s\n' "$out" | tail -1)"
  printf '%s\t%s\t%s\n' "$rc" "$last" "$(git -C "$CODE" cat-file -e "main:$path" 2>/dev/null && echo merged || echo not-merged)"
}
res="$(closeout_deploy_case req-096 src-change src/app.js)"
rc="$(printf '%s' "$res" | cut -f1)"; last="$(printf '%s' "$res" | cut -f2)"; merged="$(printf '%s' "$res" | cut -f3)"
{ [ "$rc" -eq 0 ] && [ "$merged" = merged ] \
    && [ "$last" = 'DEPLOY (Emilio, on the server machine):  ! ./server/deploy && ./server/doctor' ]; } \
  && ok "closeout req-096 (touches src/): exit 0, last line is the DEPLOY line" \
  || bad "closeout req-096 should end with the DEPLOY line — rc=$rc merged=$merged last=[$last]"
printf '    | last line: %s\n' "$last"
res="$(closeout_deploy_case req-097 handoff-only handoff/notes.md)"
rc="$(printf '%s' "$res" | cut -f1)"; last="$(printf '%s' "$res" | cut -f2)"; merged="$(printf '%s' "$res" | cut -f3)"
{ [ "$rc" -eq 0 ] && [ "$merged" = merged ] && [ "$last" = 'no deploy needed' ]; } \
  && ok "closeout req-097 (touches only handoff/ + its report): exit 0, last line 'no deploy needed'" \
  || bad "closeout req-097 should end 'no deploy needed' — rc=$rc merged=$merged last=[$last]"
printf '    | last line: %s\n' "$last"

echo "# closeout — req-275 (a): a req doc with no **Status:** span → merge lands, WARNING, save/publish/push still run, exit 0"
( cd "$PLAN_WT" && printf '# req-098 — no-status fixture\n\nThis doc carries no status span.\n' > handoff/work/req-098-nostatus.md \
    && git add -A && git commit -qm "req-098 spec" )
git -C "$CODE" checkout -q -b req-098
( cd "$CODE" && printf 'r098\n' > r098.txt \
    && printf '# req-098\n\n## What I ran\n\n%s\ncheck: all green\n%s\n\n## For Emilio\n\nnothing\n' "$FENCE" "$FENCE" > reports/req-098.md \
    && git add -A && git commit -qm "req-098 work" )
git -C "$CODE" checkout -q main
out="$(cd "$CODE" && "$PLAN" closeout req-098 2>&1)"; rc=$?
{ [ $rc -eq 0 ] && git -C "$CODE" cat-file -e main:r098.txt \
    && printf '%s' "$out" | grep -qxF 'plan closeout: WARNING — req-098-nostatus.md has no **Status:** span; flip it by hand' \
    && printf '%s' "$out" | grep -q '^plan publish: ' \
    && [ "$(git --git-dir="$ORIGIN" rev-parse main)" = "$(git -C "$CODE" rev-parse main)" ] \
    && git --git-dir="$ORIGIN" cat-file -e main:r098.txt \
    && ! git -C "$CODE" rev-parse --verify -q refs/heads/req-098 >/dev/null; } \
  && ok "closeout req-098 (no Status span): exit 0, merged, WARNING printed, published, pushed (origin main = main), branch dropped" \
  || bad "closeout with no Status span must warn and finish — rc=$rc out=$out"
printf '%s\n' "$out" | sed 's/^/    | /'

echo "# closeout — req-275 (a): a reviewer_warning that returns 1 (re-run path) → no abort"
# Sourced under set -euo pipefail with reviewer_warning stubbed to fail, then cmd_closeout called as
# a plain statement (inside an && list set -e would be off and the test would prove nothing).
# req-096 is already merged (above), so this is the re-run path where review_warn is computed.
out="$(cd "$CODE" && bash -c 'set -euo pipefail; _PLAN_NO_MAIN=1 source "$1"; reviewer_warning() { return 1; }; cmd_closeout req-096; echo "REACHED-END"' _ "$PLAN" 2>&1)"; rc=$?
{ [ $rc -eq 0 ] && printf '%s' "$out" | grep -qx 'REACHED-END' \
    && printf '%s' "$out" | grep -qF 'req-096 is already on main'; } \
  && ok "closeout re-run of req-096 with reviewer_warning → 1: exit 0, runs to the end" \
  || bad "a failing reviewer_warning must not abort the closeout — rc=$rc out=$out"
printf '%s\n' "$out" | tail -3 | sed 's/^/    | /'

echo "# save — req-275 (d): the planning worktree's check_handoff.py is OLDER than plan's (L-072) → save uses the one beside plan"
# The planning copy only takes --repo (as main's did before req-272's flags); the code-side `plan`
# passes --only doc-limits --worktree. Committed straight on planning (save refuses scripts/), undone after.
( cd "$PLAN_WT" && printf 'import argparse\np = argparse.ArgumentParser()\np.add_argument("--repo")\np.parse_args()\n' > scripts/check_handoff.py \
    && git add scripts/check_handoff.py && git commit -qm "old check_handoff fixture" \
    && printf '# l072\n' > handoff/work/l072-note.md )
out="$(cd "$PLAN_WT" && "$PLAN" save "l072 fixture" 2>&1)"; rc=$?
{ [ $rc -eq 0 ] && printf '%s' "$out" | grep -q '^plan save: committed' \
    && ! printf '%s' "$out" | grep -q 'unrecognized arguments' \
    && git -C "$PLAN_WT" cat-file -e HEAD:handoff/work/l072-note.md; } \
  && ok "save with an old planning-side check_handoff.py: exit 0, committed, no 'unrecognized arguments'" \
  || bad "save must use the check_handoff.py beside plan — rc=$rc out=$out"
printf '%s\n' "$out" | sed 's/^/    | /'
if git -C "$PLAN_WT" cat-file -e HEAD:handoff/work/l072-note.md 2>/dev/null; then
  git -C "$PLAN_WT" reset -q --hard HEAD~2
else
  git -C "$PLAN_WT" reset -q --hard HEAD~1; rm -f "$PLAN_WT/handoff/work/l072-note.md"
fi

echo "# find_worktrees — req-257: a top-level scratch worktree never becomes CODE_DIR"
# main + ../workout-planning (planning) + ../workout-scratch (scratch) + a nested agent worktree.
R257="$SB/r257"
mkdir -p "$R257"
git init -q "$R257/repo"
git -C "$R257/repo" config user.email t@example.com
git -C "$R257/repo" config user.name tester
git -C "$R257/repo" symbolic-ref HEAD refs/heads/main
git -C "$R257/repo" commit -q --allow-empty -m init
git -C "$R257/repo" worktree add -q -b planning "$R257/workout-planning"
git -C "$R257/repo" worktree add -q -b scratch "$R257/workout-scratch"
git -C "$R257/repo" worktree add -q -b agent-x "$R257/repo/.claude/worktrees/agent-x"
fw_case() {  # prints "CODE_DIR=<path>" on stdout; find_worktrees' stderr to $SB/fw.err
  ( cd "$R257/repo" && _PLAN_NO_MAIN=1 source "$PLAN" && find_worktrees && echo "CODE_DIR=$CODE_DIR" ) 2>"$SB/fw.err"
}
out="$(fw_case)"
[ "$out" = "CODE_DIR=$R257/repo" ] \
  && ok "main + planning + scratch + nested agent → CODE_DIR is the main worktree" \
  || bad "CODE_DIR should be $R257/repo — got [$out]"
printf '    | %s\n' "$out"; sed 's/^/    | stderr: /' "$SB/fw.err"
grep -qF "$R257/workout-scratch" "$SB/fw.err" && grep -qF "$R257/repo" "$SB/fw.err" \
  && ! grep -qF 'agent-x' "$SB/fw.err" \
  && ok "two top-level candidates are listed on stderr (the nested agent is not)" \
  || bad "expected stderr to list repo + workout-scratch, not agent-x — got [$(cat "$SB/fw.err")]"
grep -q 'no worktree on main' "$SB/fw.err" && bad "'no worktree on main' must not print when main has one" \
  || ok "no 'no worktree on main' line when a worktree is on main"

echo "# find_worktrees — req-257: no worktree on main → the old pick (last listed) + a stderr line"
git -C "$R257/repo" checkout -q -b other
old_pick="$(git -C "$R257/repo" worktree list --porcelain | awk '
  /^worktree /{p=substr($0,10)} /^branch refs\/heads\//{ if ($2!="refs/heads/planning" && index(p,"/.claude/")==0) last=p } END{print last}')"
out="$(fw_case)"
{ [ -n "$old_pick" ] && [ "$out" = "CODE_DIR=$old_pick" ] \
    && grep -qxF "plan: no worktree on main — using $old_pick as the code worktree" "$SB/fw.err"; } \
  && ok "no main worktree → CODE_DIR=$old_pick (last listed) + 'no worktree on main' on stderr" \
  || bad "no-main case — want $old_pick, got [$out] stderr=[$(cat "$SB/fw.err")]"
printf '    | %s\n' "$out"; sed 's/^/    | stderr: /' "$SB/fw.err"
git -C "$R257/repo" checkout -q main

echo
if [ "$fails" -eq 0 ]; then echo "plan-guards: all checks passed."; else echo "plan-guards: $fails FAILED"; exit 1; fi
