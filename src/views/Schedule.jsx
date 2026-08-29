import { useState } from 'react'
import { LOOP_WEEKS, WEEKDAY_ORDER, formatTargets, parseTargets, weekdayName } from '../ids'
import {
  addDays,
  clampLoopWeeks,
  coveringWorkout,
  dateKey,
  loopWeekIndex,
  nextDateForSlot,
  resolveSlot,
  slotsForWeekDay,
} from '../schedule'
import { go } from '../route'
import { programById } from '../storage'
import { useStore } from '../store-context'
import { Back } from './shared'

function dayHref(week, weekday, extra = '') {
  return `#/schedule/${week}/${weekday}${extra}`
}

function slotLabel(programs, slot) {
  const resolved = resolveSlot(programs, slot)
  if (!resolved.session) return 'Missing session'
  return `${resolved.program.name} — ${resolved.session.name}`
}

export function Schedule() {
  const store = useStore()
  const schedule = store.schedule || { loopWeeks: 1, slots: [] }
  const loop = clampLoopWeeks(schedule.loopWeeks)
  const currentWeek = loopWeekIndex(schedule)
  const programs = (store.programs || []).filter((program) => !program.archivedAt)

  return (
    <section>
      <h1>Schedule</h1>
      <p>Open a day to put sessions on it and set next weights and reps. Today reads this.</p>
      <p>
        <a href="#/schedule/loop">Loop every {loop} week{loop === 1 ? '' : 's'}</a>
      </p>
      {Array.from({ length: loop }, (_, week) => (
        <article key={week}>
          <h2>
            Week {week + 1} of {loop}
            {week === currentWeek ? ' (this week)' : ''}
          </h2>
          <ul>
            {WEEKDAY_ORDER.map((weekday) => {
              const slots = slotsForWeekDay(schedule, week, weekday)
              const names = slots.map((slot) => slotLabel(programs, slot)).join(', ')
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
      {programs.length === 0 ? (
        <p>
          No programs yet. <a href="#/programs">Create one</a>.
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
      <Back to="/schedule" />
      <h1>Loop length</h1>
      <p>How many weeks until the weekdays repeat.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const value = Number(new FormData(e.target).get('loop'))
          const removed = (store.schedule?.slots || []).filter(
            (slot) => Number(slot.week) >= value,
          ).length
          if (removed && !window.confirm(`Shortening the loop will remove ${removed} scheduled session${removed === 1 ? '' : 's'}. Continue?`)) {
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
  const programs = (store.programs || []).filter((program) => !program.archivedAt)
  const slots = slotsForWeekDay(store.schedule, week, weekday)
  const loop = clampLoopWeeks(store.schedule?.loopWeeks)

  return (
    <section>
      <Back to="/schedule" />
      <h1>
        {weekdayName(weekday)}
        {loop > 1 ? ` · week ${week + 1}` : ''}
      </h1>
      {slots.length === 0 ? <p>Nothing on this day.</p> : null}
      <ul>
        {slots.map((slot) => (
          <li key={slot.id}>
            <a href={dayHref(week, weekday, `/${slot.id}`)}>{slotLabel(programs, slot)}</a>{' '}
            <button type="button" onClick={() => store.removeSlot(slot.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <p>
        {programs.length === 0 ? (
          <a href="#/programs">Add a program first</a>
        ) : (
          <a href={dayHref(week, weekday, '/add')}>Add session</a>
        )}
      </p>
    </section>
  )
}

export function ScheduleDayAdd({ week, weekday }) {
  const store = useStore()
  const activePrograms = (store.programs || []).filter((program) => !program.archivedAt)
  const programs = activePrograms.filter((p) => p.sessions.some((session) => !session.archivedAt))
  const empty = activePrograms.filter((p) => !p.sessions.some((session) => !session.archivedAt))

  return (
    <section>
      <Back to={`/schedule/${week}/${weekday}`} />
      <h1>Add session</h1>
      <p>Pick the program.</p>
      {programs.length === 0 ? (
        <p>
          {empty.length ? (
            <>
              <a href={`#/programs/${empty[0].id}`}>Add a session</a> to a program first.
            </>
          ) : (
            <>
              No programs. <a href="#/programs">Create one</a>.
            </>
          )}
        </p>
      ) : (
        <ul>
          {programs.map((p) => (
            <li key={p.id}>
              <a href={dayHref(week, weekday, `/add/${p.id}`)}>
                {p.name}
              </a>{' '}
              ({p.sessions.filter((session) => !session.archivedAt).length} sessions)
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function ScheduleDaySessions({ week, weekday, programId }) {
  const store = useStore()
  const program = programById(store.programs, programId)

  if (!program) {
    return (
      <section>
        <p>Program not found.</p>
        <Back to={`/schedule/${week}/${weekday}/add`} />
      </section>
    )
  }

  return (
    <section>
      <Back to={`/schedule/${week}/${weekday}/add`} />
      <h1>{program.name}</h1>
      <p>Pick the session for {weekdayName(weekday)}.</p>
      {program.sessions.filter((session) => !session.archivedAt).length === 0 ? (
        <p>
          <a href={`#/programs/${program.id}/session/new`}>Add a session</a> first.
        </p>
      ) : (
        <ul>
          {program.sessions.filter((session) => !session.archivedAt).map((sess) => (
            <li key={sess.id}>
              <button
                type="button"
                onClick={() => {
                  const duplicate = (store.schedule?.slots || []).some(
                    (slot) =>
                      Number(slot.week) === Number(week) &&
                      Number(slot.weekday) === Number(weekday) &&
                      slot.sessionId === sess.id,
                  )
                  if (duplicate) {
                    window.alert('That session is already assigned to this day.')
                    return
                  }
                  store.addSlot({ week, weekday, programId: program.id, sessionId: sess.id })
                  go(`/schedule/${week}/${weekday}`)
                }}
              >
                {sess.name}
              </button>{' '}
              ({sess.focus}, {sess.exercises.length} exercises)
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function slotOnDay(schedule, week, weekday, slotId) {
  return slotsForWeekDay(schedule, week, weekday).find((s) => s.id === slotId) || null
}

function nextOpenDate(store, slot) {
  let from = new Date()
  for (let i = 0; i < 6; i++) {
    const date = nextDateForSlot(store.schedule, slot, from, true)
    if (!date) return null
    const key = dateKey(date)
    if (!coveringWorkout(store.workouts, slot.sessionId, key, slot.id)) return date
    from = addDays(date, 1)
  }
  return null
}

export function ScheduleSlot({ week, weekday, slotId }) {
  const store = useStore()
  const slot = slotOnDay(store.schedule, week, weekday, slotId)
  const dayPath = `/schedule/${week}/${weekday}`

  if (!slot) {
    return (
      <section>
        <p>Session not on this day.</p>
        <Back to={dayPath} />
      </section>
    )
  }

  const { program, session } = resolveSlot(store.programs, slot)
  if (!program || !session) {
    return (
      <section>
        <p>Session not found.</p>
        <Back to={dayPath} />
      </section>
    )
  }
  const date = nextOpenDate(store, slot)
  const plan = date
    ? store.getPlannedWorkout({
        sessionId: session.id,
        date: dateKey(date),
        scheduleSlotId: slot.id,
      })
    : null

  return (
    <section>
      <Back to={dayPath} />
      <h1>
        {program.name} — {session.name}
      </h1>
      <p>
        {weekdayName(weekday)}
        {clampLoopWeeks(store.schedule?.loopWeeks) > 1 ? ` · week ${week + 1}` : ''}
      </p>
      {date ? <p>Upcoming workout: {dateKey(date)}. Changes here affect this date only.</p> : <p>No open occurrence found.</p>}
      {plan?.items.length === 0 ? <p>No exercises in this session.</p> : null}
      <ol>
        {(plan?.items || []).map((item) => {
          const kg = (item.suggestedWeights || []).some((weight) => Number(weight) > 0)
            ? item.suggestedWeights.join('/')
            : ''
          return (
            <li key={item.id}>
              <a href={`${dayHref(week, weekday, `/${slot.id}/plan/${plan.date}/item/${item.id}`)}`}>
                {item.exerciseName}
              </a>
              {' — '}
              {item.sets} set{item.sets === 1 ? '' : 's'} · {formatTargets(item.targets) || 'no targets'}
              {kg ? ` · ${kg} kg` : ''}
              {item.calibrationRequired ? ' · find starting weight' : ''}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export function SchedulePlanItem({ week, weekday, slotId, date, itemId }) {
  const store = useStore()
  const slot = slotOnDay(store.schedule, week, weekday, slotId)
  const dayPath = `/schedule/${week}/${weekday}`
  const slotPath = `/schedule/${week}/${weekday}/${slotId}`

  if (!slot) {
    return (
      <section>
        <p>Session not on this day.</p>
        <Back to={dayPath} />
      </section>
    )
  }

  const { program, session } = resolveSlot(store.programs, slot)
  if (!program || !session) {
    return (
      <section>
        <p>Session not found.</p>
        <Back to={dayPath} />
      </section>
    )
  }
  const plan = store.getPlannedWorkout({
    sessionId: session.id,
    date,
    scheduleSlotId: slot.id,
  })
  const item = plan?.items.find((candidate) => candidate.id === itemId)
  if (!plan || !item) {
    return (
      <section>
        <p>Planned exercise not found.</p>
        <Back to={slotPath} />
      </section>
    )
  }

  return (
    <PlanItemForm
      key={`${plan.id}-${item.id}`}
      plan={plan}
      item={item}
      onSave={(patch) => {
        store.savePlannedWorkout({
          ...plan,
          items: plan.items.map((candidate) =>
            candidate.id === item.id ? { ...candidate, ...patch, calibrationRequired: false } : candidate,
          ),
        })
        go(slotPath)
      }}
      backTo={slotPath}
    />
  )
}

function PlanItemForm({ plan, item, onSave, backTo }) {
  const [sets, setSets] = useState(String(item.sets || 3))
  const [targets, setTargets] = useState(formatTargets(item.targets))
  const [weights, setWeights] = useState((item.suggestedWeights || []).join('/'))
  const [restSec, setRestSec] = useState(String(item.restSec || 0))
  const [notes, setNotes] = useState(item.notes || '')

  return (
    <section>
      <Back to={backTo} />
      <p>Scheduled workout · {plan.date} · {plan.sessionName}</p>
      <h1>{item.exerciseName}</h1>
      {item.calibrationRequired ? (
        <p>
          No history yet. Start light enough to complete the recommended reps with clean form. After each set,
          move one available weight step up if it felt very easy, hold if it felt moderate, or move down if
          you missed reps or reached failure.
        </p>
      ) : (
        <p>{item.recommendationReason}</p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const count = Math.max(1, Number(sets) || 1)
          onSave({
            sets: count,
            targets: parseTargets(targets, count),
            suggestedWeights: weights
              .split(/[/,]/)
              .map((value) => Number(value.trim()))
              .filter(Number.isFinite)
              .slice(0, count),
            restSec: Math.max(0, Number(restSec) || 0),
            notes,
          })
        }}
      >
        <p><label>Sets<br /><input type="number" min="1" value={sets} onChange={(event) => setSets(event.target.value)} /></label></p>
        <p><label>Recommended reps<br /><input value={targets} onChange={(event) => setTargets(event.target.value)} /></label></p>
        <p><label>Recommended kg<br /><input value={weights} onChange={(event) => setWeights(event.target.value)} placeholder={item.calibrationRequired ? 'Leave empty and find it during the workout' : ''} /></label></p>
        <p><label>Rest (sec)<br /><input type="number" min="0" value={restSec} onChange={(event) => setRestSec(event.target.value)} /></label></p>
        <p><label>Notes<br /><input value={notes} onChange={(event) => setNotes(event.target.value)} /></label></p>
        <p><button type="submit">Save</button> <button type="button" onClick={() => go(backTo)}>Cancel</button></p>
      </form>
    </section>
  )
}
