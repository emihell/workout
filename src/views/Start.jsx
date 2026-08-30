import { weekdayName } from '../ids'
import { clampLoopWeeks, coveringWorkout, dateKey, remainingInLoop } from '../schedule'
import { useStore } from '../store-context'
import { Back } from './shared'

export function StartWorkout() {
  const store = useStore()
  const routines = (store.routines || []).filter((routine) => !routine.archivedAt)
  const loop = clampLoopWeeks(store.schedule?.loopWeeks)
  const upcoming = remainingInLoop(routines, store.schedule)

  return (
    <section>
      <Back />
      <h1>Start workout</h1>
      <p>Choose a scheduled workout to do early, or start an ad-hoc workout that does not complete a future slot.</p>

      {(store.draftWorkouts || []).length ? (
        <>
          <h2>Drafts</h2>
          <ul>
            {store.draftWorkouts.map((draft) => (
              <li key={draft.id}>
                {draft.snapshot?.routineName || draft.snapshot?.sessionName || 'Workout'} · {(draft.sets || []).length} logged sets{' '}
                <button
                  type="button"
                  onClick={() => {
                    store.resumeDraft(draft.id)
                    window.location.hash = `#/workout/${draft.routineId || draft.sessionId}`
                  }}
                >
                  Resume
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h2>Left in the loop</h2>
      {upcoming.length === 0 ? <p>Nothing else scheduled in the next {loop} week{loop === 1 ? '' : 's'}.</p> : null}
      <ul>
        {upcoming.map((item) => {
          const when = dateKey(item.date)
          const done = coveringWorkout(store.workouts, item.routine.id, when, item.slot.id)
          return (
            <li key={`${item.slot.id}-${when}`}>
              {loop > 1 ? `Week ${item.week + 1} ` : ''}
              {weekdayName(item.date.getDay())} — {item.routine.name}{' '}
              {done ? (
                <span>Workout done on {dateKey(done.finishedAt)}</span>
              ) : (
                <a href={`#/workout/${item.routine.id}/${item.slot.id}/${when}`}>View and do early</a>
              )}
            </li>
          )
        })}
      </ul>

      <h2>Any routine</h2>
      {routines.length === 0 ? (
        <p>
          No routines. <a href="#/routines">Create one</a>.
        </p>
      ) : (
        <ul>
          {routines.map((routine) => (
            <li key={routine.id}>
              <a href={`#/workout/${routine.id}`}>{routine.name}</a> ({routine.focus}, {routine.exercises.length} exercises)
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
