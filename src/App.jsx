import { useSyncExternalStore } from 'react'
import { StoreProvider } from './store'
import { getExternalChanged, getLoadUnreadable, getSaveFailed, subscribeExternalChange, subscribeLoadUnreadable, subscribeSaveFailed } from './persistence.js'
import { ErrorBoundary } from './error-boundary'
import { WakeLock } from './wake-lock'
import { RestEndCue } from './rest-cue'
import { useHashRoute } from './route'
import { Banner, Button } from './ui/index.jsx'
import { ConfirmSheet } from './ui/index.jsx'
import { Today } from './views/Today'
import {
  RoutineNew,
  RoutineDetail,
  RoutineEdit,
  RoutineExercisePick,
  RoutineExerciseNew,
  RoutineExerciseEdit,
} from './views/Routine'
import { ScheduleLoop, ScheduleDay, ScheduleDayAdd, ScheduleSlot } from './views/Schedule'
import { Exercises, ExerciseNew, ExerciseNewManual, ExerciseNewSearch, ExerciseDetail, ExerciseEdit } from './views/Exercises'
import { Workout, WorkoutItem, WorkoutItemLog, WorkoutItemDone, WorkoutItemExercise, WorkoutItemReplace, WorkoutSetEdit, WorkoutFinish, WorkoutSetup } from './views/workout'
import { History, HistoryDetail, HistoryEdit, HistorySet, HistorySetAdd, HistorySetNew, HistoryExercises, HistoryExercise, HistoryWorkoutExercise, HistoryRecalculate, HistoryRoutine } from './views/history'
import { Settings } from './views/Settings'
import { BottomMenu } from './ui/BottomMenu.jsx'
import { Library } from './views/Library'
import { Showcase } from './ui/Showcase.jsx'
// req-86 (N8) / req-87 — the "note on this page" feedback capture. req-87 flipped
// its gating from build-time (DCE'd out of prod) to RUNTIME: it ships in the
// production build and renders only when the feedback toggle is ON (default OFF),
// read reactively so a flip in Settings shows/hides it live.
import { DevNotes } from './dev/DevNotes.jsx'
import { getFeedbackEnabled, subscribeFeedbackEnabled } from './dev/dev-notes.js'

// req-121 — the three app banners use the library Banner (role="alert" kept) and
// Reload the library Button, instead of raw unstyled div/button elements.
function SaveFailedBanner() {
  const failed = useSyncExternalStore(subscribeSaveFailed, getSaveFailed, getSaveFailed)
  if (!failed) return null
  return (
    <Banner role="alert">
      Couldn't save your last change. Your data may not persist — export a backup from Settings.
    </Banner>
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
    <Banner role="alert">
      Couldn't read your saved data. It's still on this device but unreadable — don't clear
      your browser data. Nothing you do now will be saved. Seek recovery before making changes.
    </Banner>
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
    <Banner role="alert">
      Another tab changed your data — reload to see the latest.{' '}
      <Button onClick={() => window.location.reload()}>Reload</Button>
    </Banner>
  )
}

// req-87 — the runtime gate for the feedback-capture button. Subscribes to the
// feedback-enabled flag (its own localStorage key, never workout-mvp-v9) the same
// way as the banners above; renders the button/panel only when ON. Default OFF, so
// on a fresh/production visit nothing renders and no key is written until the
// Settings toggle is turned on.
function FeedbackNotesGate() {
  const enabled = useSyncExternalStore(subscribeFeedbackEnabled, getFeedbackEnabled, getFeedbackEnabled)
  if (!enabled) return null
  return <DevNotes />
}

function Screen() {
  const route = useHashRoute()
  if (route.name === 'schedule') return <Library tab="schedule" />
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
  if (route.name === 'exercise-edit') return <ExerciseEdit key={route.id} exerciseId={route.id} returnTo={route.from} />
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
  if (route.name === 'workout-item-replace') {
    return <WorkoutItemReplace key={`${route.routineId}-${route.itemId}`} routineId={route.routineId} itemId={route.itemId} />
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
  if (route.name === 'history-set-add') {
    return (
      <HistorySetAdd
        key={`${route.id}-${route.itemId}`}
        workoutId={route.id}
        exerciseId={route.exerciseId}
        itemId={route.itemId}
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
  // req-115 — the outer ErrorBoundary is the last resort: a render throw in
  // StoreProvider, a banner or the menu (outside <main>) shows the fallback instead
  // of unmounting the whole tree to a blank page. The inner one still handles a
  // screen throw with the nav left visible.
  return (
    <ErrorBoundary>
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
        <BottomMenu />
        <FeedbackNotesGate />
        <ConfirmSheet />
      </StoreProvider>
    </ErrorBoundary>
  )
}
