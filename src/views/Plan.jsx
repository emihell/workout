// req-181 (DEC-098) — "Start from a plan": days per week → each day's slots, each filled
// from the req-180 picker filtered to its pattern (or skipped) → Save once (store.applyPlan).
// One component for every step (route 'routine-plan'), so the choices survive moving
// between the steps; they are in memory only — leaving before Save writes nothing, and a
// reload starts over.
import { useEffect, useRef, useState } from 'react'
import { loadExerciseCatalog } from '../exerciseCatalog.js'
import {
  PLAN_DAYS,
  PLAN_SKIP,
  PLAN_TEMPLATES,
  SLOTS,
  SPLIT_AB,
  SPLIT_SAME,
  WEEKDAYS_MON_FIRST,
  WEEKDAY_SHORT,
  carriedFills,
  emptyDaySheetText,
  machinesPlan,
  nextWorkoutNames,
  planDaysText,
  slotFilters,
  startTodayWeek,
} from '../plan-templates.js'
import { go, useHashRoute } from '../route'
import { useStore } from '../store-context'
import { askChoice } from '../ui/confirm.js'
import { Actions, Button, Field, List, NavLink, Row, Screen, SectionHeader, SegmentedControl, Title } from '../ui/index.jsx'
import { ExercisePicker } from './ExercisePicker'
import { Back } from './shared'

const BASE = '/routines/new/plan'
const SKIP = PLAN_SKIP

function daysLabel(n) {
  return `${n} ${n === 1 ? 'day' : 'days'} a week`
}

function DaysChoice() {
  return (
    <Screen>
      <Back to="/routines/new" />
      <Title>Start from a plan</Title>
      <p className="ui-sub">How many days a week?</p>
      <List>
        {PLAN_DAYS.map((n) => {
          const template = PLAN_TEMPLATES[n]
          return (
            <Row key={n} to={`${BASE}/${n}`}>
              <span className="ui-row__stack">
                <span>
                  {daysLabel(n)} — {template.label}
                </span>
                {template.routines.map((routine) => (
                  <span key={routine.name} className="ui-row__meta">
                    {routine.name}: {routine.slots.map((key) => SLOTS[key].label).join(' · ')}
                  </span>
                ))}
              </span>
            </Row>
          )
        })}
      </List>
    </Screen>
  )
}

function SlotPick({ days, r, s, onPick }) {
  const template = PLAN_TEMPLATES[days]
  const slot = SLOTS[template.routines[r]?.slots[s]]
  const back = `${BASE}/${days}`
  // The slot's filters need the library (own exercises match by libraryId → pattern).
  // If it can't load, the picker says so and searches your own exercises unfiltered.
  const [library, setLibrary] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    loadExerciseCatalog()
      .then((list) => !cancelled && setLibrary(list))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [])

  const filters = library ? slotFilters(slot.patterns, library) : {}
  return (
    <Screen>
      <Back to={back} />
      <p className="ui-sub">{template.routines[r].name}</p>
      <Title>{slot.label}</Title>
      {library || failed ? (
        <ExercisePicker
          cancelTo={back}
          max={1}
          addLabel={() => 'Use'}
          ownFilter={filters.ownFilter}
          libraryFilter={filters.libraryFilter}
          lateral={
            <Button
              onClick={() => {
                onPick(SKIP)
                go(back)
              }}
            >
              Skip
            </Button>
          }
          onPick={([pick]) => {
            onPick(pick)
            go(back)
          }}
        />
      ) : (
        <p className="ui-sub">Loading…</p>
      )}
    </Screen>
  )
}

