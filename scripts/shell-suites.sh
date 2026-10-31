#!/usr/bin/env bash
# req-275 (L-071) — the six shell suites, which nothing ran: not ./check, not CI. Each builds its
# own throwaway repo under $TMPDIR and never touches this one.
#
#   bash scripts/shell-suites.sh --all       every suite (CI, after ./check)
#   bash scripts/shell-suites.sh --changed   only the suites whose subject this checkout changed
#                                            (./check): the diff vs main (merge base) plus the
#                                            working tree, staged, unstaged and untracked
#
# Locally only on a change: all six take ≈34 s against a ≈9 s ./check (req-275, measured on main).
# One table maps a suite to what it tests — a suite's own file, and this runner, count too.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SUITES=(plan-guards plan-ledger check-handoff check-lanes check-skills pre-push)
subject_re() {  # the paths (ERE, whole path) a suite tests, besides its own scripts/<suite>.test.sh
  case "$1" in
    plan-guards)   echo '^(plan|scripts/(check_handoff|dec_index)\.py)$' ;;   # it copies all three into its sandbox
    plan-ledger)   echo '^plan$' ;;
    check-handoff) echo '^scripts/(check_handoff|dec_index)\.py$' ;;        # check_handoff imports dec_index
    check-lanes)   echo '^scripts/(check_handoff|dec_index)\.py$' ;;
    check-skills)  echo '^(scripts/check_skills\.py|\.claude/skills/.*)$' ;;
    pre-push)      echo '^\.githooks/.*$' ;;
  esac
}

mode="${1:-}"
selected=()
case "$mode" in
  --all) selected=("${SUITES[@]}") ;;
  --changed)
    # WORKOUT_SUITES_BASE: compare against another ref than main — only to prove the selection on a
    # branch whose main lacks this runner (req-275's own receipts). Said loudly, like WORKOUT_TEST_LIMIT.
    base="${WORKOUT_SUITES_BASE:-main}"
    [ "$base" = main ] || echo "shell suites: base overridden to $base (WORKOUT_SUITES_BASE)" >&2
    changed="$(
      if git rev-parse --verify -q "$base" >/dev/null; then git diff --name-only "$base...HEAD"; fi
      git diff --name-only HEAD
      git ls-files --others --exclude-standard
    )"
    for s in "${SUITES[@]}"; do
      if grep -Eq "$(subject_re "$s")|^scripts/$s\.test\.sh$|^scripts/shell-suites\.sh$" <<<"$changed"; then
        selected+=("$s")
      fi
    done
    ;;
  *) echo "usage: scripts/shell-suites.sh --all | --changed" >&2; exit 2 ;;
esac

if [ "${#selected[@]}" -eq 0 ]; then
  echo "shell suites: none — this change touches none of plan, scripts/, .githooks/, .claude/skills/ they test"
  exit 0
fi
echo "shell suites: ${selected[*]}"

log="$(mktemp "${TMPDIR:-/tmp}/shell-suite.XXXXXX")"
trap 'rm -f "$log"' EXIT
failed=()
for s in "${selected[@]}"; do
  start=$SECONDS
  if bash "scripts/$s.test.sh" >"$log" 2>&1; then
    echo "shell suite $s: passed ($((SECONDS - start)) s, $(grep -c '^ok ' "$log") ok)"
  else
    echo "shell suite $s: FAILED ($((SECONDS - start)) s) — its output:" >&2
    sed 's/^/  | /' "$log" >&2
    failed+=("$s")
  fi
done

if [ "${#failed[@]}" -gt 0 ]; then
  echo "shell suites: RED — ${failed[*]}" >&2
  exit 1
fi
echo "shell suites: green — ${selected[*]}"
