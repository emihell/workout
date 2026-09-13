import { recordButton } from '../analytics'
import { importWithBackup } from '../import-backup'
import { greeting } from '../ids'
import { coveringWorkout, dateKey, loopWeekIndex, remainingInLoop, resolveSlot, slotsOn } from '../schedule'
import { completedOnDayKey, findRoutine, staleInProgressWorkouts } from '../storage'
import { useStore } from '../store-context'
import { continueInProgress, startOrContinue } from '../workout-actions'
import { Button, FileButton, List, Row, Screen, SectionHeader, Title } from '../ui/index.jsx'
import { sortWorkoutsByDate, weekdayDate, workoutDateKey, workoutRoutineId, workoutRoutineName } from './history/helpers'
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

// req-53 — the "in progress" marker that sits next to the routine info in the
// emphasized hero block (today's slot or the standalone hero). Reuses the
// grayscale eyebrow look; inline so it reads as a status beside the name, not a
// second line.
function InProgressMark() {
  return <span className="ui-inprogress">in progress</span>
}

// req-14 (Emilio review iter 5) — the ONE shared row-info format for every workout
// row on the screen (Upcoming / Today / Recent / Completed today). req-47: a
// two-line stack echoing the Today block — the date (`when`) on its own line in
// caption size, then `name — focus` below (the old ` · ` separator is gone). `focus`
// degrades gracefully — when a source has none (an older history snapshot without
// focus, or a deleted routine) the "— focus" is dropped rather than invented
// (DESIGN §1: never invent absent data). `when` uses the one shared `weekdayDate`
// format across all rows (iter 6). `today` colors the body black (`--ui-ink`) when
// the row's date is today, gray (`--ui-ink-2`) otherwise, so the eye lands on today;
// it is keyed off the row's date-vs-today, not the component. This is INFO only;
// each row keeps its own action/status (Start, Done, the history link).
function WorkoutInfo({ when, name, focus, today }) {
  return (
    <span className={`ui-workout-info${today ? ' ui-workout-info--today' : ''}`}>
      <span className="ui-workout-info__date">{when}</span>
      <span className="ui-workout-info__body">
        {name}
        {focus ? ` — ${focus}` : ''}
      </span>
    </span>
  )
}

// req-28 — a completed-today workout row, linking to its History detail. Uses the
// shared info format (iter 5); `when` is "Today" (all completed today), focus from
// the immutable snapshot. Program name dropped so it matches the other sections.
function CompletedTodayRow({ store, workout, todayKey }) {
  const { routine } = findRoutine(store.routines, workoutRoutineId(workout))
  return (
    <Row to={`/history/${workout.id}`}>
      <WorkoutInfo when={weekdayDate(workoutDateKey(workout))} name={workoutRoutineName(workout, routine)} focus={workout.snapshot?.focus} today={workoutDateKey(workout) === todayKey} />
    </Row>
  )
}

// req-14 (Emilio review) — a recent-history peek row linking to the History detail.
// Shared info format (iter 5): `when` is the workout's date, focus from the snapshot.
function HistoryPeekRow({ store, workout, todayKey }) {
  const { routine } = findRoutine(store.routines, workoutRoutineId(workout))
  return (
    <Row to={`/history/${workout.id}`}>
      <WorkoutInfo when={weekdayDate(workoutDateKey(workout))} name={workoutRoutineName(workout, routine)} focus={workout.snapshot?.focus} today={workoutDateKey(workout) === todayKey} />
    </Row>
  )
}

// req-14 (Emilio review iter 2) — an upcoming (future) scheduled workout in the
// peek, with an inline Start so you can start ahead directly from Workouts (the
// behaviour the old Today "Next" section had; Emilio restored it). Today's big
// primary Start stays the main CTA — upcoming items get a smaller secondary Start.
// Guards like the today row: already-covered shows `Done …`, in-progress shows no
// Start (the top-of-screen Continue owns it). Same startOrContinue path. Info via
// the shared format (iter 5); `when` is the weekday. The Done status stays in the
// row's value slot; only the weekday moved into the info line.
function UpcomingRow({ store, date, slot, routine, todayKey }) {
  const dk = dateKey(date)
  const done = coveringWorkout(store.workouts, routine.id, dk, slot.id)
  const mine = store.activeWorkout
  const inProgress =
    activeRoutineId(mine) === routine.id && mine?.scheduleSlotId === slot.id && mine.scheduledFor === dk
  const startAction =
    !done && !inProgress ? <StartButton store={store} routine={routine} slot={slot} date={dk} /> : null
  return (
    <Row value={done ? `Done ${dateKey(done.finishedAt)}` : null} action={startAction}>
      <WorkoutInfo when={weekdayDate(dk)} name={routine.name} focus={routine.focus} today={dk === todayKey} />
    </Row>
  )
}

