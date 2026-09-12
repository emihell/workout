import { recordButton } from '../analytics'
import { importWithBackup } from '../import-backup'
import { greeting, weekdayName } from '../ids'
import { coveringWorkout, dateKey, loopWeekIndex, remainingInLoop, resolveSlot, slotsOn } from '../schedule'
import { completedOnDayKey, findRoutine } from '../storage'
import { useStore } from '../store-context'
import { startOrContinue } from '../workout-actions'
import { Button, FileButton, List, Row, Screen, SectionHeader, Title } from '../ui/index.jsx'
import { compactDate, sortWorkoutsByDate, workoutDateKey, workoutRoutineId, workoutRoutineName } from './history/helpers'
import { NavLink } from './shared'

function StartButton({ store, routine, slot, date, label = 'Start', variant, block }) {
  return (
    <Button
      variant={variant}
      block={block}
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

// req-14 (Emilio review) — a recent-history peek row: same program — routine label
// as History's list, plus the date, linking to the History detail.
function HistoryPeekRow({ store, workout }) {
  const { routine } = findRoutine(store.routines, workoutRoutineId(workout))
  const programName = workout.snapshot?.programName
  const name = workoutRoutineName(workout, routine)
  const label = programName ? `${programName} — ${name}` : name
  return (
    <Row to={`/history/${workout.id}`}>
      {label} — {compactDate(workoutDateKey(workout))}
    </Row>
  )
}

// req-14 (Emilio review) — today's workout is the Workouts screen's main call to
// action: the routine name + a large, primary, full-width Start. `Done …` shows
// once logged; a workout already in progress shows nothing here (the top-of-screen
// Continue owns that), matching the pre-review behaviour.
function TodayWorkout({ store, routine, slot, date }) {
  const done = coveringWorkout(store.workouts, routine.id, date, slot.id)
  const mine = store.activeWorkout
  const inProgress =
    activeRoutineId(mine) === routine.id &&
    mine?.scheduleSlotId === slot.id &&
    mine.scheduledFor === date
  const bits = [routine.focus].filter(Boolean)
  return (
    <div className="ui-today-workout">
      <p className="ui-today-workout__name">
        {routine.name}
        {bits.length ? ` — ${bits.join(' · ')}` : ''}
      </p>
      {done ? (
        <p className="ui-sub">Done {dateKey(done.finishedAt)}</p>
      ) : inProgress ? null : (
        <StartButton store={store} routine={routine} slot={slot} date={date} variant="primary" block />
      )}
    </div>
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
  // Upcoming schedule peek (tomorrow onward) and recent-history peek — two small
  // previews that each end in a "Show all" to the full page (req-14 review; the
  // interim before req-32's unified Workouts scroll).
  const upcoming = remainingInLoop(routines, schedule, now).slice(0, 2)
  const recent = sortWorkoutsByDate(store.workouts || []).slice(0, 2)
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

      <SectionHeader>Today</SectionHeader>
      {todays.length ? (
        todays.map(({ slot, routine }) => (
          <TodayWorkout key={slot.id} store={store} routine={routine} slot={slot} date={todayKey} />
        ))
      ) : (
        <p className="ui-sub">Nothing scheduled today.</p>
      )}

      {mine ? null : (
        <p>
          <NavLink to="/start">Choose a workout</NavLink>
        </p>
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

      {/* req-14 review — Schedule and History are no longer tabs (DEC-024 folded
          them under Workouts). Show a light peek of each with a "Show all" to the
          full page; interim until req-32's unified Workouts scroll. */}
      <SectionHeader>Upcoming</SectionHeader>
      {upcoming.length === 0 ? <p className="ui-sub">Nothing scheduled.</p> : null}
      <List>
        {upcoming.map(({ date, slot, routine }) => (
          <Row key={`${dateKey(date)}-${slot.id}`} value={weekdayName(date.getDay())}>
            {routine.name}
          </Row>
        ))}
        <Row to="/schedule">Show all</Row>
      </List>

      <SectionHeader>Recent</SectionHeader>
      {recent.length === 0 ? <p className="ui-sub">No history yet.</p> : null}
      <List>
        {recent.map((workout) => (
          <HistoryPeekRow key={workout.id} store={store} workout={workout} />
        ))}
        <Row to="/history">Show all</Row>
      </List>
    </Screen>
  )
}
