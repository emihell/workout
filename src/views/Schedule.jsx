import { LOOP_WEEKS, WEEKDAY_ORDER, weekdayName } from '../ids'
import { clampLoopWeeks, loopWeekIndex, resolveSlot, slotsForWeekDay } from '../schedule'
import { go } from '../route'
import { useStore } from '../store-context'
import { RoutineNewForm, RoutineScreens, navForBase } from './Routine'
import { Back, Missing } from './shared'

function dayHref(week, weekday, extra = '') {
  return `#/schedule/${week}/${weekday}${extra}`
}

function slotLabel(routines, slot) {
  const resolved = resolveSlot(routines, slot)
  if (!resolved.routine) return 'Missing'
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
      <p>
        <a href="#/schedule/loop">Loop · {loop} week{loop === 1 ? '' : 's'}</a>
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
        <p>No routines.</p>
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
      <h1>Loop</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const value = Number(new FormData(e.target).get('loop'))
          const removed = (store.schedule?.slots || []).filter(
            (slot) => Number(slot.week) >= value,
          ).length
          if (removed && !window.confirm(`Remove ${removed} scheduled routine${removed === 1 ? '' : 's'}?`)) {
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
      {slots.length === 0 ? <p>None.</p> : null}
      <ul>
        {slots.map((slot) => (
          <li key={slot.id}>
            <a href={dayHref(week, weekday, `/${slot.id}`)}>{slotLabel(routines, slot)}</a>
            {' '}
            <button
              type="button"
              onClick={() => {
                if (!window.confirm(`Remove ${slotLabel(routines, slot)}?`)) return
                store.removeSlot(slot.id)
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <p>
        <a href={dayHref(week, weekday, '/add')}>Add routine</a>
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
  const dayPath = `/schedule/${week}/${weekday}`

  return (
    <section>
      <Back />
      <h1>Add routine</h1>
      {routines.length === 0 ? (
        <RoutineNewForm
          onSave={({ name, focus }) => {
            const id = store.addRoutine({ name, focus })
            store.addSlot({ week, weekday, routineId: id })
            go(dayPath)
          }}
          onCancel={() => go(dayPath)}
        />
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
                    go(dayPath)
                  }}
                >
                  {routine.name}
                </button>
                {' — '}
                {routine.focus}
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

export function ScheduleSlot({ week, weekday, slotId, screen = 'detail', itemId, exerciseId }) {
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
  const paths = navForBase(`/schedule/${week}/${weekday}/${slotId}`, `/schedule/${week}/${weekday}`, {
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
