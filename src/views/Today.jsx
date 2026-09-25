import { useState } from 'react'
import { recordButton } from '../analytics'
import { importWithBackup } from '../import-backup'
import { greeting } from '../ids'
import { isCurrentWorkout, otherTodayOccurrences } from '../current-workout'
import { clampLoopWeeks, coveringWorkout, dateKey, loopWeekIndex, occurrenceId, remainingInLoop, resolveSlot, slotsOn } from '../schedule'
import { routineById } from '../model.js'
import { completedOnDayKey, isFirstRun, staleInProgressWorkouts } from '../history-queries.js'
import { useStore } from '../store-context'
import { continueInProgress, startOrContinue } from '../workout-actions'
import { withFrom } from '../route'
import { routineStartable } from '../exercise-names.js'
import { Banner, Button, FileButton, List, NavLink, Row, Screen, Title } from '../ui/index.jsx'
import { sortWorkoutsByDate, weekdayDate, workoutDateKey, workoutRoutineId, workoutRoutineName } from './history/helpers'

// req-114 — the Start names its occurrence (slot@date), so startOrContinue only
// "continues" the active workout when it IS this occurrence. Without it, today's slot
// of the same routine a pre-midnight workout came from silently resumed yesterday's
// occurrence; now it goes through the one-active rule (DEC-038 abandon-on-new confirm).
// req-127 — no Start on an empty routine (it made an empty active workout and could
// abandon a real one); the preview already hides it (overview.jsx). Covers today's
// block and the upcoming rows.
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

function activeRoutineId(workout) {
  return workout?.routineId
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

// req-28 — a completed-today workout row, linking to its History detail (req-171:
// carrying `from=/`, so its Back returns to Today). Uses the
// shared info format (iter 5); `when` is "Today" (all completed today), focus from
// the immutable snapshot. Program name dropped so it matches the other sections.
function CompletedTodayRow({ store, workout, todayKey }) {
  const routine = routineById(store.routines, workoutRoutineId(workout))
  return (
    <Row to={withFrom(`/history/${workout.id}`, '/')}>
      <WorkoutInfo when={weekdayDate(workoutDateKey(workout))} name={workoutRoutineName(workout, routine)} focus={workout.snapshot?.focus} today={workoutDateKey(workout) === todayKey} />
    </Row>
  )
}

// req-14 (Emilio review) — a recent-history peek row linking to the History detail
// (req-171: its Back returns to Today).
// Shared info format (iter 5): `when` is the workout's date, focus from the snapshot.
function HistoryPeekRow({ store, workout, todayKey }) {
  const routine = routineById(store.routines, workoutRoutineId(workout))
  return (
    <Row to={withFrom(`/history/${workout.id}`, '/')}>
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
    <Row value={done ? `Done ${weekdayDate(dateKey(done.finishedAt))}` : null} action={startAction}>
      <WorkoutInfo when={weekdayDate(dk)} name={routine.name} focus={routine.focus} today={dk === todayKey} />
    </Row>
  )
}

// req-14 (Emilio review) — today's workout is the Workout screen's focal point and
// main call to action. Iter 8: a two-line stack — the bold date on top, then
// "name — focus" as a secondary line — then a large, primary, full-width Start.
// `Done …` shows once logged. req-55/DEC-038: this block never carries the
// in-progress state — a current active workout is the single hero (`TodayHero`,
// which req-114 renders above today's other occurrences), and a stale active
// workout is a Continue row lower down, not the hero. So a today routine only
// ever shows Start (or Done); the Continue path lives elsewhere. req-114: `Done`
// uses the shared weekdayDate format, like every other row.
// req-110 — a day with two+ routines is ONE day: the date line prints once, then
// each routine (name — focus, and its own Start or `Done …`) in schedule order.
// With one routine the markup is exactly the pre-req-110 block (date, name, Start).
// Each routine keeps the full-width primary Start (one clearly-tappable Start per
// routine); `__routine` only spaces the routines apart under the shared date.
function TodayRoutine({ store, routine, slot, date }) {
  const done = coveringWorkout(store.workouts, routine.id, date, slot.id)
  return (
    <>
      <p className="ui-today-workout__name">
        {routine.name}
        {routine.focus ? ` — ${routine.focus}` : ''}
      </p>
      {done ? (
        <p className="ui-sub">Done {weekdayDate(dateKey(done.finishedAt))}</p>
      ) : (
        <StartButton store={store} routine={routine} slot={slot} date={date} variant="primary" block />
      )}
    </>
  )
}

function TodayWorkouts({ store, todays, date }) {
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
    </div>
  )
}