function Fill({ days, fills, onSave, saving }) {
  const template = PLAN_TEMPLATES[days]
  const chosen = fills.flat().filter((pick) => pick && pick !== SKIP).length
  return (
    <Screen>
      <Back to={BASE} />
      <Title>{daysLabel(days)}</Title>
      <p className="ui-sub">Choose an exercise for each slot, or skip it. Nothing is saved until Save.</p>
      {template.routines.map((routine, r) => (
        <section key={routine.name}>
          <SectionHeader>{routine.name}</SectionHeader>
          <List>
            {routine.slots.map((key, s) => {
              // req-182 — a picked slot leads with the exercise; the slot is the meta.
              const pick = fills[r]?.[s]
              const picked = pick && pick !== SKIP
              return (
                <Row key={key} to={`${BASE}/${days}/${r}/${s}`}>
                  <span className="ui-row__stack">
                    <span>{picked ? pick.name : SLOTS[key].label}</span>
                    <span className="ui-row__meta">
                      {picked ? `${SLOTS[key].label} · ${pick.label}` : pick === SKIP ? 'Skipped' : 'Choose'}
                    </span>
                  </span>
                </Row>
              )
            })}
          </List>
        </section>
      ))}
      {/* req-181 QA — pinned above the dock like the picker's bar: unpinned, a tap aimed at
          Save mid-scroll hit the dock's Workout link and dropped the unsaved plan. */}
      <Actions
        className="ui-picker-bar"
        retreat={<NavLink to="/routines/new" look="secondary">Cancel</NavLink>}
        forward={
          <Button variant="primary" disabled={chosen === 0 || saving} onClick={onSave}>
            Save
          </Button>
        }
      />
    </Screen>
  )
}

function Done() {
  return (
    <Screen>
      <Title>Workouts made</Title>
      <p>Your schedule already has days, so it was left as it is.</p>
      <p>
        <NavLink to="/schedule" look="primary" block>
          Add them to your schedule
        </NavLink>
      </p>
      <p>
        <NavLink to="/" look="secondary" block>
          Home
        </NavLink>
      </p>
    </Screen>
  )
}

export function RoutinePlan() {
  const store = useStore()
  const route = useHashRoute()
  // { [days]: fills[r][s] = pick | 'skip' | undefined } — per day count, so switching back
  // to another count keeps what was chosen there.
  const [byDays, setByDays] = useState({})
  const [done, setDone] = useState(false)
  // req-181 review — Save navigates Home on a later hashchange, so the enabled Save stays
  // mounted for a moment: a second tap would write a second set of routines. The ref blocks
  // a tap in the same tick (before any re-render); `saving` disables the button after.
  const savedRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const days = PLAN_TEMPLATES[route.days] ? route.days : null

  if (done) return <Done />
  if (!days) return <DaysChoice />
  // req-182 — what the screen shows and Save saves: the explicit choices, with each unset
  // slot carrying the same slot's pick from an earlier day (carriedFills).
  const explicit = byDays[days] || []
  const fills = carriedFills(days, explicit)
  const setFill = (r, s, pick) =>
    setByDays((all) => {
      // Explicit choices only: a carried pick becomes explicit only when the user picks it.
      const next = (all[days] || []).map((row) => [...(row || [])])
      while (next.length <= r) next.push([])
      next[r][s] = pick
      return { ...all, [days]: next }
    })

  const [r, s] = route.slot || []
  if (route.slot && PLAN_TEMPLATES[days].routines[r]?.slots[s]) {
    return <SlotPick key={`${days}-${r}-${s}`} days={days} r={r} s={s} onPick={(pick) => setFill(r, s, pick)} />
  }
  return (
    <Fill
      days={days}
      fills={fills}
      saving={saving}
      onSave={async () => {
        if (savedRef.current) return
        savedRef.current = true
        setSaving(true)
        const cleaned = fills.map((row) => (row || []).map((pick) => (pick && pick !== SKIP ? pick : null)))
        // req-190 §4 — a day with no exercises is answered before anything is written.
        // Back (or backdrop / Escape) leaves the fill screen as it was, nothing saved.
        const sheet = emptyDaySheetText(days, cleaned)
        let empty = null
        if (sheet) {
          empty = await askChoice(sheet.message, { title: sheet.title, choices: sheet.choices, cancelLabel: 'Back' })
          if (!empty) {
            savedRef.current = false
            setSaving(false)
            return
          }
        }
        const { scheduled } = store.applyPlan({ days, fills: cleaned, empty })
        if (scheduled) go('/')
        else setDone(true)
      }}
    />
  )
}

