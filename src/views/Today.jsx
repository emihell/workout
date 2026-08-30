import { greeting, weekdayName } from '../ids'
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

function WorkoutRow({ store, routine, slot, date, extra }) {
  const done = coveringWorkout(store.workouts, routine.id, date, slot.id)
  const mine = store.activeWorkout
  const inProgress =
    activeRoutineId(mine) === routine.id &&
    mine?.scheduleSlotId === slot.id &&
    mine.scheduledFor === date
  const bits = [extra, routine.focus].filter(Boolean)
  return (
    <li>
      {routine.name} — {bits.join(' · ')}
      {done ? (
        <> — Done {dateKey(done.finishedAt)}</>
      ) : inProgress ? null : (
        <>
          {' '}
          <StartButton store={store} routine={routine} slot={slot} date={date} />
        </>
      )}
    </li>
  )
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
        <p>No data.</p>
        <p>Import, or start empty.</p>
        <p>
          <label>
            Import
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
                        'Replace all data on this device?',
                      )
                    ) {
                      return
                    }
                    store.applyBackup(payload)
                  } catch (err) {
                    window.alert(err instanceof Error ? err.message : 'Could not import.')
                  }
                })
              }}
            />
          </label>
        </p>
        <p>
          Or{' '}
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
          In progress.{' '}
          <button type="button" onClick={() => startOrContinue(store, activeRoutineId(mine))}>
            Continue
          </button>
        </p>
      ) : null}

      {todays.length ? (
        <>
          <h2>Today</h2>
          <ul>
            {todays.map(({ slot, routine }) => (
              <WorkoutRow key={slot.id} store={store} routine={routine} slot={slot} date={todayKey} />
            ))}
          </ul>
        </>
      ) : upcoming ? (
        <>
        <p>None today.</p>
          <h2>Next</h2>
          <ul>
            {upcoming.items.map(({ slot, routine }) => (
              <WorkoutRow
                key={slot.id}
                store={store}
                routine={routine}
                slot={slot}
                date={dateKey(upcoming.date)}
                extra={weekdayName(upcoming.date.getDay())}
              />
            ))}
          </ul>
        </>
      ) : (
        <p>None.</p>
      )}

      {mine ? null : (
        <p>
          <a href="#/start">Other</a>
        </p>
      )}
    </section>
  )
}
