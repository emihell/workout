import { applyBackup as validateBackup, buildBackup } from './exchange.js'
import { askConfirm } from './ui/confirm.js'
import { dateKey } from './schedule.js'
import { getLoadUnreadable, keepUnreadableCopy, readUnreadableValues, releaseUnreadable } from './persistence.js'

// req-157 — the object URL is revoked a while AFTER the click, not synchronously: revoking
// straight away can cancel a download the browser hasn't started reading yet.
const REVOKE_AFTER_MS = 60_000

function downloadBlob(filename, blob) {
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(href), REVOKE_AFTER_MS)
}

// The one download implementation, shared by Settings' Export button and the
// destructive-import safety backup below (was duplicated in Settings.jsx).
export function downloadJson(filename, data) {
  downloadBlob(filename, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
}

// req-157 — a string saved as-is (no JSON re-serialising). A Blob is UTF-8, so an unpaired
// surrogate becomes U+FFFD here; the on-device copy (keepUnreadableCopy) keeps it exactly.
export function downloadText(filename, text) {
  downloadBlob(filename, new Blob([text], { type: 'text/plain' }))
}

export const REPLACE_MESSAGE = 'Replace all data on this device?'
export const REPLACE_UNREADABLE_MESSAGE =
  "Replace all data on this device? The saved data that couldn't be read is kept as a copy on this device and downloaded first."
export const KEEP_FAILED_MESSAGE =
  "Couldn't keep a copy of the unreadable data on this device, so nothing was imported. It is still stored as it was."
// req-161 — the copy didn't fit. Export can't help (it would only hold the empty state), so
// name the one thing the user can do — and warn off clearing THIS app's data, which holds it.
export const KEEP_NO_SPACE_MESSAGE =
  "Couldn't keep a copy of the unreadable data: this browser's storage is full. Nothing was imported, and the data is still stored as it was. To make room, clear the website data of other sites in your browser's settings (not this app's — it holds the data), then try Import again."

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
// req-157 (audit F-RISK-5, DEC-085 §2, refines DEC-032) — in the unreadable state saveState
// refuses every write so the stored value survives; Import used to report success and save
// nothing. Now, after the same validate-first check and a confirm that says so, the raw
// value is never put at risk: in order,
//   1. read it fresh from disk (after the confirm);
//   2. keep an on-device copy under `workout-mvp-unreadable-<ISO time>-<v9|v8|…>`, read back
//      ===, for EVERY workout key present (req-161: a leftover legacy key too; an identical
//      copy of the same source is reused, not re-written); if any fails → throw
//      KEEP_FAILED_MESSAGE, or KEEP_NO_SPACE_MESSAGE when storage is full (the sites show it
//      inline): lock kept, nothing saved;
//   3. download the value the load read as `workout-unreadable-<date>.txt` IN PLACE OF the
//      usual backup (which would only hold the empty in-memory state); a throw here also
//      keeps the lock;
//   4. only then lift the lock and import, so the import is really saved.
// A download that returns proves nothing reached the user (iOS asks "Download?" later) —
// that is why step 2 comes first. The copy is never deleted by the app.
// If getItem says the value is gone there is nothing to keep: the usual backup runs, then
// the lock lifts. If getItem THROWS we can't tell → abort, lock kept.
// Cancel or a bad file: nothing read, kept, downloaded or saved. `unreadable`,
// `unreadableValues`, `keepCopy`, `release`, `downloadRaw` are injected for tests.
export async function importWithBackup({
  store,
  payload,
  ask = (message) => askConfirm(message, { confirmLabel: 'Replace' }),
  download = downloadJson,
  downloadRaw = downloadText,
  unreadable = getLoadUnreadable,
  unreadableValues = readUnreadableValues,
  keepCopy = keepUnreadableCopy,
  release = releaseUnreadable,
}) {
  validateBackup(payload)
  const locked = unreadable()
  if (!(await ask(locked ? REPLACE_UNREADABLE_MESSAGE : REPLACE_MESSAGE))) return null
  const today = dateKey(new Date())
  const read = locked ? unreadableValues() : { unlocked: true }
  if (read.error) throw new Error(KEEP_FAILED_MESSAGE)
  if (read.values) {
    const now = new Date() // one timestamp for this Import's copies
    for (const { key, raw } of read.values) {
      const kept = keepCopy(raw, key, now)
      if (kept.error) throw new Error(kept.quota ? KEEP_NO_SPACE_MESSAGE : KEEP_FAILED_MESSAGE)
    }
    downloadRaw(`workout-unreadable-${today}.txt`, read.values[0].raw)
  } else {
    // buildBackup(store) uses dataOnly() — the store's functions are filtered out —
    // and structuredClone, so this is a stable snapshot of state before the replace.
    download(`workout-database-${today}.json`, buildBackup(store))
  }
  if (locked) release()
  return store.applyBackup(payload)
}
