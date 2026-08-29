import { StoreProvider } from './store'
import { useHashRoute } from './route'
import { Today } from './views/Today'
import { Programs, ProgramNew, ProgramDetail, ProgramEdit } from './views/Programs'
import {
  SessionNew,
  SessionDetail,
  SessionEdit,
  SessionExercisePick,
  SessionExerciseNew,
  SessionExerciseEdit,
} from './views/Session'
import { Schedule, ScheduleLoop, ScheduleDay, ScheduleDayAdd, ScheduleDaySessions, ScheduleSlot, SchedulePlanItem } from './views/Schedule'
import { Exercises, ExerciseNew, ExerciseDetail, ExerciseEdit } from './views/Exercises'
import { Workout, WorkoutSetEdit } from './views/Workout'
import { History, HistoryDetail, HistoryEdit, HistorySet, HistorySetNew, HistoryExercises, HistoryExercise, HistoryWorkoutExercise, HistoryRecalculate, HistoryDelete } from './views/History'
import { StartSession, StartProgram } from './views/Start'

function Nav() {
  return (
    <nav>
      <a href="#/">Today</a>
      {' · '}
      <a href="#/schedule">Schedule</a>
      {' · '}
      <a href="#/programs">Programs</a>
      {' · '}
      <a href="#/exercises">Exercises</a>
      {' · '}
      <a href="#/history">History</a>
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
  if (route.name === 'schedule-day-sessions') {
    return (
      <ScheduleDaySessions
        key={`${route.week}-${route.weekday}-${route.programId}`}
        week={route.week}
        weekday={route.weekday}
        programId={route.programId}
      />
    )
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
  if (route.name === 'programs') return <Programs />
  if (route.name === 'program-new') return <ProgramNew />
  if (route.name === 'program-edit') return <ProgramEdit key={route.id} programId={route.id} />
  if (route.name === 'program') return <ProgramDetail key={route.id} programId={route.id} />
  if (route.name === 'session-new') return <SessionNew key={route.programId} programId={route.programId} />
  if (route.name === 'session-edit') {
    return <SessionEdit key={`${route.programId}-${route.sessionId}`} programId={route.programId} sessionId={route.sessionId} />
  }
  if (route.name === 'session-exercise-pick') {
    return (
      <SessionExercisePick key={`${route.programId}-${route.sessionId}`} programId={route.programId} sessionId={route.sessionId} />
    )
  }
  if (route.name === 'session-exercise-new') {
    return (
      <SessionExerciseNew
        key={`${route.programId}-${route.sessionId}-${route.exerciseId}`}
        programId={route.programId}
        sessionId={route.sessionId}
        exerciseId={route.exerciseId}
      />
    )
  }
  if (route.name === 'session-exercise') {
    return (
      <SessionExerciseEdit
        key={`${route.programId}-${route.sessionId}-${route.itemId}`}
        programId={route.programId}
        sessionId={route.sessionId}
        itemId={route.itemId}
      />
    )
  }
  if (route.name === 'session') {
    return <SessionDetail key={`${route.programId}-${route.sessionId}`} programId={route.programId} sessionId={route.sessionId} />
  }
  if (route.name === 'exercises') return <Exercises />
  if (route.name === 'exercise-new') return <ExerciseNew />
  if (route.name === 'exercise-edit') return <ExerciseEdit key={route.id} exerciseId={route.id} />
  if (route.name === 'exercise') return <ExerciseDetail exerciseId={route.id} />
  if (route.name === 'workout-set') return <WorkoutSetEdit key={`${route.sessionId}-${route.index}`} sessionId={route.sessionId} index={route.index} />
  if (route.name === 'workout-preview') {
    return <Workout key={`${route.sessionId}-${route.scheduleSlotId}-${route.date}`} sessionId={route.sessionId} scheduleSlotId={route.scheduleSlotId} date={route.date} />
  }
  if (route.name === 'workout') return <Workout sessionId={route.sessionId} />
  if (route.name === 'start-program') return <StartProgram key={route.id} programId={route.id} />
  if (route.name === 'start') return <StartSession />
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
