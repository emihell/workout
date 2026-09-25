# req-164 — split `storage.js` by job; break the model ↔ workout-log import cycle

**Status: READY** (2026-09-25) — **Lane: tooling** (pure refactor, no behaviour change) — shared core → reviewer
mandatory. DEC-085 §10. After req-165. Source: `audits/2026-09-24.md` **F-STRUCT-6** (39 exports, 15 importers; only ~10
are persistence; the `model.js` ↔ `workout-log.js` cycle forces a duplicate `isSkipped` in `progress.js`; `store.jsx` has
10 inline reducers).

1. Split `storage.js` into modules by job — persistence (load/save/migrate keys/lock/copies), history queries (last sets,
   prefill, previous workouts, summary stats), reducers — keeping `storage.js` as a thin re-export for one release so
   imports can move in the same PR (Builder's call: move all importers now, or re-export; say which).
2. Break the `model.js` ↔ `workout-log.js` cycle; delete the duplicate `isSkipped` in `progress.js`.
3. Move `store.jsx`'s inline reducers next to the other reducers (pure, tested).
4. Update `handoff/reference/`-bound notes in the report (planning updates the reference docs).

## Acceptance criteria

- **No behaviour change:** every existing test passes **unedited** except import paths (each listed), the smoke is green,
  and a v8→v9 migration + load/save round-trip deep-equals main on `src/db.json` (paste).
- `madge`-style or a grep receipt: no import cycle among model/workout-log/storage modules (paste the tool output or a
  small script's).
- Bundle size within ±1 kB of main (paste both).
- Reviewer before merge.
