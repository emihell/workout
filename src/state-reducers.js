// req-164 (F-STRUCT-6) — the state reducers, split out of storage.js: pure
// (state, …) → state functions for store.jsx's setState, plus the delete blast-radius
// reads and wording the confirms show before them.
import { buildPlannedWorkout, exerciseById, planSnapshot } from './model.js'
import { dateKey } from './schedule.js'
import { patchExercise } from './exercise-names.js'
import { itemKey, replaceItemPatch, replacementItem, skipItemPatch, withLoggedSet } from './workout-log.js'
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

// ---- req-164 (F-STRUCT-6) — store.jsx's inline reducers, moved here verbatim as pure
// (state, …) → state functions. Ids and clock readings are made by the caller (store.jsx)
// and passed in, so each reducer is deterministic and unit-tested (req-164.test.js).

export function routineAddedState(s, routine) {
  return { ...s, routines: [...(s.routines || []), routine] }
}

export function routinePatchedState(s, routineId, mutator) {
  return {
    ...s,
    routines: (s.routines || []).map((routine) => (routine.id === routineId ? mutator(routine) : routine)),
  }
}

// Routine-level mutators for routinePatchedState. `id` is the new item's id (the caller's
// `item.id || uid('si')`).
export function routineItemAdded(routine, item, id) {
  return {
    ...routine,
    exercises: [
      ...routine.exercises,
      {
        id,
        exerciseId: item.exerciseId,
        role: item.role || 'main',
        restSec: Number(item.restSec) || 0,
        notes: item.notes || '',
        warmup: item.warmup || null,
        sets: Math.max(1, Number(item.sets) || (item.targets || []).length || 1),
        targets: Array.isArray(item.targets) ? item.targets : [],
        suggestedWeights: Array.isArray(item.suggestedWeights) ? item.suggestedWeights : [],
        // req-85 — per-set target seconds (parallel to targets/suggestedWeights).
        durations: Array.isArray(item.durations) ? item.durations : [],
      },
    ],
  }
}

export function routineItemUpdated(routine, index, patch) {
  return {
    ...routine,
    exercises: routine.exercises.map((item, i) =>
      i === index
        ? {
            ...item,
            role: patch.role ?? item.role,
            restSec: patch.restSec ?? item.restSec,
            notes: patch.notes ?? item.notes,
            warmup: patch.warmup === undefined ? item.warmup : patch.warmup,
            sets: patch.sets != null ? Math.max(1, Number(patch.sets) || 1) : item.sets,
            targets: patch.targets !== undefined ? patch.targets : item.targets,
            suggestedWeights: patch.suggestedWeights !== undefined ? patch.suggestedWeights : item.suggestedWeights,
            durations: patch.durations !== undefined ? patch.durations : item.durations,
          }
        : item,
    ),
  }
}

export function routineItemRemoved(routine, index) {
  return { ...routine, exercises: routine.exercises.filter((_, i) => i !== index) }
}

export function routineItemMoved(routine, index, dir) {
  const next = [...routine.exercises]
  const j = index + dir
  if (j < 0 || j >= next.length) return routine
  const tmp = next[index]
  next[index] = next[j]
  next[j] = tmp
  return { ...routine, exercises: next }
}

// `loopWeeks` already clamped by the caller (clampLoopWeeks).
export function loopWeeksState(s, loopWeeks) {
  return {
    ...s,
    schedule: {
      ...s.schedule,
      loopWeeks,
      slots: (s.schedule?.slots || []).filter((slot) => Number(slot.week) < loopWeeks),
    },
  }
}

// A slot for the same week + weekday + routine already there → the same state.
export function slotAddedState(s, slot) {
  const duplicate = (s.schedule?.slots || []).some(
    (candidate) =>
      Number(candidate.week) === Number(slot.week) &&
      Number(candidate.weekday) === Number(slot.weekday) &&
      candidate.routineId === slot.routineId,
  )
  if (duplicate) return s
  return { ...s, schedule: { ...s.schedule, slots: [...(s.schedule?.slots || []), slot] } }
}

export function slotRemovedState(s, slotId) {
  return {
    ...s,
    schedule: { ...s.schedule, slots: (s.schedule?.slots || []).filter((slot) => slot.id !== slotId) },
  }
}

export function exerciseAddedState(s, exercise) {
  return { ...s, exercises: [...s.exercises, exercise] }
}

