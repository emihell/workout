#!/usr/bin/env bash
# req-166 — self-test for check_handoff's Lane / DECIDED rules (DEC-085 §6), in a throwaway
# git repo (check_handoff reads handoff/ via `git show <ref>:<path>`). Nothing in the real
# repo is touched. Manual, like check-handoff.test.sh:  bash scripts/check-lanes.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHECK="${CHECK_HANDOFF:-$ROOT/scripts/check_handoff.py}"
SB="$(mktemp -d)"
trap 'rm -rf "$SB"' EXIT
fails=0
ok()  { printf 'ok   - %s\n' "$1"; }
bad() { printf 'FAIL - %s\n' "$1"; fails=$((fails+1)); }

R="$SB/repo"
git init -q "$R" && cd "$R"
git config user.email t@example.com && git config user.name tester
git symbolic-ref HEAD refs/heads/main
mkdir -p handoff/work
printf 'export const app = 1\n' > app.js
doc() { printf '# %s\n\n%s\n\nBody.\n' "$1" "$2" > "handoff/work/$1-thing.md"; }
doc req-300 '**Status: READY** (2026-09-25) — **Lane: tooling.** A valid lane, trailing period.'
doc req-301 '**Status: READY** — **Lane: bug** (small). A valid lane with a note after it.'
doc req-302 '**Status: READY** — **Lane: frontend** — not a lane.'
doc req-303 '**Status: READY** — Gate: functional. A legacy Gate tag.'
doc req-304 '**Status: READY** — no lane, no gate.'
doc req-305 '**Status: DECIDED 2026-09-25 → DEC-090, req-306.** A design req, finished.'
doc req-307 '**Status: BUILT AND MERGED, 2026-01-01.** An old shipped req with neither tag.'
printf '# Now\n\nUpdated. **Shipped: req-305, req-307.**\n' > handoff/NOW.md
git add -A && git commit -qm init
printf 'export const app = 2\n' > app.js && git commit -qam "req-307: ship it"

out="$(python3 "$CHECK" --repo "$R" --ref HEAD 2>&1)"; rc=$?
verbose="$(python3 "$CHECK" --repo "$R" --ref HEAD --verbose 2>&1)"
has()   { printf '%s' "$out" | grep -qF "$1"; }
line()  { printf '%s\n' "$out" | grep -F "$1"; }

has 'req-300' && bad "req-300 Lane: tooling. (trailing period) accepted — got: $(line req-300)" || ok "req-300 **Lane: tooling.** accepted (no finding)"
has 'req-301' && bad "req-301 Lane: bug (note after) accepted — got: $(line req-301)" || ok "req-301 **Lane: bug** (small) accepted (no finding)"
line 'req-302' | grep -q '^\[fail\] lane: req-302 — unknown Lane' && ok "req-302 a bad Lane value FAILS: $(line req-302)" || bad "req-302 should fail — got: [$(line req-302)]"
has 'req-303' && bad "req-303 legacy Gate should be accepted — got: $(line req-303)" || ok "req-303 legacy 'Gate:' tag accepted (no finding)"
line 'req-304' | grep -q '^\[warn\] lane: req-304' && ok "req-304 open req with neither WARNS: $(line req-304)" || bad "req-304 should warn — got: [$(line req-304)]"
printf '%s' "$verbose" | grep -q 'req-305' && bad "req-305 DECIDED should classify (no unknown/finding) — got: $(printf '%s\n' "$verbose" | grep req-305)" || ok "req-305 DECIDED <date> → DEC-…, req-… accepted as terminal (no finding even with --verbose; NOW's Shipped agrees)"
has 'req-307' && bad "req-307 merged-without-tag should be quiet — got: $(line req-307)" || ok "req-307 an old merged req with neither tag is not flagged"
[ "$rc" -eq 1 ] && ok "exit 1 (the bad Lane is a failure; the warning alone would not fail)" || bad "expected exit 1, got $rc"

# The warning alone doesn't fail the run.
git rm -q handoff/work/req-302-thing.md && git commit -qm "drop the bad lane"
python3 "$CHECK" --repo "$R" --ref HEAD >/dev/null 2>&1; rc2=$?
[ "$rc2" -eq 0 ] && ok "only the req-304 warning left → exit 0" || bad "a warning must not fail the run (rc=$rc2)"

[ "$fails" -eq 0 ] && echo "check-lanes: all checks passed." || { echo "check-lanes: $fails failing."; exit 1; }
