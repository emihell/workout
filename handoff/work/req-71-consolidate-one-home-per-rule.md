# req-71 — Consolidate the workflow docs to one-home-per-rule

**Status: SHIPPED 2026-09-14** — planning-owned, published to `main`. Independent reviewer PASS
(one dropped nuance found + restored); Emilio OK'd the before/after. Workflow-audit follow-up #2.

## Why

The audit's dominant finding: ~15 operational rules are stated in full in 2–5 docs (not
cross-referenced), so a change to one rots the copies — proven by the merge-gate drift (req-65/69/70)
and L-002. ~250–350 of the 2,393 machinery lines are restatement. req-70 made the stale copies
*correct*; this req removes the duplication so they can't drift again.

## The rule: one home + cross-references (never a second full statement)

Each rule gets ONE authoritative home; every other mention becomes a short cross-reference
(`see DEC-035` / `see rules/WORKFLOW.md §…`). **Exception — `CLAUDE.md` stays self-contained**: it
loads into Builder every turn, so it keeps a *one-liner* of any rule Builder needs mid-build (then
`see …`), never the full treatment. **Preserve every fact** — if collapsing a restatement would drop
a nuance, keep the nuance as one line at the home, don't delete it.

## Home map (from the audit §1; homes chosen, cross-ref the rest)

- **Merge gate + two carve-outs** → home **DEC-035** (+ digest). CLAUDE.md keeps its Builder one-liner
  ("you never merge; planning merges on its testing"); PLANNING.md/WORKFLOW.md cross-ref.
- **Migration ask-gate #2** → home **CLAUDE.md:191-198** (Builder triggers it). WORKFLOW.md:164-176 →
  pointer.
- **Batch vs single** → home **DEC-035**. PLANNING.md keeps the operational one-liner + `see DEC-035`.
- **`/clear` is manual (no programmatic clear)** → home **DEC-037**. PLANNING.md keeps the one-line
  "remind Emilio to /clear in single mode" + `see DEC-037`; drop the full re-explanation.
- **Planning micro-loop diagram** → home **rules/WORKFLOW.md:12-29**. PLANNING.md → pointer (it already
  says "full version in WORKFLOW.md" then restates — delete the restatement).
- **Two-worktree isolation** → home **DEC-005** / **rules/WORKFLOW.md**. PLANNING.md + READMEs cross-ref.
- **Re-check CC by kind** (mechanical=read output, judgment=read diff yourself) → stated **twice inside
  PLANNING.md** (:85-89 and :425-442) — collapse to one.
- **Git-command list** → stated **twice inside PLANNING.md** (~:38-63 and ~:304-331) — collapse to one.
- Smaller multi-homed craft rules (verify-don't-recall, say-what-you-did, no-auto-memory, reports-in-
  reports/, failure-criterion, READY-only-reaches-builder, post-closeout-maintenance, deterministic-
  work→script, write-docs-trimmed, scope-discipline): pick the one home the audit names, cross-ref the
  rest. Where CLAUDE.md and a rules doc both state a Builder-facing craft rule, CLAUDE.md keeps the
  one-liner.

## Out of scope

- Fit adaptations (req-72) and gaps (req-73) — structure only here, no policy/behaviour change.
- Deleting or rewording any DEC. No change to what any rule *says* — only where it lives.
- `DECISIONS.md` archive trimming (the audit's ~150 build-narrative lines) — defer; ledger stays.

## Acceptance

- Every rule in the home map appears **in full once**; other mentions are a cross-ref (grep each rule's
  key phrase → one full statement + N pointers). No rule LOST: a checklist mapping each of the ~15 rules
  → its home + the cross-refs that replaced its copies, in the report.
- PLANNING.md's two internal duplicates (git-command list, re-check-by-kind) are single.
- Net machinery shrinks materially (target −200+ lines); report the before/after `wc -l` per file.
- `CLAUDE.md` still stands alone for Builder (every rule Builder needs mid-build is at least one line in
  it). `check_handoff` passes. Independent reviewer confirms no fact dropped and no new contradiction.
