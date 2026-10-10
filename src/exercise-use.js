// req-216 (DEC-119 §5) — "Your exercises" split by use, and the picker's "Added:" strip.
// Pure helpers: nothing here reads or writes the store.

// The exercise ids used by any active (non-archived) routine.
export function idsInActiveRoutines(routines) {
  const ids = new Set()
  for (const routine of routines || []) {
    if (routine.archivedAt) continue
    for (const item of routine.exercises || []) if (item.exerciseId) ids.add(item.exerciseId)
  }
  return ids
}

// Live (non-archived) exercises split into those in any active routine and the rest. An
// exercise only in an archived routine is "not in a workout"; order is kept as given.
export function exerciseUseSplit(exercises, routines) {
  const used = idsInActiveRoutines(routines)
  const inWorkouts = []
  const notInWorkout = []
  for (const ex of exercises || []) {
    if (ex.archivedAt) continue
    if (used.has(ex.id)) inWorkouts.push(ex)
    else notInWorkout.push(ex)
  }
  return { inWorkouts, notInWorkout }
}

// The picks the strip names, in tap order: up to 3 are all shown; more → the first 2 and "+N"
// ("Added: Row, Incline press, +2"). `expanded` shows every one.
export function addedStrip(picks, expanded = false) {
  if (expanded || picks.length <= 3) return { shown: picks, more: 0 }
  return { shown: picks.slice(0, 2), more: picks.length - 2 }
}
