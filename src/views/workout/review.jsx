// req-276 — split from views/workout/item.jsx: the exercise review (an exercise marked done).
import { useState } from 'react'
import { EFFORT_OPTIONS, isWeightedType, roleTag } from '../../ids'
import { go } from '../../route'
import { recordButton } from '../../analytics'
import { useStore } from '../../store-context'
import {
  canAddSet,
  itemEffort,
  itemEffortSets,
  itemKey,
  itemLoggingState,
  reopenItemPatch,
} from '../../workout-items.js'
import { loggedSetRowText } from '../../set-display.js'
import { nextNotDoneItem } from '../../workout-progress.js'
import { ExercisesLink } from '../shared'
import {
  Button,
  NavLink,
  Screen,
  SectionHeader,
  SegmentedControl,
  SetList,
} from '../../ui/index.jsx'
import { MissingItem, NotInWorkout } from './helpers'
import {
  exerciseName,
  findItem,
  finishTarget,
  isActiveFor,
  itemLogPath,
} from './workout-helpers.js'
import { WorkoutPill } from './rest'
import { exerciseImprovementPct, improvementText } from '../../beat-last-time.js'
import { previousSameRoutineWorkouts } from '../../history-queries.js'
import { isEachSide } from '../../library-hints.js'
import { useExerciseLibrary } from './use-library.js'
import { liveExercise, markNextArrival } from './item-actions.js'
import { ExerciseTitle, ExerciseSetupHeader } from './item-header.jsx'
import { LoggedSetSheet } from './logged-set-sheet.jsx'

// req-212 (DEC-119 §1) — the exercise review (replaces the req-11 done view): where the last
// Done lands, and what re-entering a done exercise opens. The name, each set (tap → the edit
// sheet), the "↑ N%" line (DEC-117 §1, the overview's helper), one Effort for the whole
// exercise (Easy · Medium · Hard, nothing preselected; hidden with no work set to carry it —
// warm-up-only, all skipped, or cardio), then Next: {next exercise} / Finish, Choose exercise
// and Add set.
export function WorkoutItemDone({ routineId, itemId }) {
  const store = useStore()
  const active = store.activeWorkout
  const mine = isActiveFor(active, routineId)
  const item = mine ? findItem(active.snapshot?.items, itemId) : null

  if (!mine) return <NotInWorkout routineId={routineId} />
  if (!item) return <MissingItem />
  return <ExerciseReview key={itemKey(item)} routineId={routineId} item={item} />
}

function ExerciseReview({ routineId, item }) {
  const store = useStore()
  const active = store.activeWorkout
  const [editIndex, setEditIndex] = useState(null)
  const ex = liveExercise(store, item)
  const weighted = isWeightedType(ex?.type)
  // req-217 — the set lines read "12 each side" for a unilateral library entry.
  const library = useExerciseLibrary()
  const eachSide = isEachSide(ex, library)
  // req-194 — a non-timed cardio exercise's sets read "1 · 12:30 · level 8 · 1.5 km".
  const cardioFields = ex?.type === 'cardio' && !ex?.hasDuration
  const { logged, workLogged } = itemLoggingState(active, item)
  const rows = logged.map((set) => {
    const label = set.setType === 'wu' ? 'Warm-up' : String(workLogged.indexOf(set) + 1)
    const setIndex = (active.sets || []).indexOf(set)
    return { key: String(setIndex), status: 'done', setIndex, text: loggedSetRowText(label, set, weighted, cardioFields, eachSide), highlighted: editIndex === setIndex }
  })
  const pct = exerciseImprovementPct(active, previousSameRoutineWorkouts(active, store.workouts, store.routines), item.exerciseId, store.exercises)
  // Effort: hidden on cardio (no effort, req-156) and when no logged, non-skipped work set exists.
  const showEffort = ex?.type !== 'cardio' && itemEffortSets(active, item).length > 0
  const effort = itemEffort(active, item)
  const next = nextNotDoneItem(active, item)

  function pickEffort(value) {
    recordButton('exercise-effort')
    store.setItemEffort(itemKey(item), value)
  }

  return (
    <Screen className="ui-screen--rest">
      <ExercisesLink routineId={routineId} name={active.snapshot?.routineName} />
      <WorkoutPill />
      <ExerciseTitle routineId={routineId} item={item} ex={ex} bits={[roleTag(item.role)]} eachSide={eachSide} />
      <ExerciseSetupHeader item={item} ex={ex} />
      {pct != null ? <p className="ui-sub">{improvementText(pct)}</p> : null}
      {rows.length ? (
        <SetList rows={rows} onOpen={(row) => setEditIndex(row.setIndex)} />
      ) : (
        <p className="ui-sub">None.</p>
      )}
      {showEffort ? (
        <>
          <SectionHeader>Effort</SectionHeader>
          {/* clearable (req-221): tap the picked one again → none (rpe null on those sets). */}
          <SegmentedControl clearable options={EFFORT_OPTIONS} value={effort} onChange={pickEffort} ariaLabel="Effort" />
        </>
      ) : null}
      {/* Navigation only (nothing written), so links wearing the button look (DEC-040). Finish:
          the auto-complete summary on the overview when it is armed (as the last Done reached
          before req-212), else the Finish screen. */}
      <div className="ui-workout-end">
        {next ? (
          // req-223 — Next is an arrival: the next exercise opens with its Up next bar.
          <NavLink to={itemLogPath(routineId, next)} look="primary" block onClick={(e) => markNextArrival(e, routineId, next)}>
            Next: {exerciseName(next)}
          </NavLink>
        ) : (
          <NavLink to={finishTarget(active, routineId)} look="primary" block>
            Finish
          </NavLink>
        )}
        <NavLink to={`/workout/${routineId}`} look="secondary" block>
          Choose exercise
        </NavLink>
        {/* req-274 (DEC-155 §10) — not shown at MAX_SETS (20): no message. */}
        {canAddSet(item) ? (
          <Button
            variant="quiet"
            block
            onClick={() => {
              // Re-opening a completed exercise: clear the done mark first so the
              // log screen's markedDone guard doesn't bounce straight back here.
              store.patchActive(reopenItemPatch(active, item))
              store.addWorkingSet(itemKey(item))
              go(itemLogPath(routineId, item), { replace: true })
            }}
          >
            Add set
          </Button>
        ) : null}
      </div>
      {editIndex != null ? (
        <LoggedSetSheet
          key={editIndex}
          item={item}
          ex={ex}
          index={editIndex}
          eachSide={eachSide}
          onClose={() => setEditIndex(null)}
          // An edit that turns a skipped set into a real one: the effort picked for the
          // exercise covers it too (re-applied from the latest state).
          onSaved={() => {
            if (effort !== '') store.setItemEffort(itemKey(item), effort)
          }}
        />
      ) : null}
    </Screen>
  )
}
