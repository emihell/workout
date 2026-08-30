import { useCallback, useMemo, useState } from 'react'
import { uid } from './ids'
import { applyBackup as applyBackupFn } from './exchange.js'
import { applyProgressionToRoutines, buildPlannedWorkout, planSnapshot, progressionFromWorkout } from './model'
import { clampLoopWeeks } from './schedule'
import { loadState, saveState } from './storage'
import { StoreContext } from './store-context'
import { addWorkingSetToState, withSkippedUnloggedSets } from './workout-log'

export function StoreProvider({ children }) {
  const [state, setStateRaw] = useState(loadState)

  const setState = useCallback((updater) => {
    setStateRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
      saveState(next)
      return next
    })
  }, [])

  const api = useMemo(() => {
    function patchRoutine(routineId, mutator) {
      setState((s) => ({
        ...s,
        routines: (s.routines || []).map((routine) => (routine.id === routineId ? mutator(routine) : routine)),
      }))
    }

    return {
      ...state,
      addRoutine({ name, focus }) {
        const routine = {
          id: uid('rtn'),
          name: name.trim() || 'Routine',
          focus: focus || 'Machines',
          exercises: [],
        }
        setState((s) => ({ ...s, routines: [...(s.routines || []), routine] }))
        return routine.id
      },
      updateRoutine(routineId, patch) {
        patchRoutine(routineId, (routine) => ({ ...routine, ...patch }))
      },
      removeRoutine(routineId) {
        setState((s) => {
          const referenced = (s.workouts || []).some(
            (workout) => (workout.routineId || workout.sessionId) === routineId,
          )
          return {
            ...s,
            routines: referenced
              ? (s.routines || []).map((routine) =>
                  routine.id === routineId ? { ...routine, archivedAt: new Date().toISOString() } : routine,
                )
              : (s.routines || []).filter((routine) => routine.id !== routineId),
            schedule: {
              ...s.schedule,
              slots: (s.schedule?.slots || []).filter(
                (slot) => (slot.routineId || slot.sessionId) !== routineId,
              ),
            },
            plannedWorkouts: (s.plannedWorkouts || []).filter(
              (plan) => (plan.routineId || plan.sessionId) !== routineId,
            ),
          }
        })
      },
      addRoutineExercise(routineId, item) {
        patchRoutine(routineId, (routine) => ({
          ...routine,
          exercises: [
            ...routine.exercises,
            {
              id: item.id || uid('si'),
              exerciseId: item.exerciseId,
              role: item.role || 'main',
              restSec: Number(item.restSec) || 0,
              notes: item.notes || '',
              warmup: item.warmup || null,
              sets: Math.max(1, Number(item.sets) || (item.targets || []).length || 1),
              targets: Array.isArray(item.targets) ? item.targets : [],
              suggestedWeights: Array.isArray(item.suggestedWeights) ? item.suggestedWeights : [],
            },
          ],
        }))
      },
      updateRoutineExercise(routineId, index, patch) {
        patchRoutine(routineId, (routine) => ({
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
                  suggestedWeights:
                    patch.suggestedWeights !== undefined ? patch.suggestedWeights : item.suggestedWeights,
                }
              : item,
          ),
        }))
      },
      removeRoutineExercise(routineId, index) {
        patchRoutine(routineId, (routine) => ({
          ...routine,
          exercises: routine.exercises.filter((_, i) => i !== index),
        }))
      },
      moveRoutineExercise(routineId, index, dir) {
        patchRoutine(routineId, (routine) => {
          const next = [...routine.exercises]
          const j = index + dir
          if (j < 0 || j >= next.length) return routine
          const tmp = next[index]
          next[index] = next[j]
          next[j] = tmp
          return { ...routine, exercises: next }
        })
      },
      setLoopWeeks(n) {
        const loopWeeks = clampLoopWeeks(n)
        setState((s) => ({
          ...s,
          schedule: {
            ...s.schedule,
            loopWeeks,
            slots: (s.schedule?.slots || []).filter((slot) => Number(slot.week) < loopWeeks),
          },
        }))
      },
      addSlot({ week, weekday, routineId }) {
        const slot = {
          id: uid('slot'),
          week: Number(week),
          weekday: Number(weekday),
          routineId,
        }
        setState((s) => {
          const duplicate = (s.schedule?.slots || []).some(
            (candidate) =>
              Number(candidate.week) === Number(week) &&
              Number(candidate.weekday) === Number(weekday) &&
              (candidate.routineId || candidate.sessionId) === routineId,
          )
          if (duplicate) return s
          return {
            ...s,
            schedule: { ...s.schedule, slots: [...(s.schedule?.slots || []), slot] },
          }
        })
        return slot.id
      },
      removeSlot(slotId) {
        setState((s) => ({
          ...s,
          schedule: {
            ...s.schedule,
            slots: (s.schedule?.slots || []).filter((slot) => slot.id !== slotId),
          },
        }))
      },
      addExercise(data) {
        const exercise = {
          id: uid('ex'),
          name: data.name.trim(),
          equipment: (data.equipment || '').trim() || 'Unknown',
          weightStep: (data.weightStep || '').trim() || 'n/a',
          muscles: (data.muscles || '').trim(),
          cues: (data.cues || '').trim(),
          type: data.type || 'free',
        }
        setState((s) => ({ ...s, exercises: [...s.exercises, exercise] }))
        return exercise.id
      },
      updateExercise(exerciseId, patch) {
        setState((s) => ({
          ...s,
          exercises: s.exercises.map((ex) => (ex.id === exerciseId ? { ...ex, ...patch } : ex)),
        }))
      },
      removeExercise(exerciseId) {
        setState((s) => ({
          ...s,
          exercises: (s.workouts || []).some((workout) =>
            (workout.sets || []).some((set) => set.exerciseId === exerciseId),
          )
            ? s.exercises.map((ex) =>
                ex.id === exerciseId ? { ...ex, archivedAt: new Date().toISOString() } : ex,
              )
            : s.exercises.filter((ex) => ex.id !== exerciseId),
          routines: (s.routines || []).map((routine) => ({
            ...routine,
            exercises: (routine.exercises || []).filter((item) => item.exerciseId !== exerciseId),
          })),
          plannedWorkouts: (s.plannedWorkouts || []).map((plan) => ({
            ...plan,
            items: (plan.items || []).filter((item) => item.exerciseId !== exerciseId),
          })),
        }))
      },
      getPlannedWorkout(args) {
        return buildPlannedWorkout(state, args)
      },
      startWorkout(routineId, scheduledFor = null, scheduleSlotId = null, suppliedPlan = null) {
        setState((s) => {
          const plan =
            suppliedPlan ||
            buildPlannedWorkout(s, {
              routineId,
              date: scheduledFor || new Date().toISOString().slice(0, 10),
              scheduleSlotId,
            })
          if (!plan) return s
          if (s.activeWorkout?.occurrenceId === plan.occurrenceId) return s
          return {
            ...s,
            draftWorkouts: s.activeWorkout
              ? [
                  ...(s.draftWorkouts || []).filter(
                    (draft) => draft.occurrenceId !== s.activeWorkout.occurrenceId,
                  ),
                  s.activeWorkout,
                ]
              : s.draftWorkouts || [],
            activeWorkout: {
              id: uid('wo'),
              routineId,
              scheduledFor: plan.scheduleSlotId ? plan.date : null,
              performedOn: new Date().toISOString().slice(0, 10),
              scheduleSlotId: plan.scheduleSlotId || null,
              occurrenceId: plan.occurrenceId,
              snapshot: planSnapshot(plan),
              startedAt: new Date().toISOString(),
              finishedAt: null,
              overallNote: '',
              overallFeel: '',
              completedItemIds: [],
              restEndsAt: null,
              restPausedRemaining: null,
              sets: [],
              progression: null,
            },
          }
        })
      },
      resumeDraft(workoutId) {
        setState((s) => {
          const draft = (s.draftWorkouts || []).find((candidate) => candidate.id === workoutId)
          if (!draft) return s
          return {
            ...s,
            draftWorkouts: [
              ...(s.draftWorkouts || []).filter((candidate) => candidate.id !== workoutId),
              ...(s.activeWorkout ? [s.activeWorkout] : []),
            ],
            activeWorkout: draft,
          }
        })
      },
      abandonWorkout() {
        setState((s) => ({ ...s, activeWorkout: null }))
      },
      patchActive(patch) {
        setState((s) => {
          if (!s.activeWorkout) return s
          return { ...s, activeWorkout: { ...s.activeWorkout, ...patch } }
        })
      },
      addWorkingSet(itemId) {
        setState((s) => addWorkingSetToState(s, itemId))
      },
      completeSet(setRecord, activePatch = {}) {
        setState((s) => {
          if (!s.activeWorkout) return s
          return {
            ...s,
            activeWorkout: {
              ...s.activeWorkout,
              ...activePatch,
              sets: [...s.activeWorkout.sets, setRecord],
            },
          }
        })
      },
      updateActiveSet(index, patch) {
        setState((s) => {
          if (!s.activeWorkout) return s
          return {
            ...s,
            activeWorkout: {
              ...s.activeWorkout,
              sets: (s.activeWorkout.sets || []).map((set, i) =>
                i === index ? { ...set, ...patch } : set,
              ),
            },
          }
        })
      },
      removeActiveSet(index) {
        setState((s) => {
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
        })
      },
      updateWorkout(workoutId, patch) {
        setState((s) => ({
          ...s,
          workouts: s.workouts.map((w) => (w.id === workoutId ? { ...w, ...patch } : w)),
        }))
      },
      removeWorkout(workoutId) {
        setState((s) => ({
          ...s,
          workouts: s.workouts.filter((w) => w.id !== workoutId),
        }))
      },
      recalculateFuturePlans(workoutId) {
        setState((s) => {
          const workout = (s.workouts || []).find((candidate) => candidate.id === workoutId)
          if (!workout) return s
          return {
            ...s,
            routines: applyProgressionToRoutines(
              s.routines,
              workout.routineId || workout.sessionId,
              progressionFromWorkout(s, workout),
            ),
          }
        })
      },
      finishWorkout({ overallNote, overallFeel, progression = [] }) {
        setState((s) => {
          if (!s.activeWorkout) return s
          const finished = withSkippedUnloggedSets({
            ...s.activeWorkout,
            finishedAt: new Date().toISOString(),
            overallNote: overallNote || '',
            overallFeel: overallFeel || '',
            restEndsAt: null,
            restPausedRemaining: null,
            progression,
          })
          return {
            ...s,
            routines: applyProgressionToRoutines(
              s.routines,
              finished.routineId || finished.sessionId,
              progression,
            ),
            plannedWorkouts: (s.plannedWorkouts || []).filter(
              (plan) => plan.occurrenceId !== s.activeWorkout.occurrenceId,
            ),
            activeWorkout: null,
            workouts: [finished, ...s.workouts],
          }
        })
      },
      applyBackup(payload) {
        let result
        setState(() => {
          result = applyBackupFn(payload)
          return result.state
        })
        return result
      },
    }
  }, [state, setState])

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}
