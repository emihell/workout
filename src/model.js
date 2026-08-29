import { parseTargets } from './ids.js'
import { GOAL_PROFILES, normalizeGoal, recommendNextPrescription } from './progress.js'

export const SCHEMA_VERSION = 6

function inferRole(item, exercise, index) {
  if (item.role) return item.role
  if (exercise?.type === 'cardio' && index === 0) return 'warmup'
  const notes = String(item.notes || '').toLowerCase()
  if (notes.includes('finisher')) return 'finisher'
  return exercise?.type === 'cardio' ? 'cardio' : 'main'
}

function itemId(sessionId, item, index) {
  return item.id || `si-${sessionId}-${index}-${item.exerciseId}`
}

function workoutSnapshot(state, workout) {
  const found = findSessionInState(state.programs, workout.sessionId)
  if (workout.snapshot) {
    const items = (workout.snapshot.items || []).map((item) => {
      const templateItem = found.session?.exercises?.find(
        (candidate) =>
          candidate.id === item.sessionItemId ||
          candidate.exerciseId === item.exerciseId,
      )
      const exercise = (state.exercises || []).find(
        (candidate) => candidate.id === item.exerciseId,
      )
      const actualWorkingSets = (workout.sets || []).filter(
        (set) =>
          (set.sessionItemId === item.sessionItemId || set.exerciseId === item.exerciseId) &&
          set.setType !== 'wu' &&
          String(set.reps || '').toLowerCase() !== 'skipped',
      )
      const baseline = templateItem?.id
        ? state.legacyRecommendations?.[templateItem.id]
        : null
      return {
        ...item,
        exerciseName: item.exerciseName || exercise?.name || 'Deleted exercise',
        equipment: item.equipment || exercise?.equipment || '',
        exerciseType: item.exerciseType || exercise?.type || 'free',
        weightStep: item.weightStep || exercise?.weightStep || 'n/a',
        targets:
          item.targets?.length
            ? item.targets
            : [...(baseline?.targets || actualWorkingSets.map((set) => String(set.reps || '')))],
        suggestedWeights:
          item.suggestedWeights?.length
            ? item.suggestedWeights
            : actualWorkingSets.map((set) => Number(set.weight) || 0),
      }
    })
    const itemByExercise = new Map(items.map((item) => [item.exerciseId, item]))
    return {
      ...workout,
      schemaVersion: SCHEMA_VERSION,
      snapshot: { ...workout.snapshot, items },
      sets: (workout.sets || []).map((set) => ({
        ...set,
        sessionItemId:
          set.sessionItemId ||
          itemByExercise.get(set.exerciseId)?.sessionItemId ||
          `history-${workout.id}-${set.exerciseId}`,
        targetReps: set.targetReps ?? '',
        targetWeight: set.targetWeight ?? null,
      })),
    }
  }
  const programName = found.program?.name || workout.programName || 'Deleted program'
  const sessionName = found.session?.name || workout.sessionName || 'Deleted session'
  const items = []
  const seen = new Set()
  for (const set of workout.sets || []) {
    if (seen.has(set.exerciseId)) continue
    seen.add(set.exerciseId)
    const ex = (state.exercises || []).find((x) => x.id === set.exerciseId)
    const templateItem = found.session?.exercises?.find((x) => x.exerciseId === set.exerciseId)
    const baseline = templateItem?.id
      ? state.legacyRecommendations?.[templateItem.id]
      : null
    const actualWorkingSets = (workout.sets || []).filter(
      (candidate) =>
        candidate.exerciseId === set.exerciseId &&
        candidate.setType !== 'wu' &&
        String(candidate.reps || '').toLowerCase() !== 'skipped',
    )
    items.push({
      sessionItemId: templateItem?.id || `history-${workout.id}-${set.exerciseId}`,
      exerciseId: set.exerciseId,
      exerciseName: ex?.name || set.exerciseName || 'Deleted exercise',
      equipment: ex?.equipment || '',
      exerciseType: ex?.type || 'free',
      weightStep: ex?.weightStep || 'n/a',
      role: templateItem?.role || 'main',
      targets: [...(baseline?.targets || actualWorkingSets.map((candidate) => String(candidate.reps || '')))],
      suggestedWeights: actualWorkingSets.map((candidate) => Number(candidate.weight) || 0),
      restSec: templateItem?.restSec || 0,
      notes: templateItem?.notes || '',
      warmup: templateItem?.warmup || null,
    })
  }
  const itemByExercise = new Map(items.map((item) => [item.exerciseId, item]))
  return {
    ...workout,
    schemaVersion: SCHEMA_VERSION,
    scheduleSlotId: workout.scheduleSlotId || null,
    occurrenceId:
      workout.occurrenceId ||
      (workout.scheduledFor ? `${workout.scheduleSlotId || workout.sessionId}@${workout.scheduledFor}` : null),
    snapshot: {
      programId: found.program?.id || workout.programId || null,
      programName,
      sessionId: workout.sessionId,
      sessionName,
      focus: found.session?.focus || '',
      goal: normalizeGoal(found.program?.goal),
      items,
    },
    sets: (workout.sets || []).map((set) => ({
      ...set,
      sessionItemId:
        set.sessionItemId ||
        itemByExercise.get(set.exerciseId)?.sessionItemId ||
        `history-${workout.id}-${set.exerciseId}`,
      targetReps: set.targetReps ?? '',
      targetWeight: set.targetWeight ?? null,
    })),
  }
}

