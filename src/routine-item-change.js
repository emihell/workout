// req-242 — "Change exercise" on a routine item: the item keeps its id, note, role and warm-up
// switch, and takes the new exercise's values from ONE source (as Add does, DEC-097 §4):
// - the new exercise has history → history's prescription (sets, reps, rest, kg), the way the
//   picker's Add builds it (routine-picker.js pickerItem); a rest history lacks keeps the item's;
// - no history, same plan kind → the item's own sets, reps, rest and per-set seconds stay; every
//   kg is blank (DESIGN §1 — no kg carried from the old exercise; DEC-106's Swap pattern);
// - req-264 (DEC-155 §2) — no history, another plan kind (cardio / timed / reps, planKind) →
//   Add's starting plan for the new exercise (pickerItem): its sets, targets, durations, rest,
//   kg blank. A missing exercise record (either side) → the same-kind rule (no reset).
// Pure: the store hands in the finished workouts and the exercise records. Finished history and
// an active workout's snapshot are never read for writing — only the routine's item changes.
import { historyPrescription } from './history-queries.js'
import { pickerItem, planKind } from './routine-picker.js'

const byId = (exercises, id) => (exercises || []).find((exercise) => exercise?.id === id) || null

// True when a no-history change from `fromExercise` to `toExercise` takes the starting plan.
export function changeTakesStartingPlan(fromExercise, toExercise) {
  return Boolean(fromExercise && toExercise) && planKind(fromExercise) !== planKind(toExercise)
}

export function changedRoutineItem(item, exerciseId, workouts, exercises = []) {
  const history = historyPrescription(workouts, exerciseId)
  if (!history) {
    const from = byId(exercises, item.exerciseId)
    const to = byId(exercises, exerciseId)
    if (changeTakesStartingPlan(from, to)) {
      const { sets, targets, durations, restSec } = pickerItem([], to).item
      return { ...item, exerciseId, sets, targets, durations, restSec, suggestedWeights: [] }
    }
    return { ...item, exerciseId, suggestedWeights: [] }
  }
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
export function routineItemExerciseChanged(routine, itemId, exerciseId, workouts, exercises = []) {
  const items = routine.exercises || []
  const index = items.findIndex((item) => item.id === itemId)
  if (index < 0 || !exerciseId || items[index].exerciseId === exerciseId) return routine
  return {
    ...routine,
    exercises: items.map((item, i) => (i === index ? changedRoutineItem(item, exerciseId, workouts, exercises) : item)),
  }
}
