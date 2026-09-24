import { applyBackup as validateBackup, buildBackup } from './exchange.js'
import { askConfirm } from './ui/confirm.js'
import { dateKey } from './schedule.js'
import { getLoadUnreadable, readUnreadableRaw, releaseUnreadable } from './storage.js'

// The one download implementation, shared by Settings' Export button and the
// destructive-import safety backup below (was duplicated in Settings.jsx).
export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.click()
  URL.revokeObjectURL(href)
}

// req-157 — a string saved as-is (no JSON re-serialising), so the unreadable value is
// downloaded exactly as stored.
export function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain' })
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.click()
  URL.revokeObjectURL(href)
}

export const REPLACE_MESSAGE = 'Replace all data on this device?'
export const REPLACE_UNREADABLE_MESSAGE =
  "Replace all data on this device? The saved data that couldn't be read will be downloaded first, exactly as stored."

// req-07 / DEC-004 — the single destructive-import path both import sites call.
//
// Importing replaces ALL state with no undo. Before that replace, auto-download a
// backup of CURRENT state (the same file the Export button produces) so an
// accidental overwrite is recoverable. The download is fired, not blocked on, and
// happens BEFORE applyBackup so the backup always captures the pre-import state.
//
// req-24 — the file is validated BEFORE the question: exchange's pure applyBackup
// runs first and throws on a non-backup file (e.g. the analytics export), so a wrong
// file surfaces its error and never shows "Replace all data on this device?".
//
// `ask` and `download` are injected (defaulting to the in-app confirm sheet /
// downloadJson) so the flow is unit-testable without a DOM. `ask` may return a
// boolean or a Promise of one. Resolves null if the user cancels, otherwise the
// applyBackup result for the caller to render. A malformed payload rejects with the
// validation error (current state left untouched, nothing asked, nothing downloaded)
// so each site surfaces the same error it does today.
//
// req-157 (audit F-RISK-5, DEC-085 §2) — in the unreadable state (DEC-032: saveState refuses
// every write so the stored value survives), Import used to report success and save
// nothing. Now, after the same validate-first check and a confirm that says so, it
// downloads the raw stored string as `workout-unreadable-<date>.txt` IN PLACE OF the usual
// backup (which would only hold the empty in-memory state), then lifts the lock, then
// imports — so the import is really saved. Cancel or a bad file: nothing downloaded, lock
// kept. If the value is already gone from disk there is nothing to keep: the lock is lifted
// and the usual backup runs. `unreadableRaw` / `release` / `downloadRaw` are injected for tests.
export async function importWithBackup({
  store,
  payload,
  ask = (message) => askConfirm(message, { confirmLabel: 'Replace' }),
  download = downloadJson,
  downloadRaw = downloadText,
  unreadable = getLoadUnreadable,
  unreadableRaw = readUnreadableRaw,
  release = releaseUnreadable,
}) {
  validateBackup(payload)
  const raw = unreadable() ? unreadableRaw() : null
  if (!(await ask(raw != null ? REPLACE_UNREADABLE_MESSAGE : REPLACE_MESSAGE))) return null
  const today = dateKey(new Date())
  if (raw != null) {
    downloadRaw(`workout-unreadable-${today}.txt`, raw)
    release()
  } else {
    if (unreadable()) release()
    // buildBackup(store) uses dataOnly() — the store's functions are filtered out —
    // and structuredClone, so this is a stable snapshot of state before the replace.
    download(`workout-database-${today}.json`, buildBackup(store))
  }
  return store.applyBackup(payload)
}
