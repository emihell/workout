import { useEffect, useState } from 'react'
import { roleTag } from '../../ids'
import { go } from '../../route'
import { recordButton } from '../../analytics'
import { findRoutine } from '../../storage'
import { useStore } from '../../store-context'
import { startOrContinue } from '../../workout-actions'
import { itemIsMarkedDone, itemKey, itemLoggingState } from '../../workout-log'
import { Back, Missing, NavLink } from '../shared'
import { Button, List, Row, Screen, Title } from '../../ui/index.jsx'
import { exerciseName, findItem, isActiveFor, itemCurrentPath, MissingItem } from './helpers'
import { AutoCompleteSummary } from './auto-complete'
import { RestPill } from './rest'

// req-93 — the exercise's label in the in-workout list. Main is the default and the
// substance of the session, so it shows the name only, BOLD, with no "— Main". Non-main
// roles (warm-up, finisher, cardio) keep a small, muted tag so the row reads clearly
// distinct from a main exercise. A missing role counts as main (unlabelled) — roleTag
// handles that. The `· WU set` / `· done` suffixes are appended by the caller, unchanged.
function ExerciseLabel({ item }) {
  const tag = roleTag(item.role)
  const name = exerciseName(item)
  return tag ? (
    <>
      {name} <span className="ui-role-tag">{tag}</span>
    </>
  ) : (
    <strong>{name}</strong>
  )
}

function abandonWorkout(store) {
  if (!window.confirm('Abandon?')) return
  recordButton('abandon-workout')
  store.abandonWorkout()
  go('/')
}

export function Workout({ routineId, scheduleSlotId = null, date = null }) {
  const store = useStore()
  // req-84 — once the auto-complete summary is cancelled, keep it dismissed for this
  // mount (all items are still done, so it would otherwise re-show immediately). A
  // fresh visit to the overview remounts and re-arms it — the intended "all done" cue.
  const [autoDismissed, setAutoDismissed] = useState(false)
  const { routine } = findRoutine(store.routines, routineId)
  const active = store.activeWorkout
  const mine = isActiveFor(active, routineId)
  const plan = !mine
    ? store.getPlannedWorkout({
        routineId,
        date: date || new Date().toISOString().slice(0, 10),
        scheduleSlotId,
      })
    : null

  if (!routine && !mine) {
    return <Missing>Not found.</Missing>
  }

  if (!mine) {
    if (!plan) {
      return <Missing>Not found.</Missing>
    }
    const previewMeta = [plan.focus, plan.date].filter(Boolean).join(' · ')
    return (
      <Screen>
        <Back to="/" />
        <Title subtitle={previewMeta}>{plan.routineName}</Title>
        <List>
          {plan.items.map((item) => (
            <Row key={item.id} value={`${item.sets} ${item.sets === 1 ? 'set' : 'sets'}`}>
              <ExerciseLabel item={item} />
              {item.warmup ? ' · WU set' : ''}
            </Row>
          ))}
        </List>
        {plan.items.length ? (
          <Button
            variant="primary"
            block
            onClick={() =>
              startOrContinue(store, routineId, {
                scheduledFor: plan.date,
                scheduleSlotId: plan.scheduleSlotId,
                occurrenceId: plan.occurrenceId,
                plan,
              })
            }
          >
            Start
          </Button>
        ) : (
          <p>
            <NavLink to={scheduleSlotId && date ? `/workout/${routineId}/${scheduleSlotId}/${date}/setup` : `/workout/${routineId}/setup`} className="ui-navlink" chevron="forward">
              Add exercises
            </NavLink>
          </p>
        )}
      </Screen>
    )
  }

  const items = active.snapshot?.items || []

  if (items.length === 0) {
    return (
      <Screen>
        <Back to="/" />
        <Title>{active.snapshot?.routineName || active.snapshot?.sessionName || 'Workout'}</Title>
        <p className="ui-sub">No exercises.</p>
        <Button variant="quiet" block onClick={() => abandonWorkout(store)}>
          Abandon
        </Button>
      </Screen>
    )
  }

  // req-84 — every exercise done (same per-item test the list rows use). When true the
  // overview shows the auto-complete summary instead of the list; NOT before then.
  const allDone = items.every(
    (item) => itemIsMarkedDone(active, item) || itemLoggingState(active, item).plannedDone,
  )
  if (allDone && !autoDismissed) {
    return (
      <AutoCompleteSummary
        routineId={routineId}
        active={active}
        store={store}
        onCancel={() => setAutoDismissed(true)}
      />
    )
  }

  return (
    <Screen>
      {/* req-49 — Back steps out of the in-workout hub to Today; the workout stays
          active (resume via Continue). Abandon (below) is the explicit discard. */}
      <Back to="/" />
      <RestPill />
      <Title>{active.snapshot?.routineName || active.snapshot?.sessionName || routine?.name || 'Workout'}</Title>
      <List>
        {items.map((item) => {
          const completed = itemIsMarkedDone(active, item) || itemLoggingState(active, item).plannedDone
          const path = itemCurrentPath(routineId, item, completed)
          return (
            // req-79 — completed exercises read muted (ui-row--done) so the eye lands
            // on what's left; not-done rows stay full emphasis. Order/meaning unchanged.
            <Row key={itemKey(item) || item.id} to={path} className={completed ? 'ui-row--done' : ''}>
              <ExerciseLabel item={item} />
              {completed ? ' · done' : ''}
            </Row>
          )
        })}
      </List>
      <List>
        <Row to={`/workout/${routineId}/finish`}>Finish</Row>
      </List>
      <Button variant="quiet" block onClick={() => abandonWorkout(store)}>
        Abandon
      </Button>
    </Screen>
  )
}

export function WorkoutItem({ routineId, itemId }) {
  const store = useStore()
  const active = store.activeWorkout
  const mine = isActiveFor(active, routineId)
  const item = mine ? findItem(active.snapshot?.items, itemId) : null
  const completed = Boolean(
    item && (itemIsMarkedDone(active, item) || itemLoggingState(active, item).plannedDone),
  )

  useEffect(() => {
    if (!item) return
    go(itemCurrentPath(routineId, item, completed), { replace: true })
  }, [completed, routineId, item])

  if (!mine || !item) return <MissingItem />
  return null
}
