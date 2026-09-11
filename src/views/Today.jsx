import { recordButton } from '../analytics'
import { importWithBackup } from '../import-backup'
import { greeting, weekdayName } from '../ids'
import { coveringWorkout, dateKey, loopWeekIndex, nextScheduled, resolveSlot, slotsOn } from '../schedule'
import { completedOnDayKey, findRoutine } from '../storage'
import { useStore } from '../store-context'
import { startOrContinue } from '../workout-actions'
import { Button, FileButton, List, Row, Screen, SectionHeader, Title } from '../ui/index.jsx'
import { workoutRoutineId, workoutRoutineName } from './history/helpers'
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

// req-28 — a completed-today workout row, linking to its History detail. Labelled
// the same way History's list does (program — routine), minus the date (all today).
function CompletedTodayRow({ store, workout }) {
  const { routine } = findRoutine(store.routines, workoutRoutineId(workout))
  const programName = workout.snapshot?.programName
  const name = workoutRoutineName(workout, routine)
  const label = programName ? `${programName} — ${name}` : name
  return <Row to={`/history/${workout.id}`}>{label}</Row>
}

function WorkoutRow({ store, routine, slot, date, extra }) {
  const done = coveringWorkout(store.workouts, routine.id, date, slot.id)
  const mine = store.activeWorkout
  const inProgress =
    activeRoutineId(mine) === routine.id &&
    mine?.scheduleSlotId === slot.id &&
    mine.scheduledFor === date
  const bits = [extra, routine.focus].filter(Boolean)
  // `Done …` is informational (value slot); the Start control is a trailing
  // action. These are mutually exclusive, and inProgress shows neither.
  const doneLabel = done ? `Done ${dateKey(done.finishedAt)}` : null
  const startAction =
    !done && !inProgress ? (
      <StartButton store={store} routine={routine} slot={slot} date={date} />
    ) : null
  return (
    <Row value={doneLabel} action={startAction}>
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
  const completedToday = completedOnDayKey(store.workouts, todayKey)

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
          <Row to="/history">History</Row>
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

      {completedToday.length ? (
        <>
          <SectionHeader>Completed today</SectionHeader>
          <List>
            {completedToday.map((workout) => (
              <CompletedTodayRow key={workout.id} store={store} workout={workout} />
            ))}
          </List>
        </>
      ) : null}

      {mine ? null : (
        <p>
          <NavLink to="/start">Other</NavLink>
        </p>
      )}

      {/* req-14 — Schedule and History are no longer their own tabs (DEC-024
          folded them under Workouts); keep them reachable from the Today home.
          Interim until req-32 merges them into one Workouts scroll. */}
      <List>
        <Row to="/schedule">Schedule</Row>
        <Row to="/history">History</Row>
      </List>
    </Screen>
  )
}
