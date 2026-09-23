import { isWeightedType } from './ids.js'
import { recommendNextPrescription } from './progress.js'
import { isAddedMidWorkout, isSkippedSet } from './workout-log.js'

export const SCHEMA_VERSION = 9

// req-85 — default target seconds for a timed exercise that has no per-set
// duration set yet. Used as the exercise-level default and the fallback when a
// routine item's `durations` array is empty.
export const DEFAULT_DURATION_SEC = 30

function inferRole(item, exercise, index) {
  if (item.role) return item.role
  if (exercise?.type === 'cardio' && index === 0) return 'warmup'
  const notes = String(item.notes || '').toLowerCase()
  if (notes.includes('finisher')) return 'finisher'
  return exercise?.type === 'cardio' ? 'cardio' : 'main'
}

function itemId(routineId, item, index) {
  return item.id || `si-${routineId}-${index}-${item.exerciseId}`
}

function migrateRoutine(routine, exercises, legacyRecommendations) {
  return {
    ...routine,
    archivedAt: routine.archivedAt || null,
    exercises: (routine.exercises || []).map((item, index) => {
      const id = itemId(routine.id, item, index)
      const ex = exercises.find((candidate) => candidate.id === item.exerciseId)
      const legacy = legacyRecommendations[id]
      if (!legacy && (item.targets?.length || item.suggestedWeights?.length)) {
        legacyRecommendations[id] = {
          targets: [...(item.targets || [])],
          suggestedWeights: [...(item.suggestedWeights || [])],
          sets: Number(item.sets) || (item.targets || []).length || 1,
        }
      }
      const baseline = legacyRecommendations[id]
      const targets = item.targets?.length ? [...item.targets] : [...(baseline?.targets || [])]
      const suggestedWeights = item.suggestedWeights?.length
        ? [...item.suggestedWeights]
        : [...(baseline?.suggestedWeights || [])]
      return {
        id,
        exerciseId: item.exerciseId,
        role: inferRole(item, ex, index),
        restSec: Number(item.restSec) || 0,
        notes: item.notes || '',
        warmup: item.warmup || null,
        sets: Number(item.sets) || Number(baseline?.sets) || targets.length || 1,
        targets,
        suggestedWeights,
        // req-85 (v9) — per-set target seconds, parallel to targets/suggestedWeights.
        // Defaulted to [] on every routine item; only timed exercises populate it.
        durations: Array.isArray(item.durations) ? [...item.durations] : [],
      }
    }),
  }
}

function flattenRoutines(source, exercises, legacyRecommendations) {
  const existing = source.routines?.length ? source.routines : source.sessions
  if (Array.isArray(existing) && existing.length) {
    return existing.map((routine) => migrateRoutine(routine, exercises, legacyRecommendations))
  }
  return (source.programs || []).flatMap((program) =>
    (program.sessions || []).map((routine) => migrateRoutine(routine, exercises, legacyRecommendations)),
  )
}

function programLabelFrom(source, routineId) {
  for (const program of source.programs || []) {
    if ((program.sessions || []).some((routine) => routine.id === routineId)) {
      return { programId: program.id || null, programName: program.name || '' }
    }
  }
  return { programId: null, programName: '' }
}