// req-14 (Emilio review) — today's workout is the Workout screen's focal point and
// main call to action. Iter 8: a two-line stack — the bold date on top, then
// "name — focus" as a secondary line — then a large, primary, full-width Start.
// `Done …` shows once logged. req-55/DEC-038: this block never carries the
// in-progress state — an active workout started today is rendered as the single
// `TodayHero` (which replaces the whole today block), and a stale active workout
// (started a prior day) is a Continue row lower down, not the hero. So today's slot
// block only ever shows Start (or Done); the Continue path lives elsewhere.
function TodayWorkout({ store, routine, slot, date }) {
  const done = coveringWorkout(store.workouts, routine.id, date, slot.id)
  return (
    <div className="ui-today-workout">
      <p className="ui-today-workout__date">{weekdayDate(date)}</p>
      <p className="ui-today-workout__name">
        {routine.name}
        {routine.focus ? ` — ${routine.focus}` : ''}
      </p>
      {done ? (
        <p className="ui-sub">Done {dateKey(done.finishedAt)}</p>
      ) : (
        <StartButton store={store} routine={routine} slot={slot} date={date} variant="primary" block />
      )}
    </div>
  )
}

// req-55 / DEC-038 — the single in-progress hero. While a workout is in progress and
// was STARTED today, it REPLACES today's scheduled Start block (Emilio: "the one
// started should always take the place of the start … when it's finished we can see
// today's routine again with the start button"). Holds whether the started workout
// is today's slot, tomorrow-started-early, or off-schedule — it is the one hero, no
// second hero. Reuses the Today block's look (`.ui-today-workout`). Name/focus/date
// resolve from the workout's OWN record (snapshot name survives a deleted/archived
// routine — DESIGN §1, never invented). Same resume call (continue the active one).
function TodayHero({ store, workout }) {
  const { routine } = findRoutine(store.routines, workoutRoutineId(workout))
  return (
    <div className="ui-today-workout">
      <p className="ui-today-workout__date">{weekdayDate(workoutDateKey(workout))}</p>
      <p className="ui-today-workout__name">
        {workoutRoutineName(workout, routine)}
        {workout.snapshot?.focus ? ` — ${workout.snapshot.focus}` : ''}
        <InProgressMark />
      </p>
      <Button variant="primary" block onClick={() => startOrContinue(store, activeRoutineId(workout))}>
        Continue
      </Button>
    </div>
  )
}

// req-55 — a stale/unfinished in-progress workout (started a prior day, or a legacy
// draft) surfaced in the recent peek as a row with a secondary **Continue**,
// mirroring UpcomingRow's inline Start. Marked "in progress"; never a finished-
// history link. Continue resumes it (abandoning any current active via the warning).
function InProgressPeekRow({ store, workout, todayKey }) {
  const { routine } = findRoutine(store.routines, workoutRoutineId(workout))
  return (
    <Row
      action={
        <Button onClick={() => continueInProgress(store, workout)}>Continue</Button>
      }
    >
      <WorkoutInfo
        when={weekdayDate(workoutDateKey(workout))}
        name={workoutRoutineName(workout, routine)}
        focus={workout.snapshot?.focus}
        today={workoutDateKey(workout) === todayKey}
      />
      <InProgressMark />
    </Row>
  )
}

