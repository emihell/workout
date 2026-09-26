// req-181 (DEC-098) — "Start from a plan": days per week → each day's slots, each filled
// from the req-180 picker filtered to its pattern (or skipped) → Save once (store.applyPlan).
// One component for every step (route 'routine-plan'), so the choices survive moving
// between the steps; they are in memory only — leaving before Save writes nothing, and a
// reload starts over.
import { useEffect, useState } from 'react'
import { loadExerciseCatalog } from '../exerciseCatalog.js'
import { PLAN_DAYS, PLAN_TEMPLATES, SLOTS, slotFilters } from '../plan-templates.js'
import { go, useHashRoute } from '../route'
import { useStore } from '../store-context'
import { Actions, Button, List, NavLink, Row, Screen, SectionHeader, Title } from '../ui/index.jsx'
import { ExercisePicker } from './ExercisePicker'
import { Back } from './shared'

const BASE = '/routines/new/plan'
const SKIP = 'skip'

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

function Fill({ days, fills, onSave }) {
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
              const pick = fills[r]?.[s]
              return (
                <Row key={key} to={`${BASE}/${days}/${r}/${s}`}>
                  <span className="ui-row__stack">
                    <span>{SLOTS[key].label}</span>
                    <span className="ui-row__meta">
                      {pick === SKIP ? 'Skipped' : pick ? `${pick.name} · ${pick.label}` : 'Choose'}
                    </span>
                  </span>
                </Row>
              )
            })}
          </List>
        </section>
      ))}
      <Actions
        retreat={<NavLink to="/routines/new" look="secondary">Cancel</NavLink>}
        forward={
          <Button variant="primary" disabled={chosen === 0} onClick={onSave}>
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
      <Title>Routines made</Title>
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
  const days = PLAN_TEMPLATES[route.days] ? route.days : null

  if (done) return <Done />
  if (!days) return <DaysChoice />
  const fills = byDays[days] || []
  const setFill = (r, s, pick) =>
    setByDays((all) => {
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
      onSave={() => {
        const cleaned = fills.map((row) => (row || []).map((pick) => (pick && pick !== SKIP ? pick : null)))
        const { scheduled } = store.applyPlan({ days, fills: cleaned })
        if (scheduled) go('/')
        else setDone(true)
      }}
    />
  )
}
