import { useCallback, useMemo, useState } from 'react'
import { uid } from './ids'
import { commitBackup } from './exchange.js'
import { buildPlannedWorkout, planSnapshot, recalculatedState } from './model'
import { clampLoopWeeks, dateKey } from './schedule'
import { loadState, removeExerciseFromState, removeRoutineFromState, replaceItemInState, restoreExerciseInState, saveState } from './storage'
import { StoreContext } from './store-context'
import { exerciseFromData, patchExercise } from './exercise-names.js'
import { addWorkingSetToState, finishedState, skipItemPatch, withLoggedSet } from './workout-log'

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
      // req-119 — the reducer (archive when referenced, incl. the live workout) is in storage.js.
      removeRoutine(routineId) {
        setState((s) => removeRoutineFromState(s, routineId))
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
              // req-85 — per-set target seconds (parallel to targets/suggestedWeights).
              durations: Array.isArray(item.durations) ? item.durations : [],
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
                  durations: patch.durations !== undefined ? patch.durations : item.durations,
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
              candidate.routineId === routineId,
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
        // req-127 — the record is built by exerciseFromData (exercise-names.js), unchanged.
        const exercise = exerciseFromData(data, uid('ex'))
        setState((s) => ({ ...s, exercises: [...s.exercises, exercise] }))
        return exercise.id
      },
      updateExercise(exerciseId, patch) {
        setState((s) => ({
          ...s,
          exercises: s.exercises.map((ex) => (ex.id === exerciseId ? patchExercise(ex, patch) : ex)),
        }))
      },
      // req-119 — the reducer (archive when referenced, incl. the live workout) is in storage.js.
      removeExercise(exerciseId) {
        setState((s) => removeExerciseFromState(s, exerciseId))
      },
      // req-127 / DEC-059 §3 — un-archive ONE exercise (same id); reducer in storage.js.
      restoreExercise(exerciseId) {
        setState((s) => restoreExerciseInState(s, exerciseId))
        return exerciseId
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
              date: scheduledFor || dateKey(new Date()),
              scheduleSlotId,
            })
          if (!plan) return s
          if (s.activeWorkout?.occurrenceId === plan.occurrenceId) return s
          // DEC-038 / req-55 — exactly one in-progress workout. Starting a new one
          // discards whatever was active (the caller warns first, workout-actions.js);
          // no draft stacking. The `draftWorkouts` field is kept (legacy data) but is
          // never written to again.
          return {
            ...s,
            activeWorkout: {
              id: uid('wo'),
              routineId,
              scheduledFor: plan.scheduleSlotId ? plan.date : null,
              performedOn: dateKey(new Date()),
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
              // req-83 (N9) — live, session-scoped per-field seed overrides
              // (exerciseId::setType → {weight?, reps?}). Transient: never a schema
              // field, cleared when the workout finishes (activeWorkout → null).
              seedOverrides: {},
            },
          }
        })
      },
      // req-55 — resolve a LEGACY stored draft (the removed multi-draft feature).
      // Continue promotes the draft to the single active workout, discarding any
      // current active entirely (one-in-progress invariant; the caller warns first).
      // No new drafts are ever written — this only drains what old data left behind.
      continueDraft(workoutId) {
        setState((s) => {
          const draft = (s.draftWorkouts || []).find((candidate) => candidate.id === workoutId)
          if (!draft) return s
          return {
            ...s,
            draftWorkouts: (s.draftWorkouts || []).filter((candidate) => candidate.id !== workoutId),
            activeWorkout: draft,
          }
        })
      },
      // req-55 — discard a legacy stored draft. No finished-history record (an
      // unfinished workout is not completed history, DESIGN §1); it is simply removed
      // from draftWorkouts.
      abandonDraft(workoutId) {
        setState((s) => ({
          ...s,
          draftWorkouts: (s.draftWorkouts || []).filter((candidate) => candidate.id !== workoutId),
        }))
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
      // req-109 — Skip exercise: remaining sets of the item logged skipped, item done.
      skipItem(itemId) {
        setState((s) => {
          const patch = s.activeWorkout ? skipItemPatch(s.activeWorkout, itemId) : null
          return patch ? { ...s, activeWorkout: { ...s.activeWorkout, ...patch } } : s
        })
      },
      // req-109 — Replace exercise: the original skipped, a blank item for `exerciseId`
      // inserted after it (this workout only; the routine is never touched). Rest comes
      // from the exercise's own last finished snapshot, else none.
      // req-124 — the new item's id is generated before the updater and returned, so the
      // picker can land on the new exercise's log screen (reducer: replaceItemInState).
      replaceItem(itemId, exerciseId) {
        const id = uid('mid')
        setState((s) => replaceItemInState(s, itemId, exerciseId, id))
        return id
      },
      // req-125 — `draftKey`: the set being logged; its setDraft is dropped inside this
      // update (withLoggedSet), from the latest state.
      completeSet(setRecord, activePatch = {}, { draftKey = null } = {}) {
        setState((s) => {
          if (!s.activeWorkout) return s
          return { ...s, activeWorkout: withLoggedSet(s.activeWorkout, setRecord, activePatch, draftKey) }
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
        setState((s) => recalculatedState(s, workoutId))
      },
      // req-112 / DEC-056 — Finish never writes the routine; the pure reducer is in
      // workout-log.js so the manual and auto-complete paths are unit-tested through it.
      finishWorkout(args) {
        setState((s) => finishedState(s, args))
      },
      // req-115 — validate + migrate first, then set; a bad file throws to the caller.
      applyBackup(payload) {
        return commitBackup(payload, setState)
      },
    }
  }, [state, setState])

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}
