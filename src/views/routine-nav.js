// req-165 (F-LINT-1) — the routine-editor route set for a base path, shared by the
// routine, schedule-slot, workout-setup and history-recalc flows. Moved out of
// Routine.jsx so that file exports components only. JSX-free.
// req-215 — `showDays`: the Days row (the routine and scheduled-workout screens; off in the
// pre-start setup and the history recalc, which edit a workout's exercises, not its days).
export function navForBase(base, done, { extra = null, showDelete = true, showDays = true } = {}) {
  return {
    base,
    done,
    extra,
    showDelete,
    showDays,
    edit: `${base}/edit`,
    pick: `${base}/exercise/new`,
    create: `${base}/exercise/create`,
    createManual: `${base}/exercise/create/manual`,
    createSearch: `${base}/exercise/create/search`,
    newItem: (exerciseId) => `${base}/exercise/new/${exerciseId}`,
    item: (itemId) => `${base}/exercise/${itemId}`,
  }
}
