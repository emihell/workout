# req-07 — back up current data before a destructive import

Branch: `req-07-backup-before-import`. Gate: **persisted-data** (DEC-009) — wraps a wholesale
replace; **waits for Emilio's hands before merge**, never auto-closed.

## Migration ask-gate (what happens to saved state)

This req does **not** delete or bulk-rewrite state itself — it adds a **safety net** around the
existing destructive import. On the confirm's OK, a backup of the **current** database is
auto-downloaded (the same file the Export button produces) **before** `applyBackup` replaces
everything. So an accidental overwrite is now recoverable from the downloaded file; nothing about
the replace itself changes. The native `confirm('Replace all data on this device?')` is kept
as-is (restyling it is a separate backlog item).

## Technical

### What changed

- **New module `src/import-backup.js`** — home of the one shared destructive-import path (my
  call on placement; it needs `buildBackup` + a download + the store, and belongs with neither
  view specifically):
  - `downloadJson(filename, data)` — moved here verbatim from `Settings.jsx` so there is one
    implementation, shared by Settings' Export button and the safety backup.
  - `importWithBackup({ store, payload, confirm, download })` — (a) `confirm` (existing wording),
    (b) on OK, `download(workout-database-<date>.json, buildBackup(store))` of **current** state,
    (c) `store.applyBackup(payload)`, (d) return the result (or `null` on cancel). `confirm` and
    `download` default to `window.confirm` / `downloadJson` and are injected in tests. The
    `applyBackup` throw on a malformed payload **propagates unchanged**.
- **`Settings.jsx`** — deleted its local `downloadJson` and its inline confirm→apply body; the
  Import handler now calls `importWithBackup({ store, payload })`, renders `backupLines(summary)`
  on success, `null` = cancelled, and keeps its inline error rendering in the same `catch`. Its
  Export button imports the shared `downloadJson`.
- **`Today.jsx`** (empty-state importer) — same: calls `importWithBackup`, keeps its `window.alert`
  error rendering.

Consolidation confirmed — no second copy of the confirm→apply logic remains:
```
$ grep -rn "store.applyBackup\|window.confirm('Replace" src/views/
(none — both sites use importWithBackup)
$ grep -rn "importWithBackup" src/views/
Today.jsx:85:    const result = importWithBackup({ store, payload })
Settings.jsx:74:  const result = importWithBackup({ store, payload })
```

### Choices the spec left to me (listed per the req)

- **Helper home:** new `src/import-backup.js` (not an export of `exchange.js`/`store.jsx`) — it
  orchestrates a DOM download + store call, which is view-adjacent glue, not backup format logic
  (that stays in `exchange.js`) or store internals.
- **Filename:** `workout-database-<date>.json` — identical to the Export button's, so the safety
  backup is indistinguishable from a manual export and re-imports the same way.
- **Order:** download **before** `applyBackup`, so the backup always captures pre-import state.
  On a malformed import the backup still fires (of the untouched current state) and then the
  error surfaces — the backup is correct either way, which is what the req's "regardless of
  order" clause requires.
- **`recordButton('import')` (req-08) placement:** moved to fire only after a real, non-cancelled
  import (`if (!result) return` first), preserving req-08's "count real imports, not cancels".
- **Cancel signalling:** helper returns `null` on cancel so each caller can skip its success
  rendering without a second confirm.

### Out of scope, respected

No change to the backup format, `applyBackup` semantics, or the native confirm; no offer-and-wait
UI, no periodic/cloud backup, no restore UI.

## Verified

`node --test src/import-backup.test.js` — **3 pass, 0 fail** (fake store mirroring store.jsx;
injected confirm/download):

- **Backup precedes replace:** captured download's `data.state.exercises[0].id === 'ex-old'`
  (pre-import), while the store afterward holds `'ex-new'` — the backup is the OLD data.
- **Failure case (required):** `{ kind: 'nope' }` → `importWithBackup` throws
  `Not a workout database backup.` (same message as today), store `exercises` is the same
  reference as before (unchanged), and the safety backup of the untouched state was still made.
- **Cancel:** returns `null`, downloads nothing, state untouched.

`./check` — **green:**
```
# tests 99
# pass 99
# fail 0
check: green — lint, 13 test file(s), and the build all passed.
```

### Acceptance criteria → receipts

- Backup precedes replace — unit-tested (old-state captured); the real file download is the human
  "use it" check.
- One path, two sites — grep receipts above; both call `importWithBackup`, no duplicated body.
- Failure case — unit-tested (malformed payload doesn't replace, same error).
- No regression — `./check` green; existing `exchange.test.js` stays green (99 tests total).

## Workflow

- **No scope changes.** Built exactly the DEC-004 auto-download-before-replace with one shared
  helper.
- **Touched req-08's `recordButton('import')`** (merged since): moved it after the cancel check so
  a cancelled import isn't counted — a small correctness carry, noted here.
- **Required human gate (persisted-data):** automated tests prove the helper backs up pre-import
  state and that a bad file doesn't replace anything, but the actual browser download (a real file
  landing in Downloads, openable and re-importable) is the merge gate — Emilio's hands.
