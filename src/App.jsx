import { useSyncExternalStore } from 'react'
import { StoreProvider } from './store'
import { getSaveFailed, subscribeSaveFailed, getLoadUnreadable, subscribeLoadUnreadable, getExternalChanged, subscribeExternalChange } from './storage'
import { ErrorBoundary } from './error-boundary'
import { WakeLock } from './wake-lock'
import { RestEndCue } from './rest-cue'
import { useHashRoute } from './route'
import { Today } from './views/Today'
import {
  RoutineNew,
  RoutineDetail,
  RoutineEdit,
  RoutineExercisePick,
  RoutineExerciseNew,
  RoutineExerciseEdit,
} from './views/Routine'
import { Schedule, ScheduleLoop, ScheduleDay, ScheduleDayAdd, ScheduleSlot } from './views/Schedule'
import { Exercises, ExerciseNew, ExerciseNewManual, ExerciseNewSearch, ExerciseDetail, ExerciseEdit } from './views/Exercises'
import { Workout, WorkoutItem, WorkoutItemLog, WorkoutItemDone, WorkoutItemExercise, WorkoutSetEdit, WorkoutFinish, WorkoutSetup } from './views/workout'
import { History, HistoryDetail, HistoryEdit, HistorySet, HistorySetNew, HistoryExercises, HistoryExercise, HistoryWorkoutExercise, HistoryRecalculate, HistoryRoutine } from './views/history'
import { StartWorkout } from './views/Start'
import { Settings } from './views/Settings'
import { TabBar } from './ui/index.jsx'
import { Library } from './views/Library'
import { Showcase } from './ui/Showcase.jsx'

function SaveFailedBanner() {
  const failed = useSyncExternalStore(subscribeSaveFailed, getSaveFailed, getSaveFailed)
  if (!failed) return null
  return (
    <div role="alert">
      Couldn't save your last change. Your data may not persist — export a backup from Settings.
    </div>
  )
}

// req-36 / DEC-032 — distinct from SaveFailedBanner: the stored data was present
// but unreadable, so the app is showing an empty history and has stopped saving to
// avoid overwriting the corrupt-but-recoverable value. Persistent until the key is
// resolved out-of-band (a reload with a readable value clears the signal).
function LoadUnreadableBanner() {
  const unreadable = useSyncExternalStore(
    subscribeLoadUnreadable,
    getLoadUnreadable,
    getLoadUnreadable,
  )
  if (!unreadable) return null
  return (
    <div role="alert">
      Couldn't read your saved data. It's still on this device but unreadable — don't clear
      your browser data. Nothing you do now will be saved. Seek recovery before making changes.
    </div>
  )
}

// req-41 / DEC-029 (audit F-RISK-3) — another same-origin tab wrote or cleared our
// storage key, so this tab's in-memory state is now stale and its next save would
// clobber the other tab's changes. Warn-only (no merge, no hold-saves): reloading
// re-reads the latest and clears the signal. Distinct from the two banners above.
function ExternalChangeBanner() {
  const changed = useSyncExternalStore(
    subscribeExternalChange,
    getExternalChanged,
    getExternalChanged,
  )
  if (!changed) return null
  return (
    <div role="alert">
      Another tab changed your data — reload to see the latest.{' '}
      <button type="button" onClick={() => window.location.reload()}>Reload</button>
    </div>
  )
}