// ---- req-190 (DEC-105 §1) — machines first: "Which exercises do you do?" → days a week →
// (2+ days) the same workout or A/B → Save (store.applyPlan with { days, split, picks }).
// One component for both steps (route 'routine-machines'), choices in memory only: Cancel
// or Back at any step, or a reload, writes nothing.

const MACHINES = '/routines/new/machines'

function Choice({ name, checked, onChange, children }) {
  return (
    <Row>
      <label className="ui-check">
        <input className="ui-check__box" type="radio" name={name} checked={checked} onChange={onChange} />
        <span>{children}</span>
      </label>
    </Row>
  )
}

// req-207 (DEC-116) — the days the plan suggests for `n` days a week, starting today (DEC-105):
// the template's spacing shifted to today's weekday. The chips start ticked on these.
function suggestedWeekdays(n, now) {
  const template = PLAN_TEMPLATES[n]
  return template ? startTodayWeek(template.week, now).map(([weekday]) => weekday) : []
}

// req-207 — the 7 weekday chips, Mon–Sun: each a toggle (aria-pressed), styled as the
// segmented control's segments.
function WeekdayChips({ value, onToggle }) {
  return (
    <div className="ui-seg" role="group" aria-label="Days">
      {WEEKDAYS_MON_FIRST.map((weekday) => {
        const on = value.includes(weekday)
        return (
          <button
            key={weekday}
            type="button"
            aria-pressed={on}
            className={`ui-seg__item${on ? ' is-selected' : ''}`}
            onClick={() => onToggle(weekday)}
          >
            {WEEKDAY_SHORT[weekday]}
          </button>
        )
      })}
    </div>
  )
}

