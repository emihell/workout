# req-67 — Make DECISIONS.md a reference, not just an archive

**Status: READY.** **BLOCKING** (workflow-review finding #4, 2026-09-13) — lower urgency than
req-65/66 (hygiene, not a live trap); do it in the same blocking batch.

**Gate: infra/docs.** Builder: **planning** — edits `handoff/log/DECISIONS.md` (planning's).
No code-session dispatch. Merges on planning's own read.

## Why

DECISIONS.md is 869 lines / 46 entries, 14 of which explicitly supersede an earlier one. To
know the *current* rule you must read all 46 and mentally apply the supersession chain
(DEC-044 over DEC-043's "shrink"; DEC-035 over the by-kind merge gate; …). It's append-only
by design (correct — history matters), but with no supersession markers it's drifting toward
the same "can't find current truth" problem the workflow fights everywhere else.

## Scope

- **Mark every superseded DEC inline**, at the top of the entry, non-destructively (keep the
  text — append-only is preserved): e.g. a leading line `> SUPERSEDED by DEC-NN (<date>).`
  Find them by scanning for the 14 "supersede/replaces/overrides DEC" mentions and following
  each to the entry it replaced; mark that entry.
- **Add a short "Current rules digest" at the very top** (before DEC-001): a compact list of
  the live rules that matter operationally — the merge gate (DEC-035 + carve-outs), the build
  lane/loop (DEC-037/009), the isolation boundary (DEC-005/DEC-043/044) — each one line, each
  pointing at its live DEC number. This is the reference; the entries stay the archive.
- Keep it mechanical and honest: a DEC is "superseded" only where a later DEC explicitly says
  so or plainly replaces its rule — do not editorialize borderline cases; if unsure, leave
  unmarked and note it for Emilio.

## Out of scope

- Deleting or rewriting any DEC (append-only; markers + a digest only).
- LESSONS.md (separate; only if the same problem is visible there, note it).

## Acceptance

- Every DEC that a later DEC supersedes carries a `> SUPERSEDED by DEC-NN` marker; the count
  of markers matches the supersession mentions found (report the list).
- A "Current rules digest" exists at the top, ≤ ~15 lines, each line → a live DEC number.
- Nothing was deleted (`git diff` shows only added marker lines + the digest); `check_handoff`
  passes.

## Decisions

- **format (planning's call):** exact marker/digest wording, as long as superseded entries are
  visibly flagged and the current operational rules are findable in one place.
