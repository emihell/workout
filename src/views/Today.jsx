import { useState } from 'react'
import { recordButton } from '../analytics'
import { importWithBackup } from '../import-backup'
import { greeting } from '../ids'
import { isCurrentWorkout, otherTodayOccurrences } from '../current-workout'
import { clampLoopWeeks, coveringWorkout, dateKey, loopWeekIndex, occurrenceId, resolveSlot, slotsOn, weekRows } from '../schedule'
import { routineById } from '../model.js'
import { completedOnDayKey, doneInTodayBlock, isFirstRun, staleInProgressWorkouts } from '../history-queries.js'
import { useStore } from '../store-context'
import { continueInProgress, startOrContinue } from '../workout-actions'
import { withFrom } from '../route'
import { routineStartable } from '../exercise-names.js'
import { Banner, Button, FileButton, List, NavLink, Row, Screen, SectionHeader, Title } from '../ui/index.jsx'
import { sortWorkoutsByDate, weekdayDate, workoutDateKey, workoutRoutineId, workoutRoutineName } from './history/helpers'

// req-114 — the Start names its occurrence (slot@date), so startOrContinue only
// "continues" the active workout when it IS this occurrence. Without it, today's slot
// of the same routine a pre-midnight workout came from silently resumed yesterday's
// occurrence; now it goes through the one-active rule (DEC-038 abandon-on-new confirm).
// req-127 — no Start on an empty routine (it made an empty active workout and could
// abandon a real one); the preview already hides it (overview.jsx). Covers today's
// block (req-200: the upcoming rows that also used it are gone).
function StartButton({ store, routine, slot, date, label = 'Start', variant, block }) {
  if (!routineStartable(routine)) return null
  return (
    <Button
      variant={variant}
      block={block}
      onClick={() =>
        startOrContinue(store, routine.id, {
          scheduledFor: date,
          scheduleSlotId: slot.id,
          occurrenceId: occurrenceId(slot.id, date),
        })
      }
    >
      {label}
    </Button>
  )
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
// caption size, then the name below (req-179 / DEC-099: the " — focus" suffix is gone;
// stored focus values stay, unread). `when` uses the one shared `weekdayDate`
// format across all rows (iter 6). `today` colors the body black (`--ui-ink`) when
// the row's date is today, gray (`--ui-ink-2`) otherwise, so the eye lands on today;
// it is keyed off the row's date-vs-today, not the component. This is INFO only;
// each row keeps its own action/status (Start, Done, the history link).
function WorkoutInfo({ when, name, today }) {
  return (
    <span className={`ui-workout-info${today ? ' ui-workout-info--today' : ''}`}>
      <span className="ui-workout-info__date">{when}</span>
      <span className="ui-workout-info__body">
        {name}
      </span>
    </span>
  )
}

// req-14 (Emilio review) — a recent-history peek row linking to the History detail
// (req-171: its Back returns to Today).
// Shared info format (iter 5): `when` is the workout's date.
function HistoryPeekRow({ store, workout, todayKey }) {
  const routine = routineById(store.routines, workoutRoutineId(workout))
  return (
    <Row to={withFrom(`/history/${workout.id}`, '/')}>
      <WorkoutInfo when={weekdayDate(workoutDateKey(workout))} name={workoutRoutineName(workout, routine)} today={workoutDateKey(workout) === todayKey} />
    </Row>
  )
}

// req-200 (DEC-110 §4) — one day of "This week": weekday + date · its routines (or
// "Rest") · "Done ✓" when any workout finished that date (weekRows: by date, never by
// slot id — review F2). No Start on any row: today's block above owns today's Start,
// and starting another day's routine ahead lives on the day's screen ("Start now").
// Today's row is marked ("Today", bold). A tap opens that date's ScheduleDay — its loop
// week and weekday from weekRows — with `?from=/` so its Back returns Home.
function WeekRow({ routines, row, todayKey }) {
  const names = row.slots.map((slot) => resolveSlot(routines, slot).routine?.name || 'Missing').join(', ')
  const today = row.dateKey === todayKey
  const status = [today ? 'Today' : null, row.done ? 'Done ✓' : null].filter(Boolean).join(' · ')
  return (
    <Row
      to={withFrom(`/schedule/${row.week}/${row.weekday}`, '/')}
      value={status || null}
      className={today ? 'ui-row--today' : ''}
    >
      {weekdayDate(row.dateKey)} · {names || 'Rest'}
    </Row>
  )
}

// req-14 (Emilio review) — today's workout is the Workout screen's focal point and
// main call to action. Iter 8: a two-line stack — the bold date on top, then
// the name as a secondary line — then a large, primary, full-width Start.
// `Done …` shows once logged. req-55/DEC-038: this block never carries the
// in-progress state — a current active workout is the single hero (`TodayHero`,
// which req-114 renders above today's other occurrences), and a stale active
// workout is a Continue row lower down, not the hero. So a today routine only
// ever shows Start (or Done); the Continue path lives elsewhere. req-114: `Done`
// uses the shared weekdayDate format, like every other row.
// req-110 — a day with two+ routines is ONE day: the date line prints once, then
// each routine (name, and its own Start or `Done …`) in schedule order.
// With one routine the markup is exactly the pre-req-110 block (date, name, Start).
// Each routine keeps the full-width primary Start (one clearly-tappable Start per
// routine); `__routine` only spaces the routines apart under the shared date.
function TodayRoutine({ store, routine, slot, date }) {
  const done = coveringWorkout(store.workouts, routine.id, date, slot.id)
  return (
    <>
      <p className="ui-today-workout__name">
        {routine.name}
      </p>
      {done ? (
        <p className="ui-sub">Done {weekdayDate(dateKey(done.finishedAt))}</p>
      ) : (
        <StartButton store={store} routine={routine} slot={slot} date={date} variant="primary" block />
      )}
    </>
  )
}

function TodayWorkouts({ store, todays, date, done }) {
  return (
    <div className="ui-today-workout">
      <p className="ui-today-workout__date">{weekdayDate(date)}</p>
      {todays.length === 1 ? (
        <TodayRoutine store={store} routine={todays[0].routine} slot={todays[0].slot} date={date} />
      ) : (
        todays.map(({ slot, routine }) => (
          <div key={slot.id} className="ui-today-workout__routine">
            <TodayRoutine store={store} routine={routine} slot={slot} date={date} />
          </div>
        ))
      )}
      <TodayDone store={store} done={done} />
    </div>
  )
}

// req-195 / DEC-108 §5 — the workouts finished today (not already a slot's Done above)
// live INSIDE today's block, under its one date line: "<routine> · Done ✓ ›", each a
// forward link to its History detail (Back returns to Today, req-171). Was a separate
// "Completed today" row in the list below, which read as a second row for today. The
// name resolves like every workout row (snapshot name survives a deleted routine). An
// empty `done` renders nothing, so a day with nothing done is exactly the old block.
function TodayDone({ store, done }) {
  if (!done.length) return null
  return (
    <ul className="ui-today-workout__done">
      {done.map((workout) => (
        <li key={workout.id}>
          <NavLink to={withFrom(`/history/${workout.id}`, '/')} chevron="forward">
            {workoutRoutineName(workout, routineById(store.routines, workoutRoutineId(workout)))} · Done ✓
          </NavLink>
        </li>
      ))}
    </ul>
  )
}

// req-55 / DEC-038 — the single in-progress hero: the name resolves from the
// workout's OWN record (snapshot name survives a deleted/archived routine — DESIGN §1,
// never invented), marked in progress, with Continue (same resume call). req-114 /
// DEC-058: it no longer REPLACES today's block — it sits inside it, under today's
// date (a 23:50 workout viewed at 00:05 reads under the new day), above today's other
// occurrences. It is the one hero whatever it was started from (today's slot,
// tomorrow's started early, off-schedule).
function HeroRoutine({ store, workout }) {
  const routine = routineById(store.routines, workoutRoutineId(workout))
  return (
    <>
      <p className="ui-today-workout__name">
        {workoutRoutineName(workout, routine)}
        <InProgressMark />
      </p>
      {/* req-114 review — resume BY ID (continueInProgress never abandons). The hero is
          decided with the render-time clock; startOrContinue re-checks "current" with a
          fresh one, so a tap just past the 6 h edge would have asked to abandon it. */}
      <Button variant="primary" block onClick={() => continueInProgress(store, workout)}>
        Continue
      </Button>
    </>
  )
}

// req-114 / DEC-058 §3 — today's block while a current workout is in progress: TODAY's
// date once, the in-progress workout first, then today's OTHER occurrences (`others`,
// from otherTodayOccurrences) each with its own Start/Done, spaced like req-110's
// routines. With no others it is the date and the hero alone (the req-55 shape).
function TodayHero({ store, workout, others, date, done }) {
  return (
    <div className="ui-today-workout">
      <p className="ui-today-workout__date">{weekdayDate(date)}</p>
      {others.length === 0 ? (
        <HeroRoutine store={store} workout={workout} />
      ) : (
        <>
          <div className="ui-today-workout__routine">
            <HeroRoutine store={store} workout={workout} />
          </div>
          {others.map(({ slot, routine }) => (
            <div key={slot.id} className="ui-today-workout__routine">
              <TodayRoutine store={store} routine={routine} slot={slot} date={date} />
            </div>
          ))}
        </>
      )}
      <TodayDone store={store} done={done} />
    </div>
  )
}

// req-55 — a stale/unfinished in-progress workout (started a prior day, or a legacy
// draft) surfaced in the recent peek as a row with a secondary **Continue**.
// Marked "in progress"; never a finished-history link. Continue resumes it
// (abandoning any current active via the warning).
function InProgressPeekRow({ store, workout, todayKey }) {
  const routine = routineById(store.routines, workoutRoutineId(workout))
  return (
    <Row
      action={
        <Button onClick={() => continueInProgress(store, workout)}>Continue</Button>
      }
    >
      <WorkoutInfo
        when={weekdayDate(workoutDateKey(workout))}
        name={workoutRoutineName(workout, routine)}
       
        today={workoutDateKey(workout) === todayKey}
      />
      <InProgressMark />
    </Row>
  )
}

// req-14 (Emilio review iter 8) — the empty-today state keeps the same emphasized
// Today block: the bold date on top, "Nothing scheduled today." in the name slot.
// req-82 (N1) — the Start is no longer a dead disabled control. With nothing
// scheduled you can still start off-schedule: it becomes an enabled "Start new
// workout" that opens the routine picker (the existing Routines list at
// `/routines`, whose per-row Start already calls startOrContinue off-schedule —
// DEC-047 (a): reuse that surface, don't invent one, and no ad-hoc/blank workout).
// Today()'s isFirstRun early return (req-119: no routines, no workouts, no active
// workout) handles the empty-app case with the no-data screen. With history but every
// routine deleted, TodayEmpty can render and its picker (/routines) offers Add routine.
// req-195 — once something was done today, the done rows replace "Nothing scheduled
// today." (it read as contradicting them) and Start new workout drops to the secondary
// look: the day's work is in, another workout is the lesser option.
function TodayEmpty({ store, date, done }) {
  return (
    <div className="ui-today-workout">
      <p className="ui-today-workout__date">{weekdayDate(date)}</p>
      {done.length ? (
        <TodayDone store={store} done={done} />
      ) : (
        <p className="ui-today-workout__name">Nothing scheduled today.</p>
      )}
      {/* req-121 — navigation only, so a NavLink with the button look (DEC-040). */}
      <NavLink to="/routines" look={done.length ? 'secondary' : 'primary'} block>
        Start new workout
      </NavLink>
    </div>
  )
}

export function Today() {
  const store = useStore()
  // req-24 — a failed first-run import shows in-page (was a native alert).
  const [importError, setImportError] = useState('')
  const now = new Date()
  const todayKey = dateKey(now)
  const schedule = store.schedule
  const routines = store.routines || []
  const todays = slotsOn(schedule, now)
    .map((slot) => resolveSlot(routines, slot))
    .filter((x) => x.routine)
  // req-200 (DEC-110 §4) — this calendar week, Mon–Sun, rest days included (replaces
  // the 2 upcoming rows and their Start; Start-ahead moved to the day screen).
  const week7 = weekRows(schedule, store.workouts, now)
  // req-114 — clamp like Schedule does (an imported 6 read "Week 1 of 6").
  const loop = clampLoopWeeks(schedule?.loopWeeks)
  const week = loopWeekIndex(schedule, now)
  const mine = store.activeWorkout
  const completedToday = completedOnDayKey(store.workouts, todayKey)
  // req-81 — dedupe: today's finished sessions are owned by today's block (req-195: its
  // "· Done ✓" rows, or a slot's Done); the recent peek excludes exactly that set (by
  // id) and reads as prior-day history only.
  const completedTodayIds = new Set(completedToday.map((workout) => workout.id))
  // req-55 / DEC-038 — the single in-progress workout is the today hero only while it
  // is CURRENT (req-114 / DEC-058 §2: started today or within the last 6 h). Once
  // stale it is no longer the hero (today's Start shows normally) and surfaces as a
  // Continue row instead. Legacy drafts count as stale too. req-114 / DEC-058 §3: the
  // hero sits in today's block with today's OTHER occurrences, not instead of them.
  const hero = isCurrentWorkout(mine, now, todayKey) ? mine : null
  const others = hero ? otherTodayOccurrences(todays, hero, todayKey) : todays
  // req-195 — today's finished workouts show inside today's block; one a rendered slot
  // already shows as Done is not repeated (`others` is exactly the slots rendered: all
  // of today's without a hero, the hero's others with one).
  const done = doneInTodayBlock(store.workouts, others, todayKey)
  // req-55 — a stale/unfinished in-progress workout (started a prior day, or a legacy
  // draft) is a Continue row. req-200 (review F6): it sits with today's block, above the
  // week, ALWAYS shown — it was merged by date into the 2-row recent peek, where an old
  // one fell off the bottom. The recent peek is now finished, prior-day history only.
  // req-81 — today's finished workouts are excluded there; they live in today's block.
  const stale = staleInProgressWorkouts(store, todayKey, now)
  const recent = sortWorkoutsByDate(
    (store.workouts || []).filter((workout) => !completedTodayIds.has(workout.id)),
  ).slice(0, 2)

  // req-119 — first run is no routines AND no workouts AND no active workout (was
  // `!routines.length`, which showed "No data" mid-workout and with history).
  if (isFirstRun(store)) {
    return (
      <Screen>
        <Title subtitle="Nothing here yet.">Today</Title>
        {/* req-174 — the empty home's primary action: navigation only, so a NavLink with
            the button look (DEC-040), as TodayEmpty's. Import stays below as the secondary. */}
        {/* req-177 — the two actions stack with the app's standard gap (.ui-first-run-actions). */}
        <div className="ui-first-run-actions">
          <NavLink to="/routines/new" look="primary" block>
            Create your first routine
          </NavLink>
          <FileButton
            label="Import"
            accept="application/json,.json"
            onFiles={(files) => {
              // req-153 — a new pick starts clean: the last file's error never lingers
              // over this one's outcome (a success, a cancel, or its own error).
              setImportError('')
              const file = files?.[0]
              if (!file) return
              file.text().then(async (text) => {
                try {
                  const payload = JSON.parse(text)
                  const result = await importWithBackup({ store, payload })
                  if (!result) return // cancelled at the confirm
                  recordButton('import')
                } catch (err) {
                  setImportError(err instanceof Error ? err.message : 'Could not import.')
                }
              })
            }}
          />
        </div>
        {importError ? <Banner role="alert">{importError}</Banner> : null}
        {/* req-198 — Schedule and Settings rows dropped (DEC-110 §1); Import is above. */}
        <List>
          <Row to="/routines">Routines</Row>
          <Row to="/history">History</Row>
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
      {/* req-198 (DEC-112) — no bottom bar: Home is the hub. A small link to the
          routines list; today's Start stays the dominant control. */}
      <p>
        <NavLink to="/routines" chevron="forward">Workouts</NavLink>
      </p>

      {/* req-200 (DEC-110 §4) — section order: today's block (with today's finished
          workouts inside it, req-195) → the stale Continue row (review F6) → this week
          Mon–Sun → prior-day recent items → History. The 2 upcoming rows (req-14/59/60) are gone:
          only today's block carries Start. */}
      {/* req-55 / DEC-038 — a current in-progress workout IS the single hero. No second
          hero. req-114 / DEC-058 §3: it heads today's block (today's date), and the
          day's other occurrences stay below it with their own Start/Done. On
          finish/abandon it is gone and the block is the plain scheduled one. A stale
          in-progress is not the hero — today shows normally; it appears as a Continue
          row right under this block (req-200). */}
      {hero ? (
        <TodayHero store={store} workout={hero} others={others} date={todayKey} done={done} />
      ) : todays.length ? (
        <TodayWorkouts store={store} todays={todays} date={todayKey} done={done} />
      ) : (
        <TodayEmpty store={store} date={todayKey} done={done} />
      )}

      {stale.length ? (
        <List>
          {stale.map((workout) => (
            <InProgressPeekRow key={workout.id} store={store} workout={workout} todayKey={todayKey} />
          ))}
        </List>
      ) : null}

      <SectionHeader>This week</SectionHeader>
      <List>
        {week7.map((row) => (
          <WeekRow key={row.dateKey} routines={routines} row={row} todayKey={todayKey} />
        ))}
      </List>

      {/* req-195 / DEC-108 §5 — the list below today's block holds PRIOR days only (the
          recent peek, then the History link). Today's finished workouts moved into
          today's block; they were the head of this list (req-94 merged them into it),
          which read as a second row for today. "No history yet." still keys off both, so
          a first workout finished today does not claim there is no history. */}
      {recent.length === 0 && completedToday.length === 0 ? (
        <p className="ui-sub">No history yet.</p>
      ) : null}
      <List>
        {recent.map((workout) => (
          <HistoryPeekRow key={workout.id} store={store} workout={workout} todayKey={todayKey} />
        ))}
        <Row to="/history">History</Row>
      </List>
    </Screen>
  )
}