export function findSessionInState(programs, sessionId) {
  for (const program of programs || []) {
    const session = (program.sessions || []).find((candidate) => candidate.id === sessionId)
    if (session) return { program, session }
  }
  return { program: null, session: null }
}

export function migrateState(input) {
  const source = structuredClone(input || {})
  const exercises = Array.isArray(source.exercises) ? source.exercises : []
  const legacyRecommendations = { ...(source.legacyRecommendations || {}) }
  const programs = (source.programs || []).map((program) => ({
    ...program,
    archivedAt: program.archivedAt || null,
    goal: normalizeGoal(program.goal),
    sessions: (program.sessions || []).map((session) => ({
      ...session,
      archivedAt: session.archivedAt || null,
      exercises: (session.exercises || []).map((item, index) => {
        const id = itemId(session.id, item, index)
        const ex = exercises.find((candidate) => candidate.id === item.exerciseId)
        if (!legacyRecommendations[id] && (item.targets?.length || item.suggestedWeights?.length)) {
          legacyRecommendations[id] = {
            targets: [...(item.targets || [])],
            suggestedWeights: [...(item.suggestedWeights || [])],
            sets: Number(item.sets) || (item.targets || []).length || 3,
          }
        }
        return {
          id,
          exerciseId: item.exerciseId,
          role: inferRole(item, ex, index),
          restSec: Number(item.restSec) || 0,
          notes: item.notes || '',
          warmup: item.warmup || null,
        }
      }),
    })),
  }))

  const interim = {
    ...source,
    schemaVersion: SCHEMA_VERSION,
    exercises: exercises.map((exercise) => ({ ...exercise, archivedAt: exercise.archivedAt || null })),
    programs,
    schedule: {
      ...(source.schedule || {}),
      slots: (source.schedule?.slots || []).map((slot, index) => ({
        ...slot,
        id:
          slot.id ||
          `slot-${Number(slot.week) || 0}-${Number(slot.weekday) || 0}-${slot.sessionId}-${index}`,
      })),
    },
    plannedWorkouts: Array.isArray(source.plannedWorkouts) ? source.plannedWorkouts : [],
    draftWorkouts: Array.isArray(source.draftWorkouts)
      ? source.draftWorkouts.map((workout) => workoutSnapshot(source, workout))
      : [],
    legacyRecommendations,
  }

  return {
    ...interim,
    workouts: (source.workouts || []).map((workout) => workoutSnapshot(interim, workout)),
    draftWorkouts: (source.draftWorkouts || []).map((workout) => workoutSnapshot(interim, workout)),
    activeWorkout: source.activeWorkout ? workoutSnapshot(interim, source.activeWorkout) : null,
  }
}

