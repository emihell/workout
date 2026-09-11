import { useEffect, useState } from 'react'
import { RPE_OPTIONS, formatSetLine, roleLabel } from '../../ids'
import { go } from '../../route'
import { recordButton } from '../../analytics'
import { exerciseById, historySetPrefill, lastSetsForExercise } from '../../storage'
import { useStore } from '../../store-context'
import {
  carriedWorkingSet,
  initialSetFields,
  itemIsMarkedDone,
  itemKey,
  itemLoggingState,
  lastLoggedSetIndex,
  markItemDonePatch,
  pendingWeightFor,
  reopenItemPatch,
  restPatchAfterSet,
} from '../../workout-log'
import { SetEditForm } from '../set-edit'
import { Back, ExercisesLink, Missing } from '../shared'
import { Button, List, NumberField, Row, Screen, SectionHeader, SetLogForm, Title } from '../../ui/index.jsx'
import { exerciseName, findItem, isActiveFor, itemLogPath, itemSetsPath, MissingItem } from './helpers'
import { RestBar, useRestCountdown } from './rest'

function usesWeight(ex) {
  return ex && ex.type !== 'bodyweight' && ex.type !== 'cardio'
}

function isDurationTarget(target) {
  const t = String(target || '').toLowerCase()
  return t.includes('min') || t.includes('sec') || /s$/.test(t.replace(/\s/g, ''))
}

function liveExercise(store, item) {
  return (
    exerciseById(store.exercises, item.exerciseId) || {
      name: item.exerciseName,
      equipment: item.equipment,
      type: item.exerciseType,
      weightStep: item.weightStep,
      cues: '',
    }
  )
}

function exerciseEditorPath(routineId, item) {
  return `/workout/${routineId}/item/${itemKey(item)}/exercise`
}

function setProgressLabel(item, state, currentType, currentWorkIndex) {
  const hasWu = Boolean(item?.warmup)
  const total = (hasWu ? 1 : 0) + state.workCount
  const current = currentType === 'wu' ? 1 : (hasWu ? 1 : 0) + currentWorkIndex + 1
  return `${current}/${total}`
}

function ExerciseTitle({ routineId, item, ex, bits }) {
  const inLibrary = Boolean(item?.exerciseId && ex?.id === item.exerciseId)
  const name = exerciseName(item)
  const meta = (bits || []).filter(Boolean).join(' · ')
  return (
    <>
      <Title>
        {inLibrary ? (
          <a href={`#${exerciseEditorPath(routineId, item)}`}>{name}</a>
        ) : (
          name
        )}
      </Title>
      {meta ? <p className="ui-sub">{meta}</p> : null}
    </>
  )
}

function ExerciseSetupHeader({ item, ex, showNotes = true }) {
  return (
    <>
      {ex?.equipment ? <p className="ui-sub">{ex.equipment}</p> : null}
      {showNotes && item?.notes ? <p className="ui-sub">{item.notes}</p> : null}
    </>
  )
}

// req-11 / DEC-013 — completing the last set marks the exercise done and returns
// to the workout overview (the exercise menu), replacing the old per-exercise
// review screen in the flow. WorkoutItemDone stays reachable by re-entering a
// completed exercise from the overview.
function markDoneAndGoToOverview(store, workout, routineId, item) {
  store.patchActive(markItemDonePatch(workout, item))
  go(`/workout/${routineId}`, { replace: true })
}

export function WorkoutItemLog({ routineId, itemId }) {
  const store = useStore()
  const active = store.activeWorkout
  const mine = isActiveFor(active, routineId)
  const item = mine ? findItem(active.snapshot?.items, itemId) : null
  const markedDone = Boolean(item && itemIsMarkedDone(active, item))

  useEffect(() => {
    if (markedDone) go(`/workout/${routineId}`, { replace: true })
  }, [markedDone, routineId])

  if (!mine || !item) return <MissingItem />
  if (markedDone) return <MissingItem />

  return <WorkoutItemLive routineId={routineId} item={item} />
}

