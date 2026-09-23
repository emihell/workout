#!/usr/bin/env bash
# req-129 — regression test for .githooks/pre-push (the DEC-045 --no-ff guard).
# Builds a bare origin + a clone wired to the REAL hook (core.hooksPath), then
# pushes main in each scenario. Never touches the live repo or its remote.
#   1. an FF'd req-* branch WITH commits → refused      (DEC-045, the failure case)
#   2. a --no-ff merge of a req-* branch → allowed       (the closeout path)
#   3. a just-created, empty req-* branch at main's unpushed tip → allowed (req-129)
#   4. an empty-at-creation branch that later MOVED (reset) onto the spine → refused
#   5. WORKOUT_ALLOW_FF=1 overrides case 1, loudly
# Deterministic; run: bash scripts/pre-push.test.sh
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SB="$(mktemp -d)"
trap 'rm -rf "$SB"' EXIT
fails=0
ok()  { printf 'ok   - %s\n' "$1"; }
bad() { printf 'FAIL - %s\n' "$1"; fails=$((fails+1)); }

git init -q --bare "$SB/origin.git"
git -C "$SB/origin.git" symbolic-ref HEAD refs/heads/main
C="$SB/clone"
git init -q "$C"
git -C "$C" symbolic-ref HEAD refs/heads/main
git -C "$C" config user.email t@example.com
git -C "$C" config user.name tester
git -C "$C" config core.logAllRefUpdates true
mkdir -p "$C/.githooks"
cp "$ROOT/.githooks/pre-push" "$C/.githooks/pre-push"
chmod +x "$C/.githooks/pre-push"
git -C "$C" config core.hooksPath .githooks
git -C "$C" remote add origin "$SB/origin.git"
commit() { printf '%s\n' "$2" >> "$C/$1" && git -C "$C" add -A && git -C "$C" commit -qm "$2"; }
commit README "init"
git -C "$C" push -q origin main 2>/dev/null
push() { git -C "$C" push origin main 2>&1; }

echo "# 1. FF'd req-* branch with its own commits → refused (failure case)"
git -C "$C" checkout -q -b req-201 main
commit a.txt "req-201 work"
git -C "$C" checkout -q main
git -C "$C" merge -q --ff-only req-201
out="$(push)"; rc=$?
{ [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'Refusing' && printf '%s' "$out" | grep -q 'req-201'; } \
  && ok "FF'd req-201 (reflog: created + commit) refused (exit $rc)" \
  || bad "FF'd req-201 should be refused — rc=$rc out=$out"

echo "# 5. WORKOUT_ALLOW_FF=1 overrides, never silently"
out="$(WORKOUT_ALLOW_FF=1 git -C "$C" push origin main 2>&1)"; rc=$?
{ [ $rc -eq 0 ] && printf '%s' "$out" | grep -q 'WORKOUT_ALLOW_FF=1 set'; } \
  && ok "override allows and says so (exit $rc)" || bad "override — rc=$rc out=$out"
git -C "$C" branch -q -D req-201

echo "# 2. --no-ff merge → allowed"
git -C "$C" checkout -q -b req-202 main
commit b.txt "req-202 work"
git -C "$C" checkout -q main
git -C "$C" merge -q --no-ff req-202 -m "Merge branch 'req-202'"
out="$(push)"; rc=$?
[ $rc -eq 0 ] && ok "--no-ff merge of req-202 pushed (exit $rc)" || bad "--no-ff should push — rc=$rc out=$out"
git -C "$C" branch -q -d req-202

echo "# 3. just-created, empty req-* branch at main's unpushed tip → allowed (req-129)"
commit NOTES "doc commit on main (a publish)"
git -C "$C" branch req-203 main
subjects="$(git -C "$C" reflog show --format=%gs refs/heads/req-203)"
printf '%s' "$subjects" | grep -qx 'branch: Created from main' \
  && ok "fixture: req-203's reflog is only its creation" || bad "fixture reflog: '$subjects'"
out="$(push)"; rc=$?
[ $rc -eq 0 ] && ok "empty req-203 sitting on the pushed spine is allowed (exit $rc)" \
  || bad "empty req-203 should be allowed — rc=$rc out=$out"
git -C "$C" branch -q -D req-203

echo "# 4. branch created elsewhere, later reset onto the spine → refused (moved = not exempt)"
git -C "$C" branch req-204 main
commit c.txt "work later reachable only via reset"
git -C "$C" branch -f req-204 main
out="$(push)"; rc=$?
{ [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'req-204'; } \
  && ok "req-204 (reflog: created + reset) refused (exit $rc)" \
  || bad "a moved req-204 should be refused — rc=$rc out=$out"

echo
if [ "$fails" -eq 0 ]; then echo "pre-push: all checks passed."; else echo "pre-push: $fails FAILED"; exit 1; fi
