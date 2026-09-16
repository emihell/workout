#!/usr/bin/env bash
# req-90 — unit test for `plan closeout`'s ledger helpers (append_shipped_stub,
# bump_now_range). Sources ./plan with _PLAN_NO_MAIN=1 so the real functions are
# tested (no merge/publish). Deterministic; run: bash scripts/plan-ledger.test.sh
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
_PLAN_NO_MAIN=1 source "$ROOT/plan"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fails=0
ok()   { printf 'ok   - %s\n' "$1"; }
bad()  { printf 'FAIL - %s\n' "$1"; fails=$((fails+1)); }
# assert file $1 CONTAINS pattern $2 (grep -F -q by default, -E if $4=re)
has()  { if grep -Eq "$2" "$1"; then ok "$3"; else bad "$3"; fi; }
hasnt(){ if grep -Eq "$2" "$1"; then bad "$3"; else ok "$3"; fi; }
count(){ grep -Ec "$2" "$1"; }

now_fixture() {
  cat > "$1" <<'EOF'
# Now

Updated 2026-09-16. **Shipped: req-01–09, req-11–23, req-25–31, req-33–89** (req-10 pending; req-24
gated; req-32 dropped). **Building: req-90** (plan closeout auto-ledger).

## Milestone
EOF
}
shipped_fixture() {
  cat > "$1" <<'EOF'
# Shipped

---

## req-89 — a headless screenshot script  (merged 2026-09-16)

Real prose the author wrote for 89.
EOF
}

echo "# append_shipped_stub"
S="$TMP/SHIPPED.md"; shipped_fixture "$S"
append_shipped_stub "$S" "req-90" "plan closeout auto-ledger" "2026-09-16" >/dev/null
has "$S" '^## req-90 — plan closeout auto-ledger  \(merged 2026-09-16\)' "stub heading appended with title + merge date"
has "$S" '_Stub — Planner:' "one-line placeholder appended"
# idempotent: re-run does NOT double-append
append_shipped_stub "$S" "req-90" "plan closeout auto-ledger" "2026-09-16" >/dev/null
[ "$(count "$S" '^## req-90 ')" = "1" ] && ok "re-run does not double-append (still 1 heading)" || bad "re-run doubled the heading"
# does not clobber the author's already-written prose under an existing heading
S2="$TMP/SHIPPED2.md"; shipped_fixture "$S2"
printf '\n## req-91 — preview deploy  (merged 2026-09-17)\n\nAuthor already filled this in fully.\n' >> "$S2"
append_shipped_stub "$S2" "req-91" "preview deploy" "2026-09-17" >/dev/null
has "$S2" 'Author already filled this in fully\.' "existing filled entry left untouched"
hasnt "$S2" '_Stub — Planner:' "no stub written over a filled entry"

echo "# bump_now_range — contiguous extend"
N="$TMP/NOW.md"; now_fixture "$N"
before_lines="$(wc -l < "$N")"
out="$(bump_now_range "$N" 90)"; [ "$out" = "extended" ] && ok "reports 'extended'" || bad "expected 'extended', got '$out'"
has "$N" '\*\*Shipped: req-01–09, req-11–23, req-25–31, req-33–90\*\*' "range req-33–89 bumped to req-33–90"
after_lines="$(wc -l < "$N")"
[ "$before_lines" = "$after_lines" ] && ok "no line added (≤50 rule: range is one token)" || bad "line count changed $before_lines -> $after_lines"
hasnt "$N" 'Building: req-90.*Building: req-90' "rest of NOW untouched (Building line intact, once)"
has "$N" '\*\*Building: req-90\*\*' "Building marker left for the author (not moved)"

echo "# bump_now_range — idempotent / already covered"
out="$(bump_now_range "$N" 90)"; [ "$out" = "unchanged" ] && ok "re-run on 90 is 'unchanged'" || bad "expected 'unchanged', got '$out'"
out="$(bump_now_range "$N" 25)"; [ "$out" = "unchanged" ] && ok "an in-range id (25) is 'unchanged'" || bad "expected 'unchanged', got '$out'"

echo "# bump_now_range — non-contiguous append"
N2="$TMP/NOW2.md"; now_fixture "$N2"
out="$(bump_now_range "$N2" 95)"; [ "$out" = "appended" ] && ok "non-abutting id (95) reports 'appended'" || bad "expected 'appended', got '$out'"
has "$N2" '\*\*Shipped:.*req-33–89, req-95\*\*' "', req-95' appended to the list"

echo "# bump_now_range — single-token abut"
N3="$TMP/NOW3.md"; printf '# Now\n\n**Shipped: req-01, req-88** (x).\n' > "$N3"
out="$(bump_now_range "$N3" 89)"; [ "$out" = "extended" ] && ok "bare req-88 + 89 reports 'extended'" || bad "expected 'extended', got '$out'"
has "$N3" '\*\*Shipped: req-01, req-88–89\*\*' "single req-88 became range req-88–89"

echo "# bump_now_range — no Shipped span"
N4="$TMP/NOW4.md"; printf '# Now\n\nno shipped span here.\n' > "$N4"
if bump_now_range "$N4" 90 >/dev/null 2>&1; then bad "should fail when no span"; else ok "exits nonzero when no '**Shipped: …**' span (caller warns)"; fi

echo
if [ "$fails" -eq 0 ]; then echo "plan-ledger: all checks passed."; else echo "plan-ledger: $fails check(s) FAILED." >&2; fi
exit "$fails"
