import { formatSetLine, roleTag } from '../../ids'
import { childLink, go } from '../../route'
import { exerciseById, routineById } from '../../model.js'
import { durationLabel, groupSetsByExercise, workoutVolume } from '../../history-queries.js'
import { useStore } from '../../store-context'
import { loggedSetCount } from '../../workout-log'
import { Back, Missing } from '../shared'
import { Button, List, NavLink, Row, Screen, SectionHeader, Title } from '../../ui/index.jsx'
import { historyAddSetPath } from './add-set'
import {
  historyGroupRowMeta,
  itemIdOf,
  routineTitle,
  whenLabel,
  workoutRoutineId,
  workoutRoutineName,
} from './helpers'
import { snapshotItemFor } from './snapshot-item.js'
import { historyDetailBack, historyDetailPath, historyExerciseBack, historyExercisePath } from './return-paths.js'
import { historySetKind } from '../set-values.js'
import { askConfirm } from '../../ui/confirm.js'

export function HistoryDetail({ workoutId, from = null }) {
  const store = useStore()
  const workout = store.workouts.find((x) => x.id === workoutId)
  if (!workout) {
    return <Missing>Not found.</Missing>
  }

  const routine = routineById(store.routines, workoutRoutineId(workout))
  const snapshot = workout.snapshot
  const sets = workout.sets || []
  const groups = groupSetsByExercise(sets, {
    exercises: snapshot?.items || routine?.exercises || [],
  })

  // req-171 — opened from Today, a month list or an overview: Back returns there.
  const here = historyDetailPath(workout.id)
  return (
    <Screen>
      <Back to={historyDetailBack(from)} />
      <Title>
        {snapshot
          ? snapshot.programName
            ? `${snapshot.programName} — ${workoutRoutineName(workout, routine)}`
            : workoutRoutineName(workout, routine)
          : routineTitle(null, routine)}
      </Title>
      <p className="ui-sub">
        {[
          whenLabel(workout),
          durationLabel(workout.startedAt, workout.finishedAt),
          // req-116 — skipped sets aren't counted, matching Finish and the summary.
          `${loggedSetCount(workout)} sets`,
          `${workoutVolume(workout)} kg`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <p className="ui-sub">
        {workout.overallFeel ? `${workout.overallFeel} · ` : ''}
        <NavLink to={childLink(`${here}/edit`, here, from)} chevron="forward">Edit</NavLink>
      </p>
      {workout.overallNote ? <p className="ui-sub">{workout.overallNote}</p> : null}

      <SectionHeader>Exercises</SectionHeader>
      {groups.length === 0 ? <p className="ui-sub">None.</p> : null}
      <List>
        {groups.map((group) => {
          const ex = exerciseById(store.exercises, group.exerciseId)
          // req-109 — id first, exerciseId only as the fallback (snapshot-item.js).
          const snapshotItem = snapshotItemFor(snapshot?.items, group.routineItemId, group.exerciseId)
          return (
            <Row key={group.routineItemId} to={childLink(historyExercisePath(workout.id, group.routineItemId), here, from)}>
              {snapshotItem?.exerciseName || ex?.name || group.exerciseId}
              {` — ${historyGroupRowMeta(snapshotItem, group.items)}`}
            </Row>
          )
        })}
      </List>
      <p>
        <NavLink to={childLink(`${here}/set/new`, here, from)} chevron="forward">Add set</NavLink>
      </p>

      {/* req-96 — the "Next time" load-recommendation surface was removed here (and on
          the Finish screen): at the time it only moved with an RPE signal the app didn't
          log, so it just echoed the workout. (req-165: Effort is logged on work sets now;
          the recommendation lives on History → correct → "Update?", DEC-056.)
          req-158 — the record's `progression` field is no longer written on Finish (older
          workouts keep theirs; nothing reads it). History detail gets no "beat last time"
          line — it's a past record, not a forward celebration (decided). */}
      <Button
        onClick={async () => {
          if (!(await askConfirm(`Delete ${workoutRoutineName(workout, routine)}?`, { confirmLabel: 'Delete' }))) return
          store.removeWorkout(workout.id)
          go(historyDetailBack(from))
        }}
      >
        Delete
      </Button>
    </Screen>
  )
}

export function HistoryWorkoutExercise({ workoutId, exerciseId, from = null }) {
  const store = useStore()
  const workout = store.workouts.find((x) => x.id === workoutId)
  // req-109 — the route param is an item id (or a legacy exerciseId): id first.
  const snapshotItem = snapshotItemFor(workout?.snapshot?.items, exerciseId)
  const actualExerciseId = snapshotItem?.exerciseId || exerciseId
  const ex = exerciseById(store.exercises, actualExerciseId)
  const items = (workout?.sets || [])
    .map((s, index) => ({ s, index }))
    .filter((x) =>
      snapshotItem
        ? itemIdOf(x.s) === itemIdOf(snapshotItem)
        : x.s.exerciseId === exerciseId,
    )

  if (!workout) {
    return <Missing>Not found.</Missing>
  }

  const here = historyExercisePath(workout.id, exerciseId)
  return (
    <Screen>
      <Back to={historyExerciseBack(workout.id, from)} />
      <Title>{snapshotItem?.exerciseName || ex?.name || exerciseId}</Title>
      <p className="ui-sub">
        {/* req-128 — req-93 rule: main unlabelled (roleTag), non-main tagged. */}
        {[roleTag(snapshotItem?.role), snapshotItem?.warmup ? 'WU set' : null, whenLabel(workout)]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {items.length === 0 ? <p className="ui-sub">None.</p> : null}
      <List>
        {items.map(({ s, index }) => (
          <Row key={index} to={childLink(`/history/${workout.id}/set/${index}`, here, from)}>
            {/* req-163 — no effort label on a warm-up or cardio set (DEC-087 §2, display only). */}
            {formatSetLine(s, { cardio: historySetKind(snapshotItem, ex).cardio })}
            {s.note ? ` — ${s.note}` : ''}
          </Row>
        ))}
      </List>
      {/* req-117 — opens the add form (unsaved until Save); was a Button that wrote a
          placeholder set first. Navigation, so it wears the link treatment (DESIGN §4). */}
      <p>
        <NavLink
          to={childLink(historyAddSetPath(workout, actualExerciseId, itemIdOf(snapshotItem) || null), here, from)}
          chevron="forward"
        >
          Add set
        </NavLink>
      </p>
    </Screen>
  )
}
