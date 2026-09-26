// req-178 (DEC-096 §6, DEC-100 Q1) — the one-time fill: since the routine now sets the
// workout's kg, each routine item's kg is brought in line with the exercise's latest
// finished history once, so the next workout reads as it did before (history seeded it).
// Pure: loadState (persistence.js) runs it ONCE PER DEVICE, guarded by a marker kept in its
// own localStorage key (DEVICE_FILL_KEY), outside the state document, so no Import (an old
// Export, an assistant's reply) can remove it and re-trigger a fill (req-178 review, DEC-095).
// The dry run (scripts/fill-routine-kg.mjs) runs the SAME function on an Export.
//
// Per routine item — a weighted exercise with a history prescription that has kg:
//   for each set i < min(item sets, history sets) with history kg > 0 → to[i] = history[i].
// - 'overwrite' (DEC-100, the shipped mode): any routine kg at i is replaced.
// - 'blanks' (Q1 option b, dry run only): only items with no kg > 0 at all are filled.
// Other positions, items, fields, workouts and the schedule are untouched. A position the
// routine didn't have yet (shorter list) is padded with 0 — "no weight" (req-113).
import { isWeightedType } from './ids.js'
import { historyPrescription } from './history-queries.js'
import { exerciseById } from './model.js'

// The device marker: an ISO time, set once the fill has run (or at a blank device's start).
// Not under `workout-mvp-`, so the unreadable-copy scan and the legacy cleanup never see it.
export const DEVICE_FILL_KEY = 'workout-routine-kg-filled'

function sameKg(a, b) {
  const x = a || []
  const y = b || []
  const n = Math.max(x.length, y.length)
  for (let i = 0; i < n; i++) if ((Number(x[i]) || 0) !== (Number(y[i]) || 0)) return false
  return x.length === y.length
}

// One item's filled kg list, or null when it wouldn't change.
export function filledKg(item, exercise, workouts, mode = 'overwrite') {
  if (!exercise || !isWeightedType(exercise.type)) return null
  const history = historyPrescription(workouts, item.exerciseId)
  const kg = history?.suggestedWeights || []
  if (!kg.some((value) => Number(value) > 0)) return null
  const from = Array.isArray(item.suggestedWeights) ? item.suggestedWeights : []
  if (mode === 'blanks' && from.some((value) => Number(value) > 0)) return null
  const sets = Math.max(1, Number(item.sets) || 1)
  const to = [...from]
  for (let i = 0; i < Math.min(sets, kg.length); i++) {
    if (!(Number(kg[i]) > 0)) continue
    while (to.length < i) to.push(0)
    to[i] = Number(kg[i])
  }
  return sameKg(from, to) ? null : to
}

// → { state, changes: [{ routineId, routineName, itemId, exerciseId, exerciseName, from, to }] }.
// No change → the same state object. Whether to run it at all is the caller's (the device marker).
export function fillRoutineKgFromHistory(state, { mode = 'overwrite' } = {}) {
  const changes = []
  const routines = (state?.routines || []).map((routine) => {
    let changed = false
    const exercises = (routine.exercises || []).map((item) => {
      const exercise = exerciseById(state.exercises, item.exerciseId)
      const to = filledKg(item, exercise, state.workouts, mode)
      if (!to) return item
      changed = true
      changes.push({
        routineId: routine.id,
        routineName: routine.name,
        itemId: item.id,
        exerciseId: item.exerciseId,
        exerciseName: exercise?.name || item.exerciseId,
        from: item.suggestedWeights || [],
        to,
      })
      return { ...item, suggestedWeights: to }
    })
    return changed ? { ...routine, exercises } : routine
  })
  return { state: changes.length ? { ...state, routines } : state, changes }
}