export function exerciseUpdatedState(s, exerciseId, patch) {
  return { ...s, exercises: s.exercises.map((ex) => (ex.id === exerciseId ? patchExercise(ex, patch) : ex)) }
}

// Start: `id` for the new workout, `now` the clock. No plan, or the same occurrence already
// active → the same state. DEC-038 / req-55 — exactly one in-progress workout: starting a
// new one discards whatever was active (the caller warns first, workout-actions.js); no
// draft stacking. The `draftWorkouts` field is kept (legacy data) but is never written to.
export function startedWorkoutState(s, { routineId, scheduledFor = null, scheduleSlotId = null, suppliedPlan = null, id, now }) {
  const plan = suppliedPlan || buildPlannedWorkout(s, { routineId, date: scheduledFor || dateKey(now), scheduleSlotId })
  if (!plan) return s
  if (s.activeWorkout?.occurrenceId === plan.occurrenceId) return s
  return {
    ...s,
    activeWorkout: {
      id,
      routineId,
      scheduledFor: plan.scheduleSlotId ? plan.date : null,
      performedOn: dateKey(now),
      scheduleSlotId: plan.scheduleSlotId || null,
      occurrenceId: plan.occurrenceId,
      snapshot: planSnapshot(plan),
      startedAt: now.toISOString(),
      finishedAt: null,
      overallNote: '',
      overallFeel: '',
      completedItemIds: [],
      restEndsAt: null,
      restPausedRemaining: null,
      sets: [],
      // req-83 (N9) — live, session-scoped per-field seed overrides
      // (exerciseId::setType → {weight?, reps?}). Transient: never a schema
      // field, cleared when the workout finishes (activeWorkout → null).
      seedOverrides: {},
    },
  }
}

// req-55 — resolve a LEGACY stored draft (the removed multi-draft feature). Continue
// promotes the draft to the single active workout, discarding any current active entirely
// (one-in-progress invariant; the caller warns first). No new drafts are ever written.
export function draftContinuedState(s, workoutId) {
  const draft = (s.draftWorkouts || []).find((candidate) => candidate.id === workoutId)
  if (!draft) return s
  return {
    ...s,
    draftWorkouts: (s.draftWorkouts || []).filter((candidate) => candidate.id !== workoutId),
    activeWorkout: draft,
  }
}

// req-55 — discard a legacy stored draft. No finished-history record (an unfinished workout
// is not completed history, DESIGN §1); it is simply removed from draftWorkouts.
export function draftAbandonedState(s, workoutId) {
  return { ...s, draftWorkouts: (s.draftWorkouts || []).filter((candidate) => candidate.id !== workoutId) }
}

export function workoutAbandonedState(s) {
  return { ...s, activeWorkout: null }
}

export function activePatchedState(s, patch) {
  if (!s.activeWorkout) return s
  return { ...s, activeWorkout: { ...s.activeWorkout, ...patch } }
}

// req-109 — Skip exercise: remaining sets of the item logged skipped, item done.
export function itemSkippedState(s, itemId) {
  const patch = s.activeWorkout ? skipItemPatch(s.activeWorkout, itemId) : null
  return patch ? { ...s, activeWorkout: { ...s.activeWorkout, ...patch } } : s
}

// req-125 — `draftKey`: the set being logged; its setDraft is dropped in the same update.
export function setLoggedState(s, setRecord, activePatch = {}, draftKey = null) {
  if (!s.activeWorkout) return s
  return { ...s, activeWorkout: withLoggedSet(s.activeWorkout, setRecord, activePatch, draftKey) }
}

export function activeSetUpdatedState(s, index, patch) {
  if (!s.activeWorkout) return s
  return {
    ...s,
    activeWorkout: {
      ...s.activeWorkout,
      sets: (s.activeWorkout.sets || []).map((set, i) => (i === index ? { ...set, ...patch } : set)),
    },
  }
}

export function activeSetRemovedState(s, index) {
  if (!s.activeWorkout) return s
  return {
    ...s,
    activeWorkout: {
      ...s.activeWorkout,
      sets: (s.activeWorkout.sets || []).filter((_, i) => i !== index),
      restEndsAt: null,
      restPausedRemaining: null,
    },
  }
}

export function workoutUpdatedState(s, workoutId, patch) {
  return { ...s, workouts: s.workouts.map((w) => (w.id === workoutId ? { ...w, ...patch } : w)) }
}

export function workoutRemovedState(s, workoutId) {
  return { ...s, workouts: s.workouts.filter((w) => w.id !== workoutId) }
}
