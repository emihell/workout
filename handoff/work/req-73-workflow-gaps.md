# req-73 — Fill the workflow gaps the audit found

**Status: SHIPPED 2026-09-14** — planning-owned, published to `main`. Workflow-audit follow-up #4
(`audits/workflow-2026-09-14.md` §4). Planner-owned.
Four small doc-gap fills; the 5th gap (`reference/migration.md`) is deferred to its own req (req-75)
because it must be derived carefully from `src/storage.js`, not rushed into a multi-gap change.

## Gaps (audit §4) and the fills

1. **No backup discipline for the irreplaceable store.** The whole workflow rests on "localStorage has
   no undo" yet never prompts a backup. **Fill:** before merging any persisted-data / migration req,
   Planner reminds Emilio to export a fresh backup first (the app has Export); plus a periodic reminder.
   **Marked `unconfirmed`** — Emilio flagged this as a policy call; conservative default pending his
   ratification.
2. **No "done" for the design-unsettled (live) lane.** DEC-037's Emilio+CC-live lane says "fold the
   result in when it lands" but never says what *closes* it. **Fill:** state that it closes like any
   other req — Planner writes the settled result up as a req doc (+ any `DEC-`), then runs the normal
   gate + `closeout`.
3. **No cadence to re-fit the workflow to the project.** The product `/audit` targets code; the
   machinery only got audited because Emilio asked ad hoc. **Fill:** note in `rules/AUDIT.md` that a
   companion **workflow-fit audit** runs between milestones (same diagnose-don't-treat discipline).
4. **No pruning/entry-path rule for the append-only logs.** `DECISIONS.md` is 937 lines, unbounded.
   **Fill:** a line in the `DECISIONS.md` header — the digest is the read path; if the archive grows
   unwieldy (~1000+ lines) superseded entries may be split to a `DECISIONS-archive.md`, digest stays
   the entry point. (Append-only mandate preserved; this is guidance, not a rewrite.)

## Out of scope

- `reference/migration.md` (gap 5) → **req-75**, derived from `storage.js`.
- Any code / `plan` / `check_handoff` change. No new DEC (the backup rule stays unconfirmed guidance
  until Emilio ratifies it into a DEC).

## Acceptance

- PLANNING.md: the persisted-data/migration guidance includes the backup reminder, marked `unconfirmed`;
  the live lane states how it closes.
- `rules/AUDIT.md`: names the companion workflow-fit audit cadence.
- `DECISIONS.md` header: names the digest as read path + the archive-split option.
- `check_handoff` passes.