// req-02 / DEC-002: for an exercise with NO finished-workout history, the kg+reps
// carried onto the next working set — the most recent non-skipped working set
// logged this session. Null for a with-history exercise (`last` present), a
// warm-up set, or when nothing has been logged yet, so the existing history /
// blank-kg / target-reps paths stay untouched.
function carryFor(ex, last, currentType, workLogged) {
  if (last || currentType !== 'work') return null
  const src = carriedWorkingSet(workLogged)
  if (!src) return null
  return {
    weight: src.weight != null && Number(src.weight) !== 0 ? String(src.weight) : '',
    reps: src.reps != null && src.reps !== '' ? String(src.reps) : '',
  }
}

function restoreFromLoggedSet(set) {
  const skipped = String(set?.reps || '').toLowerCase() === 'skipped'
  return {
    setType: set.setType || 'work',
    workIndex: set.setType === 'wu' ? 0 : null,
    weight: set.weight != null && Number(set.weight) !== 0 ? String(set.weight) : '',
    reps: skipped ? '' : set.reps != null && set.reps !== '' ? String(set.reps) : '',
    rpe: set.rpe != null && set.rpe !== '' ? String(set.rpe) : '',
    note: skipped ? '' : set.note || '',
  }
}

// req-27 — during rest, the upcoming set's prescribed weight is shown and made
// editable so the lifter can adjust the next load before the set starts. The reps
// are shown for context (not editable — out of scope). The edit is written to
// activeWorkout.nextSetWeight (scoped by the caller to this one set) and pre-fills
// the next set's form via initialSetFields. Local state seeds from the computed
// upcoming weight and is remounted per set by the caller's `key`, so each set
// starts from its own seed; the store write + seed wiring live in the caller.
function RestUpcoming({ weight, reps, changed, direction, onWeightChange }) {
  const [value, setValue] = useState(weight)
  return (
    <div className="ui-upcoming">
      <span className="ui-upcoming__label">
        Next
        {changed ? (
          <span className="ui-upcoming__mark" aria-label={direction === 'up' ? 'increased' : 'decreased'}>
            {' '}
            {direction === 'up' ? '↑' : '↓'}
          </span>
        ) : null}
      </span>
      <NumberField
        label="kg"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          onWeightChange(e.target.value)
        }}
      />
      <span className="ui-upcoming__reps">× {reps}</span>
    </div>
  )
}