// req-55 / DEC-038 — the single in-progress hero: name/focus resolve from the
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
        {workout.snapshot?.focus ? ` — ${workout.snapshot.focus}` : ''}
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
function TodayHero({ store, workout, others, date }) {
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
        focus={workout.snapshot?.focus}
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
function TodayEmpty({ date }) {
  return (
    <div className="ui-today-workout">
      <p className="ui-today-workout__date">{weekdayDate(date)}</p>
      <p className="ui-today-workout__name">Nothing scheduled today.</p>
      {/* req-121 — navigation only, so a NavLink with the button look (DEC-040). */}
      <NavLink to="/routines" look="primary" block>
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
  // Upcoming schedule peek (tomorrow onward) — a small preview of what's next, each
  // with an inline Start (req-14 review; the interim before req-32's unified scroll).
  // req-60 — the shown list is REVERSED so the column reads chronologically top→bottom
  // (dates decreasing): the furthest of the two soonest workouts sits at the top and
  // the nearest just above the today hero. `remainingInLoop` is ascending (nearest
  // first) and stays that way for its other callers — the flip is render-time only.
  const upcoming = remainingInLoop(routines, schedule, now).slice(0, 2).reverse()
  // req-114 — clamp like Schedule does (an imported 6 read "Week 1 of 6").
  const loop = clampLoopWeeks(schedule?.loopWeeks)
  const week = loopWeekIndex(schedule, now)
  const mine = store.activeWorkout
  const completedToday = completedOnDayKey(store.workouts, todayKey)
  // req-81 — dedupe: a workout finished today used to appear twice on Today — in the
  // "Completed today" section AND in the recent peek. "Completed today" (with its
  // header) owns today's finished sessions; the recent peek excludes exactly that set
  // (by id, so it tracks whatever the section renders) and reads as prior-day history.
  const completedTodayIds = new Set(completedToday.map((workout) => workout.id))
  // req-55 / DEC-038 — the single in-progress workout is the today hero only while it
  // is CURRENT (req-114 / DEC-058 §2: started today or within the last 6 h). Once
  // stale it is no longer the hero (today's Start shows normally) and surfaces as a
  // Continue row instead. Legacy drafts count as stale too. req-114 / DEC-058 §3: the
  // hero sits in today's block with today's OTHER occurrences, not instead of them.
  const hero = isCurrentWorkout(mine, now, todayKey) ? mine : null
  const others = hero ? otherTodayOccurrences(todays, hero, todayKey) : todays
  // req-55 — the recent peek shows finished history AND any stale/unfinished
  // in-progress workout (started a prior day, or a legacy draft) as a Continue row,
  // merged by date so a stale one appears only when it falls in the recent window.
  // req-81 — today's finished workouts are excluded here; they live in "Completed
  // today" above (stale in-progress are never finished, so none are in that set).
  const recent = sortWorkoutsByDate([
    ...staleInProgressWorkouts(store, todayKey, now),
    ...(store.workouts || []).filter((workout) => !completedTodayIds.has(workout.id)),
  ]).slice(0, 2)

  // req-119 — first run is no routines AND no workouts AND no active workout (was
  // `!routines.length`, which showed "No data" mid-workout and with history).
  if (isFirstRun(store)) {
    return (
      <Screen>
        <Title subtitle="Nothing here yet.">Today</Title>
        {/* req-174 — the empty home's primary action: navigation only, so a NavLink with
            the button look (DEC-040), as TodayEmpty's. Import stays below as the secondary. */}
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
        {importError ? <Banner role="alert">{importError}</Banner> : null}
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

      {/* Section order: upcoming items → Today (emphasized) → Completed today →
          recent items → Previous› (plain link, the last Row of the recent list) →
          gap → Routines› (pinned to the viewport bottom, above the tab bar). req-59
          restored the upcoming preview (the "what's next" items with inline Start);
          req-57's Schedule nav link stays gone — Schedule lives in the Library
          segment (req-56). The upcoming list is headerless. Interim peeks until
          req-32's unified scroll. */}
      <List>
        {upcoming.map(({ date, slot, routine }) => (
          <UpcomingRow key={`${dateKey(date)}-${slot.id}`} store={store} date={date} slot={slot} routine={routine} todayKey={todayKey} />
        ))}
      </List>
      {upcoming.length === 0 ? <p className="ui-sub">Nothing scheduled.</p> : null}

      {/* req-55 / DEC-038 — a current in-progress workout IS the single hero. No second
          hero. req-114 / DEC-058 §3: it heads today's block (today's date), and the
          day's other occurrences stay below it with their own Start/Done. On
          finish/abandon it is gone and the block is the plain scheduled one. A stale
          in-progress is not the hero — today shows normally; it appears as a Continue
          row in the recent peek below. */}
      {hero ? (
        <TodayHero store={store} workout={hero} others={others} date={todayKey} />
      ) : todays.length ? (
        <TodayWorkouts store={store} todays={todays} date={todayKey} />
      ) : (
        <TodayEmpty date={todayKey} />
      )}

      {/* req-94 — completed-today sessions and the recent-history peek are ONE list,
          not two adjacent <List>s. Two lists each drew their own top/bottom rule and
          carried their own vertical margin, so the completed↔recent boundary stacked
          a divider-under + divider-over into a thin white gap. Merged, the rows carry
          their own state instead: a completed-today row reads near-black (its date is
          today → .ui-workout-info--today), a recent prior-day row reads gray, so the
          two stay distinguishable within the single list. De-dup is unchanged — the
          recent list already excludes today's finished sessions by id (see `recent`
          above), so nothing shows twice. Order preserved: completed today first, then
          recent, then the History link. */}
      {recent.length === 0 && completedToday.length === 0 ? (
        <p className="ui-sub">No history yet.</p>
      ) : null}
      <List>
        {completedToday.map((workout) => (
          <CompletedTodayRow key={workout.id} store={store} workout={workout} todayKey={todayKey} />
        ))}
        {recent.map((workout) =>
          workout.finishedAt ? (
            <HistoryPeekRow key={workout.id} store={store} workout={workout} todayKey={todayKey} />
          ) : (
            <InProgressPeekRow key={workout.id} store={store} workout={workout} todayKey={todayKey} />
          ),
        )}
        <Row to="/history">History</Row>
      </List>
    </Screen>
  )
}