function Screen() {
  const route = useHashRoute()
  if (route.name === 'schedule') return <Schedule />
  if (route.name === 'schedule-loop') return <ScheduleLoop />
  if (route.name === 'schedule-day') {
    return <ScheduleDay key={`${route.week}-${route.weekday}`} week={route.week} weekday={route.weekday} />
  }
  if (route.name === 'schedule-day-add') {
    return <ScheduleDayAdd key={`${route.week}-${route.weekday}`} week={route.week} weekday={route.weekday} />
  }
  if (route.name === 'schedule-slot') {
    return (
      <ScheduleSlot
        key={`${route.week}-${route.weekday}-${route.slotId}-${route.screen}-${route.itemId}-${route.exerciseId}`}
        week={route.week}
        weekday={route.weekday}
        slotId={route.slotId}
        screen={route.screen}
        itemId={route.itemId}
        exerciseId={route.exerciseId}
      />
    )
  }
  if (route.name === 'routines') return <Library tab="routines" />
  if (route.name === 'routine-new') return <RoutineNew />
  if (route.name === 'routine-edit') {
    return <RoutineEdit key={route.routineId} routineId={route.routineId} />
  }
  if (route.name === 'routine-exercise-pick') {
    return <RoutineExercisePick key={route.routineId} routineId={route.routineId} />
  }
  if (route.name === 'routine-exercise-create') {
    return <ExerciseNew key={route.routineId} returnBase={`/routines/${route.routineId}`} />
  }
  if (route.name === 'routine-exercise-create-manual') {
    return <ExerciseNewManual key={route.routineId} returnBase={`/routines/${route.routineId}`} />
  }
  if (route.name === 'routine-exercise-create-search') {
    return <ExerciseNewSearch key={route.routineId} returnBase={`/routines/${route.routineId}`} />
  }
  if (route.name === 'routine-exercise-new') {
    return (
      <RoutineExerciseNew
        key={`${route.routineId}-${route.exerciseId}`}
        routineId={route.routineId}
        exerciseId={route.exerciseId}
      />
    )
  }
  if (route.name === 'routine-exercise') {
    return (
      <RoutineExerciseEdit
        key={`${route.routineId}-${route.itemId}`}
        routineId={route.routineId}
        itemId={route.itemId}
      />
    )
  }
  if (route.name === 'routine') {
    return <RoutineDetail key={route.routineId} routineId={route.routineId} />
  }
  if (route.name === 'exercises') return <Library tab="exercises" />
  if (route.name === 'exercises-type') {
    return <Exercises key={route.type} type={route.type} />
  }
  if (route.name === 'exercise-new-manual') return <ExerciseNewManual />
  if (route.name === 'exercise-new-search') return <ExerciseNewSearch />
  if (route.name === 'exercise-new') return <ExerciseNew />
  if (route.name === 'exercise-edit') return <ExerciseEdit key={route.id} exerciseId={route.id} />
  if (route.name === 'exercise') return <ExerciseDetail exerciseId={route.id} />
  if (route.name === 'workout-set') return <WorkoutSetEdit key={`${route.routineId}-${route.index}`} routineId={route.routineId} index={route.index} />
  if (route.name === 'workout-item-done') {
    return <WorkoutItemDone key={`${route.routineId}-${route.itemId}`} routineId={route.routineId} itemId={route.itemId} />
  }
  if (route.name === 'workout-item-exercise') {
    return <WorkoutItemExercise key={`${route.routineId}-${route.itemId}`} routineId={route.routineId} itemId={route.itemId} />
  }
  if (route.name === 'workout-item-log') {
    return <WorkoutItemLog key={`${route.routineId}-${route.itemId}`} routineId={route.routineId} itemId={route.itemId} />
  }
  if (route.name === 'workout-item') {
    return <WorkoutItem key={`${route.routineId}-${route.itemId}`} routineId={route.routineId} itemId={route.itemId} />
  }
  if (route.name === 'workout-finish') return <WorkoutFinish key={route.routineId} routineId={route.routineId} />
  if (route.name === 'workout-setup') {
    return (
      <WorkoutSetup
        key={`${route.routineId}-${route.scheduleSlotId}-${route.date}-${route.screen}-${route.itemId}-${route.exerciseId}`}
        routineId={route.routineId}
        scheduleSlotId={route.scheduleSlotId}
        date={route.date}
        screen={route.screen}
        itemId={route.itemId}
        exerciseId={route.exerciseId}
      />
    )
  }
  if (route.name === 'workout-preview') {
    return <Workout key={`${route.routineId}-${route.scheduleSlotId}-${route.date}`} routineId={route.routineId} scheduleSlotId={route.scheduleSlotId} date={route.date} />
  }
  if (route.name === 'workout') return <Workout routineId={route.routineId} />
  if (route.name === 'start') return <StartWorkout />
  if (route.name === 'history') return <History />
  if (route.name === 'history-month') return <History key={route.month} month={route.month} />
  if (route.name === 'history-exercises') return <HistoryExercises />
  if (route.name === 'history-exercise') return <HistoryExercise key={route.id} exerciseId={route.id} />
  if (route.name === 'history-workout-exercise') {
    return (
      <HistoryWorkoutExercise
        key={`${route.id}-${route.exerciseId}`}
        workoutId={route.id}
        exerciseId={route.exerciseId}
      />
    )
  }
  if (route.name === 'history-edit') return <HistoryEdit key={route.id} workoutId={route.id} />
  if (route.name === 'history-recalculate') return <HistoryRecalculate key={route.id} workoutId={route.id} />
  if (route.name === 'history-routine') {
    return (
      <HistoryRoutine
        key={`${route.id}-${route.screen}-${route.itemId}-${route.exerciseId}`}
        workoutId={route.id}
        screen={route.screen}
        itemId={route.itemId}
        exerciseId={route.exerciseId}
      />
    )
  }
  if (route.name === 'history-set-new') return <HistorySetNew key={route.id} workoutId={route.id} />
  if (route.name === 'history-set') return <HistorySet key={`${route.id}-${route.index}`} workoutId={route.id} index={route.index} />
  if (route.name === 'history-detail') return <HistoryDetail workoutId={route.id} />
  if (route.name === 'settings') return <Settings />
  if (route.name === 'components') return <Showcase />
  return <Today />
}

export default function App() {
  return (
    <StoreProvider>
      <WakeLock />
      <RestEndCue />
      <SaveFailedBanner />
      <LoadUnreadableBanner />
      <ExternalChangeBanner />
      <main className="ui-main">
        <ErrorBoundary>
          <Screen />
        </ErrorBoundary>
      </main>
      <TabBar />
    </StoreProvider>
  )
}