function WorkoutItemLive({ routineId, item }) {
  const store = useStore()
  const active = store.activeWorkout
  const ex = liveExercise(store, item)
  const last = lastSetsForExercise(store.workouts, item.exerciseId)
  const state = itemLoggingState(active, item)
  const { needsWu, workCount, currentWorkIndex, plannedDone } = state
  const currentType = needsWu ? 'wu' : 'work'
  const target = needsWu
    ? String(item.warmup?.reps ?? '')
    : item.targets?.[currentWorkIndex] ?? item.targets?.[item.targets.length - 1] ?? ''
  const [restore, setRestore] = useState(null)
  const { resting } = useRestCountdown(active)

  useEffect(() => {
    if (!resting && plannedDone) markDoneAndGoToOverview(store, active, routineId, item)
  }, [resting, plannedDone, routineId, item, store, active])

  function finishAfterThisSet() {
    if (needsWu) return false
    return currentWorkIndex + 1 >= workCount
  }

  // req-25 — rest is armed by completion, not suppressed on the last set; the
  // pure decision lives in restPatchAfterSet. `done` (last set) no longer affects
  // rest, only navigation (see completeSet), so it is not passed here anymore.
  function restAfterSet(skipped = false) {
    return restPatchAfterSet({ restSec: item.restSec, skipped })
  }

  function completeSet({ weight, reps, rpe, note }) {
    if (currentType === 'work' && ex?.type !== 'cardio' && !rpe) {
      window.alert('Pick effort.')
      return
    }
    recordButton('complete-set')
    const done = finishAfterThisSet()
    setRestore(null)
    store.completeSet(
      {
        routineItemId: itemKey(item),
        exerciseId: item.exerciseId,
        setType: currentType,
        weight: usesWeight(ex) ? Number(weight) || 0 : 0,
        reps: reps || '',
        rpe: rpe ? Number(rpe) : null,
        note,
        targetReps: target || '',
        targetWeight:
          currentType === 'work' && item.suggestedWeights?.[currentWorkIndex] != null
            ? item.suggestedWeights[currentWorkIndex]
            : null,
      },
      // req-27 — clear any upcoming-weight override: this set consumed it (the
      // form seeded from it), and the next set starts from its own computed seed.
      { ...restAfterSet(), nextSetWeight: null },
    )
    if (done) markDoneAndGoToOverview(store, active, routineId, item)
  }

  function skipSet() {
    recordButton('skip-set')
    setRestore(null)
    const done = finishAfterThisSet()
    store.completeSet(
      {
        routineItemId: itemKey(item),
        exerciseId: item.exerciseId,
        setType: currentType,
        weight: 0,
        reps: 'skipped',
        rpe: null,
        note: 'skipped',
        targetReps: target || '',
        targetWeight:
          currentType === 'work' ? item.suggestedWeights?.[currentWorkIndex] ?? null : null,
      },
      { ...restAfterSet(true), nextSetWeight: null },
    )
    if (done) markDoneAndGoToOverview(store, active, routineId, item)
  }

  function previousSet() {
    const index = lastLoggedSetIndex(active, item)
    const lastLogged = index >= 0 ? active.sets[index] : null
    if (!lastLogged) return
    recordButton('previous-set')
    const next = restoreFromLoggedSet(lastLogged)
    next.workIndex = lastLogged.setType === 'wu' ? 0 : state.workLogged.length - 1
    setRestore(next)
    store.removeActiveSet(index)
    // req-27 — going back changes which set is upcoming; drop any stale override.
    store.patchActive({ nextSetWeight: null })
  }

  // req-27 — an explicit upcoming-weight edit during rest, written scoped to this
  // exact { itemId, workIndex } so it can only pre-fill this one set.
  function setUpcomingWeight(value) {
    store.patchActive({
      nextSetWeight: { itemId: itemKey(item), workIndex: currentWorkIndex, weight: value },
    })
  }

  const canGoBack = state.logged.length > 0
  const weighted = usesWeight(ex)
  const repsLabel = ex?.type === 'cardio' || isDurationTarget(target) ? 'Duration' : 'Reps'
  const showEffort = currentType === 'work' && ex?.type !== 'cardio'
  // Seed the set-log fields from the same sources the app has always used —
  // restore (Previous), then carry (no-history working set), then history /
  // target. Domain logic stays here; the ui/ SetLogForm only holds the values.
  const historyPrefill = historySetPrefill(last, { setType: currentType, workIndex: currentWorkIndex })
  const fromRestore =
    restore &&
    restore.setType === currentType &&
    (currentType === 'wu' || restore.workIndex === currentWorkIndex)
  // req-27 — a weight the lifter edited on the rest screen for this exact upcoming
  // set overrides the computed seed; scoped so it never touches another set/exercise.
  const weightOverride = pendingWeightFor(active.nextSetWeight, {
    itemId: itemKey(item),
    workIndex: currentWorkIndex,
  })
  const seed = initialSetFields({
    weighted,
    fromRestore,
    restore,
    hasHistory: Boolean(last),
    history: historyPrefill,
    carry: carryFor(ex, last, currentType, state.workLogged),
    target,
    weightOverride,
  })

  // req-27 — mark the upcoming weight when it differs from the set just completed
  // (a progression bump or planned step). Both sides must be real numbers to compare,
  // so a no-history blank upcoming (or a skipped last set) is never flagged.
  const lastLoggedWork = state.workLogged.at(-1)
  const lastLoggedWeight =
    lastLoggedWork && String(lastLoggedWork.reps || '').toLowerCase() !== 'skipped'
      ? Number(lastLoggedWork.weight)
      : null
  const upcomingWeightNum = seed.weight !== '' && seed.weight != null ? Number(seed.weight) : null
  const upcomingChanged =
    weighted && lastLoggedWeight != null && upcomingWeightNum != null && upcomingWeightNum !== lastLoggedWeight
  const upcomingDirection = upcomingChanged ? (upcomingWeightNum > lastLoggedWeight ? 'up' : 'down') : null

  return (
    <Screen>
      <ExercisesLink routineId={routineId} />
      <RestBar />
      <ExerciseTitle
        routineId={routineId}
        item={item}
        ex={ex}
        bits={[
          roleLabel(item.role),
          currentType === 'wu' ? 'WU set' : null,
          setProgressLabel(item, state, currentType, currentWorkIndex),
        ]}
      />
      {resting ? (
        <>
          {weighted && !plannedDone ? (
            <RestUpcoming
              key={`up-${itemKey(item)}-${currentType}-${currentWorkIndex}`}
              weight={seed.weight}
              reps={target}
              changed={upcomingChanged}
              direction={upcomingDirection}
              onWeightChange={setUpcomingWeight}
            />
          ) : null}
          {canGoBack ? (
            <Button variant="quiet" onClick={previousSet}>
              Previous
            </Button>
          ) : null}
        </>
      ) : plannedDone ? null : (
        <SetLogForm
          key={`${itemKey(item)}-${currentType}-${currentWorkIndex}`}
          weighted={weighted}
          showEffort={showEffort}
          repsLabel={repsLabel}
          effortOptions={RPE_OPTIONS}
          initialWeight={seed.weight}
          initialReps={seed.reps}
          initialEffort={seed.effort}
          initialNote={seed.note}
          canGoBack={canGoBack}
          onComplete={({ weight, reps, effort, note }) => completeSet({ weight, reps, rpe: effort, note })}
          onSkip={skipSet}
          onPrevious={previousSet}
        />
      )}
      {/* req-26 — the equipment + cues block that sat under the buttons is removed
          to declutter the mid-set screen. Cues stay reachable: the exercise Title
          is a link to the exercise editor (which shows them). */}
    </Screen>
  )
}