// req-14 (Emilio review iter 8) — the empty-today state keeps the same emphasized
// Today block: the bold date on top, "Nothing scheduled today." in the name slot,
// and the big primary Start rendered disabled (there's nothing to start).
function TodayEmpty({ date }) {
  return (
    <div className="ui-today-workout">
      <p className="ui-today-workout__date">{weekdayDate(date)}</p>
      <p className="ui-today-workout__name">Nothing scheduled today.</p>
      <Button variant="primary" block disabled>
        Start
      </Button>
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
  const loop = Math.max(1, Number(schedule?.loopWeeks) || 1)
  const week = loopWeekIndex(schedule, now)
  const mine = store.activeWorkout
  const completedToday = completedOnDayKey(store.workouts, todayKey)
  // req-55 / DEC-038 — the single in-progress workout is the today hero only while it
  // was STARTED today; then it replaces today's scheduled Start block. Once it ages to
  // a prior day it is "stale": no longer the hero (today's Start shows normally), and
  // it surfaces as a Continue row instead. Legacy drafts count as stale too.
  const activeStartedToday = !!mine && dateKey(mine.startedAt) === todayKey
  // req-55 — the recent peek shows finished history AND any stale/unfinished
  // in-progress workout (started a prior day, or a legacy draft) as a Continue row,
  // merged by date so a stale one appears only when it falls in the recent window.
  const recent = sortWorkoutsByDate([
    ...staleInProgressWorkouts(store, todayKey),
    ...(store.workouts || []),
  ]).slice(0, 2)

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
    <Screen className={activeStartedToday ? '' : 'ui-screen--subbar'}>
      <Title>{greeting()}</Title>
      {loop > 1 ? (
        <p className="ui-sub">
          Week {week + 1} of {loop}
        </p>
      ) : null}

      {/* Section order: Upcoming› (plain link) → items → Today (emphasized) →
          Completed today → recent items → Previous› (plain link) → gap → Routines›
          (pinned to the viewport bottom, above the tab bar). Iter 7: "Upcoming" and
          "Previous" are the SAME style — the first Row of the upcoming list and the
          last Row of the recent list — so they bookend with identical typography/
          chevron. Interim peeks of Schedule/History until req-32's unified scroll. */}
      <List>
        <Row to="/schedule">Schedule</Row>
        {upcoming.map(({ date, slot, routine }) => (
          <UpcomingRow key={`${dateKey(date)}-${slot.id}`} store={store} date={date} slot={slot} routine={routine} todayKey={todayKey} />
        ))}
      </List>
      {upcoming.length === 0 ? <p className="ui-sub">Nothing scheduled.</p> : null}

      {/* req-55 / DEC-038 — an in-progress workout started today IS the single hero,
          replacing today's scheduled block(s). No second hero. On finish/abandon it
          is gone and today's scheduled block returns with Start. A stale in-progress
          (prior day) is not the hero — today shows normally; it appears as a Continue
          row in the recent peek below. */}
      {activeStartedToday ? (
        <TodayHero store={store} workout={mine} />
      ) : todays.length ? (
        todays.map(({ slot, routine }) => (
          <TodayWorkout key={slot.id} store={store} routine={routine} slot={slot} date={todayKey} />
        ))
      ) : (
        <TodayEmpty date={todayKey} />
      )}

      {completedToday.length ? (
        <>
          <SectionHeader>Completed today</SectionHeader>
          <List>
            {completedToday.map((workout) => (
              <CompletedTodayRow key={workout.id} store={store} workout={workout} todayKey={todayKey} />
            ))}
          </List>
        </>
      ) : null}

      {recent.length === 0 ? <p className="ui-sub">No history yet.</p> : null}
      <List>
        {recent.map((workout) =>
          workout.finishedAt ? (
            <HistoryPeekRow key={workout.id} store={store} workout={workout} todayKey={todayKey} />
          ) : (
            <InProgressPeekRow key={workout.id} store={store} workout={workout} todayKey={todayKey} />
          ),
        )}
        <Row to="/history">History</Row>
      </List>

      {/* Entry to the "choose any workout" picker (/start). Iter 8: a fixed strip
          docked directly above the tab bar (bottom chrome, out of the scroll) — the
          .ui-screen--subbar padding above keeps content clear of it. Replaces the
          iter-7 flex-pin, which overflowed by a hair. Hidden while the in-progress
          hero leads the screen (req-55); a stale in-progress keeps the picker. */}
      {activeStartedToday ? null : (
        <nav className="ui-subbar" aria-label="Routines">
          <NavLink to="/start" className="ui-subbar__link">
            <span>Routines</span>
            <span className="ui-row__chev" aria-hidden="true">›</span>
          </NavLink>
        </nav>
      )}
    </Screen>
  )
}
