import { useEffect } from 'react'
import { LOOP_WEEKS, WEEKDAY_ORDER, weekdayName } from '../ids'
import { clampLoopWeeks, loopWeekIndex, resolveSlot, slotsForWeekDay } from '../schedule'
import { go } from '../route'
import { useStore } from '../store-context'
import { Back } from './shared'

function dayHref(week, weekday, extra = '') {
  return `#/schedule/${week}/${weekday}${extra}`
}

function slotLabel(routines, slot) {
  const resolved = resolveSlot(routines, slot)
  if (!resolved.routine) return 'Missing routine'
  return resolved.routine.name
}

function slotRoutineId(slot) {
  return slot.routineId || slot.sessionId
}

function activeRoutines(store) {
  return (store.routines || []).filter((routine) => !routine.archivedAt)
}

export function Schedule() {
  const store = useStore()
  const schedule = store.schedule || { loopWeeks: 1, slots: [] }
  const loop = clampLoopWeeks(schedule.loopWeeks)
  const currentWeek = loopWeekIndex(schedule)
  const routines = activeRoutines(store)

  return (
    <section>
      <h1>Schedule</h1>
      <p>Open a day to put routines on it. Sets, kg, and rest live on the routine.</p>
      <p>
        <a href="#/schedule/loop">Loop every {loop} week{loop === 1 ? '' : 's'}</a>
      </p>
      {Array.from({ length: loop }, (_, week) => (
        <article key={week}>
          {loop > 1 ? (
            <h2>
              Week {week + 1} of {loop}
              {week === currentWeek ? ' (this week)' : ''}
            </h2>
          ) : null}
          <ul>
            {WEEKDAY_ORDER.map((weekday) => {
              const slots = slotsForWeekDay(schedule, week, weekday)
              const names = slots.map((slot) => slotLabel(routines, slot)).join(', ')
              return (
                <li key={weekday}>
                  <a href={dayHref(week, weekday)}>{weekdayName(weekday)}</a>
                  {' — '}
                  {names || 'Rest'}
                </li>
              )
            })}
          </ul>
        </article>
      ))}
      {routines.length === 0 ? (
        <p>
          No routines yet. <a href="#/routines">Create one</a>.
        </p>
      ) : null}
    </section>
  )
}

export function ScheduleLoop() {
  const store = useStore()
  const loop = clampLoopWeeks(store.schedule?.loopWeeks)

  return (
    <section>
      <Back />
      <h1>Loop length</h1>
      <p>How many weeks until the weekdays repeat.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const value = Number(new FormData(e.target).get('loop'))
          const removed = (store.schedule?.slots || []).filter(
            (slot) => Number(slot.week) >= value,
          ).length
          if (removed && !window.confirm(`Shortening the loop will remove ${removed} scheduled routine${removed === 1 ? '' : 's'}. Continue?`)) {
            return
          }
          store.setLoopWeeks(value)
          go('/schedule')
        }}
      >
        <p>
          <label>
            Weeks
            <br />
            <select name="loop" defaultValue={loop}>
              {LOOP_WEEKS.map((n) => (
                <option key={n} value={n}>
                  {n} week{n === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </label>
        </p>
        <p>
          <button type="submit">Save</button>{' '}
          <button type="button" onClick={() => go('/schedule')}>Cancel</button>
        </p>
      </form>
    </section>
  )
}

export function ScheduleDay({ week, weekday }) {
  const store = useStore()
  const routines = activeRoutines(store)
  const slots = slotsForWeekDay(store.schedule, week, weekday)
  const loop = clampLoopWeeks(store.schedule?.loopWeeks)

  return (
    <section>
      <Back />
      <h1>
        {weekdayName(weekday)}
        {loop > 1 ? ` · week ${week + 1}` : ''}
      </h1>
      {slots.length === 0 ? <p>Nothing on this day.</p> : null}
      <ul>
        {slots.map((slot) => (
          <li key={slot.id}>
            <a href={dayHref(week, weekday, `/${slot.id}`)}>{slotLabel(routines, slot)}</a>{' '}
            <button type="button" onClick={() => store.removeSlot(slot.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <p>
        {routines.length === 0 ? (
          <a href="#/routines">Add a routine first</a>
        ) : (
          <a href={dayHref(week, weekday, '/add')}>Add routine</a>
        )}
      </p>
      <p>
        <button type="button" onClick={() => go('/schedule')}>
          Done
        </button>
      </p>
    </section>
  )
}

export function ScheduleDayAdd({ week, weekday }) {
  const store = useStore()
  const routines = activeRoutines(store)

  return (
    <section>
      <Back />
      <h1>Add routine</h1>
      <p>Pick the routine for {weekdayName(weekday)}.</p>
      {routines.length === 0 ? (
        <p>
          No routines. <a href="#/routines">Create one</a>.
        </p>
      ) : (
        <ul>
          {routines.map((routine) => {
            const assigned = (store.schedule?.slots || []).some(
              (slot) =>
                Number(slot.week) === Number(week) &&
                Number(slot.weekday) === Number(weekday) &&
                slotRoutineId(slot) === routine.id,
            )
            return (
              <li key={routine.id}>
                <button
                  type="button"
                  disabled={assigned}
                  onClick={() => {
                    store.addSlot({ week, weekday, routineId: routine.id })
                    go(`/schedule/${week}/${weekday}`)
                  }}
                >
                  {routine.name}
                </button>{' '}
                ({routine.focus}, {routine.exercises.length} exercises)
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function slotOnDay(schedule, week, weekday, slotId) {
  return slotsForWeekDay(schedule, week, weekday).find((s) => s.id === slotId) || null
}

export function ScheduleSlot({ week, weekday, slotId }) {
  const store = useStore()
  const slot = slotOnDay(store.schedule, week, weekday, slotId)

  if (!slot) {
    return (
      <section>
        <p>Routine not on this day.</p>
        <Back />
      </section>
    )
  }

  const { routine } = resolveSlot(store.routines, slot)
  if (!routine) {
    return (
      <section>
        <p>Routine not found.</p>
        <Back />
      </section>
    )
  }

  return (
    <section>
      <Back />
      <h1>{routine.name}</h1>
      <p>
        {weekdayName(weekday)}
        {clampLoopWeeks(store.schedule?.loopWeeks) > 1 ? ` · week ${week + 1}` : ''}
      </p>
      <p>{routine.focus} · {routine.exercises.length} exercises</p>
      <p>
        <a href={`#/routines/${routine.id}`}>Open routine</a>
      </p>
    </section>
  )
}

export function SchedulePlanItem({ week, weekday, slotId }) {
  const store = useStore()
  const slot = slotOnDay(store.schedule, week, weekday, slotId)
  const dayPath = `/schedule/${week}/${weekday}`
  const { routine } = slot ? resolveSlot(store.routines, slot) : { routine: null }
  const target = routine ? `/routines/${routine.id}` : dayPath

  useEffect(() => {
    go(target)
  }, [target])

  return (
    <section>
      <Back />
      <p>Exercise details live on the routine. Opening it.</p>
    </section>
  )
}
