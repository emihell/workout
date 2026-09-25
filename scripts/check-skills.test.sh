#!/usr/bin/env bash
# req-160 — planted-failure self-test for check_skills.py: it must pass on the real
# skills, and FIRE on each planted fault (copied rule text, a dead L-/DEC-/§ pointer,
# a missing path) in a throwaway skills dir. Nothing in the repo is touched.
# Manual; not wired into ./check (precedent: check-handoff.test.sh).
#   bash scripts/check-skills.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHECK="$ROOT/scripts/check_skills.py"
SB="$(mktemp -d)"
trap 'rm -rf "$SB"' EXIT
fails=0
ok()  { printf 'ok   - %s\n' "$1"; }
bad() { printf 'FAIL - %s\n' "$1"; fails=$((fails + 1)); }

if python3 "$CHECK" >/dev/null; then ok "the real skills pass"; else bad "the real skills fail"; fi

plant() { # name, body → expect exit 1
  rm -rf "$SB/skills" && mkdir -p "$SB/skills/x"
  printf -- '---\nname: x\ndescription: planted\n---\n%s\n' "$2" > "$SB/skills/x/SKILL.md"
  python3 "$CHECK" --skills-dir "$SB/skills" > "$SB/out" 2>&1
  if [ $? -eq 1 ]; then ok "fires on $1 ($(grep -m1 '^    ' "$SB/out" | sed 's/^ *//'))"; else bad "silent on $1"; cat "$SB/out"; fi
}
# A sentence lifted from L-032's "How to apply".
plant "copied rule text" "Planning commits go through ./plan save only — never a raw git commit, never a hand-set HANDOFF=1."
plant "a dead L- id" "See L-999."
plant "a dead DEC- id" "See DEC-999."
plant "a dead § section" "See handoff/rules/WORKFLOW.md §No such heading here."
plant "a missing path" 'Read `handoff/rules/NOPE.md`.'

rm -rf "$SB/skills" && mkdir -p "$SB/skills"
python3 "$CHECK" --skills-dir "$SB/skills" >/dev/null 2>&1
[ $? -eq 2 ] && ok "refuses an empty skills dir (exit 2)" || bad "passes an empty skills dir"

[ "$fails" -eq 0 ] && echo "check-skills: all checks passed." || { echo "check-skills: $fails failing."; exit 1; }
