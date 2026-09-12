# req-45 — plan doctor compares grant *contents*, not just existence (DEC-028 follow-up)

**Status: BUILT AND MERGED, 2026-09-12 — branch `req-45` (`1aaacfa`…`1aaacfa`, 1 commit).** From the DEC-028 follow-up (surfaced during the F-CONFIG-1 fix).
**Gate: functional** — workflow tooling (`plan` script); planning verifies by
running `plan doctor` + merges. No app code, no persisted data.

## Why

`plan doctor`'s grants check (`plan:568-576`) only tests that
`.claude/settings.local.json` **exists** — it's blind to **content drift**: a
machine whose grant list is stale, narrower, or broader than canonical passes the
check, and the mismatch only surfaces later as an unexpected permission re-prompt
(or, worse, an over-broad grant that never re-prompts). This is the one drift kind
the machine-local model (DEC-028) can't currently catch — recorded as the DEC-028
follow-up.

## The fix

In the grants check, when `settings.local.json` exists, **compare its
`permissions.allow` to the canonical grant set** and report any **missing** or
**extra** grants; `ok` only on an exact match. Keep the missing-file FIX as-is.

- **Canonical list** = the ten grants in README §Setup step 5 / DEC-005 / DEC-026:
  ```
  Bash(git add:*)  Bash(git commit:*)  Bash(git reset:*)  Bash(git restore:*)
  Bash(git push origin planning:*)  Bash(git push origin main planning:*)
  Bash(../workout-codebase/plan save:*)  Bash(../workout-codebase/plan status:*)
  Bash(../workout-codebase/plan publish:*)  Bash(../workout-codebase/plan closeout:*)
  ```
  Define it once in `plan` (a bash array or inside the comparison). **Add a comment
  that this list must stay in sync with README §Setup step 5** — the one coupling.
- **Parse with `python3`** (already a dependency — `scripts/check_handoff.py`), not
  ad-hoc grep, so the allow array is read as JSON: extract `permissions.allow`,
  diff against canonical (set comparison — order-independent), print missing and
  extra. A malformed/unparseable file → a FIX explaining it, not a crash.
- Output shape stays consistent with the other doctor lines: `ok grants — …` on
  match; `FIX: grants — missing: <…>; extra: <…>` (or the missing-file message) and
  set `fail=1`. Exit still reflects setup invariants only (DEC-027 unchanged).

## Scope / Out of scope

- **In:** the grant-content comparison in `plan`'s doctor; a canonical list + sync
  comment.
- **Out:** changing the grants themselves; DEC-027's exit semantics; any other
  doctor check; reading the list *from* README (fragile parsing — hardcode + comment
  instead).

## Ordered steps

1. Add the canonical grant list to `plan` (near the doctor grants check) with the
   "keep in sync with README §Setup step 5" comment.
2. Rewrite the grants check: exists → `python3` reads `permissions.allow`, computes
   `missing = canonical − actual` and `extra = actual − canonical`; empty both →
   `ok`; else `FIX` listing them + `fail=1`. Missing file → existing FIX. Unparseable
   → a clear FIX.
3. Verify by running `plan doctor` (see acceptance).

## Acceptance criteria (written before implementation)

- On this machine (settings.local.json holds exactly the ten canonical grants),
  `plan doctor` prints `ok grants — …`. Paste the line.
- With a grant temporarily removed from a **throwaway copy** (do NOT mutate the real
  file — L-001), the check prints `FIX: grants — missing: Bash(git add:*)` (or
  similar) and doctor exits non-zero. Paste the demonstration.
- With an extra bogus grant added to the throwaway copy, the check reports it under
  `extra:`.
- A malformed JSON file → a FIX message, not a stack trace.
- `./check` green (the `plan` change doesn't affect the app build/tests, but run it).

## Decisions

- **approach:** hardcode the canonical list in `plan` (+ sync comment); parse with
  `python3`; report missing AND extra; `ok` only on exact match.
- **implementation (CC's call):** exact bash/python plumbing and message wording.

## Notes

This closes the drift gap discussed at the F-CONFIG-1 fix: `plan doctor` now catches
both a *missing* grants file (already did) and a *drifted* one (new) — so
cross-machine grant confidence no longer relies on the file merely existing. Verify
against a throwaway copy; never edit the real `settings.local.json` to test (L-001).
