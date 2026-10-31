import { applyBackup as validateBackup, buildBackup, importPreview, previewLines } from './exchange.js'
import { askChoice, askConfirm } from './ui/confirm.js'
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

// req-198 — the one Export: Backup & data's button and the save-failed banner's both call
// this, so the banner's download is the same file. `download` is injectable for tests.
// req-220 — "Export for your AI" is the same backup with `assistant` (the rules and the data
// structure) added, under its own name so the user can tell the two files apart.
export function exportBackup(store, { includeAssistant = false, now = new Date(), download = downloadJson } = {}) {
  const filename = `${includeAssistant ? 'workout-for-ai' : 'workout-database'}-${dateKey(now)}.json`
  download(filename, buildBackup(store, { includeAssistant }))
  return filename
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
//
// req-220 (DEC-123 §2) — the preview. After validation and before the question, the file is
// compared with the current data (exchange.js importPreview) and `ask(message, preview)` shows
// what changes. When the file would change logged history (`preview.conflict`) the answer is
// a choice: 'keep' (Keep my history — the default; `true` means it too) or 'replace'
// (Replace everything); anything falsy cancels. Otherwise it is the plain confirm and a truthy
// answer replaces, as before. In the unreadable state there is no readable data to compare
// with, so `preview` is null and the question is the req-157 one, unchanged. The order after
// the answer — copies, the safety download, then the write — is the same for both choices.
export async function importWithBackup({
  store,
  payload,
  ask = askImport,
  download = downloadJson,
  downloadRaw = downloadText,
  unreadable = getLoadUnreadable,
  unreadableValues = readUnreadableValues,
  keepCopy = keepUnreadableCopy,
  release = releaseUnreadable,
}) {
  const incoming = validateBackup(payload)
  const locked = unreadable()
  const preview = locked ? null : importPreview(store, incoming.state)
  const mode = importMode(await ask(locked ? REPLACE_UNREADABLE_MESSAGE : REPLACE_MESSAGE, preview), preview)
  if (!mode) return null
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
  return mode === 'keep' ? store.applyBackup(payload, { keepHistory: true }) : store.applyBackup(payload)
}

// An answer → 'keep' | 'replace' | null (cancelled). Keep is offered only on a conflict.
export function importMode(answer, preview) {
  if (!answer) return null
  if (!preview?.conflict) return 'replace'
  if (answer === 'replace') return 'replace'
  return answer === true || answer === 'keep' ? 'keep' : null
}

export const HISTORY_CHANGED_TITLE = 'This file changes your logged history'
export const KEEP_HISTORY_LINE =
  'Keep my history takes the workouts, exercises and schedule from the file and keeps your logged history on this device as it is. A copy of your current data downloads first.'
// req-264 (DEC-155 §2, reversing req-220 review round 1) — "Keep my history" is the highlighted
// choice (filled primary); "Replace everything" wears the plain secondary look, no other
// "destructive" marking (DEC-017: no danger variant). Keep stays first and the default answer.
export const IMPORT_CHOICES = [
  { value: 'keep', label: 'Keep my history', primary: true },
  { value: 'replace', label: 'Replace everything' },
]

// The default `ask`: the in-app sheet with the preview above the question (req-220). On a
// conflict the preview's archived line describes Keep (the default); the plain confirm's
// describes the replace it confirms.
export function askImport(message, preview) {
  if (!preview) return askConfirm(message, { confirmLabel: 'Replace' })
  const lines = previewLines(preview).join('\n')
  if (preview.conflict) {
    return askChoice(`${lines}\n\n${KEEP_HISTORY_LINE}`, { title: HISTORY_CHANGED_TITLE, choices: IMPORT_CHOICES })
  }
  return askConfirm(`${lines}\n\n${message}`, { confirmLabel: 'Replace' })
}
