# req-157 — Import from the "unreadable data" state keeps the raw value first, then really saves

**Status: BUILT — branch `req-157`, NOT merged; `7731c59` sent back (reviewer blocker: the raw value lives only in a download that may not have happened → a verified side key first, Planner's call, unconfirmed).** (2026-09-24) — Phase 1 bug, **persisted data** (reviewer + DEC-046 backup reminder before merge). DEC-085
§2; refines DEC-032. Source: `audits/2026-09-24.md` **F-RISK-5**.

Today: when the stored value can't be read, `saveState` refuses every write (`storage.js:208`, DEC-032, to keep the
possibly-recoverable raw value). Import then shows success but nothing is saved — the import and anything logged after it
vanish on reload.

**Fix:** in the unreadable state, Import (after its validate-first check and the confirm sheet, req-24) **first downloads
the raw stored string** as a file (e.g. `workout-unreadable-<date>.txt`, exact bytes), and only after that download has been
triggered clears the unreadable lock and saves the imported state. Cancel → nothing changes, lock stays. Say in the sheet's
message that the unreadable data will be downloaded first. Outside the unreadable state, Import is unchanged.

## Acceptance criteria

- Unit: unreadable state + valid import + confirm → one download whose content equals the raw stored string byte-for-byte,
  then the new state is saved and a reload loads it. Cancel → no download, no save, lock kept. Invalid file → error, nothing
  downloaded, lock kept.
- Browser (isolated origin; seed the key with a corrupt string): the above, with the stored value pasted before/after.
- `./check` green (paste). Reviewer before merge.
