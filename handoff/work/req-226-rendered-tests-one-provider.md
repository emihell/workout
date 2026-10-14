**Status: READY** **Lane: tooling** — tests only; no `src/` product code changes.

# req-226 — rendered tests keep one StoreProvider (L-051 sweep) + the anti-staleness app-path gaps

Cleanup batch 2026-10-14 (Emilio: "A cleanup batch - do it"). BACKLOG §batch 5 follow-up (b) and §req-220 follow-up (b).
Builder: throwaway agent (DEC-055).

## Facts (rescanned 2026-10-14, `main` c474c9d)

- L-051: a rendered test that mounts a fresh `StoreProvider` per screen can pass on a write to an unmounted provider; the app
  never does that. req-218's sweep (`reports/req-218.md:25-28`) listed per-screen-remount files: req-175, 176, 177, 179, 180, 188,
  189, 192, 194, 212, 216 (and explicit unmount/re-render ones: 156, 168, 173, 181, 183, 186, 190, 191, 215) — "latent, not failing".
- `grep -l StoreProvider src/*.test.js | xargs grep -l "function mount\|const mount"` (2026-10-14) → 167, 175, 176, 177, 178, 179,
  180, 182, 187, 188, 189, 192, 194, 212, 215, 216 (178/182/187 were already converted by req-218 — re-check, don't redo).
- req-220 reviewer latent: the anti-staleness app-path test doesn't cover History edit / recalc, Swap / Add / Add set / timed /
  Skip through the UI, `applyPlan`, or extra editor-form fields (`reports/req-220.md`).

## Scope

1. Convert every listed **per-screen-remount** harness that still remounts the provider to the L-051 pattern: one `StoreProvider`
   for the test, screens swapped inside it. Explicit unmount/re-render tests that test a reload on purpose stay (say which, why).
2. Extend the req-220 anti-staleness app-path test to the listed paths (each one: drive it through the UI, then assert the stored
   state the import preview sees is current).
3. No product change. If a conversion exposes a real product bug, stop and report it (don't fix it here).

## Out of scope

Any `src/` non-test change; new behaviour; rewriting tests beyond the harness.

## Acceptance criteria

1. The grep above, re-run, lists only files whose remaining remount is a deliberate reload (each named in the report with why).
2. Every converted file passes; total test count before/after is reported, and **no assertion is removed or loosened** (diff
   reviewed per file in the report: harness lines only).
3. **Failure case — could it pass for the wrong reason?** For one converted file, show that a write answered after a screen swap
   now lands in the one provider (an assertion on the stored value that would have passed vacuously before).
4. The anti-staleness test covers each listed path; reverting the req-220 staleness fix makes each new case fail (revert check).
5. `./check` green.

## Decisions made on Emilio's behalf

- implementation only (test harness). None user-visible.

## READY checks

1. L-051, L-055, req-218, req-220. 2. Siblings: req-227 adds tests to req-222/224 files — build 226 first. 3. none. 4. lists from the
   grep above. 5. no trigger file (tests only). 6. none.
