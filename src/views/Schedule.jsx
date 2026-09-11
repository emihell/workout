import { LOOP_WEEKS, WEEKDAY_ORDER, weekdayName } from '../ids'
import { clampLoopWeeks, loopWeekIndex, resolveSlot, slotsForWeekDay } from '../schedule'
import { go } from '../route'
import { useStore } from '../store-context'
import { RoutineNewForm, RoutineScreens, navForBase } from './Routine'
import { Back, Missing, NavLink } from './shared'
import { Button, List, Row, Screen, SectionHeader, Select, Title } from '../ui/index.jsx'

function dayPathOf(week, weekday, extra = '') {
  return `/schedule/${week}/${weekday}${extra}`
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
    <Screen>
      <Title>Schedule</Title>
      <p>
        <NavLink to="/schedule/loop">
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
              return (
                <Row key={weekday} to={dayPathOf(week, weekday)}>
                  {weekdayName(weekday)} — {names || 'Rest'}
                </Row>
              )
            })}
          </List>
        </div>
      ))}
      {routines.length === 0 ? <p className="ui-sub">No routines.</p> : null}
    </Screen>
  )
}

export function ScheduleLoop() {
  const store = useStore()
  const loop = clampLoopWeeks(store.schedule?.loopWeeks)

  return (
    <Screen>
      <Back />
      <Title>Loop</Title>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const value = Number(new FormData(e.target).get('loop'))
          const removed = (store.schedule?.slots || []).filter((slot) => Number(slot.week) >= value).length
          if (removed && !window.confirm(`Remove ${removed} scheduled routine${removed === 1 ? '' : 's'}?`)) {
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
        <div className="ui-actions">
          <NavLink to="/schedule">Cancel</NavLink>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </form>
    </Screen>
  )
}

export function ScheduleDay({ week, weekday }) {
  const store = useStore()
  const routines = activeRoutines(store)
  const slots = slotsForWeekDay(store.schedule, week, weekday)
  const loop = clampLoopWeeks(store.schedule?.loopWeeks)

  return (
    <Screen>
      <Back />
      <Title>
        {weekdayName(weekday)}
        {loop > 1 ? ` · week ${week + 1}` : ''}
      </Title>
      {slots.length === 0 ? <p className="ui-sub">None.</p> : null}
      <List>
        {slots.map((slot) => (
          <Row
            key={slot.id}
            action={
              <Button
                onClick={() => {
                  if (!window.confirm(`Remove ${slotLabel(routines, slot)}?`)) return
                  store.removeSlot(slot.id)
                }}
              >
                Remove
              </Button>
            }
          >
            <NavLink to={dayPathOf(week, weekday, `/${slot.id}`)}>{slotLabel(routines, slot)}</NavLink>
          </Row>
        ))}
      </List>
      <p>
        <NavLink to={dayPathOf(week, weekday, '/add')}>Add routine</NavLink>
      </p>
      <p>
        <NavLink to="/schedule">Done</NavLink>
      </p>
    </Screen>
  )
}

export function ScheduleDayAdd({ week, weekday }) {
  const store = useStore()
  const routines = activeRoutines(store)
  const dayPath = `/schedule/${week}/${weekday}`

  return (
    <Screen>
      <Back />
      <Title>Add routine</Title>
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
        <List>
          {routines.map((routine) => {
            const assigned = (store.schedule?.slots || []).some(
              (slot) =>
                Number(slot.week) === Number(week) &&
                Number(slot.weekday) === Number(weekday) &&
                slotRoutineId(slot) === routine.id,
            )
            return (
              <Row key={routine.id} value={routine.focus}>
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
