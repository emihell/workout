// req-181 (DEC-098) — "Start from a plan": days per week → each day's slots, each filled
// from the req-180 picker filtered to its pattern (or skipped) → Save once (store.applyPlan).
// One component for every step (route 'routine-plan'), so the choices survive moving
// between the steps; they are in memory only — leaving before Save writes nothing, and a
// reload starts over.
import { useEffect, useRef, useState } from 'react'
import { loadExerciseCatalog } from '../exerciseCatalog.js'
import { PLAN_DAYS, PLAN_SKIP, PLAN_TEMPLATES, SLOTS, carriedFills, slotFilters } from '../plan-templates.js'
import { go, useHashRoute } from '../route'
import { useStore } from '../store-context'
import { Actions, Button, List, NavLink, Row, Screen, SectionHeader, Title } from '../ui/index.jsx'
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
      onSave={() => {
        if (savedRef.current) return
        savedRef.current = true
        setSaving(true)
        const cleaned = fills.map((row) => (row || []).map((pick) => (pick && pick !== SKIP ? pick : null)))
        const { scheduled } = store.applyPlan({ days, fills: cleaned })
        if (scheduled) go('/')
        else setDone(true)
      }}
    />
  )
}
