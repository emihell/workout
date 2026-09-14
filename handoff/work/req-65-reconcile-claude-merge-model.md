# req-65 — Reconcile CLAUDE.md's merge model with DEC-035

**Status: READY.** **BLOCKING** (workflow-review finding #1, 2026-09-13). Highest priority:
a live trap for the build session.

**Gate: infra/docs.** Builder: **planning** — this edits `handoff/CLAUDE.md` (the root
`CLAUDE.md` is a symlink to it), which is planning's to write. No code-session dispatch.
Quick. Merges on planning's own read (DEC-035).

## Why

`handoff/CLAUDE.md` — auto-loaded into the build session every turn — still asserts a merge
model DEC-035 overrode, so the builder runs on a stale picture (the exact "fact in two
places, follow the one you never read" failure the workflow exists to prevent; found in the
2026-09-13 workflow review). Live proof: this session req-62 (ux-feel) merged on planning's
tests + the demo note, no use-by-Emilio — correct per DEC-035, but flatly against CLAUDE.md.

Stale statements to fix:
- §"Nothing merges until Emilio has used it" (~line 191): *"A human using the app is a merge
  gate, not a formality… do not merge on your own initiative, ever."*
- §"How work arrives": *"Review and merge are handled for you… merging by req type — Emilio
  uses UX and persisted-data reqs himself first."*

Both predate DEC-035, which made **planning** the merger on its own testing for essentially
all reqs (ux-feel + persisted-data included), with two carve-outs only: an actual
migration/bulk rewrite of existing stored records gets Emilio's eyes first, and shared-code
(store/model/storage/migration/wide blast radius) gets an independent-reviewer subagent
before merge.

## Scope

- Rewrite those two CLAUDE.md passages to match DEC-035: the build session **reports built +
  unmerged and does not merge** (that part is still true and stays), but drop the claim that
  a human use-gate blocks every merge and that Emilio personally uses UX/persisted-data reqs
  first. State the real gate: **planning merges on its own testing (DEC-035); the two
  carve-outs are the only human/reviewer gates.** Point to DEC-035 by name.
- Keep it short; do not restate DEC-035 in full — reference it.
- Do NOT change the build session's own instructions (branch, `./check`, report, don't
  merge) — those are unchanged.

## Out of scope

- The `rules/`, `PLANNING.md`, the `plan` script — check them in passing for the same stale
  claim and note (don't fix) anything found; this req is CLAUDE.md.

## Acceptance

- CLAUDE.md no longer says a human use-gate blocks every merge or that Emilio uses UX/
  persisted-data reqs himself first; it states the DEC-035 model + the two carve-outs, and
  references DEC-035. Quote the before/after.
- `grep -n "used it\|not a formality\|himself first" handoff/CLAUDE.md` → the stale phrasings
  are gone.
- `check_handoff` still passes; no other `handoff/` doc contradicts the new text (grep for
  the old claim elsewhere and report).

## Decisions

- **content (Emilio, via DEC-035):** planning is the merger; the human gate is now only the
  migration carve-out. This req just makes the builder's guide say so.
