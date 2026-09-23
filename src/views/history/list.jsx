import { dateKey } from '../../schedule'
import { exerciseById, exercisesInHistory, findRoutine, groupWorkoutsByRoutine, staleInProgressWorkouts } from '../../storage'
import { useStore } from '../../store-context'
import { abandonInProgress, continueInProgress } from '../../workout-actions'
import { Back, NavLink } from '../shared'
import { Button, List, Row, Screen, SectionHeader, Title } from '../../ui/index.jsx'
import {
  compactDate,
  groupWorkoutsByMonth,
  monthLabel,
  routineTitle,
  sortWorkoutsByDate,
  whenLabel,
  workoutDateKey,
  workoutRoutineId,
  workoutRoutineName,
} from './helpers'

function WorkoutHistoryRow({ store, workout }) {
  const { routine } = findRoutine(store.routines, workoutRoutineId(workout))
  const programName = workout.snapshot?.programName
  const name = workoutRoutineName(workout, routine)
  const label = programName ? `${programName} — ${name}` : name
  return (
    <Row to={`/history/${workout.id}`}>
      {label} — {compactDate(workoutDateKey(workout))}
    </Row>
  )
}

// req-55 / DEC-038 — an unfinished in-progress workout (the single stale
// activeWorkout, started a prior day, or a legacy draft) shown in History so it can
// be resolved: **Continue** resumes it (abandoning any current active via the
// warning), **Abandon** discards it entirely — it is NEVER a finished-history record
// and never feeds progress.js. No link to a detail page (there is no finished record
// to open); the row's action buttons are the only affordances.
function InProgressHistoryRow({ store, workout }) {
  const { routine } = findRoutine(store.routines, workoutRoutineId(workout))
  const name = workoutRoutineName(workout, routine)
  return (
    <Row
      action={
        <>
          {/* req-121 — DESIGN §4: retreat (Abandon) left, forward (Continue) right. */}
          <Button variant="quiet" onClick={() => abandonInProgress(store, workout)}>
            Abandon
          </Button>
          <Button onClick={() => continueInProgress(store, workout)}>Continue</Button>
        </>
      }
    >
      <span className="ui-workout-info">
        <span className="ui-workout-info__date">{compactDate(workoutDateKey(workout))}</span>
        <span className="ui-workout-info__body">
          {name}
          <span className="ui-inprogress">in progress</span>
        </span>
      </span>
    </Row>
  )
}

export function History({ month = null }) {
  const store = useStore()
  const months = groupWorkoutsByMonth(store.workouts || [])
  const inProgress = staleInProgressWorkouts(store, dateKey(new Date()))

  if (month) {
    const group = months.find((candidate) => candidate.key === month)
    const workouts = group?.workouts || []
    return (
      <Screen>
        <Back to="/history" />
        <Title>{monthLabel(month)}</Title>
        {workouts.length === 0 ? (
          <p className="ui-sub">None.</p>
        ) : (
          <List>
            {workouts.map((workout) => (
              <WorkoutHistoryRow key={workout.id} store={store} workout={workout} />
            ))}
          </List>
        )}
      </Screen>
    )
  }

  return (
    <Screen>
      <Back to="/" />
      <Title>History</Title>
      <p>
        <NavLink to="/history/exercises" className="ui-navlink" chevron="forward">By exercise</NavLink>
      </p>
      {inProgress.length ? (
        <>
          <SectionHeader>In progress</SectionHeader>
          <List>
            {inProgress.map((workout) => (
              <InProgressHistoryRow key={workout.id} store={store} workout={workout} />
            ))}
          </List>
        </>
      ) : null}
      {months.length === 0 ? <p className="ui-sub">None.</p> : null}
      <List>
        {months.map((group) => (
          <Row key={group.key} to={`/history/month/${group.key}`} value={String(group.workouts.length)}>
            {monthLabel(group.key)}
          </Row>
        ))}
      </List>
    </Screen>
  )
}

export function HistoryExercises() {
  const store = useStore()
  const list = exercisesInHistory(store.workouts || [], store.exercises, store.routines)

  return (
    <Screen>
      <Back to="/history" />
      <Title>By exercise</Title>
      {list.length === 0 ? <p className="ui-sub">None.</p> : null}
      <List>
        {list.map((item) => (
          <Row key={item.id} to={`/history/exercise/${item.id}`}>
            {item.exercise?.name || item.id}
            {item.routines.length ? ` — ${item.routines.map((routine) => routine.name).join(', ')}` : ''}
          </Row>
        ))}
      </List>
    </Screen>
  )
}

export function HistoryExercise({ exerciseId }) {
  const store = useStore()
  const ex = exerciseById(store.exercises, exerciseId)
  const visits = (store.workouts || []).filter((w) => (w.sets || []).some((s) => s.exerciseId === exerciseId))
  const groups = groupWorkoutsByRoutine(visits, store.routines)

  return (
    <Screen>
      <Back to="/history/exercises" />
      <Title>{ex?.name || exerciseId}</Title>
      {groups.length === 0 ? <p className="ui-sub">None.</p> : null}
      {groups.map((group) => (
        <div key={group.groupId || group.routineId}>
          <SectionHeader>{routineTitle(group.program, group.routine)}</SectionHeader>
          <List>
            {sortWorkoutsByDate(group.workouts).map((w) => {
              const count = (w.sets || []).filter((s) => s.exerciseId === exerciseId).length
              return (
                <Row key={w.id} to={`/history/${w.id}/exercise/${exerciseId}`} value={`${count} set${count === 1 ? '' : 's'}`}>
                  {whenLabel(w)}
                </Row>
              )
            })}
          </List>
        </div>
      ))}
    </Screen>
  )
}
