import { LOOP_WEEKS, WEEKDAY_ORDER, weekdayName } from '../ids'
import { clampLoopWeeks, dateKey, loopWeekIndex, resolveSlot, slotsForWeekDay } from '../schedule'
import { routineById } from '../model.js'
import { workoutRoutineId, workoutRoutineName } from './history/helpers'
import {
  changeDaySheet,
  changedDayPath,
  dayEveryText,
  dayScreenDate,
  doneOnDay,
  longWeekdayDate,
  removeSlotText,
  scheduleRowText,
  slotMenuSheet,
  startNowShown,
} from './schedule-day.js'
import { childLink, go, withFrom } from '../route'
import { nextWorkoutName } from '../plan-templates.js'
import { useStore } from '../store-context'
import { startOrContinue } from '../workout-actions'
import { routineStartable } from '../exercise-names.js'
import { RoutineNewForm, RoutineScreens } from './Routine'
import { navForBase } from './routine-nav.js'
import { Back, Missing } from './shared'
import { Actions, Button, List, NavLink, Row, Screen, SectionHeader, Select, Title } from '../ui/index.jsx'
import { askChoice, askConfirm } from '../ui/confirm.js'

function dayPathOf(week, weekday, extra = '') {
  return `/schedule/${week}/${weekday}${extra}`
}

function slotLabel(routines, slot) {
  const resolved = resolveSlot(routines, slot)
  if (!resolved.routine) return 'Missing'
  return resolved.routine.name
}

function slotRoutineId(slot) {
  return slot.routineId
}

function activeRoutines(store) {
  return (store.routines || []).filter((routine) => !routine.archivedAt)
}

export function Schedule() {
  const store = useStore()
  const schedule = store.schedule || { loopWeeks: 1, slots: [] }
  const loop = clampLoopWeeks(schedule.loopWeeks)
  const currentWeek = loopWeekIndex(schedule)
  // req-48 — mark today's row: the single (week, weekday) that is the current loop
  // week AND today's weekday. `getDay()` (0=Sun..6=Sat) is the same weekday
  // convention `slotsOn`/`WEEKDAY_ORDER` use, so it lines up with the rows below.
  const todayWeekday = new Date().getDay()
  const routines = activeRoutines(store)
  // req-209 §7 — today's row reads "Today · Done ✓" once a workout finished today.
  const doneTodayNames = doneOnDay(store.workouts, dateKey(new Date())).map((workout) =>
    workoutRoutineName(workout, routineById(store.routines, workoutRoutineId(workout))),
  )

  // req-199 — no Library toggle. req-205 (DEC-115): reached from Home's "Schedule ›" (the
  // Routines list's "Whole plan ›" is gone), so Back goes Home — and, Back being "/", no
  // Today link (showsTodayLink). History hangs off the bottom ("History ›"; its Back returns
  // here). Every /schedule/* route is unchanged.
  return (
    <Screen>
      <Back to="/" />
      <Title>Schedule</Title>
      <p>
        <NavLink to="/schedule/loop" chevron="forward">
          Loop · {loop} week{loop === 1 ? '' : 's'}
        </NavLink>
      </p>
      {Array.from({ length: loop }, (_, week) => (
        <div key={week}>
          {loop > 1 ? (
            <SectionHeader>
              Week {week + 1} of {loop}
              {week === currentWeek ? ' (this week)' : ''}
            </SectionHeader>
          ) : null}
          <List>
            {WEEKDAY_ORDER.map((weekday) => {
              const slots = slotsForWeekDay(schedule, week, weekday)
              const names = slots.map((slot) => slotLabel(routines, slot)).join(', ')
              const isToday = week === currentWeek && weekday === todayWeekday
              const row = scheduleRowText({ names, isToday, doneNames: isToday ? doneTodayNames : [] })
              return (
                <Row key={weekday} to={dayPathOf(week, weekday)} value={row.value}>
                  {weekdayName(weekday)} — {row.label}
                </Row>
              )
            })}
          </List>
        </div>
      ))}
      {routines.length === 0 ? <p className="ui-sub">No workouts.</p> : null}
      <List>
        <Row to="/history">History</Row>
      </List>
    </Screen>
  )
}

