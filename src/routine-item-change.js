// req-242 — "Change exercise" on a routine item: the item keeps its id, note, role and warm-up
// switch, and takes the new exercise's values from ONE source (as Add does, DEC-097 §4):
// - the new exercise has history → history's prescription (sets, reps, rest, kg), the way the
//   picker's Add builds it (routine-picker.js pickerItem); a rest history lacks keeps the item's;
// - no history → the item's own sets, reps, rest and per-set seconds stay; every kg is blank
//   (DESIGN §1 — no kg carried from the old exercise; DEC-106's Swap pattern).
// Pure: the store hands in the finished workouts. Finished history and an active workout's
// snapshot are never read for writing — only the routine's item changes.
import { historyPrescription } from './history-queries.js'

export function changedRoutineItem(item, exerciseId, workouts) {
  const history = historyPrescription(workouts, exerciseId)
  if (!history) return { ...item, exerciseId, suggestedWeights: [] }
  return {
    ...item,
    exerciseId,
    sets: history.sets,
    targets: history.targets,
    suggestedWeights: history.suggestedWeights,
    restSec: history.restSec ?? item.restSec,
    durations: [],
  }
}

// Routine-level mutator for routinePatchedState. Located by item id; an unknown id, a missing
// exercise id or the same exercise leaves the routine as it is.
export function routineItemExerciseChanged(routine, itemId, exerciseId, workouts) {
  const items = routine.exercises || []
  const index = items.findIndex((item) => item.id === itemId)
  if (index < 0 || !exerciseId || items[index].exerciseId === exerciseId) return routine
  return {
    ...routine,
    exercises: items.map((item, i) => (i === index ? changedRoutineItem(item, exerciseId, workouts) : item)),
  }
}
