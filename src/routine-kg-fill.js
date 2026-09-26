// req-178 (DEC-096 §6, DEC-100 Q1) — the one-time fill: since the routine now sets the
// workout's kg, each routine item's kg is brought in line with the exercise's latest
// finished history once, so the next workout reads as it did before (history seeded it).
// Pure: loadState (persistence.js) runs it once, guarded by the stored marker; the dry run
// (scripts/fill-routine-kg.mjs) runs the SAME function read-only on an Export.
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

export const FILL_MARKER = 'routineKgFilledAt'

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
// `at` (an ISO time) is written as the marker; `at: null` (the dry run) writes no marker.
// A state that already has the marker is returned as it is, with no changes.
export function fillRoutineKgFromHistory(state, { mode = 'overwrite', at = null } = {}) {
  if (state?.[FILL_MARKER]) return { state, changes: [] }
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
  const next = changes.length ? { ...state, routines } : state
  return { state: at ? { ...next, [FILL_MARKER]: at } : next, changes }
}
