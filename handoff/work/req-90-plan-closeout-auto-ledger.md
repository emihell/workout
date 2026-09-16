# req-90 — `plan closeout` auto-writes the SHIPPED stub + bumps NOW's shipped range

**Status: READY — from the 2026-09-16 session retro.** Kills the repetitive, error-prone ledger step that
follows every closeout.

**Gate: tooling** (the `plan` script; no app change).

## Why

[measured] every `plan closeout req-N` this session was followed by a manual step: append a `## req-N …
(merged DATE)` block to `SHIPPED.md` and bump the shipped range + move the "building" marker in `NOW.md`,
then `plan save` + `plan publish`. It's pure bookkeeping, done ~13 times, and it went wrong twice —
`NOW.md` tripped its own ≤50-line rule (hit 51) and once carried a duplicated req-84/85 block. `plan
closeout` already prints these exact steps as a to-do; it should just do the mechanical parts.

## The behaviour

Extend `plan closeout req-N` so that, after the merge, it:
- **Appends a SHIPPED.md stub** for req-N — the heading it already prints (`## req-N — <title> (merged
  <date>)`) plus a one-line placeholder the Planner then fills with the real detail. (Title/date it
  already computes; the Planner still writes the substance — this only removes the boilerplate + the
  copy-paste of the heading.)
- **Bumps the shipped range in NOW.md** to include req-N (extend the range / list), leaving the rest of
  NOW untouched.
- Runs (or prompts) the existing `save` + `publish` + push as it does today.

Keep it a **stub + range bump**, not a full auto-writer: the SHIPPED substance (what changed / what was
verified) stays the Planner's to write — the value is removing the mechanical heading + range edit that
caused the errors, not authoring the entry.

## Scope

- The `plan` script's `closeout` path; the NOW-range edit; the SHIPPED heading append.

## Out of scope

- Writing the SHIPPED entry's substance (stays manual — it's the signal).
- Any change to the merge/gate logic in closeout.

## Acceptance criteria

- **Stub appended:** after `plan closeout req-N`, SHIPPED.md has a `## req-N …` heading with the merge
  date; NOW's shipped range includes req-N; no other NOW content changed.
- **NOW stays ≤50:** the range bump does not push NOW over its own line limit (the range is one token, not
  a new line) — and if NOW is already at the limit, it warns rather than silently overflowing.
- **Idempotent / safe:** re-running does not double-append; a closeout that fails mid-way leaves a
  recoverable state.
- **Existing closeout behaviour unchanged:** the merge/publish/push/branch-delete all still happen.

## Decisions

- Stub + range-bump only; SHIPPED substance stays the Planner's (session retro, 2026-09-16 — reviewer:
  "convenience, not a risk fix," so keep it minimal).
