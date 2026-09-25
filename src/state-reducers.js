// req-164 (F-STRUCT-6) — the state reducers, split out of storage.js: pure
// (state, …) → state functions for store.jsx's setState, plus the delete blast-radius
// reads and wording the confirms show before them.
import { exerciseById } from './model.js'
import { itemKey, replaceItemPatch, replacementItem } from './workout-log.js'
import { historyPrescription, routinesUsingExercise } from './history-queries.js'

// req-43 / DEC-031 (audit F-DIV-3) — the blast radius of deleting a routine, so the
// confirm can name it. removeRoutine (store.jsx) also drops every schedule slot that
// references the routine (req-165: stored plannedWorkouts are no longer read or pruned —
// nothing has written one since workouts are built on Start; an old doc keeps its key),
// and archives-vs-deletes on whether finished history references it. These are pure
// reads that mirror the store's own reference tests exactly (routineId) so the confirm
// counts match what
// the delete removes. The logic in the store is unchanged (DEC-031) — this is only
// how we describe it.
export function routineDeletionImpact(state, routineId) {
  const refersTo = (obj) => obj.routineId === routineId
  return {
    slots: (state?.schedule?.slots || []).filter(refersTo).length,
    hasHistory: (state?.workouts || []).some(refersTo),
  }
}

// req-43 / DEC-031 — the blast radius of deleting an exercise. removeExercise strips
// it from every routine and archives-vs-deletes on
// finished history (a set with this exerciseId). Reuses routinesUsingExercise for
// the routine count; history mirrors the store's set.exerciseId test.
export function exerciseDeletionImpact(state, exerciseId) {
  return {
    routines: routinesUsingExercise(state?.routines, exerciseId).length,
    hasHistory: (state?.workouts || []).some((workout) =>
      (workout.sets || []).some((set) => set.exerciseId === exerciseId),
    ),
  }
}

// req-119 / DEC-058 §5 (amends DEC-031) — the in-progress workout counts as a
// reference too: its snapshot items and its logged sets. Without this, deleting an
// exercise or routine the live workout uses hard-deleted it, so after Finish history
// showed a raw id and the workout's routineId pointed at nothing.
export function exerciseInActiveWorkout(state, exerciseId) {
  const active = state?.activeWorkout
  if (!active) return false
  return (
    (active.snapshot?.items || []).some((item) => item.exerciseId === exerciseId) ||
    (active.sets || []).some((set) => set.exerciseId === exerciseId)
  )
}

export function routineInActiveWorkout(state, routineId) {
  const active = state?.activeWorkout
  if (!active) return false
  return (active.routineId || active.snapshot?.routineId) === routineId
}

// req-119 — the delete reducers, moved out of store.jsx so the archive-vs-delete rule
// is unit-tested. Referenced = finished history (DEC-031) OR the in-progress workout
// (DEC-058 §5) → archived via the existing `archivedAt` path; otherwise hard-deleted.
// Everything else each delete did is unchanged: removeExercise strips the exercise
// from every routine; removeRoutine drops its schedule slots (req-165: stored plans are
// no longer touched). Neither touches activeWorkout — its snapshot is its own.
export function removeExerciseFromState(s, exerciseId, archivedAt = new Date().toISOString()) {
  const referenced = exerciseDeletionImpact(s, exerciseId).hasHistory || exerciseInActiveWorkout(s, exerciseId)
  return {
    ...s,
    exercises: referenced
      ? (s.exercises || []).map((ex) => (ex.id === exerciseId ? { ...ex, archivedAt } : ex))
      : (s.exercises || []).filter((ex) => ex.id !== exerciseId),
    routines: (s.routines || []).map((routine) => ({
      ...routine,
      exercises: (routine.exercises || []).filter((item) => item.exerciseId !== exerciseId),
    })),
  }
}

// req-127 / DEC-059 §3 — Restore: the inverse of the archive branch above, on ONE
// record. Clears `archivedAt` (to null, the normalized shape, model.js) on that same
// exercise, so its id — and with it history and "last time" — comes back. It does NOT
// bring back the routine / planned-workout rows the archive removed. Returns `s`
// unchanged (same reference) for an unknown or non-archived id.
export function restoreExerciseInState(s, exerciseId) {
  const target = exerciseById(s.exercises, exerciseId)
  if (!target || !target.archivedAt) return s
  return {
    ...s,
    exercises: s.exercises.map((ex) => (ex.id === exerciseId ? { ...ex, archivedAt: null } : ex)),
  }
}

// req-124 — the Replace exercise reducer, moved out of store.jsx (logic unchanged from
// req-109) so the caller can pick the new item's `id` BEFORE the setState updater and
// navigate to it. Returns `s` unchanged (same reference) when there is no active
// workout, the exercise or the original item is unknown, or the patch fails — in that
// case no item with `id` exists.
export function replaceItemInState(s, itemId, exerciseId, id) {
  const active = s.activeWorkout
  const exercise = exerciseById(s.exercises, exerciseId)
  const original = (active?.snapshot?.items || []).find((item) => itemKey(item) === itemId)
  if (!active || !exercise || !original) return s
  const replacement = replacementItem({
    id,
    original,
    exercise,
    restSec: historyPrescription(s.workouts, exerciseId)?.restSec,
  })
  const patch = replaceItemPatch(active, itemId, replacement)
  return patch ? { ...s, activeWorkout: { ...active, ...patch } } : s
}

export function removeRoutineFromState(s, routineId, archivedAt = new Date().toISOString()) {
  const referenced = routineDeletionImpact(s, routineId).hasHistory || routineInActiveWorkout(s, routineId)
  return {
    ...s,
    routines: referenced
      ? (s.routines || []).map((routine) => (routine.id === routineId ? { ...routine, archivedAt } : routine))
      : (s.routines || []).filter((routine) => routine.id !== routineId),
    schedule: {
      ...s.schedule,
      slots: (s.schedule?.slots || []).filter((slot) => slot.routineId !== routineId),
    },
  }
}

// req-119 — the head line of the delete confirm (Exercises.jsx / Routine.jsx), pure so
// the wording per case is tested. The current workout wins over past history in the
// wording: it is the reference the user is in the middle of.
export function deletionConfirmHead(name, { hasHistory, inCurrentWorkout }) {
  if (inCurrentWorkout) return `${name} is in the current workout and will be archived (the workout keeps it).`
  if (hasHistory) return `${name} has past workouts and will be archived (kept in your history).`
  return `Delete ${name}?`
}
