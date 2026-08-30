import { StoreProvider } from './store'
import { useHashRoute } from './route'
import { Today } from './views/Today'
import {
  Routines,
  RoutineNew,
  RoutineDetail,
  RoutineEdit,
  RoutineExercisePick,
  RoutineExerciseNew,
  RoutineExerciseEdit,
} from './views/Routine'
import { Schedule, ScheduleLoop, ScheduleDay, ScheduleDayAdd, ScheduleSlot, SchedulePlanItem } from './views/Schedule'
import { Exercises, ExerciseNew, ExerciseNewManual, ExerciseNewSearch, ExerciseDetail, ExerciseEdit } from './views/Exercises'
import { Workout, WorkoutItem, WorkoutItemLog, WorkoutItemDone, WorkoutItemExercise, WorkoutSetEdit, WorkoutFinish } from './views/Workout'
import { History, HistoryDetail, HistoryEdit, HistorySet, HistorySetNew, HistoryExercises, HistoryExercise, HistoryWorkoutExercise, HistoryRecalculate, HistoryDelete } from './views/History'
import { StartWorkout } from './views/Start'
import { Settings } from './views/Settings'

function Nav() {
  return (
    <nav>
      <a href="#/">Today</a>
      {' · '}
      <a href="#/schedule">Schedule</a>
      {' · '}
      <a href="#/routines">Routines</a>
      {' · '}
      <a href="#/exercises">Exercises</a>
      {' · '}
      <a href="#/history">History</a>
      {' · '}
      <a href="#/settings">Settings</a>
    </nav>
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
  if (route.name === 'schedule-plan-item') {
    return (
      <SchedulePlanItem
        key={`${route.week}-${route.weekday}-${route.slotId}-${route.date}-${route.itemId}`}
        week={route.week}
        weekday={route.weekday}
        slotId={route.slotId}
        date={route.date}
        itemId={route.itemId}
      />
    )
  }
  if (route.name === 'schedule-slot') {
    return (
      <ScheduleSlot
        key={`${route.week}-${route.weekday}-${route.slotId}`}
        week={route.week}
        weekday={route.weekday}
        slotId={route.slotId}
      />
    )
  }
  if (route.name === 'routines') return <Routines />
  if (route.name === 'routine-new') return <RoutineNew />
  if (route.name === 'routine-edit') {
    return <RoutineEdit key={route.routineId} routineId={route.routineId} />
  }
  if (route.name === 'routine-exercise-pick') {
    return <RoutineExercisePick key={route.routineId} routineId={route.routineId} />
  }
  if (route.name === 'routine-exercise-create') {
    return <ExerciseNew key={route.routineId} returnRoutineId={route.routineId} />
  }
  if (route.name === 'routine-exercise-create-manual') {
    return <ExerciseNewManual key={route.routineId} returnRoutineId={route.routineId} />
  }
  if (route.name === 'routine-exercise-create-search') {
    return <ExerciseNewSearch key={route.routineId} returnRoutineId={route.routineId} />
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
  if (route.name === 'exercises') return <Exercises />
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
  if (route.name === 'workout-preview') {
    return <Workout key={`${route.routineId}-${route.scheduleSlotId}-${route.date}`} routineId={route.routineId} scheduleSlotId={route.scheduleSlotId} date={route.date} />
  }
  if (route.name === 'workout') return <Workout routineId={route.routineId} />
  if (route.name === 'start') return <StartWorkout />
  if (route.name === 'history') return <History />
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
  if (route.name === 'history-delete') return <HistoryDelete key={route.id} workoutId={route.id} />
  if (route.name === 'history-set-new') return <HistorySetNew key={route.id} workoutId={route.id} />
  if (route.name === 'history-set') return <HistorySet key={`${route.id}-${route.index}`} workoutId={route.id} index={route.index} />
  if (route.name === 'history-detail') return <HistoryDetail workoutId={route.id} />
  if (route.name === 'settings') return <Settings />
  return <Today />
}

export default function App() {
  return (
    <StoreProvider>
      <Nav />
      <main>
        <Screen />
      </main>
    </StoreProvider>
  )
}
