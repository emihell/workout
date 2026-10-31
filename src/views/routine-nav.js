// req-165 (F-LINT-1) — the routine-editor route set for a base path, shared by the
// routine, schedule-slot, workout-setup and history-recalc flows. Moved out of
// Routine.jsx so that file exports components only. JSX-free.
// req-215 — `showDays`: the Days row (the routine and scheduled-workout screens; off in the
// pre-start setup and the history recalc, which edit a workout's exercises, not its days).
//
// req-263 (DEC-155 §6) — `from`: the routine screen's own `?from=` (only the history recalc
// passes one). With it, every link down to an inner screen carries the chain (childLink,
// DEC-092) and `up` — where every inner exit returns — is the routine screen *with* its
// `from`, so the routine's Back still unwinds to where it was entered from. With no `from`
// (the other three flows) every path is the plain string it always was, and `up === base`.
import { withFrom } from '../route.js'

export function navForBase(base, done, { extra = null, showDelete = true, showDays = true, from = null } = {}) {
  // `link(child, parent)`: `child`, carrying `parent` as its return path when this routine
  // screen was entered with a `from`; the plain `child` otherwise.
  const link = (child, parent) => (from ? withFrom(child, parent) : child)
  const up = link(base, from)
  const pick = link(`${base}/exercise/new`, up)
  const create = link(`${base}/exercise/create`, pick)
  const item = (itemId) => link(`${base}/exercise/${itemId}`, up)
  return {
    base,
    done,
    extra,
    showDelete,
    showDays,
    up,
    edit: link(`${base}/edit`, up),
    pick,
    create,
    createManual: link(`${base}/exercise/create/manual`, create),
    createSearch: link(`${base}/exercise/create/search`, create),
    newItem: (exerciseId) => link(`${base}/exercise/new/${exerciseId}`, pick),
    item,
    // req-242 — the item editor's "Change exercise" picker.
    change: (itemId) => link(`${base}/exercise/${itemId}/change`, item(itemId)),
  }
}
