import { weekdayName } from '../ids'
import { go } from '../route'
import { clampLoopWeeks, coveringWorkout, dateKey, remainingInLoop } from '../schedule'
import { useStore } from '../store-context'
import { RoutineNewForm } from './Routine'
import { Back } from './shared'

export function StartWorkout() {
  const store = useStore()
  const routines = (store.routines || []).filter((routine) => !routine.archivedAt)
  const loop = clampLoopWeeks(store.schedule?.loopWeeks)
  const upcoming = remainingInLoop(routines, store.schedule)

  return (
    <section>
      <Back />
      <h1>Start</h1>

      {(store.draftWorkouts || []).length ? (
        <>
          <h2>Drafts</h2>
          <ul>
            {store.draftWorkouts.map((draft) => (
              <li key={draft.id}>
                {draft.snapshot?.routineName || draft.snapshot?.sessionName || 'Workout'} — {(draft.sets || []).length} sets{' '}
                <button
                  type="button"
                  onClick={() => {
                    store.resumeDraft(draft.id)
                    go(`/workout/${draft.routineId || draft.sessionId}`)
                  }}
                >
                  Resume
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h2>Scheduled</h2>
      {upcoming.length === 0 ? <p>None.</p> : null}
      <ul>
        {upcoming.map((item) => {
          const when = dateKey(item.date)
          const done = coveringWorkout(store.workouts, item.routine.id, when, item.slot.id)
          return (
            <li key={`${item.slot.id}-${when}`}>
              {done ? (
                <>
                  {item.routine.name} — {loop > 1 ? `Week ${item.week + 1} · ` : ''}
                  {weekdayName(item.date.getDay())} — Done {dateKey(done.finishedAt)}
                </>
              ) : (
                <>
                  <a href={`#/workout/${item.routine.id}/${item.slot.id}/${when}`}>{item.routine.name}</a>
                  {' — '}
                  {loop > 1 ? `Week ${item.week + 1} · ` : ''}
                  {weekdayName(item.date.getDay())}
                </>
              )}
            </li>
          )
        })}
      </ul>

      <h2>Any routine</h2>
      {routines.length === 0 ? (
        <RoutineNewForm
          onSave={({ name, focus }) => {
            const id = store.addRoutine({ name, focus })
            go(`/workout/${id}`)
          }}
          onCancel={() => go('/')}
        />
      ) : (
        <ul>
          {routines.map((routine) => (
            <li key={routine.id}>
              <a href={`#/workout/${routine.id}`}>{routine.name}</a> — {routine.focus}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
