import { weekdayName } from '../ids'
import { clampLoopWeeks, coveringWorkout, dateKey, remainingInLoop } from '../schedule'
import { programById } from '../storage'
import { useStore } from '../store-context'
import { Back } from './shared'

export function StartSession() {
  const store = useStore()
  const programs = (store.programs || []).filter((program) => !program.archivedAt)
  const loop = clampLoopWeeks(store.schedule?.loopWeeks)
  const upcoming = remainingInLoop(programs, store.schedule)

  return (
    <section>
      <Back to="/" />
      <h1>Start session</h1>
      <p>Choose a scheduled workout to do early, or start an ad-hoc session that does not complete a future slot.</p>

      {(store.draftWorkouts || []).length ? (
        <>
          <h2>Drafts</h2>
          <ul>
            {store.draftWorkouts.map((draft) => (
              <li key={draft.id}>
                {draft.snapshot?.sessionName || 'Workout'} · {(draft.sets || []).length} logged sets{' '}
                <button
                  type="button"
                  onClick={() => {
                    store.resumeDraft(draft.id)
                    window.location.hash = `#/workout/${draft.sessionId}`
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
          const done = coveringWorkout(store.workouts, item.session.id, when, item.slot.id)
          return (
            <li key={`${item.slot.id}-${when}`}>
              {loop > 1 ? `Week ${item.week + 1} ` : ''}
              {weekdayName(item.date.getDay())} — {item.program.name}: {item.session.name}{' '}
              {done ? (
                <span>Session done on {dateKey(done.finishedAt)}</span>
              ) : (
                <a href={`#/workout/${item.session.id}/${item.slot.id}/${when}`}>View and do early</a>
              )}
            </li>
          )
        })}
      </ul>

      <h2>Any session</h2>
      {programs.length === 0 ? (
        <p>
          No programs. <a href="#/programs">Create one</a>.
        </p>
      ) : (
        <ul>
          {programs.map((p) => (
            <li key={p.id}>
              <a href={`#/start/${p.id}`}>{p.name}</a> ({p.sessions.filter((session) => !session.archivedAt).length} sessions)
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function StartProgram({ programId }) {
  const store = useStore()
  const program = programById(store.programs, programId)

  if (!program) {
    return (
      <section>
        <p>Program not found.</p>
        <Back to="/start" />
      </section>
    )
  }

  return (
    <section>
      <Back to="/start" />
      <h1>{program.name}</h1>
      {program.sessions.filter((session) => !session.archivedAt).length === 0 ? <p>No sessions in this program.</p> : null}
      <ul>
        {program.sessions.filter((session) => !session.archivedAt).map((sess) => (
          <li key={sess.id}>
            <a href={`#/workout/${sess.id}`}>{sess.name}</a> ({sess.focus}, {sess.exercises.length} exercises)
          </li>
        ))}
      </ul>
    </section>
  )
}
