import { useCallback, useMemo, useState } from 'react'
import { uid } from './ids'
import { buildPlannedWorkout, planSnapshot } from './model'
import { clampLoopWeeks } from './schedule'
import { findSession, loadState, saveState } from './storage'
import { StoreContext } from './store-context'

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
    function patchProgram(programId, mutator) {
      setState((s) => ({
        ...s,
        programs: s.programs.map((p) => (p.id === programId ? mutator(p) : p)),
      }))
    }

    return {
      ...state,
      createProgram({ name, goal }) {
        const program = {
          id: uid('prog'),
          name: name.trim() || 'Program',
          goal: goal || 'gain',
          sessions: [],
        }
        setState((s) => ({ ...s, programs: [...s.programs, program] }))
        return program.id
      },
      updateProgram(programId, patch) {
        patchProgram(programId, (p) => ({ ...p, ...patch }))
      },
      removeProgram(programId) {
        setState((s) => {
          const sessionIds = new Set(
            s.programs.find((program) => program.id === programId)?.sessions?.map((session) => session.id) || [],
          )
          const referenced = (s.workouts || []).some((workout) => sessionIds.has(workout.sessionId))
          return {
            ...s,
            programs: referenced
              ? s.programs.map((program) =>
                  program.id === programId
                    ? { ...program, archivedAt: new Date().toISOString() }
                    : program,
                )
              : s.programs.filter((program) => program.id !== programId),
            schedule: {
              ...s.schedule,
              slots: (s.schedule?.slots || []).filter((slot) => slot.programId !== programId),
            },
            plannedWorkouts: (s.plannedWorkouts || []).filter(
              (plan) => plan.programId !== programId,
            ),
          }
        })
      },
      addSession(programId, { name, focus }) {
        const session = {
          id: uid('sess'),
          name: name.trim() || 'Session',
          focus: focus || 'Machines',
          exercises: [],
        }
        patchProgram(programId, (p) => ({ ...p, sessions: [...p.sessions, session] }))
        return session.id
      },
      updateSession(programId, sessionId, patch) {
        patchProgram(programId, (p) => ({
          ...p,
          sessions: p.sessions.map((sess) => (sess.id === sessionId ? { ...sess, ...patch } : sess)),
        }))
      },
      removeSession(programId, sessionId) {
        setState((s) => ({
          ...s,
          programs: s.programs.map((p) => {
            if (p.id !== programId) return p
            const referenced = (s.workouts || []).some((workout) => workout.sessionId === sessionId)
            return {
              ...p,
              sessions: referenced
                ? p.sessions.map((sess) =>
                    sess.id === sessionId ? { ...sess, archivedAt: new Date().toISOString() } : sess,
                  )
                : p.sessions.filter((sess) => sess.id !== sessionId),
            }
          }),
          schedule: {
            ...s.schedule,
            slots: (s.schedule?.slots || []).filter((slot) => slot.sessionId !== sessionId),
          },
          plannedWorkouts: (s.plannedWorkouts || []).filter(
            (plan) => plan.sessionId !== sessionId,
          ),
        }))
      },
      addSessionExercise(programId, sessionId, item) {
        patchProgram(programId, (p) => ({
          ...p,
          sessions: p.sessions.map((sess) => {
            if (sess.id !== sessionId) return sess
            return {
              ...sess,
              exercises: [
                ...sess.exercises,
                {
                  id: item.id || uid('si'),
                  exerciseId: item.exerciseId,
                  role: item.role || 'main',
                  restSec: Number(item.restSec) || 0,
                  notes: item.notes || '',
                  warmup: item.warmup || null,
                },
              ],
            }
          }),
        }))
      },
      updateSessionExercise(programId, sessionId, index, patch) {
        patchProgram(programId, (p) => ({
          ...p,
          sessions: p.sessions.map((sess) => {
            if (sess.id !== sessionId) return sess
            return {
              ...sess,
              exercises: sess.exercises.map((item, i) =>
                i === index
                  ? {
                      ...item,
                      role: patch.role ?? item.role,
                      restSec: patch.restSec ?? item.restSec,
                      notes: patch.notes ?? item.notes,
                      warmup: patch.warmup === undefined ? item.warmup : patch.warmup,
                    }
                  : item,
              ),
            }
          }),
        }))
      },
      removeSessionExercise(programId, sessionId, index) {
        patchProgram(programId, (p) => ({
          ...p,
          sessions: p.sessions.map((sess) => {
            if (sess.id !== sessionId) return sess
            return { ...sess, exercises: sess.exercises.filter((_, i) => i !== index) }
          }),
        }))
      },
      moveSessionExercise(programId, sessionId, index, dir) {
        patchProgram(programId, (p) => ({
          ...p,
          sessions: p.sessions.map((sess) => {
            if (sess.id !== sessionId) return sess
            const next = [...sess.exercises]
            const j = index + dir
            if (j < 0 || j >= next.length) return sess
            const tmp = next[index]
            next[index] = next[j]
            next[j] = tmp
            return { ...sess, exercises: next }
          }),
        }))
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
      addSlot({ week, weekday, programId, sessionId }) {
        const slot = {
          id: uid('slot'),
          week: Number(week),
          weekday: Number(weekday),
          programId,
          sessionId,
        }
        setState((s) => {
          const duplicate = (s.schedule?.slots || []).some(
            (candidate) =>
              Number(candidate.week) === Number(week) &&
              Number(candidate.weekday) === Number(weekday) &&
              candidate.sessionId === sessionId,
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
          programs: s.programs.map((p) => ({
            ...p,
            sessions: p.sessions.map((sess) => ({
              ...sess,
              exercises: (sess.exercises || []).filter((item) => item.exerciseId !== exerciseId),
            })),
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
      savePlannedWorkout(plan) {
        setState((s) => ({
          ...s,
          plannedWorkouts: [
            ...(s.plannedWorkouts || []).filter((candidate) => candidate.id !== plan.id),
            { ...plan, manuallyEdited: true },
          ],
        }))
      },
      startWorkout(sessionId, scheduledFor = null, scheduleSlotId = null, suppliedPlan = null) {
        setState((s) => {
          const plan =
            suppliedPlan ||
            buildPlannedWorkout(s, {
              sessionId,
              date: scheduledFor || new Date().toISOString().slice(0, 10),
              scheduleSlotId,
            })
          if (!plan) return s
          if (s.activeWorkout?.occurrenceId === plan.occurrenceId) return s
          const { program } = findSession(s.programs, sessionId)
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
              programId: program?.id || null,
              sessionId,
              scheduledFor: plan.scheduleSlotId ? plan.date : null,
              performedOn: new Date().toISOString().slice(0, 10),
              scheduleSlotId: plan.scheduleSlotId || null,
              occurrenceId: plan.occurrenceId,
              snapshot: planSnapshot(plan),
              startedAt: new Date().toISOString(),
              finishedAt: null,
              overallNote: '',
              overallFeel: '',
              exerciseIndex: 0,
              extraSets: {},
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
      completeSet(setRecord) {
        setState((s) => {
          if (!s.activeWorkout) return s
          return {
            ...s,
            activeWorkout: {
              ...s.activeWorkout,
              sets: [...s.activeWorkout.sets, setRecord],
              restPausedRemaining: null,
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
          const cutoff = new Date().toISOString().slice(0, 10)
          return {
            ...s,
            plannedWorkouts: (s.plannedWorkouts || []).filter(
              (plan) =>
                plan.sessionId !== workout.sessionId ||
                plan.date < cutoff ||
                plan.manuallyEdited,
            ),
          }
        })
      },
      finishWorkout({ overallNote, overallFeel, progression = [] }) {
        setState((s) => {
          if (!s.activeWorkout) return s
          const finished = {
            ...s.activeWorkout,
            finishedAt: new Date().toISOString(),
            overallNote: overallNote || '',
            overallFeel: overallFeel || '',
            restEndsAt: null,
            restPausedRemaining: null,
            progression,
          }
          return {
            ...s,
            plannedWorkouts: (s.plannedWorkouts || []).filter(
              (plan) => plan.occurrenceId !== s.activeWorkout.occurrenceId,
            ),
            activeWorkout: null,
            workouts: [finished, ...s.workouts],
          }
        })
      },
    }
  }, [state, setState])

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}
