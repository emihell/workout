import { useCallback, useMemo, useState } from 'react'
import { uid } from './ids'
import { commitBackup } from './exchange.js'
import { buildPlannedWorkout, recalculatedState } from './model'
import { clampLoopWeeks } from './schedule'
import { loadState, saveState } from './persistence.js'
import {
  activePatchedState,
  activeSetRemovedState,
  activeSetUpdatedState,
  draftAbandonedState,
  draftContinuedState,
  exerciseAddedState,
  exerciseUpdatedState,
  itemSkippedState,
  loopWeeksState,
  removeExerciseFromState,
  removeRoutineFromState,
  replaceItemInState,
  restoreExerciseInState,
  routineAddedState,
  routineItemAdded,
  routineItemMoved,
  routineItemRemoved,
  routineItemUpdated,
  routinePatchedState,
  setLoggedState,
  slotAddedState,
  slotRemovedState,
  startedWorkoutState,
  workoutAbandonedState,
  workoutRemovedState,
  workoutUpdatedState,
} from './state-reducers.js'
import { StoreContext } from './store-context'
import { exerciseFromData } from './exercise-names.js'
import { planIds, planToState } from './plan-templates.js'
import { addWorkingSetToState, finishedState } from './workout-log'

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
    // req-164 (F-STRUCT-6) — every reducer is a pure function in state-reducers.js /
    // workout-log.js / model.js; the store only makes ids and clock readings and hands
    // them in.
    function patchRoutine(routineId, mutator) {
      setState((s) => routinePatchedState(s, routineId, mutator))
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
        setState((s) => routineAddedState(s, routine))
        return routine.id
      },
      updateRoutine(routineId, patch) {
        patchRoutine(routineId, (routine) => ({ ...routine, ...patch }))
      },
      // req-119 — the reducer (archive when referenced, incl. the live workout) is in state-reducers.js.
      removeRoutine(routineId) {
        setState((s) => removeRoutineFromState(s, routineId))
      },
      addRoutineExercise(routineId, item) {
        const id = item.id || uid('si')
        patchRoutine(routineId, (routine) => routineItemAdded(routine, item, id))
      },
      updateRoutineExercise(routineId, index, patch) {
        patchRoutine(routineId, (routine) => routineItemUpdated(routine, index, patch))
      },
      removeRoutineExercise(routineId, index) {
        patchRoutine(routineId, (routine) => routineItemRemoved(routine, index))
      },
      moveRoutineExercise(routineId, index, dir) {
        patchRoutine(routineId, (routine) => routineItemMoved(routine, index, dir))
      },
      setLoopWeeks(n) {
        const loopWeeks = clampLoopWeeks(n)
        setState((s) => loopWeeksState(s, loopWeeks))
      },
      addSlot({ week, weekday, routineId }) {
        const slot = {
          id: uid('slot'),
          week: Number(week),
          weekday: Number(weekday),
          routineId,
        }
        setState((s) => slotAddedState(s, slot))
        return slot.id
      },
      // req-181 (DEC-098) — "Start from a plan": exercises, routines, items and (on an empty
      // schedule) the week's slots in ONE state write. The ids are made here, before the
      // updater, so a re-run updater (StrictMode) builds the same records; the result is read
      // from the same pure reducer on the current state.
      applyPlan(choices) {
        const ids = planIds(choices, uid, new Date())
        setState((s) => planToState(s, choices, ids()).state)
        const { routineIds, scheduled } = planToState(state, choices, ids())
        return { routineIds, scheduled }
      },
      removeSlot(slotId) {
        setState((s) => slotRemovedState(s, slotId))
      },
      addExercise(data) {
        // req-127 — the record is built by exerciseFromData (exercise-names.js), unchanged.
        const exercise = exerciseFromData(data, uid('ex'))
        setState((s) => exerciseAddedState(s, exercise))
        return exercise.id
      },
      updateExercise(exerciseId, patch) {
        setState((s) => exerciseUpdatedState(s, exerciseId, patch))
      },
      // req-119 — the reducer (archive when referenced, incl. the live workout) is in state-reducers.js.
      removeExercise(exerciseId) {
        setState((s) => removeExerciseFromState(s, exerciseId))
      },
      // req-127 / DEC-059 §3 — un-archive ONE exercise (same id); reducer in state-reducers.js.
      restoreExercise(exerciseId) {
        setState((s) => restoreExerciseInState(s, exerciseId))
        return exerciseId
      },
      getPlannedWorkout(args) {
        return buildPlannedWorkout(state, args)
      },
      // DEC-038 / req-55 — one in-progress workout; the reducer (startedWorkoutState) keeps
      // `draftWorkouts` as legacy data and never writes it.
      startWorkout(routineId, scheduledFor = null, scheduleSlotId = null, suppliedPlan = null) {
        const id = uid('wo')
        const now = new Date()
        setState((s) => startedWorkoutState(s, { routineId, scheduledFor, scheduleSlotId, suppliedPlan, id, now }))
      },
      // req-55 — resolve / discard a LEGACY stored draft (the removed multi-draft feature).
      continueDraft(workoutId) {
        setState((s) => draftContinuedState(s, workoutId))
      },
      abandonDraft(workoutId) {
        setState((s) => draftAbandonedState(s, workoutId))
      },
      abandonWorkout() {
        setState((s) => workoutAbandonedState(s))
      },
      patchActive(patch) {
        setState((s) => activePatchedState(s, patch))
      },
      addWorkingSet(itemId) {
        setState((s) => addWorkingSetToState(s, itemId))
      },
      // req-109 — Skip exercise: remaining sets of the item logged skipped, item done.
      skipItem(itemId) {
        setState((s) => itemSkippedState(s, itemId))
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
      // update (setLoggedState → withLoggedSet), from the latest state.
      completeSet(setRecord, activePatch = {}, { draftKey = null } = {}) {
        setState((s) => setLoggedState(s, setRecord, activePatch, draftKey))
      },
      updateActiveSet(index, patch) {
        setState((s) => activeSetUpdatedState(s, index, patch))
      },
      // req-25 — clears the armed rest too (activeSetRemovedState).
      removeActiveSet(index) {
        setState((s) => activeSetRemovedState(s, index))
      },
      updateWorkout(workoutId, patch) {
        setState((s) => workoutUpdatedState(s, workoutId, patch))
      },
      removeWorkout(workoutId) {
        setState((s) => workoutRemovedState(s, workoutId))
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
