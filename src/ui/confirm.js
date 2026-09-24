// req-24 / DEC-079 — the in-app confirm, replacing every native browser dialog.
//
// A tiny module-level store, not React state, so plain modules (workout-actions.js,
// import-backup.js) can ask too. `askConfirm(message, { confirmLabel })` opens the one
// bottom sheet (<ConfirmSheet/> in ui/index.jsx, mounted once in App) and resolves
// true on the destructive button, false on Cancel / backdrop / Escape / navigation.
// Only one question is open at a time: a new ask cancels (resolves false) the old one.
// Pure JS, so `node --test` drives it with answerConfirm() — no DOM needed.

let pending = null // { message, confirmLabel, resolve }
const listeners = new Set()

function emit() {
  for (const fn of listeners) fn()
}

export function askConfirm(message, { confirmLabel = 'OK' } = {}) {
  if (pending) pending.resolve(false)
  return new Promise((resolve) => {
    pending = { message, confirmLabel, resolve }
    emit()
  })
}

export function answerConfirm(value) {
  if (!pending) return
  const { resolve } = pending
  pending = null
  emit()
  resolve(!!value)
}

export function getPendingConfirm() {
  return pending
}

export function subscribeConfirm(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
