import { useEffect } from 'react'
import { roleLabel } from '../../ids'
import { go } from '../../route'
import { recordButton } from '../../analytics'
import { findRoutine } from '../../storage'
import { useStore } from '../../store-context'
import { startOrContinue } from '../../workout-actions'
import { itemIsMarkedDone, itemKey, itemLoggingState } from '../../workout-log'
import { Back, Missing, NavLink } from '../shared'
import { Button, List, Row, Screen, Title } from '../../ui/index.jsx'
import { exerciseName, findItem, isActiveFor, itemCurrentPath, MissingItem } from './helpers'
import { RestBar } from './rest'

function abandonWorkout(store) {
  if (!window.confirm('Abandon?')) return
  recordButton('abandon-workout')
  store.abandonWorkout()
  go('/')
}

export function Workout({ routineId, scheduleSlotId = null, date = null }) {
  const store = useStore()
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
        <Back />
        <Title subtitle={previewMeta}>{plan.routineName}</Title>
        <List>
          {plan.items.map((item) => (
            <Row key={item.id} value={`${item.sets} ${item.sets === 1 ? 'set' : 'sets'}`}>
              {exerciseName(item)} — {roleLabel(item.role)}
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
            <NavLink to={scheduleSlotId && date ? `/workout/${routineId}/${scheduleSlotId}/${date}/setup` : `/workout/${routineId}/setup`}>
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
        <Back />
        <Title>{active.snapshot?.routineName || active.snapshot?.sessionName || 'Workout'}</Title>
        <p className="ui-sub">No exercises.</p>
        <Button variant="quiet" block onClick={() => abandonWorkout(store)}>
          Abandon
        </Button>
      </Screen>
    )
  }

  return (
    <Screen>
      <Back />
      <RestBar />
      <Title>{active.snapshot?.routineName || active.snapshot?.sessionName || routine?.name || 'Workout'}</Title>
      <List>
        {items.map((item) => {
          const completed = itemIsMarkedDone(active, item) || itemLoggingState(active, item).plannedDone
          const path = itemCurrentPath(routineId, item, completed)
          return (
            <Row key={itemKey(item) || item.id} to={path}>
              {exerciseName(item)} — {roleLabel(item.role)}
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
