import { recordButton } from '../analytics'
import { importWithBackup } from '../import-backup'
import { greeting, weekdayName } from '../ids'
import { coveringWorkout, dateKey, loopWeekIndex, nextScheduled, resolveSlot, slotsOn } from '../schedule'
import { useStore } from '../store-context'
import { startOrContinue } from '../workout-actions'
import { Button, FileButton, List, Row, Screen, SectionHeader, Title } from '../ui/index.jsx'
import { NavLink } from './shared'

function StartButton({ store, routine, slot, date, label = 'Start' }) {
  return (
    <Button
      onClick={() =>
        startOrContinue(store, routine.id, {
          scheduledFor: date,
          scheduleSlotId: slot.id,
        })
      }
    >
      {label}
    </Button>
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
  const action = done ? (
    `Done ${dateKey(done.finishedAt)}`
  ) : inProgress ? null : (
    <StartButton store={store} routine={routine} slot={slot} date={date} />
  )
  return (
    <Row value={action}>
      {routine.name} — {bits.join(' · ')}
    </Row>
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
      <Screen>
        <Title subtitle="No data. Import, or start empty.">Today</Title>
        <FileButton
          label="Import"
          accept="application/json,.json"
          onFiles={(files) => {
            const file = files?.[0]
            if (!file) return
            file.text().then((text) => {
              try {
                const payload = JSON.parse(text)
                const result = importWithBackup({ store, payload })
                if (!result) return // cancelled at the confirm
                recordButton('import')
              } catch (err) {
                window.alert(err instanceof Error ? err.message : 'Could not import.')
              }
            })
          }}
        />
        <List>
          <Row to="/routines">Routines</Row>
          <Row to="/schedule">Schedule</Row>
          <Row to="/settings">Settings</Row>
        </List>
      </Screen>
    )
  }

  return (
    <Screen>
      <Title>{greeting()}</Title>
      {loop > 1 ? (
        <p className="ui-sub">
          Week {week + 1} of {loop}
        </p>
      ) : null}

      {mine ? (
        <p className="ui-sub">
          In progress.{' '}
          <Button onClick={() => startOrContinue(store, activeRoutineId(mine))}>Continue</Button>
        </p>
      ) : null}

      {todays.length ? (
        <>
          <SectionHeader>Today</SectionHeader>
          <List>
            {todays.map(({ slot, routine }) => (
              <WorkoutRow key={slot.id} store={store} routine={routine} slot={slot} date={todayKey} />
            ))}
          </List>
        </>
      ) : upcoming ? (
        <>
          <p className="ui-sub">None today.</p>
          <SectionHeader>Next</SectionHeader>
          <List>
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
          </List>
        </>
      ) : (
        <p className="ui-sub">None.</p>
      )}

      {mine ? null : (
        <p>
          <NavLink to="/start">Other</NavLink>
        </p>
      )}
    </Screen>
  )
}
