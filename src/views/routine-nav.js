// req-165 (F-LINT-1) — the routine-editor route set for a base path, shared by the
// routine, schedule-slot, workout-setup and history-recalc flows. Moved out of
// Routine.jsx so that file exports components only. JSX-free.
export function navForBase(base, done, { extra = null, showDelete = true } = {}) {
  return {
    base,
    done,
    extra,
    showDelete,
    edit: `${base}/edit`,
    pick: `${base}/exercise/new`,
    create: `${base}/exercise/create`,
    createManual: `${base}/exercise/create/manual`,
    createSearch: `${base}/exercise/create/search`,
    newItem: (exerciseId) => `${base}/exercise/new/${exerciseId}`,
    item: (itemId) => `${base}/exercise/${itemId}`,
  }
}