function workoutSnapshot(state, workout, origin = state) {
  const routineId = workout.routineId || workout.sessionId
  const found = findRoutineInState(state.routines, routineId)
  if (workout.snapshot) {
    // req-109 — items added mid-workout (a replacement, isAddedMidWorkout) and their
    // sets' keys. With none (every workout before req-109) this set is empty and the
    // branch below behaves byte-for-byte as it always has.
    const midWorkoutKeys = new Set(
      (workout.snapshot.items || []).filter(isAddedMidWorkout).map((item) => item.routineItemId).filter(Boolean),
    )
    const items = (workout.snapshot.items || []).map((item) => {
      // req-109 — a mid-workout item is kept exactly as written: no routine-template
      // match (by id or exerciseId), so it keeps its own unique routineItemId and
      // finish never writes it onto the routine; and no targets/weights backfill, so
      // it stays blank across reloads (its prefill comes from its own history).
      if (isAddedMidWorkout(item)) return item
      const templateItem = found.routine?.exercises?.find(
        (candidate) =>
          candidate.id === (item.routineItemId || item.sessionItemId) ||
          candidate.exerciseId === item.exerciseId,
      )
      const exercise = (state.exercises || []).find((candidate) => candidate.id === item.exerciseId)
      const actualWorkingSets = (workout.sets || []).filter((set) => {
        const setItemId = set.routineItemId || set.sessionItemId
        const itemIdValue = item.routineItemId || item.sessionItemId
        return (
          (setItemId === itemIdValue || set.exerciseId === item.exerciseId) &&
          set.setType !== 'wu' &&
          !isSkippedSet(set) &&
          // req-109 — a replacement's sets never backfill another item of the same
          // exercise (always true when the workout has no mid-workout item).
          !midWorkoutKeys.has(setItemId)
        )
      })
      const baseline = templateItem?.id ? state.legacyRecommendations?.[templateItem.id] : null
      const { sessionItemId, ...rest } = item
      return {
        ...rest,
        routineItemId: item.routineItemId || sessionItemId || templateItem?.id,
        exerciseName: item.exerciseName || exercise?.name || 'Deleted exercise',
        equipment: item.equipment || exercise?.equipment || '',
        exerciseType: item.exerciseType || exercise?.type || 'free',
        weightStep: item.weightStep || exercise?.weightStep || 'n/a',
        targets: item.targets?.length
          ? item.targets
          : [...(baseline?.targets || actualWorkingSets.map((set) => String(set.reps || '')))],
        suggestedWeights: item.suggestedWeights?.length
          ? item.suggestedWeights
          : actualWorkingSets.map((set) => Number(set.weight) || 0),
      }
    })
    // req-109 — a key-less legacy set is attributed to a routine item, never to a
    // mid-workout one (same Map as before when there is none).
    const itemByExercise = new Map(
      items.filter((item) => !isAddedMidWorkout(item)).map((item) => [item.exerciseId, item]),
    )
    const snapshot = { ...workout.snapshot, items }
    delete snapshot.sessionId
    delete snapshot.sessionName
    return {
      ...workout,
      schemaVersion: SCHEMA_VERSION,
      routineId,
      completedItemIds: workout.completedItemIds || workout.completedSessionItemIds || [],
      snapshot: {
        ...snapshot,
        routineId,
        routineName:
          workout.snapshot.routineName || workout.snapshot.sessionName || found.routine?.name || '',
      },
      sets: (workout.sets || []).map((set) => {
        const { sessionItemId, ...rest } = set
        return {
          ...rest,
          routineItemId:
            set.routineItemId ||
            sessionItemId ||
            itemByExercise.get(set.exerciseId)?.routineItemId ||
            `history-${workout.id}-${set.exerciseId}`,
          targetReps: set.targetReps ?? '',
          targetWeight: set.targetWeight ?? null,
        }
      }),
    }
  }
  const routineName = found.routine?.name || workout.routineName || workout.sessionName || 'Deleted routine'
  const legacyProgram = programLabelFrom(origin, routineId)
  const items = []
  const seen = new Set()
  for (const set of workout.sets || []) {
    if (seen.has(set.exerciseId)) continue
    seen.add(set.exerciseId)
    const ex = (state.exercises || []).find((x) => x.id === set.exerciseId)
    const templateItem = found.routine?.exercises?.find((x) => x.exerciseId === set.exerciseId)
    const baseline = templateItem?.id ? state.legacyRecommendations?.[templateItem.id] : null
    const actualWorkingSets = (workout.sets || []).filter(
      (candidate) =>
        candidate.exerciseId === set.exerciseId &&
        candidate.setType !== 'wu' &&
        !isSkippedSet(candidate),
    )
    items.push({
      routineItemId: templateItem?.id || `history-${workout.id}-${set.exerciseId}`,
      exerciseId: set.exerciseId,
      exerciseName: ex?.name || set.exerciseName || 'Deleted exercise',
      equipment: ex?.equipment || '',
      exerciseType: ex?.type || 'free',
      weightStep: ex?.weightStep || 'n/a',
      role: templateItem?.role || 'main',
      targets: templateItem?.targets?.length
        ? [...templateItem.targets]
        : [...(baseline?.targets || actualWorkingSets.map((candidate) => String(candidate.reps || '')))],
      suggestedWeights: actualWorkingSets.map((candidate) => Number(candidate.weight) || 0),
      restSec: templateItem?.restSec || 0,
      notes: templateItem?.notes || '',
      warmup: templateItem?.warmup || null,
      // req-85 (v9) — thread per-set durations into the legacy-rebuilt snapshot item
      // (the already-snapshotted branch above preserves it via `...rest`).
      durations: templateItem?.durations ? [...templateItem.durations] : [],
    })
  }
  const itemByExercise = new Map(items.map((item) => [item.exerciseId, item]))
  return {
    ...workout,
    schemaVersion: SCHEMA_VERSION,
    routineId,
    scheduleSlotId: workout.scheduleSlotId || null,
    occurrenceId:
      workout.occurrenceId ||
      (workout.scheduledFor ? `${workout.scheduleSlotId || routineId}@${workout.scheduledFor}` : null),
    completedItemIds: workout.completedItemIds || workout.completedSessionItemIds || [],
    snapshot: {
      programId: workout.programId || legacyProgram.programId,
      programName: workout.programName || workout.snapshot?.programName || legacyProgram.programName,
      routineId,
      routineName,
      focus: found.routine?.focus || '',
      items,
    },
    sets: (workout.sets || []).map((set) => {
      const { sessionItemId, ...rest } = set
      return {
        ...rest,
        routineItemId:
          set.routineItemId ||
          sessionItemId ||
          itemByExercise.get(set.exerciseId)?.routineItemId ||
          `history-${workout.id}-${set.exerciseId}`,
        targetReps: set.targetReps ?? '',
        targetWeight: set.targetWeight ?? null,
      }
    }),
  }
}

