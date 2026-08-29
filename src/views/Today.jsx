import { greeting, weekdayName } from '../ids'
import { coveringWorkout, dateKey, loopWeekIndex, nextScheduled, resolveSlot, slotsOn } from '../schedule'
import { useStore } from '../store-context'
import { startOrContinue } from '../workout-actions'

function StartButton({ store, session, slot, date, label = 'Start' }) {
  return (
    <button
      type="button"
      onClick={() =>
        startOrContinue(store, session.id, {
          scheduledFor: date,
          scheduleSlotId: slot.id,
        })
      }
    >
      {label}
    </button>
  )
}

export function Today() {
  const store = useStore()
  const now = new Date()
  const todayKey = dateKey(now)
  const schedule = store.schedule
  const programs = store.programs || []
  const todays = slotsOn(schedule, now)
    .map((slot) => resolveSlot(programs, slot))
    .filter((x) => x.session)
  const upcoming = nextScheduled(programs, schedule, now)
  const loop = Math.max(1, Number(schedule?.loopWeeks) || 1)
  const week = loopWeekIndex(schedule, now)
  const mine = store.activeWorkout

  if (!programs.length) {
    return (
      <section>
        <h1>Today</h1>
        <p>Create a program, put sessions on the schedule, then open Today and do what it says.</p>
        <p>
          <a href="#/programs">Programs</a>
          {' · '}
          <a href="#/schedule">Schedule</a>
        </p>
      </section>
    )
  }

  return (
    <section>
      <h1>{greeting()}</h1>
      <p>
        Week {week + 1} of {loop}
      </p>

      {mine ? (
        <p>
          Session in progress.{' '}
          <button type="button" onClick={() => startOrContinue(store, mine.sessionId)}>
            Continue
          </button>
        </p>
      ) : null}

      {todays.length ? (
        todays.map(({ slot, program, session }) => {
          const done = coveringWorkout(store.workouts, session.id, todayKey, slot.id)
          const inProgress =
            mine?.sessionId === session.id &&
            mine?.scheduleSlotId === slot.id &&
            mine.scheduledFor === todayKey
          return (
            <article key={slot.id}>
              <h2>
                Today — {program.name}: {session.name}
              </h2>
              <p>
                {session.focus} · {session.exercises.length} exercises
              </p>
              {done ? (
                <p>Session done on {dateKey(done.finishedAt)}</p>
              ) : inProgress ? (
                <p>
                  <StartButton store={store} session={session} slot={slot} date={todayKey} label="Continue" />
                </p>
              ) : (
                <p>
                  <StartButton store={store} session={session} slot={slot} date={todayKey} />
                  {' '}
                  <a href={`#/workout/${session.id}/${slot.id}/${todayKey}`}>View plan</a>
                </p>
              )}
            </article>
          )
        })
      ) : upcoming ? (
        <>
          <p>Nothing on the calendar for {weekdayName(now.getDay())}.</p>
          {upcoming.items.map(({ slot, program, session }) => {
            const when = dateKey(upcoming.date)
            const done = coveringWorkout(store.workouts, session.id, when, slot.id)
            const inProgress =
              mine?.sessionId === session.id &&
              mine?.scheduleSlotId === slot.id &&
              mine.scheduledFor === when
            return (
              <article key={slot.id}>
                <h2>
                  Next — {program.name}: {session.name}
                </h2>
                <p>
                  {weekdayName(upcoming.date.getDay())} · {session.focus} · {session.exercises.length} exercises
                </p>
                {done ? (
                  <p>Session done on {dateKey(done.finishedAt)}</p>
                ) : inProgress ? (
                  <p>
                    <StartButton store={store} session={session} slot={slot} date={when} label="Continue" />
                  </p>
                ) : (
                  <p>
                    <StartButton store={store} session={session} slot={slot} date={when} />
                    {' '}
                    <a href={`#/workout/${session.id}/${slot.id}/${when}`}>View plan</a>
                  </p>
                )}
              </article>
            )
          })}
        </>
      ) : (
        <p>Nothing scheduled. Add sessions in Schedule.</p>
      )}

      <p>
        <a href="#/start">Start a different session</a>
      </p>
    </section>
  )
}
