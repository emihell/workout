import { go } from '../../route'
import { useStore } from '../../store-context'
import { navForBase, RoutineScreens } from '../Routine'
import { Back, Missing, NavLink } from '../shared'
import { Button, Screen, Title } from '../../ui/index.jsx'
import { whenLabel, workoutRoutineId, workoutRoutineName } from './helpers'

export function HistoryRecalculate({ workoutId }) {
  const store = useStore()
  const workout = store.workouts.find((candidate) => candidate.id === workoutId)
  if (!workout) {
    return <Missing>Not found.</Missing>
  }
  const routinePath = workoutRoutineId(workout) ? `/history/${workout.id}/routine` : null

  return (
    <Screen>
      <Back />
      <Title>Update?</Title>
      <p className="ui-sub">
        {workoutRoutineName(workout, null)} — {whenLabel(workout)}
      </p>
      {routinePath ? (
        <p>
          <NavLink to={routinePath}>Routine</NavLink>
        </p>
      ) : null}
      {/* DESIGN §4: Skip dismisses the recalc (retreat) → left; Apply commits
          (forward) → right. */}
      <div className="ui-actions">
        <NavLink to={`/history/${workout.id}`}>Skip</NavLink>
        <Button
          variant="primary"
          onClick={() => {
            store.recalculateFuturePlans(workout.id)
            go(`/history/${workout.id}`)
          }}
        >
          Apply
        </Button>
      </div>
    </Screen>
  )
}

export function HistoryRoutine({ workoutId, screen = 'detail', itemId, exerciseId }) {
  const store = useStore()
  const workout = store.workouts.find((candidate) => candidate.id === workoutId)
  const routineId = workoutRoutineId(workout)
  if (!workout || !routineId) {
    return <Missing>Not found.</Missing>
  }
  const paths = navForBase(`/history/${workoutId}/routine`, `/history/${workoutId}/recalculate`, {
    extra: whenLabel(workout),
    showDelete: false,
  })
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
