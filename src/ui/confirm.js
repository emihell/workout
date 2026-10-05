// req-24 / DEC-079 — the in-app confirm, replacing every native browser dialog.
//
// A tiny module-level store, not React state, so plain modules (workout-actions.js,
// import-backup.js) can ask too. `askConfirm(message, { confirmLabel })` opens the one
// bottom sheet (<ConfirmSheet/> in ui/index.jsx, mounted once in App) and resolves
// true on the destructive button, false on Cancel / backdrop / Escape / navigation.
// Only one question is open at a time: a new ask cancels (resolves false) the old one.
// Pure JS, so `node --test` drives it with answerConfirm() — no DOM needed.
//
// req-187 — optional `title` (a bold first line), `cancelLabel` (default "Cancel", e.g.
// "Keep 20 kg") and `stayOn` (a route path, e.g. '/workout/r1'): a hashchange that lands on
// `stayOn` does NOT answer the sheet, so it can be opened alongside the navigation to that
// screen and survive it. Any other navigation still answers false.

// req-188 — `askChoice(message, { title, choices: [{ value, label }] })`: the same one sheet
// with a button per choice (stacked) above Cancel; resolves the chosen `value`, or null on
// Cancel / backdrop / Escape / navigation. A plain askConfirm still resolves a boolean.

let pending = null // { message, confirmLabel, cancelLabel, title, stayOn, choices, resolve }
const listeners = new Set()

function emit() {
  for (const fn of listeners) fn()
}

export function askConfirm(message, { confirmLabel = 'OK', cancelLabel = 'Cancel', title = null, stayOn = null } = {}) {
  if (pending) pending.resolve(pending.choices ? null : false)
  return new Promise((resolve) => {
    pending = { message, confirmLabel, cancelLabel, title, stayOn, resolve }
    emit()
  })
}

export function askChoice(message, { title = null, choices = [], cancelLabel = 'Cancel' } = {}) {
  if (pending) pending.resolve(pending.choices ? null : false)
  return new Promise((resolve) => {
    pending = { message, confirmLabel: null, cancelLabel, title, stayOn: null, choices, resolve }
    emit()
  })
}

export function answerConfirm(value) {
  if (!pending) return
  const { resolve, choices } = pending
  pending = null
  emit()
  if (choices) resolve(choices.some((choice) => choice.value === value) ? value : null)
  else resolve(!!value)
}

export function getPendingConfirm() {
  return pending
}

export function subscribeConfirm(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// req-187 — does a navigation to `hash` answer (cancel) the open sheet? Yes, unless the
// sheet was opened with `stayOn` and the new route is that path (query ignored).
export function navigationCancels(open, hash) {
  if (!open) return false
  if (!open.stayOn) return true
  const path = (value) => {
    const raw = String(value || '').replace(/^#/, '') || '/'
    return (raw.startsWith('/') ? raw : `/${raw}`).split('?')[0]
  }
  return path(hash) !== path(open.stayOn)
}
