import { buildBackup } from './exchange.js'
import { dateKey } from './schedule.js'

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

// req-07 / DEC-004 — the single destructive-import path both import sites call.
//
// Importing replaces ALL state with no undo. Before that replace, auto-download a
// backup of CURRENT state (the same file the Export button produces) so an
// accidental overwrite is recoverable. The download is fired, not blocked on, and
// happens BEFORE applyBackup so the backup always captures the pre-import state.
//
// `confirm` and `download` are injected (defaulting to the real window.confirm /
// downloadJson) so the flow is unit-testable without a DOM. Returns null if the
// user cancels, otherwise the applyBackup result for the caller to render. A
// malformed payload makes store.applyBackup throw; that throw propagates unchanged
// (current state left untouched) so each site surfaces the same error it does today.
export function importWithBackup({
  store,
  payload,
  confirm = (message) => window.confirm(message),
  download = downloadJson,
}) {
  if (!confirm('Replace all data on this device?')) return null
  // buildBackup(store) uses dataOnly() — the store's functions are filtered out —
  // and structuredClone, so this is a stable snapshot of state before the replace.
  download(`workout-database-${dateKey(new Date())}.json`, buildBackup(store))
  return store.applyBackup(payload)
}
