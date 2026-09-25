import { useEffect, useState } from 'react'
import { roleTag } from '../../ids'
import { go } from '../../route'
import { finishedForPlan } from '../../current-workout'
import { dateKey, planDateFor } from '../../schedule'
import { findRoutine } from '../../storage'
import { useStore } from '../../store-context'
import { startOrContinue } from '../../workout-actions'
import { allItemsDone, autoCompleteArmed, itemAllSkipped, itemIsMarkedDone, itemKey, itemLoggingState } from '../../workout-log'
import { Back, Missing } from '../shared'
import { Button, List, NavLink, Row, Screen, Textarea, Title } from '../../ui/index.jsx'
import { activeNote } from '../../workout-note.js'
import { weekdayDate } from '../history/helpers'
import { MissingItem, NotInWorkout } from './helpers'
import { abandonWorkout, exerciseName, findItem, isActiveFor, itemCurrentPath } from './workout-helpers.js'
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

export function Workout({ routineId, scheduleSlotId = null, date = null }) {
  const store = useStore()
  // req-107 — the "Add note" reveal (req-26/req-80 pattern). Tapping opens the field
  // for this mount; once the note has text it stays shown on every visit.
  const [noteOpen, setNoteOpen] = useState(false)
  const { routine } = findRoutine(store.routines, routineId)
  const active = store.activeWorkout
  const mine = isActiveFor(active, routineId)
  const plan = !mine
    ? store.getPlannedWorkout({
        routineId,
        // req-114 — local today, not the UTC date (00:00–02:00 in Sweden was yesterday).
        date: planDateFor(date),
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
    // req-116 — the guard for Back after Finish: an occurrence that already has a
    // finished workout shows Done and a link to it in History, never a fresh Start.
    const done = finishedForPlan(store.workouts, plan)
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
        {done ? (
          <>
            <p className="ui-sub">Done {weekdayDate(dateKey(done.finishedAt))}</p>
            <p>
              <NavLink to={`/history/${done.id}`} chevron="forward">
                View in History
              </NavLink>
            </p>
          </>
        ) : plan.items.length ? (
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
            <NavLink to={scheduleSlotId && date ? `/workout/${routineId}/${scheduleSlotId}/${date}/setup` : `/workout/${routineId}/setup`} chevron="forward">
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
  // req-105 — the test lives in workout-log.js (allItemsDone) and also drives Finish.
  // req-116 — the summary's gate is autoCompleteArmed: all done, something logged (an
  // all-skipped workout never auto-finishes, DEC-058 §4), and not yet dismissed. Cancel
  // and Edit set the persisted autoFinishDismissed flag, so Back from Finish (a remount)
  // and a reload no longer re-arm the countdown.
  const allDone = allItemsDone(active)
  if (autoCompleteArmed(active)) {
    return (
      <AutoCompleteSummary
        routineId={routineId}
        active={active}
        store={store}
        onCancel={() => store.patchActive({ autoFinishDismissed: true })}
      />
    )
  }

  return (
    <Screen className="ui-screen--rest">
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
              {/* req-109 — a done row whose sets are ALL skipped reads "skipped"; one
                  logged set and it reads done (derived from the sets, no marker). */}
              {completed ? (itemAllSkipped(active, item) ? ' · skipped' : ' · done') : ''}
            </Row>
          )
        })}
      </List>
      {/* req-107 — a workout note, kept on the active workout (its existing overallNote,
          written through patchActive) so it survives leaving, logging and reloading.
          The Finish screen shows and edits the same note. autoFocus only when opened
          by tapping; a note that already has text renders the field without it. */}
      {noteOpen || activeNote(active) ? (
        <Textarea
          label="Note"
          value={activeNote(active)}
          onChange={(e) => store.patchActive({ overallNote: e.target.value })}
          rows={3}
          autoFocus={noteOpen}
        />
      ) : (
        <Button variant="quiet" className="ui-addnote" onClick={() => setNoteOpen(true)}>
          Add note
        </Button>
      )}
      {/* req-105 — Finish is a bottom button above Abandon, not a list row (it read as
          another exercise). Secondary while work is left; primary once every exercise is
          done (i.e. after the auto-complete summary is cancelled). It navigates without
          writing, so per DEC-040 it's a NavLink wearing the button look, not a Button. */}
      <div className="ui-workout-end">
        <NavLink to={`/workout/${routineId}/finish`} look={allDone ? 'primary' : 'secondary'} block>
          Finish
        </NavLink>
        <Button variant="quiet" block onClick={() => abandonWorkout(store)}>
          Abandon
        </Button>
      </div>
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

  if (!mine) return <NotInWorkout routineId={routineId} />
  if (!item) return <MissingItem />
  return null
}
