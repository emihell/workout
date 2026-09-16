import { useEffect, useState } from 'react'
import { RPE_OPTIONS, formatSetLine, isWeightedType, roleLabel } from '../../ids'
import { go } from '../../route'
import { recordButton } from '../../analytics'
import { isDurationTarget } from '../../progress'
import { exerciseById, historySetPrefill, lastSetsForExercise } from '../../storage'
import { useStore } from '../../store-context'
import {
  carriedWorkingSet,
  initialSetFields,
  isSkippedSet,
  itemIsMarkedDone,
  itemKey,
  itemLoggingState,
  lastLoggedSetIndex,
  markItemDonePatch,
  nextSeedOverrides,
  reopenItemPatch,
  restPatchAfterSet,
  seedOverrideKey,
} from '../../workout-log'
import { SetEditForm } from '../set-edit'
import { Back, ExercisesLink, Missing, NavLink } from '../shared'
import { Button, Field, List, Row, Screen, SectionHeader, SetLogForm, Title } from '../../ui/index.jsx'
import { exerciseName, findItem, isActiveFor, itemLogPath, itemSetsPath, MissingItem } from './helpers'
import { RestPill, useRestCountdown } from './rest'
import { unlockAudio } from '../../rest-cue'

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

// `aside` (req-80) renders a small control beside the title — the live log screen
// passes the "Add note" toggle here so it sits next to the exercise name. Callers
// that omit it (the done view) render exactly as before.
function ExerciseTitle({ routineId, item, ex, bits, aside }) {
  const inLibrary = Boolean(item?.exerciseId && ex?.id === item.exerciseId)
  const name = exerciseName(item)
  const meta = (bits || []).filter(Boolean).join(' · ')
  return (
    <>
      <div className="ui-exercise-head">
        <Title>
          {inLibrary ? (
            <NavLink to={exerciseEditorPath(routineId, item)}>{name}</NavLink>
          ) : (
            name
          )}
        </Title>
        {aside ? <div className="ui-exercise-head__aside">{aside}</div> : null}
      </div>
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
  const skipped = isSkippedSet(set)
  return {
    setType: set.setType || 'work',
    workIndex: set.setType === 'wu' ? 0 : null,
    weight: set.weight != null && Number(set.weight) !== 0 ? String(set.weight) : '',
    reps: skipped ? '' : set.reps != null && set.reps !== '' ? String(set.reps) : '',
    rpe: set.rpe != null && set.rpe !== '' ? String(set.rpe) : '',
    note: skipped ? '' : set.note || '',
  }
}

// req-78 — the req-27 RestUpcoming panel (an editable "next weight" shown during a
// blocking rest) is gone. Rest no longer blocks: the next set's own log form is shown
// immediately on completing a set, and its weight field IS the editable surface, so the
// separate panel and its nextSetWeight override folded away. The rest itself now shows
// only as the floating RestPill.

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
    // req-31 — completing a set is the gesture that arms the rest; use it to
    // unlock/resume the AudioContext (iOS only lets a gesture start audio) so the
    // rest-end beep can play when the timer runs out. Fail-silent.
    unlockAudio()
    const done = finishAfterThisSet()
    setRestore(null)
    // req-83 (N9) — a field entered differently from the seed becomes the seed for
    // this exercise's remaining sets this session. Compared against `seed` (what the
    // form presented, incl. any earlier override); only a changed field propagates.
    // Merged into the same activeWorkout patch as the rest timer.
    const seedOverrides = nextSeedOverrides(active.seedOverrides, {
      exerciseId: item.exerciseId,
      setType: currentType,
      weighted,
      seed,
      logged: { weight, reps },
    })
    store.completeSet(
      {
        routineItemId: itemKey(item),
        exerciseId: item.exerciseId,
        setType: currentType,
        weight: isWeightedType(ex.type) ? Number(weight) || 0 : 0,
        reps: reps || '',
        rpe: rpe ? Number(rpe) : null,
        note,
        targetReps: target || '',
        targetWeight:
          currentType === 'work' && item.suggestedWeights?.[currentWorkIndex] != null
            ? item.suggestedWeights[currentWorkIndex]
            : null,
      },
      { ...restAfterSet(), seedOverrides },
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
      restAfterSet(true),
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
    // req-25 — removeActiveSet clears the armed rest (restEndsAt/restPausedRemaining)
    // so going back then forward re-arms a fresh timer rather than double-counting.
    store.removeActiveSet(index)
  }

  const canGoBack = state.logged.length > 0
  const weighted = isWeightedType(ex.type)
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
  // req-83 (N9) — the live, session-scoped seed override for this exercise+setType:
  // once a value entered this session differs from the presented seed, it seeds the
  // remaining sets (see nextSeedOverrides, applied on completeSet below). Absent for
  // an untouched field, so the normal carry/history/target seed shows through.
  const override = (active.seedOverrides || {})[seedOverrideKey(item.exerciseId, currentType)]
  // req-78 — the weight seed comes from restore/carry/history only; the req-27
  // upcoming-weight override is gone (the next set's form is now the editable surface).
  const seed = initialSetFields({
    weighted,
    fromRestore,
    restore,
    hasHistory: Boolean(last),
    history: historyPrefill,
    carry: carryFor(ex, last, currentType, state.workLogged),
    target,
    override,
  })

  // req-80 — the note affordance moved out of SetLogForm to sit beside the exercise
  // title. The value lives here (passed straight to completeSet), and the reveal
  // (req-26 pattern) starts open only when a note is already seeded (restore/history),
  // so it is never lost. Both reset per set: SetLogForm remounts by `key`, but this
  // state lives above it, so the effect re-seeds it whenever the current set changes.
  const noteSeed = seed.note
  const setSeedKey = `${itemKey(item)}-${currentType}-${currentWorkIndex}`
  const [note, setNote] = useState(noteSeed)
  const [showNote, setShowNote] = useState(Boolean(noteSeed))
  useEffect(() => {
    setNote(noteSeed)
    setShowNote(Boolean(noteSeed))
  }, [setSeedKey, noteSeed])
  // req-78 — the next set's log form is now shown throughout rest (rest doesn't block
  // input), so the note affordance shows whenever the form does: any time the exercise
  // isn't planned-done. (`resting` no longer gates the form.)
  const logging = !plannedDone

  return (
    <Screen>
      <ExercisesLink routineId={routineId} />
      {/* req-78 — the running rest is a small floating pill (self-hides when no rest). */}
      <RestPill />
      <ExerciseTitle
        routineId={routineId}
        item={item}
        ex={ex}
        bits={[
          roleLabel(item.role),
          currentType === 'wu' ? 'WU set' : null,
          setProgressLabel(item, state, currentType, currentWorkIndex),
        ]}
        aside={
          logging && !showNote ? (
            <Button variant="quiet" className="ui-addnote" onClick={() => setShowNote(true)}>
              Add note
            </Button>
          ) : null
        }
      />
      {/* req-80 — the note field the "Add note" control reveals, rendered by the
          title (not inside SetLogForm). autoFocus only when opened by tapping (no
          seeded note); an empty field submits no note (unchanged behaviour). */}
      {logging && showNote ? (
        <Field label="Note" value={note} onChange={(e) => setNote(e.target.value)} autoFocus={!noteSeed} />
      ) : null}
      {/* req-78 — the next set's log form shows immediately on completing a set, during
          rest included (no intermediate rest panel, no extra tap). Its Complete is live
          while the pill counts down (D2, self-paced). The form remounts per set by
          `key`; rest ending doesn't change the key, so in-progress edits survive. Once
          the exercise is planned-done, completeSet has already advanced to the overview. */}
      {plannedDone ? null : (
        <SetLogForm
          key={`${itemKey(item)}-${currentType}-${currentWorkIndex}`}
          weighted={weighted}
          showEffort={showEffort}
          repsLabel={repsLabel}
          effortOptions={RPE_OPTIONS}
          initialWeight={seed.weight}
          initialReps={seed.reps}
          initialEffort={seed.effort}
          canGoBack={canGoBack}
          onComplete={({ weight, reps, effort }) => completeSet({ weight, reps, rpe: effort, note })}
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
      <RestPill />
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
  const usesLoad = isWeightedType(item?.exerciseType)
  const usesRpe = set?.setType !== 'wu' && item?.exerciseType !== 'cardio'
  const itemPath = itemSetsPath(routineId, item, workout)

  if (!workout || !set) {
    return <Missing>Not found.</Missing>
  }

  return (
    <Screen>
      <Back to={itemPath} />
      <RestPill />
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
