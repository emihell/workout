import { childLink, go } from '../../route'
import { useStore } from '../../store-context'
import { RoutineScreens } from '../Routine'
import { Back, Missing } from '../shared'
import { Actions, Button, NavLink, Screen, Title } from '../../ui/index.jsx'
import { whenLabel, workoutRoutineId, workoutRoutineName } from './helpers'
import { historyDetailReturn, historyRoutinePaths } from './return-paths.js'

export function HistoryRecalculate({ workoutId, from = null }) {
  const store = useStore()
  const workout = store.workouts.find((candidate) => candidate.id === workoutId)
  if (!workout) {
    return <Missing>Not found.</Missing>
  }
  const here = `/history/${workout.id}/recalculate`
  const routinePath = workoutRoutineId(workout) ? childLink(`/history/${workout.id}/routine`, here, from) : null
  // req-171 — Back/Skip/Apply return to the workout as it was opened (Today, a month…).
  const back = historyDetailReturn(workout.id, from)

  return (
    <Screen>
      <Back to={back} />
      <Title>Update?</Title>
      <p className="ui-sub">
        {workoutRoutineName(workout, null)} — {whenLabel(workout)}
      </p>
      {routinePath ? (
        <p>
          <NavLink to={routinePath} chevron="forward">Workout</NavLink>
        </p>
      ) : null}
      {/* DESIGN §4: Skip dismisses the recalc (retreat) → left; Apply commits
          (forward) → right. */}
      <Actions
        retreat={<NavLink to={back} look="quiet">Skip</NavLink>}
        forward={
          <Button
            variant="primary"
            onClick={() => {
              store.recalculateFuturePlans(workout.id)
              go(back)
            }}
          >
            Apply
          </Button>
        }
      />
    </Screen>
  )
}

export function HistoryRoutine({ workoutId, screen = 'detail', itemId, exerciseId, from = null }) {
  const store = useStore()
  const workout = store.workouts.find((candidate) => candidate.id === workoutId)
  const routineId = workoutRoutineId(workout)
  if (!workout || !routineId) {
    return <Missing>Not found.</Missing>
  }
  // req-171 — the routine's own screen returns to the recalc it was opened from (and so
  // on up the chain); req-263 — its inner editor screens keep that chain too.
  const paths = historyRoutinePaths(workoutId, screen, from, { extra: whenLabel(workout), workouts: store.workouts })
  return (
    <RoutineScreens
      routineId={routineId}
      paths={paths}
      screen={screen}
      itemId={itemId}
      exerciseId={exerciseId}
    />
  )
}
