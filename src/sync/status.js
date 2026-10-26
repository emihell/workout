// req-230 (DEC-132 §2) — the one sync line on Backup & data. No conflict banner: the losing
// version of a record edited on two devices stays on the server.
import { createContext } from 'react'

// The engine of the server build, or null (the plain build never provides one).
export const SyncContext = createContext(null)

export const NOT_SYNCED = 'Not synced yet — saved on this phone, will send when online'

function ago(ms) {
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? '1 day ago' : `${days} days ago`
}

const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(1)

export function syncLine(status, now = Date.now()) {
  if (status.error?.kind === 'too-large') {
    return `Not synced — too much data to send (${mb(status.error.bytes)} MB; the server takes 20 MB). It's saved on this phone.`
  }
  if (status.error?.kind === 'server') {
    return `Not synced — the server refused it: ${status.error.message} It's saved on this phone.`
  }
  if (status.dirty || !status.syncedAt) return NOT_SYNCED
  return `Synced · ${ago(now - Date.parse(status.syncedAt))}`
}
