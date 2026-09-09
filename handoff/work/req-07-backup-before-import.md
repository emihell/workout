# req-07 — back up current data before a destructive import

**Status: READY** — decision made (DEC-004: auto-download current state before the replace).
Independent of all other reqs. Safe to build.

**Gate: persisted-data** (DEC-009) — wraps a wholesale replace of stored state. **Always waits for Emilio's hands before merge; never auto-closed** by the planning session (CLAUDE.md migration ask-gate).

## Why

Both import entry points replace the entire database after a single native confirm, with
**no way to recover the data that was there**:

- `src/views/Settings.jsx:63-79` — `confirm('Replace all data on this device?')` →
  `store.applyBackup(payload)`.
- `src/views/Today.jsx:80-95` (the empty-state importer) — the same
  `confirm('Replace all data on this device?')` → `store.applyBackup(payload)`.

`store.applyBackup` (`src/store.jsx:370-377`) replaces state wholesale via `applyBackupFn`
(`src/exchange.js:155`), and the store persists it immediately (`saveState` in the
`setState` updater, `store.jsx:13-19`). For an app whose entire value is a trustworthy
record, "one wrong file + one reflexive confirm → history gone, no undo" is the sharpest
edge in the product. [measured] — two call sites do `confirm` then `applyBackup`; the
export helper `buildBackup` (`exchange.js:130`) and a `downloadJson` (`Settings.jsx:7-15`)
already exist, so the machinery to save current state is in the codebase.

The backlog pairs this with consolidating the **duplicated import path**: Today's empty
state and Settings implement the same confirm→apply flow twice. Fix both by routing them
through one shared helper.

## The behaviour (decided — DEC-004)

**Auto-download.** On the existing confirm's OK, automatically download a `buildBackup` of
*current* state (the same file the Export button produces) **before** applying the incoming
payload. No new UI. The download is fired, not blocked on. Rejected: offer-and-wait — it
wants real inline UI and would pull the separate "replace native `alert`/`confirm` with
inline UI" backlog item into scope; this req is a data-safety net, not a UX polish pass, and
the offer-first benefit is largely moot at Today's empty-state site (nothing to lose).

## Scope

- Introduce **one shared import helper** that both `Settings.jsx` and `Today.jsx` call, so
  the confirm→back-up→apply sequence is defined once. Its home (a small module, or an
  export from `exchange.js`/`store.jsx`) is CC's call — name it in the report.
- The helper, before it calls `applyBackup`: build a backup of **current** state
  (`buildBackup(store)`) and (option A) download it via the existing `downloadJson`
  pattern. Only then apply the incoming payload.
- Preserve each site's existing feedback: Settings shows `backupLines(result.summary)` /
  error; Today shows its `alert` on parse failure. The helper must not swallow the
  parse/apply error path — a malformed file still reports the same message it does today.
- Do not back up on a *failed* import: if the incoming payload is invalid (`applyBackup`
  throws before replacing anything), the current data is untouched anyway — but ensure the
  safety backup is of the pre-import state regardless of order.

## Out of scope

- Replacing the native `confirm('Replace all data on this device?')` with inline UI — that
  is its own backlog item. This req keeps the existing confirm (option A adds a download
  around it; it does not restyle it).
- Automatic/periodic backups, cloud backup, or a restore UI. One-shot "save current state
  before I overwrite it" only.
- Changing the backup file format or `applyBackup` semantics.

## Ordered steps

1. Write the shared helper: given the incoming parsed payload and the store, (a) confirm
   (keep the existing wording), (b) on confirm, `downloadJson(buildBackup(store))` under a
   dated filename like the Export button's, (c) `store.applyBackup(payload)`, (d) return the
   result/summary for the caller to render. Errors from `applyBackup` propagate to the
   caller unchanged.
2. Route `Settings.jsx` and `Today.jsx` through it, deleting the duplicated confirm→apply
   bodies. Keep each site's own success/error rendering.
3. Test (`node --test`): the helper builds a backup of the *pre-import* state before
   applying — assert the backup captures the old data, and that a payload that throws in
   `applyBackup` leaves the current state unreplaced (and still triggers, or cleanly skips,
   the backup per the decided order).

## Acceptance criteria (written before implementation)

- **Backup precedes replace (the point):** importing a valid backup over a non-empty device
  produces a downloaded file whose contents equal the *previous* state, and the store then
  holds the imported data. Prove the "backup captures old state" half with a unit test on
  the helper (inject a fake downloader, assert it received a `buildBackup` of the old
  state); the actual file download is the human "use it" check.
- **One path, two sites:** both Settings import and Today empty-state import go through the
  same helper — no second copy of the confirm→apply logic remains. Show it in the diff.
- **Failure case (required):** importing a **malformed / non-backup** file (e.g.
  `{ kind: 'nope' }`, which `applyBackup` rejects — `exchange.test.js:86-88`) does **not**
  replace current state and surfaces the same error message as today. Assert current state
  is unchanged after the throw.
- **No regression:** existing `exchange.test.js` / import behaviour stays green; `./check`
  green (paste the line).

## Decisions

- **behaviour (Emilio, DEC-004):** auto-download current state before the replace. Confirmed
  2026-09-08. Offer-and-wait rejected (would widen scope into the inline-UI backlog item).
- **implementation (CC's call, list in report):** where the shared helper lives; the
  backup filename; how Today's `alert` and Settings' inline message are preserved through
  the shared path.

## Notes

Completes the persisted-data safety trio with `req-01` (guarded save) and `req-06` (legacy
cleanup): `req-01` stops silent write loss, `req-06` stops orphaned stale copies, this stops
an import from erasing history with no recourse. Smallest-surface option (A) is deliberate —
the inline-confirm redesign is a separate, larger item and should not ride this net.