export function WorkoutItemDone({ routineId, itemId }) {
  const store = useStore()
  const active = store.activeWorkout
  const mine = isActiveFor(active, routineId)
  const item = mine ? findItem(active.snapshot?.items, itemId) : null

  if (!mine || !item) return <MissingItem />

  const today = itemLoggingState(active, item).logged
  const previous = lastSetsForExercise(store.workouts, item.exerciseId)

  return (
    <Screen>
      <ExercisesLink routineId={routineId} />
      <RestBar />
      <SectionHeader>Today</SectionHeader>
      {today.length ? (
        <List>
          {today.map((set, index) => {
            const setIndex = (active.sets || []).indexOf(set)
            return (
              <Row key={index} to={`/workout/${routineId}/set/${setIndex}`}>
                {formatSetLine(set)}
              </Row>
            )
          })}
        </List>
      ) : (
        <p className="ui-sub">None.</p>
      )}
      <SectionHeader>Previous</SectionHeader>
      {previous ? (
        <List>
          {previous.sets.map((set, index) => (
            <Row key={index}>{formatSetLine(set)}</Row>
          ))}
        </List>
      ) : (
        <p className="ui-sub">None.</p>
      )}
      <Button
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
      <ExerciseTitle
        routineId={routineId}
        item={item}
        ex={liveExercise(store, item)}
        bits={[roleLabel(item.role)]}
      />
      <ExerciseSetupHeader item={item} ex={liveExercise(store, item)} />
    </Screen>
  )
}

export function WorkoutSetEdit({ routineId, index }) {
  const store = useStore()
  const workout = store.activeWorkout
  const set = workout?.routineId === routineId ? workout.sets?.[index] : null
  const item = workout?.snapshot?.items?.find(
    (candidate) => itemKey(candidate) === (set?.routineItemId || set?.sessionItemId),
  )
  const usesLoad = item?.exerciseType !== 'cardio' && item?.exerciseType !== 'bodyweight'
  const usesRpe = set?.setType !== 'wu' && item?.exerciseType !== 'cardio'
  const itemPath = itemSetsPath(routineId, item, workout)

  if (!workout || !set) {
    return <Missing>Not found.</Missing>
  }

  return (
    <Screen>
      <Back />
      <RestBar />
      <p className="ui-sub">{workout.snapshot?.routineName || workout.snapshot?.sessionName}</p>
      <Title>Set</Title>
      <SetEditForm
        set={set}
        showLoad={usesLoad}
        showEffort={usesRpe}
        cancelTo={itemPath}
        onSave={({ weight, reps, rpe, note }) => {
          store.updateActiveSet(index, {
            weight: weight === '' ? 0 : Number(weight),
            reps,
            rpe: rpe === '' ? null : Number(rpe),
            note,
          })
          go(itemPath)
        }}
      />
    </Screen>
  )
}