export function ScheduleLoop() {
  const store = useStore()
  const loop = clampLoopWeeks(store.schedule?.loopWeeks)

  return (
    <Screen>
      <Back to="/schedule" />
      <Title>Loop</Title>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const value = Number(new FormData(e.target).get('loop'))
          const removed = (store.schedule?.slots || []).filter((slot) => Number(slot.week) >= value).length
          if (removed && !(await askConfirm(`Remove ${removed} scheduled workout${removed === 1 ? '' : 's'}?`, { confirmLabel: 'Remove' }))) {
            return
          }
          store.setLoopWeeks(value)
          go('/schedule')
        }}
      >
        <Select
          label="Weeks"
          name="loop"
          defaultValue={loop}
          options={LOOP_WEEKS.map((n) => ({ value: n, label: `${n} week${n === 1 ? '' : 's'}` }))}
        />
        <Actions
          retreat={<NavLink to="/schedule" look="quiet">Cancel</NavLink>}
          forward={<Button type="submit" variant="primary">Save</Button>}
        />
      </form>
    </Screen>
  )
}

// req-208 — the slot row's "⋯": one sheet (Change day · Remove · Cancel), then the chosen
// action's own sheet, unchanged from req-207 / req-203:
// - Change day (DEC-116): removeSlot + addSlot (same week, same routine), no confirm (reversible).
// - Remove: the "Take X off {Day}s?" confirm, then removeSlot (this loop week's slot only).
async function slotActions(store, { routines, slot, week, weekday, loop, date, from }) {
  const name = slotLabel(routines, slot)
  const menu = slotMenuSheet(name)
  const choice = await askChoice('', { title: menu.title, choices: menu.choices })
  if (choice === 'change') {
    const taken = (store.schedule?.slots || [])
      .filter((other) => Number(other.week) === Number(week) && other.routineId === slot.routineId)
      .map((other) => other.weekday)
    const sheet = changeDaySheet(name, weekday, week, loop, taken)
    const picked = await askChoice(sheet.message, { title: sheet.title, choices: sheet.choices })
    if (picked == null || Number(picked) === Number(weekday)) return
    store.removeSlot(slot.id)
    store.addSlot({ week, weekday: Number(picked), routineId: slot.routineId })
    go(withFrom(changedDayPath(week, Number(picked), date), from))
  } else if (choice === 'remove') {
    if (!(await askConfirm(removeSlotText(name, weekday, week, loop), { confirmLabel: 'Remove' }))) return
    store.removeSlot(slot.id)
  }
}

// req-200 (DEC-110 §4) — a day of the loop, reached from the Schedule (Back → /schedule)
// or from a row of Home's "This week" (`?from=/`, so Back → Home and the Today link is
// absent). Each slot has **Start now**: that routine, today, through the same off-schedule
// start the Routines list uses (startOrContinue) — the 2-tap start-ahead the upcoming rows
// had (review F5). The screen is honest about the loop (review B1; req-203: the sub line
// "Every Saturday in week 2 of 2", was the title's " · week 2 of 2"), and in a longer loop "Whole plan ›" reaches the other weeks — unless Back already
// goes there. Remove edits THIS loop week's slot only (removeSlot; no schema change).
//
// req-203 §1 / §3 (Lena run 3, s33: "Where are my sets? Start now — did it not save?") —
// entered from Home the screen is a DATE (homeDayDate): the title reads "Wednesday, Oct 7",
// the workouts finished that date head the screen as "{name} · Done ✓ ›" links to their
// History detail (Back returns here), and Start now shows only on today (until a finished
// workout covers the slot) and later — never on a past date. A sub line says the slots
// repeat ("Every Wednesday [in week N of M]"), and Remove's confirm says what it does.
//
// req-204 — Home's "Coming up" rows link the date itself (`?date=`, any upcoming date,
// not only this week's): dayScreenDate. The screen's own path then carries it (`here`), so
// a child's Back (slot, add, a done row's History) returns to this same dated screen.
export function ScheduleDay({ week, weekday, from = null, date: linkDate = null }) {
  const store = useStore()
  const routines = activeRoutines(store)
  const slots = slotsForWeekDay(store.schedule, week, weekday)
  const loop = clampLoopWeeks(store.schedule?.loopWeeks)
  const backTo = from || '/schedule'
  const now = new Date()
  const todayKey = dateKey(now)
  const date = dayScreenDate(store.schedule, week, weekday, from, linkDate, now)
  const here = date && linkDate === date ? `${dayPathOf(week, weekday)}?date=${date}` : dayPathOf(week, weekday)
  const done = doneOnDay(store.workouts, date)

  return (
    <Screen>
      <Back to={backTo} />
      <Title subtitle={dayEveryText(weekday, week, loop)}>
        {date ? longWeekdayDate(date, now) : weekdayName(weekday)}
      </Title>
      {done.length ? (
        <List>
          {done.map((workout) => (
            <Row key={workout.id} to={childLink(`/history/${workout.id}`, here, from)}>
              {workoutRoutineName(workout, routineById(store.routines, workoutRoutineId(workout)))} · Done ✓
            </Row>
          ))}
        </List>
      ) : null}
      {slots.length === 0 ? <p className="ui-sub">None.</p> : null}
      <List>
        {slots.map((slot) => {
          const { routine } = resolveSlot(routines, slot)
          const startable =
            routine &&
            routineStartable(routine) &&
            startNowShown({ workouts: store.workouts, routineId: routine.id, slotId: slot.id, date, todayKey })
          return (
            <Row
              key={slot.id}
              className="ui-row--wrap"
              action={
                <>
                  {startable ? (
                    <Button onClick={() => startOrContinue(store, routine.id)}>Start now</Button>
                  ) : null}
                  {/* req-208 — Change day and Remove sit behind the row's "⋯" (req-188's row-menu
                      pattern): the row is the name, Start now and ⋯ on one line at 375 px. */}
                  <Button
                    variant="quiet"
                    className="ui-row-menu"
                    aria-label={`Change day or remove ${slotLabel(routines, slot)}`}
                    onClick={() => slotActions(store, { routines, slot, week, weekday, loop, date, from })}
                  >
                    ⋯
                  </Button>
                </>
              }
            >
              <NavLink to={childLink(dayPathOf(week, weekday, `/${slot.id}`), here, from)}>{slotLabel(routines, slot)}</NavLink>
            </Row>
          )
        })}
      </List>
      <p>
        <NavLink to={childLink(dayPathOf(week, weekday, '/add'), here, from)} chevron="forward">Add workout</NavLink>
      </p>
      {loop > 1 && backTo.split('?')[0] !== '/schedule' ? (
        <p>
          <NavLink to="/schedule" chevron="forward">Whole plan</NavLink>
        </p>
      ) : null}
    </Screen>
  )
}

