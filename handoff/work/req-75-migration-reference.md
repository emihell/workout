# req-75 — Refresh the migration reference (don't duplicate it)

**Status: SHIPPED 2026-09-14** — planning-owned, published to `main`. Workflow-audit follow-up #5.

## Why (and why it changed shape)

Audit §4 gap-5 said migration behaviour "lives mostly in prose … rather than one authoritative
`reference/migration.md`" and implied one should be created. **On inspection that gap was inaccurate:**
`handoff/reference/schema.md` ("Persistence: schema, **migration**, recommendation increments") already
IS the authoritative, code-measured migration reference — keys, load+migrate flow, the uniform
(non-version-branched) `migrateState`, per-shape transforms, and test coverage, all cited. Creating a
second `migration.md` would re-introduce exactly the duplication reqs 70–71 just removed. **So the correct
action is to refresh the existing reference, not duplicate it** — and it had drifted from the code (it was
measured 2026-09-12; two of the reqs it described as "open" have since shipped).

## What was done

- **schema.md drift fixes (verified against current `src/storage.js` / `src/model.js`):**
  - The corrupt-but-present v8 caveat was stale — it described the overwrite as an *open req*. req-36 /
    DEC-032 shipped: the value is now preserved, `loadUnreadable` latches, `saveState` refuses to write,
    banner shown (`storage.js:163-183, 186-189`; test `storage.test.js:320-340`). Rewritten to current.
  - v5 was marked untested; req-37 shipped a v5 round-trip test (`storage.test.js:238-274`). Table + note
    updated to shipped.
  - Stale line cites refreshed (`loadState` 64-80→140-184; `migrateState` 219→221); re-verified date added.
- **Audit persisted + a home established:** the workflow-fit audit now lives at
  `handoff/audits/workflow-2026-09-14.md` (planning's domain — committable without crossing DEC-005);
  `rules/AUDIT.md` records that workflow audits go to `handoff/audits/`, product audits to root `audits/`.
- **DEC-046** (backup discipline ratified — see that DEC) rides this publish.

## Out of scope

- Creating `reference/migration.md` — rejected; it would duplicate schema.md.

## Acceptance

- schema.md matches current code: corrupt-key = preserve+banner (not "open"), v5 = tested, cites current.
- Audit at `handoff/audits/workflow-2026-09-14.md`; AUDIT.md names the home. `check_handoff` passes.
