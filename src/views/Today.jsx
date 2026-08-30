import { greeting, weekdayName } from '../ids'
import { go } from '../route'
import { coveringWorkout, dateKey, loopWeekIndex, nextScheduled, resolveSlot, slotsOn } from '../schedule'
import { useStore } from '../store-context'
import { startOrContinue } from '../workout-actions'

function StartButton({ store, routine, slot, date, label = 'Start' }) {
  return (
    <button
      type="button"
      onClick={() =>
        startOrContinue(store, routine.id, {
          scheduledFor: date,
          scheduleSlotId: slot.id,
        })
      }
    >
      {label}
    </button>
  )
}

function activeRoutineId(workout) {
  return workout?.routineId || workout?.sessionId
}

export function Today() {
  const store = useStore()
  const now = new Date()
  const todayKey = dateKey(now)
  const schedule = store.schedule
  const routines = store.routines || []
  const todays = slotsOn(schedule, now)
    .map((slot) => resolveSlot(routines, slot))
    .filter((x) => x.routine)
  const upcoming = nextScheduled(routines, schedule, now)
  const loop = Math.max(1, Number(schedule?.loopWeeks) || 1)
  const week = loopWeekIndex(schedule, now)
  const mine = store.activeWorkout

  if (!routines.length) {
    return (
      <section>
        <h1>Today</h1>
        <p>This device has no workout data yet.</p>
        <p>
          Import a database backup to restore routines, schedule, and history. After that, this
          browser keeps a copy. To use another phone or computer, export from Settings and import
          there.
        </p>
        <p>
          <label>
            Import database
            <br />
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                file.text().then((text) => {
                  try {
                    const payload = JSON.parse(text)
                    if (
                      !window.confirm(
                        'Replace all data on this device with this backup? Current routines, schedule, and history will be gone.',
                      )
                    ) {
                      return
                    }
                    store.applyBackup(payload)
                  } catch (err) {
                    window.alert(err instanceof Error ? err.message : 'Could not import that file.')
                  }
                })
              }}
            />
          </label>
        </p>
        <p>
          Or start empty:{' '}
          <a href="#/routines">Routines</a>
          {' · '}
          <a href="#/schedule">Schedule</a>
          {' · '}
          <a href="#/settings">Settings</a>
        </p>
      </section>
    )
  }

  return (
    <section>
      <h1>{greeting()}</h1>
      {loop > 1 ? (
        <p>
          Week {week + 1} of {loop}
        </p>
      ) : null}

      {mine ? (
        <p>
          Workout in progress.{' '}
          <button type="button" onClick={() => startOrContinue(store, activeRoutineId(mine))}>
            Continue
          </button>
        </p>
      ) : null}

      {todays.length ? (
        todays.map(({ slot, routine }) => {
          const done = coveringWorkout(store.workouts, routine.id, todayKey, slot.id)
          const inProgress =
            activeRoutineId(mine) === routine.id &&
            mine?.scheduleSlotId === slot.id &&
            mine.scheduledFor === todayKey
          return (
            <article key={slot.id}>
              <h2>
                Today — {routine.name}
              </h2>
              <p>
                {routine.focus} · {routine.exercises.length} exercises
              </p>
              {done ? (
                <p>Workout done on {dateKey(done.finishedAt)}</p>
              ) : inProgress ? null : (
                <p>
                  <StartButton store={store} routine={routine} slot={slot} date={todayKey} />
                  {' '}
                  <a href={`#/routines/${routine.id}`}>View plan</a>
                </p>
              )}
            </article>
          )
        })
      ) : upcoming ? (
        <>
          <p>Nothing on the calendar for {weekdayName(now.getDay())}.</p>
          {upcoming.items.map(({ slot, routine }) => {
            const when = dateKey(upcoming.date)
            const done = coveringWorkout(store.workouts, routine.id, when, slot.id)
            const inProgress =
              activeRoutineId(mine) === routine.id &&
              mine?.scheduleSlotId === slot.id &&
              mine.scheduledFor === when
            return (
              <article key={slot.id}>
                <h2>
                  Next — {routine.name}
                </h2>
                <p>
                  {weekdayName(upcoming.date.getDay())} · {routine.focus} · {routine.exercises.length} exercises
                </p>
                {done ? (
                  <p>Workout done on {dateKey(done.finishedAt)}</p>
                ) : inProgress ? null : (
                  <p>
                    <StartButton store={store} routine={routine} slot={slot} date={when} />
                    {' '}
                    <a href={`#/routines/${routine.id}`}>View plan</a>
                  </p>
                )}
              </article>
            )
          })}
        </>
      ) : (
        <p>Nothing scheduled. Add routines in Schedule.</p>
      )}

      <p>
        <button
          type="button"
          disabled={Boolean(mine)}
          onClick={() => go('/start')}
        >
          Start a different workout
        </button>
      </p>
    </section>
  )
}