// req-200 — `from` is the day screen as it was entered (childLink: `/schedule/w/d?from=/`
// from Home's week), so Back and the add both land there and its Back still goes Home.
export function ScheduleDayAdd({ week, weekday, from = null }) {
  const store = useStore()
  const routines = activeRoutines(store)
  const dayPath = from || `/schedule/${week}/${weekday}`

  return (
    <Screen>
      <Back to={dayPath} />
      <Title>Add workout</Title>
      {routines.length === 0 ? (
        <RoutineNewForm
          defaultName={nextWorkoutName(store.routines)}
          onSave={({ name }) => {
            const id = store.addRoutine({ name })
            store.addSlot({ week, weekday, routineId: id })
            go(dayPath)
          }}
          cancelTo={dayPath}
        />
      ) : (
        <List>
          {routines.map((routine) => {
            const assigned = (store.schedule?.slots || []).some(
              (slot) =>
                Number(slot.week) === Number(week) &&
                Number(slot.weekday) === Number(weekday) &&
                slotRoutineId(slot) === routine.id,
            )
            return (
              <Row key={routine.id}>
                <Button
                  disabled={assigned}
                  onClick={() => {
                    store.addSlot({ week, weekday, routineId: routine.id })
                    go(dayPath)
                  }}
                >
                  {routine.name}
                </Button>
              </Row>
            )
          })}
        </List>
      )}
    </Screen>
  )
}

function slotOnDay(schedule, week, weekday, slotId) {
  return slotsForWeekDay(schedule, week, weekday).find((s) => s.id === slotId) || null
}

// req-202 — `from` is the day screen as it was entered (childLink from ScheduleDay, e.g.
// `/schedule/0/6?from=/` from Home's week): the slot page's Back returns there, so the day's
// own Back still ends on Home. Only the slot page itself reads it; its sub-screens keep
// their fixed parents.
export function ScheduleSlot({ week, weekday, slotId, screen = 'detail', itemId, exerciseId, from = null }) {
  const store = useStore()
  const slot = slotOnDay(store.schedule, week, weekday, slotId)

  if (!slot) {
    return <Missing>Not on this day.</Missing>
  }

  const { routine } = resolveSlot(store.routines, slot)
  if (!routine) {
    return <Missing>Not found.</Missing>
  }

  const loop = clampLoopWeeks(store.schedule?.loopWeeks)
  const extra = `${weekdayName(weekday)}${loop > 1 ? ` · week ${week + 1}` : ''}`
  const dayPath = `/schedule/${week}/${weekday}`
  const paths = navForBase(`${dayPath}/${slotId}`, from && from.split('?')[0] === dayPath ? from : dayPath, {
    extra,
    showDelete: false,
  })

  return (
    <RoutineScreens
      routineId={routine.id}
      paths={paths}
      screen={screen}
      itemId={itemId}
      exerciseId={exerciseId}
    />
  )
}