function MachinesDays({ picks, routines, schedule, saving, onSave }) {
  const [days, setDays] = useState(null)
  const [split, setSplit] = useState(SPLIT_SAME)
  const [weekdays, setWeekdays] = useState([])
  // req-207 (DEC-116) — the name boxes' prefill, "New workout #N" (and the next free one),
  // fixed when the step opens; an emptied box saves its prefill.
  const [prefill] = useState(() => nextWorkoutNames(routines, 2))
  const [typed, setTyped] = useState(prefill)
  // A/B needs two picks (B would be empty); one day is always one workout.
  const ab = split === SPLIT_AB && days >= 2 && picks.length >= 2
  const emptySchedule = (schedule?.slots || []).length === 0
  const names = prefill.map((name, r) => typed[r].trim() || name)
  // The days are picked only when they go on the schedule (an empty one); otherwise the
  // schedule stays as it is and there is nothing to pick.
  const choices = days
    ? { days, split: ab ? SPLIT_AB : SPLIT_SAME, picks, names, ...(emptySchedule ? { weekdays } : {}) }
    : null
  const plan = choices ? machinesPlan(choices) : null
  const daysOk = !emptySchedule || weekdays.length === days
  // The preview reads today's clock; Save's planToState gets the store's `now` (the same day).
  const today = new Date().getDay()
  const week = plan ? plan.week : []
  return (
    <Screen>
      <Back to={MACHINES} />
      <Title>How many days a week?</Title>
      <SegmentedControl
        ariaLabel="Days a week"
        options={PLAN_DAYS.map((n) => ({ value: n, label: String(n) }))}
        value={days ?? ''}
        onChange={(value) => {
          setDays(Number(value))
          setWeekdays(suggestedWeekdays(Number(value), new Date()))
        }}
      />
      {days && emptySchedule ? (
        <>
          <WeekdayChips
            value={weekdays}
            onToggle={(weekday) =>
              setWeekdays((list) => (list.includes(weekday) ? list.filter((d) => d !== weekday) : [...list, weekday]))
            }
          />
          {daysOk ? null : <p className="ui-sub">{`Pick ${days} ${days === 1 ? 'day' : 'days'}`}</p>}
        </>
      ) : null}
      {days >= 2 ? (
        <List>
          <Choice name="split" checked={!ab} onChange={() => setSplit(SPLIT_SAME)}>
            Same workout every time
          </Choice>
          {picks.length >= 2 ? (
            <Choice name="split" checked={ab} onChange={() => setSplit(SPLIT_AB)}>
              Two workouts, A and B
            </Choice>
          ) : null}
        </List>
      ) : null}
      {plan
        ? plan.routines.map((routine, r) => (
            <section key={r}>
              <SectionHeader>{routine.name}</SectionHeader>
              {emptySchedule && daysOk ? (
                <p className="ui-sub">
                  {/* req-191 §4 — "Starts today (Tue), then every Tue and Fri" (was "Today, Fri"). */}
                  {planDaysText(
                    week.filter(([, at]) => at === r).map(([weekday]) => weekday),
                    today,
                  )}
                </p>
              ) : null}
              <List>
                {routine.picks.map((pick) => (
                  <Row key={pick.kind === 'own' ? pick.exerciseId : pick.data.libraryId || pick.name}>
                    <span className="ui-row__stack">
                      <span>{pick.name}</span>
                      <span className="ui-row__meta">{pick.label}</span>
                    </span>
                  </Row>
                ))}
              </List>
            </section>
          ))
        : null}
      {plan && !emptySchedule ? <p className="ui-sub">Your schedule already has days, so it stays as it is.</p> : null}
      {/* req-207 (DEC-116) — the name last, just above Save. */}
      {plan
        ? plan.routines.map((_, r) => (
            <Field
              key={r}
              label={ab ? `Name ${r === 0 ? 'A' : 'B'}` : 'Name'}
              value={typed[r]}
              onChange={(e) => {
                const value = e.target.value
                setTyped((list) => list.map((old, at) => (at === r ? value : old)))
              }}
            />
          ))
        : null}
      <Actions
        className="ui-picker-bar"
        retreat={<NavLink to="/routines/new" look="secondary">Cancel</NavLink>}
        forward={
          <Button variant="primary" disabled={!plan || !daysOk || saving} onClick={() => onSave(choices)}>
            Save
          </Button>
        }
      />
    </Screen>
  )
}

export function RoutineMachines() {
  const store = useStore()
  const route = useHashRoute()
  // { picks (onPick's), selection (the picker's own, to reopen it ticked) } — memory only.
  const [chosen, setChosen] = useState(null)
  const [done, setDone] = useState(false)
  // As RoutinePlan: a second Save tap in the same tick writes nothing.
  const savedRef = useRef(false)
  const [saving, setSaving] = useState(false)

  if (done) return <Done />
  if (route.step === 'days' && chosen?.picks.length) {
    return (
      <MachinesDays
        picks={chosen.picks}
        routines={store.routines}
        schedule={store.schedule}
        saving={saving}
        onSave={(choices) => {
          if (savedRef.current) return
          savedRef.current = true
          setSaving(true)
          const { scheduled } = store.applyPlan(choices)
          if (scheduled) go('/')
          else setDone(true)
        }}
      />
    )
  }
  return (
    <Screen>
      <Back to="/routines/new" />
      <Title>Which exercises do you do?</Title>
      <p className="ui-sub">Tick the machines and exercises you use. Nothing is saved until Save.</p>
      <ExercisePicker
        cancelTo="/routines/new"
        initialSelection={chosen?.selection || null}
        addLabel={(n) => (n ? `Next (${n})` : 'Next')}
        onPick={(picks, selection) => {
          setChosen({ picks, selection })
          go(`${MACHINES}/days`)
        }}
      />
    </Screen>
  )
}