function stripLegacyWorkoutKeys(workout) {
  if (!workout) return workout
  const next = { ...workout }
  delete next.sessionId
  delete next.sessionName
  delete next.completedSessionItemIds
  return next
}

export function findRoutineInState(routines, routineId) {
  const routine = (routines || []).find((candidate) => candidate.id === routineId) || null
  return { routine }
}

export function migrateState(input) {
  const source = structuredClone(input || {})
  const exercises = Array.isArray(source.exercises) ? source.exercises : []
  const legacyRecommendations = { ...(source.legacyRecommendations || {}) }
  const routines = flattenRoutines(source, exercises, legacyRecommendations)

  const interim = {
    ...source,
    schemaVersion: SCHEMA_VERSION,
    exercises: exercises.map((exercise) => ({
      ...exercise,
      archivedAt: exercise.archivedAt || null,
      // req-85 (v9) — orthogonal timer flag + default target seconds, defaulted on
      // every exercise. hasDuration false keeps a non-timed exercise behaviour-neutral.
      hasDuration: Boolean(exercise.hasDuration),
      durationSec: exercise.durationSec != null ? Number(exercise.durationSec) : DEFAULT_DURATION_SEC,
    })),
    routines,
    schedule: {
      ...(source.schedule || {}),
      slots: (source.schedule?.slots || []).map((slot, index) => {
        const routineId = slot.routineId || slot.sessionId
        return {
          id: slot.id || `slot-${Number(slot.week) || 0}-${Number(slot.weekday) || 0}-${routineId}-${index}`,
          week: Number(slot.week) || 0,
          weekday: Number(slot.weekday),
          routineId,
        }
      }),
    },
    plannedWorkouts: (Array.isArray(source.plannedWorkouts) ? source.plannedWorkouts : []).map((plan) => {
      const items = (plan.items || []).map((item) => {
        const { sessionItemId, ...rest } = item
        return { ...rest, routineItemId: item.routineItemId || sessionItemId }
      })
      const { sessionId, sessionName, ...rest } = plan
      return {
        ...rest,
        routineId: plan.routineId || sessionId,
        routineName: plan.routineName || sessionName,
        items,
      }
    }),
    draftWorkouts: Array.isArray(source.draftWorkouts) ? source.draftWorkouts : [],
    legacyRecommendations,
  }
  delete interim.sessions
  delete interim.programs

  return {
    ...interim,
    workouts: (source.workouts || []).map((workout) =>
      stripLegacyWorkoutKeys(workoutSnapshot(interim, workout, source)),
    ),
    draftWorkouts: (source.draftWorkouts || []).map((workout) =>
      stripLegacyWorkoutKeys(workoutSnapshot(interim, workout, source)),
    ),
    activeWorkout: source.activeWorkout
      ? stripLegacyWorkoutKeys(workoutSnapshot(interim, source.activeWorkout, source))
      : null,
  }
}

export function applyProgressionToRoutines(routines, routineId, progression) {
  const byKey = new Map((progression || []).map((item) => [item.routineItemId || item.sessionItemId, item]))
  return (routines || []).map((routine) => {
    if (routine.id !== routineId) return routine
    return {
      ...routine,
      exercises: (routine.exercises || []).map((item) => {
        const next = byKey.get(item.id)
        if (!next) return item
        const targets = next.targetsTo?.length ? [...next.targetsTo] : [...(item.targets || [])]
        const suggestedWeights = Array.isArray(next.to) ? [...next.to] : [...(item.suggestedWeights || [])]
        return {
          ...item,
          targets,
          suggestedWeights,
          sets: Math.max(Number(item.sets) || 1, targets.length, suggestedWeights.length),
        }
      }),
    }
  })
}

