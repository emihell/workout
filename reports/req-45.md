# req-45 — plan doctor compares grant *contents*, not just existence

**Branch:** `req-45` · **Gate:** functional (workflow tooling — `plan` script only;
no app code, no persisted data) · **`./check`:** green.

## Technical

### What changed

`plan`'s doctor grants check (was `plan:567-576`) previously only tested that
`$pd/.claude/settings.local.json` **exists**. It now, when the file exists, parses
`permissions.allow` and compares it to a hardcoded canonical grant set, reporting
**missing** and **extra** grants; `ok` only on an exact (order-independent) match.
The missing-file FIX is unchanged.

- **Canonical list** — the ten grants from README §Setup step 5 (DEC-005 /
  DEC-026), defined once as a bash array `canonical_grants` with a comment:
  `KEEP IN SYNC WITH README §Setup step 5 — the one coupling`. Not read from README
  (fragile parsing — out of scope by the spec).
- **Parsing** — `python3` (already a dependency via `scripts/check_handoff.py`)
  reads the file as JSON, extracts `permissions.allow`, and does set differences.
  Order-independent. The canonical list is passed in via the `CANONICAL` env var
  (newline-joined) so the two lists live in one place (the bash array).
- **Malformed / unreadable** — `json.load` failure (`ValueError`/`OSError`) or a
  non-list `permissions.allow` prints a `PARSE\t<reason>` line and `sys.exit(0)`
  (never a stack trace); bash turns that into a `FIX: grants — could not read …`
  line + `fail=1`.
- **Output shape** — consistent with the other doctor lines:
  - `ok   grants — <file> matches all 10 canonical grants`
  - `FIX: grants — missing: <…>; extra: <…>` + re-paste hint + `fail=1`
  - `FIX: grants — could not read permissions.allow from <file>: <reason>` + hint + `fail=1`
- **Exit semantics** — unchanged (DEC-027): drift/parse set the same `fail=1` the
  other checks use, so doctor exits non-zero; `plan status` at the end stays
  informational.

### Implementation choices left open by the spec (CC's call)

- **`ok` wording** includes the resolved file path and the canonical count
  (`matches all 10 canonical grants`), mirroring the old line's file mention.
- **DRIFT line** always prints both `missing:` and `extra:`, using `(none)` for the
  empty side, so the shape is stable regardless of which kind of drift occurred.
- **Non-list `permissions.allow`** (e.g. `"allow": {}` or the key absent) is treated
  as a PARSE failure rather than "everything missing" — a structurally wrong file is
  a different problem from a drifted-but-valid one, and the PARSE message says so.

## Verification (receipts)

All drift/malformed testing was done against **throwaway copies** in the scratchpad;
the real `settings.local.json` was never mutated (L-001). Confirmed unchanged:
`md5` identical before/after, `git status` clean in the planning worktree.

**Acceptance criteria:**

1. *This machine, exact ten grants → `ok`* — from `./plan doctor`:
   ```
   ok   grants — /Users/…/workout-planning/.claude/settings.local.json matches all 10 canonical grants
   ```

2. *Grant removed (throwaway) → FIX + non-zero* — doctor's exact grants block run
   against a throwaway copy with `Bash(git add:*)` removed:
   ```
   FIX: grants — missing: Bash(git add:*); extra: (none)
     (exit contribution: fail=1)
   ```
   `fail=1` drives doctor's `exit 1` (`plan:604-607`).

3. *Extra bogus grant (throwaway) → reported under `extra:`* — throwaway copy with
   `Bash(rm -rf:*)` appended:
   ```
   FIX: grants — missing: (none); extra: Bash(rm -rf:*)
     (exit contribution: fail=1)
   ```

4. *Malformed JSON → FIX, not a stack trace* — throwaway truncated-JSON file:
   ```
   FIX: grants — could not read permissions.allow from …/bad.json: Expecting value: line 1 column 31 (char 30)
     (exit contribution: fail=1)
   ```

5. *`./check` green:*
   ```
   # tests 182  # pass 182  # fail 0
   check: green — lint, 15 test file(s), and the build all passed.
   ```

Cases 2–4 were exercised via a faithful copy of the doctor's grants block
(same canonical array, same python snippet, same case formatting) parameterized by
file path, because doctor reads a fixed path (`$pd/.claude/settings.local.json`)
that can't be redirected without editing the real file. Case 1 and the OK control
were run through the real `./plan doctor` / real file.

## Workflow

- **No scope changes.** Built exactly what the spec asked: content comparison,
  hardcoded canonical list + sync comment, python3 JSON parse, missing+extra,
  malformed→FIX, exit semantics unchanged.
- **No decisions needed from Emilio** — everything undecided was implementation
  plumbing (case above).
- **Possible `L-`/note for planning:** the canonical grant list now lives in **two**
  places — README §Setup step 5 (the printf paste) and `plan`'s `canonical_grants`
  array — coupled only by a comment. That's the intended trade (reading from README
  was ruled out), but it's a real drift surface: if the grants ever change, both must
  change together, and nothing enforces it. Worth a one-line `DEC`/`L` noting the
  coupling so a future edit to one doesn't silently skip the other.
