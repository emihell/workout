import { dateKey } from '../../schedule'
import { exerciseById, routineById } from '../../model.js'
import { exercisesInHistory, groupWorkoutsByRoutine, staleInProgressWorkouts } from '../../history-queries.js'
import { useStore } from '../../store-context'
import { abandonInProgress, continueInProgress } from '../../workout-actions'
import { withFrom } from '../../route'
import { Back } from '../shared'
import { Button, List, NavLink, Row, Screen, SectionHeader, Title } from '../../ui/index.jsx'
import {
  compactDate,
  groupWorkoutsByMonth,
  monthLabel,
  routineTitle,
  sessionLabel,
  sortWorkoutsByDate,
  topSetText,
  whenLabel,
  workoutDateKey,
  workoutRoutineId,
  workoutRoutineName,
} from './helpers'

function WorkoutHistoryRow({ store, workout, from }) {
  const routine = routineById(store.routines, workoutRoutineId(workout))
  const programName = workout.snapshot?.programName
  const name = workoutRoutineName(workout, routine)
  const label = programName ? `${programName} — ${name}` : name
  return (
    <Row to={withFrom(`/history/${workout.id}`, from)}>
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
  const routine = routineById(store.routines, workoutRoutineId(workout))
  const name = workoutRoutineName(workout, routine)
  return (
    <Row
      action={
        <>
          {/* req-121 — DESIGN §4: retreat (Abandon) left, forward (Continue) right. */}
          <Button variant="quiet" onClick={() => abandonInProgress(store, workout, sessionLabel(workout, routine))}>
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
              <WorkoutHistoryRow key={workout.id} store={store} workout={workout} from={`/history/month/${month}`} />
            ))}
          </List>
        )}
      </Screen>
    )
  }

  // req-198 / DEC-110 §1 — "Backup & data" closes the screen always, even with zero
  // workouts, so Import is reachable on a device that has routines but no history
  // (review F11).
  // req-205 (DEC-115) — History is reached from the Schedule's "History ›", so Back goes there
  // (was "/"); not being "/", the Today link shows beside it (showsTodayLink).
  return (
    <Screen>
      <Back to="/schedule" />
      <Title>History</Title>
      <p>
        <NavLink to="/history/exercises" chevron="forward">By exercise</NavLink>
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
      {/* req-198 — no empty month list when there are none, so its hairline doesn't
          double up with Backup & data's below. */}
      {months.length === 0 ? (
        <p className="ui-sub">None.</p>
      ) : (
        <List>
          {months.map((group) => (
            <Row key={group.key} to={`/history/month/${group.key}`} value={String(group.workouts.length)}>
              {monthLabel(group.key)}
            </Row>
          ))}
        </List>
      )}
      <List>
        <Row to="/settings">Backup &amp; data</Row>
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

export function HistoryExercise({ exerciseId, from = null }) {
  const store = useStore()
  const ex = exerciseById(store.exercises, exerciseId)
  const visits = (store.workouts || []).filter((w) => (w.sets || []).some((s) => s.exerciseId === exerciseId))
  const groups = groupWorkoutsByRoutine(visits, store.routines)
  // req-209 §4 — also opened from the exercise page (`?from=`): Back returns there, and the
  // links below carry this page (with that from) so their Back unwinds to it.
  const here = `/history/exercise/${exerciseId}`

  return (
    <Screen>
      <Back to={from || '/history/exercises'} />
      <Title>{ex?.name || exerciseId}</Title>
      {/* req-199 (DEC-110 §3) — the exercise's settings, one tap from its history. `?from=`
          brings Save / Cancel / Back back to this page. A deleted (archived) exercise has
          no settings to edit, so no link. */}
      {ex && !ex.archivedAt ? (
        <p>
          <NavLink to={withFrom(`/exercises/${ex.id}/edit`, withFrom(here, from))} chevron="forward">
            Exercise settings
          </NavLink>
        </p>
      ) : null}
      {groups.length === 0 ? <p className="ui-sub">None.</p> : null}
      {groups.map((group) => (
        <div key={group.groupId || group.routineId}>
          <SectionHeader>{routineTitle(group.program, group.routine)}</SectionHeader>
          <List>
            {sortWorkoutsByDate(group.workouts).map((w) => {
              const count = (w.sets || []).filter((s) => s.exerciseId === exerciseId).length
              // req-203 §5 — "{date} · {top set}"; a row with no kg keeps "N sets".
              const top = topSetText(w.sets, exerciseId)
              return (
                <Row key={w.id} to={withFrom(`/history/${w.id}/exercise/${exerciseId}`, withFrom(here, from))} value={top ? null : `${count} set${count === 1 ? '' : 's'}`}>
                  {top ? `${whenLabel(w)} · ${top}` : whenLabel(w)}
                </Row>
              )
            })}
          </List>
        </div>
      ))}
    </Screen>
  )
}