function latestWorkoutForItem(state, sessionId, sessionItemId, exerciseId, beforeDate) {
  const candidates = [...(state.workouts || [])]
    .filter((workout) => {
      if (!workout.finishedAt) return false
      if (beforeDate && String(workout.finishedAt).slice(0, 10) >= beforeDate) return false
      return (workout.sets || []).some(
        (set) =>
          String(set.reps || '').toLowerCase() !== 'skipped' &&
          ((set.sessionItemId && set.sessionItemId === sessionItemId) ||
            (!set.sessionItemId && set.exerciseId === exerciseId) ||
            set.exerciseId === exerciseId),
      )
    })
    .sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)))
  return (
    candidates.find(
      (workout) =>
        workout.sessionId === sessionId &&
        (workout.sets || []).some(
          (set) =>
            set.sessionItemId === sessionItemId &&
            String(set.reps || '').toLowerCase() !== 'skipped',
        ),
    ) || candidates[0]
  )
}

export function goalPrescription(goal) {
  const profile = GOAL_PROFILES[normalizeGoal(goal)]
  const targets = parseTargets(profile.defaultTargets, 3)
  return { targets, sets: targets.length }
}

export function buildPlannedWorkout(state, { sessionId, date, scheduleSlotId = null, occurrenceId = null }) {
  const existing = (state.plannedWorkouts || []).find(
    (plan) =>
      plan.date === date &&
      plan.sessionId === sessionId &&
      (plan.scheduleSlotId || null) === (scheduleSlotId || null),
  )
  if (existing) return structuredClone(existing)

  const { program, session } = findSessionInState(state.programs, sessionId)
  if (!program || !session) return null
  const base = goalPrescription(program.goal)
  const items = (session.exercises || []).map((item) => {
    const exercise = (state.exercises || []).find((candidate) => candidate.id === item.exerciseId)
    const legacy = state.legacyRecommendations?.[item.id]
    const latest = latestWorkoutForItem(state, session.id, item.id, item.exerciseId, date)
    const workSets = (latest?.sets || []).filter(
      (set) =>
        set.setType !== 'wu' &&
        (set.sessionItemId === item.id || set.exerciseId === item.exerciseId) &&
        String(set.reps || '').toLowerCase() !== 'skipped',
    )
    const recommendation = workSets.length
      ? recommendNextPrescription({
          targets: base.targets,
          sets: workSets,
          exercise,
        })
      : null
    const suggestedWeights =
      recommendation?.weights?.length
        ? recommendation.weights
        : latest
          ? workSets.map((set) => Number(set.weight) || 0)
          : [...(legacy?.suggestedWeights || [])]
    const targets =
      recommendation?.targets?.length
        ? recommendation.targets
        : legacy?.targets?.length
          ? [...legacy.targets]
          : [...base.targets]
    const weighted = exercise && exercise.type !== 'bodyweight' && exercise.type !== 'cardio'
    return {
      id: `pi-${item.id}`,
      sessionItemId: item.id,
      exerciseId: item.exerciseId,
      exerciseName: exercise?.name || 'Deleted exercise',
      equipment: exercise?.equipment || '',
      exerciseType: exercise?.type || 'free',
      weightStep: exercise?.weightStep || 'n/a',
      role: item.role || 'main',
      sets: Number(legacy?.sets) || targets.length || base.sets,
      targets,
      suggestedWeights,
      restSec: item.restSec || 0,
      notes: item.notes || '',
      warmup: item.warmup || null,
      calibrationRequired: Boolean(weighted && !suggestedWeights.some((weight) => Number(weight) > 0)),
      recommendationReason:
        recommendation?.reason ||
        (latest ? 'Based on the most recent completed workout.' : 'No history yet. Find a starting load.'),
    }
  })

  return {
    id: occurrenceId || `${scheduleSlotId || `adhoc-${sessionId}`}@${date}`,
    occurrenceId: occurrenceId || `${scheduleSlotId || `adhoc-${sessionId}`}@${date}`,
    scheduleSlotId,
    sessionId,
    programId: program.id,
    date,
    status: 'planned',
    programName: program.name,
    sessionName: session.name,
    focus: session.focus,
    goal: normalizeGoal(program.goal),
    items,
    manuallyEdited: false,
  }
}

export function planSnapshot(plan) {
  return {
    programId: plan.programId,
    programName: plan.programName,
    sessionId: plan.sessionId,
    sessionName: plan.sessionName,
    focus: plan.focus,
    goal: plan.goal,
    items: structuredClone(plan.items || []),
  }
}
