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

function migrateRoutine(routine, exercises, legacyRecommendations, legacy) {
  return {
    ...routine,
    archivedAt: routine.archivedAt || null,
    exercises: (routine.exercises || []).map((item, index) => {
      const id = itemId(routine.id, item, index)
      const ex = exerciseById(exercises, item.exerciseId)
      const recorded = legacyRecommendations[id]
      // req-158 (audit F-DEAD-4, DEC-085 §3) — a baseline is recorded only for legacy
      // (pre-v9) input, the only input that reads it (below, and workoutSnapshot). On v9
      // nothing reads it, so nothing is added: the map no longer grows on every load.
      // Entries already stored are kept as they are (the spread in migrateState).
      if (legacy && !recorded && (item.targets?.length || item.suggestedWeights?.length)) {
        legacyRecommendations[id] = {
          targets: [...(item.targets || [])],
          suggestedWeights: [...(item.suggestedWeights || [])],
          sets: Number(item.sets) || (item.targets || []).length || 1,
        }
      }
      // req-120 (audit C) — the recorded baseline refills empty lists only for legacy
      // (pre-v9) input. On v9 an empty list is the user's own choice and stays empty
      // (DESIGN §1: never invent).
      const baseline = legacy ? legacyRecommendations[id] : null
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

function flattenRoutines(source, exercises, legacyRecommendations, legacy) {
  const existing = source.routines?.length ? source.routines : source.sessions
  if (Array.isArray(existing) && existing.length) {
    return existing.map((routine) => migrateRoutine(routine, exercises, legacyRecommendations, legacy))
  }
  return (source.programs || []).flatMap((program) =>
    (program.sessions || []).map((routine) => migrateRoutine(routine, exercises, legacyRecommendations, legacy)),
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

function workoutSnapshot(state, workout, origin = state, legacy = false) {
  const routineId = workout.routineId || workout.sessionId
  const foundRoutine = routineById(state.routines, routineId)
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
      const templateItem = foundRoutine?.exercises?.find(
        (candidate) =>
          candidate.id === (item.routineItemId || item.sessionItemId) ||
          candidate.exerciseId === item.exerciseId,
      )
      const exercise = exerciseById(state.exercises, item.exerciseId)
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
      // req-120 (audit C) — the baseline and the logged-sets backfill below fill a
      // snapshot's EMPTY targets/weights only for legacy (pre-v9) input. On v9 the
      // snapshot is frozen at Start: empty stays empty (DESIGN §1, §3), so set 2's
      // target is never invented from set 1's reps.
      const baseline = legacy && templateItem?.id ? state.legacyRecommendations?.[templateItem.id] : null
      const backfillSets = legacy ? actualWorkingSets : []
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
          : [...(baseline?.targets || backfillSets.map((set) => String(set.reps || '')))],
        suggestedWeights: item.suggestedWeights?.length
          ? item.suggestedWeights
          : backfillSets.map((set) => Number(set.weight) || 0),
      }
    })
    // req-109 — a key-less legacy set is attributed to a routine item, never to a
    // mid-workout one (same Map as before when there is none). Defensive only: this Map
    // is read solely for sets with no routineItemId/sessionItemId, which are pre-snapshot
    // legacy data and can't coexist with a replacement (every set logged since carries
    // its item key), so no test can reach it through a real flow.
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
          workout.snapshot.routineName || workout.snapshot.sessionName || foundRoutine?.name || '',
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
  const routineName = foundRoutine?.name || workout.routineName || workout.sessionName || 'Deleted routine'
  const legacyProgram = programLabelFrom(origin, routineId)
  const items = []
  const seen = new Set()
  for (const set of workout.sets || []) {
    if (seen.has(set.exerciseId)) continue
    seen.add(set.exerciseId)
    const ex = exerciseById(state.exercises, set.exerciseId)
    const templateItem = foundRoutine?.exercises?.find((x) => x.exerciseId === set.exerciseId)
    // req-120 — the recorded baseline is legacy-only here too. This branch rebuilds a
    // MISSING snapshot (pre-snapshot data), so its logged-set reconstruction stays.
    const baseline = legacy && templateItem?.id ? state.legacyRecommendations?.[templateItem.id] : null
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
      focus: foundRoutine?.focus || '',
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

// req-165 (F-STRUCT-7) — ONE lookup per entity: the record, or null. Replaces the
// `{ routine }`-wrapper pair (findRoutineInState / findRoutine, a leftover from the
// program lookup) and the inline `exercises.find(… .id === …)` copies. storage.js
// re-exports both for the views.
export function routineById(routines, routineId) {
  return (routines || []).find((routine) => routine.id === routineId) ?? null
}

export function exerciseById(exercises, id) {
  return (exercises || []).find((exercise) => exercise.id === id) ?? null
}

// req-120 (audit C) — `legacy` says the input predates v9. The caller computes it from
// the RAW stored value, before any `{ ...emptyState(), ...raw }` merge (which injects
// schemaVersion 9). Only legacy input gets the plan backfill/baseline; the default is
// the safe side (false: never invent a plan value). Callers MUST pass `legacy: true`
// for pre-v9 input, or its recorded baselines are neither written nor applied.
export function migrateState(input, { legacy = false } = {}) {
  const source = structuredClone(input || {})
  const exercises = Array.isArray(source.exercises) ? source.exercises : []
  const legacyRecommendations = { ...(source.legacyRecommendations || {}) }
  const routines = flattenRoutines(source, exercises, legacyRecommendations, legacy)

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
      stripLegacyWorkoutKeys(workoutSnapshot(interim, workout, source, legacy)),
    ),
    draftWorkouts: (source.draftWorkouts || []).map((workout) =>
      stripLegacyWorkoutKeys(workoutSnapshot(interim, workout, source, legacy)),
    ),
    activeWorkout: source.activeWorkout
      ? stripLegacyWorkoutKeys(workoutSnapshot(interim, source.activeWorkout, source, legacy))
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

// req-40 (F-CODE-1) — the single, canonical per-item progression computation, used by
// `progressionFromWorkout` (the History recalc path, the one that writes the routine).
// req-158 — the Finish screen no longer computes or stores a `progression` record
// (buildFinishProgression removed), so recalc is its only caller. It used to be
// computed twice with divergent set-matching, so the same workout could yield two
// different saved recommendations (fails DESIGN §2). This reconciles to the fuller
// model.js semantics (DEC at merge): match a working set by `routineItemId ||
// sessionItemId` against the item's id-or-fallback OR its raw `item.id` (catches
// legacy/fallback-keyed sets finish.jsx's `routineItemId`-only match missed), and on
// no matched working sets keep the item's own `targets`/`suggestedWeights` rather than
// emitting a from-zero recommendation. Pure (L-007): unit-tested, not inline in a view.
// Returns `sets`/`recommendation`/`to`/`targetsTo`/`routineItemId`.
export function progressionForItem(exercises, workout, item) {
  const exercise =
    exerciseById(exercises, item.exerciseId) || {
      type: item.exerciseType,
      weightStep: item.weightStep,
    }
  const itemIdValue = item.routineItemId || item.sessionItemId || item.id
  // req-112 — every working set in log order, skipped included, so position = the
  // set's own work index (the index the log form uses: count of prior working sets).
  const workSets = (workout?.sets || []).filter((set) => {
    const setItemId = set.routineItemId || set.sessionItemId
    return set.setType !== 'wu' && (setItemId === itemIdValue || setItemId === item.id)
  })
  const sets = workSets.filter((set) => !isSkippedSet(set))
  const recommendation = recommendNextPrescription({
    targets: item.targets,
    weights: item.suggestedWeights,
    sets: workSets,
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

export function progressionFromWorkout(state, workout) {
  return (workout?.snapshot?.items || []).map((item) => {
    const { routineItemId, to, targetsTo } = progressionForItem(state.exercises, workout, item)
    return { routineItemId, to, targetsTo }
  })
}

// History → correct → "Update?" → Apply (store.recalculateFuturePlans): the ONE path
// that writes a workout's recommendation onto its routine (req-112 / DEC-056 — Finish
// no longer does). Unknown workout → the same state.
export function recalculatedState(state, workoutId) {
  const workout = (state.workouts || []).find((candidate) => candidate.id === workoutId)
  if (!workout) return state
  return {
    ...state,
    routines: applyProgressionToRoutines(
      state.routines,
      workout.routineId || workout.sessionId,
      progressionFromWorkout(state, workout),
    ),
  }
}

export function buildPlannedWorkout(state, { routineId, date, scheduleSlotId = null, occurrenceId = null }) {
  const routine = routineById(state.routines, routineId)
  if (!routine) return null
  const items = (routine.exercises || []).map((item) => {
    const exercise = exerciseById(state.exercises, item.exerciseId)
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
      // req-119 — Timed is frozen at Start like exerciseType, so a Library edit mid-
      // workout can't turn the live set form into a countdown (DESIGN §3).
      hasDuration: Boolean(exercise?.hasDuration),
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