// req-40 (F-CODE-1) — the single, canonical per-item progression computation shared
// by BOTH the Finish screen (finish.jsx, what a finished workout SAVES onto the
// routine) and `progressionFromWorkout` (the History recalc path). It used to be
// computed twice with divergent set-matching, so the same workout could yield two
// different saved recommendations (fails DESIGN §2). This reconciles to the fuller
// model.js semantics (DEC at merge): match a working set by `routineItemId ||
// sessionItemId` against the item's id-or-fallback OR its raw `item.id` (catches
// legacy/fallback-keyed sets finish.jsx's `routineItemId`-only match missed), and on
// no matched working sets keep the item's own `targets`/`suggestedWeights` rather than
// emitting a from-zero recommendation. Pure (L-007): unit-tested, not inline in a view.
// Returns the core both callers need; finish.jsx wraps its display-only fields around
// `sets`/`recommendation`/`to`/`targetsTo`/`routineItemId`.
export function progressionForItem(exercises, workout, item) {
  const exercise =
    (exercises || []).find((candidate) => candidate.id === item.exerciseId) || {
      type: item.exerciseType,
      weightStep: item.weightStep,
    }
  const itemIdValue = item.routineItemId || item.sessionItemId || item.id
  const sets = (workout?.sets || []).filter((set) => {
    const setItemId = set.routineItemId || set.sessionItemId
    return (
      set.setType !== 'wu' &&
      (setItemId === itemIdValue || setItemId === item.id) &&
      !isSkippedSet(set)
    )
  })
  const recommendation = recommendNextPrescription({
    targets: item.targets,
    sets,
    exercise,
  })
  return {
    routineItemId: itemIdValue,
    sets,
    recommendation,
    to: sets.length ? recommendation.weights : item.suggestedWeights || [],
    targetsTo: sets.length ? recommendation.targets : item.targets || [],
  }
}

// The finish-time progression array, exactly as the Finish screen builds it. The
// saved core ({ routineItemId, sets, recommendation, to, targetsTo }) comes from
// the ONE shared progressionForItem helper (identical to the History recalc path);
// the extra fields here are display-only. Extracted so the manual Finish screen
// (finish.jsx) and the req-84 auto-complete path pass byte-identical progression to
// store.finishWorkout — no second, drifting copy of this shape.
export function buildFinishProgression(exercises, active) {
  const items = active?.snapshot?.items || []
  return items.map((item) => {
    const core = progressionForItem(exercises, active, item)
    const skippedForItem = (active?.sets || []).some(
      (set) => set.routineItemId === core.routineItemId && isSkippedSet(set),
    )
    return {
      routineItemId: core.routineItemId,
      exerciseId: item.exerciseId,
      name: item.exerciseName,
      from: item.suggestedWeights || [],
      to: core.to,
      targetsFrom: item.targets || [],
      targetsTo: core.targetsTo,
      action: core.recommendation.action,
      reason: core.sets.length ? core.recommendation.reason : skippedForItem ? 'Skipped.' : 'None.',
    }
  })
}

export function progressionFromWorkout(state, workout) {
  return (workout?.snapshot?.items || []).map((item) => {
    const { routineItemId, to, targetsTo } = progressionForItem(state.exercises, workout, item)
    return { routineItemId, to, targetsTo }
  })
}

export function buildPlannedWorkout(state, { routineId, date, scheduleSlotId = null, occurrenceId = null }) {
  const { routine } = findRoutineInState(state.routines, routineId)
  if (!routine) return null
  const items = (routine.exercises || []).map((item) => {
    const exercise = (state.exercises || []).find((candidate) => candidate.id === item.exerciseId)
    const targets = [...(item.targets || [])]
    const suggestedWeights = [...(item.suggestedWeights || [])]
    const sets = Number(item.sets) || targets.length || 1
    const weighted = exercise && isWeightedType(exercise.type)
    return {
      id: `pi-${item.id}`,
      routineItemId: item.id,
      exerciseId: item.exerciseId,
      exerciseName: exercise?.name || 'Deleted exercise',
      equipment: exercise?.equipment || '',
      exerciseType: exercise?.type || 'free',
      weightStep: exercise?.weightStep || 'n/a',
      role: item.role || 'main',
      sets,
      targets,
      suggestedWeights,
      // req-85 (v9) — carry per-set durations from the routine item into the plan item
      // so the started-workout snapshot knows each timed set's target seconds.
      durations: [...(item.durations || [])],
      restSec: item.restSec || 0,
      notes: item.notes || '',
      warmup: item.warmup || null,
      calibrationRequired: Boolean(weighted && !suggestedWeights.some((weight) => Number(weight) > 0)),
      recommendationReason: suggestedWeights.some((weight) => Number(weight) > 0)
        ? 'From the routine.'
        : 'No history yet. Find a starting load.',
    }
  })

  return {
    id: occurrenceId || `${scheduleSlotId || `adhoc-${routineId}`}@${date}`,
    occurrenceId: occurrenceId || `${scheduleSlotId || `adhoc-${routineId}`}@${date}`,
    scheduleSlotId,
    routineId,
    date,
    status: 'planned',
    routineName: routine.name,
    focus: routine.focus,
    items,
    manuallyEdited: false,
  }
}

export function planSnapshot(plan) {
  return {
    routineId: plan.routineId,
    routineName: plan.routineName,
    focus: plan.focus,
    items: structuredClone(plan.items || []),
  }
}
