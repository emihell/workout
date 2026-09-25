import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { RPE_OPTIONS, formatSetLine, isWeightedType, roleTag } from '../../ids'
import { go } from '../../route'
import { recordButton } from '../../analytics'
import { isDurationTarget } from '../../progress'
import { exerciseById, historyHasSetAt, historySetPrefill, lastSetsForExercise } from '../../storage'
import { useStore } from '../../store-context'
import {
  canRemoveAddedSet,
  carryForSet,
  createSetDraftWriter,
  durationTargetFor,
  formFieldsWithDraft,
  initialSetFields,
  itemIsMarkedDone,
  itemKey,
  itemLoggingState,
  lastLoggedSetIndex,
  markItemDonePatch,
  nextSeedOverrides,
  removeAddedSetPatch,
  reopenItemPatch,
  restPatchAfterSet,
  seedOverrideKey,
  sessionExercise,
  setDraftFor,
  setDraftFromLoggedSet,
  setDraftKey,
  setPreview,
  setTargetFor,
} from '../../workout-log'
import { SetEditForm } from '../set-edit'
import { activeSetPatch, liveSetWeight } from '../set-values.js'
import { Back, ExercisesLink, Missing } from '../shared'
import { Actions, Button, Field, List, NavLink, Row, Screen, SectionHeader, SetLogForm, Title } from '../../ui/index.jsx'
import { exerciseName, findItem, isActiveFor, itemLogPath, itemReplacePath, itemSetsPath, MissingItem, NotInWorkout } from './helpers'
import { RestPill, useRestCountdown } from './rest'
import { unlockAudio } from '../../rest-cue'

// req-109 — how long an armed "Skip exercise" waits for its second tap.
const SKIP_EXERCISE_ARM_MS = 3000

// req-119 — type / Timed / name / equipment come from the snapshot (sessionExercise,
// workout-log.js); weight step and cues stay live. Old snapshots read live as before.
function liveExercise(store, item) {
  return sessionExercise(exerciseById(store.exercises, item.exerciseId), item)
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
            <NavLink to={exerciseEditorPath(routineId, item)} look="plain">{name}</NavLink>
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

  if (!mine) return <NotInWorkout routineId={routineId} />
  if (!item) return <MissingItem />
  // req-162 — a marked-done item (just skipped, or done) is leaving: the effect above
  // replaces the route with the overview. Render nothing meanwhile — "Not found." here
  // flashed for one render after Skip exercise. An unknown item still says Not found.
  if (markedDone) return null

  return <WorkoutItemLive routineId={routineId} item={item} />
}

// req-117 — restoreFromLoggedSet moved to workout-log.js (pure, unit-tested; it now
// also restores a timed set's logged seconds).

// req-78 — the req-27 RestUpcoming panel (an editable "next weight" shown during a
// blocking rest) is gone. Rest no longer blocks: the next set's own log form is shown
// immediately on completing a set, and its weight field IS the editable surface, so the
// separate panel and its nextSetWeight override folded away. The rest itself now shows
// only as the floating RestPill.

// req-125 — the set-form draft writer (createSetDraftWriter, workout-log.js: debounced,
// unit-tested) bound to the store. store.patchActive only calls the store's stable
// setState, so the first render's function stays valid for the component's life. A
// pending write is flushed on unmount (leaving the screen) and synchronously
// (flushSync, so saveState runs before the page goes) when the tab is hidden or
// unloaded — iOS reloading a backgrounded tab.
function useSetDraftWriter(store) {
  const [writer] = useState(() =>
    createSetDraftWriter({
      write: (setDraft, sync) => {
        const patch = () => store.patchActive({ setDraft })
        if (sync) flushSync(patch)
        else patch()
      },
    }),
  )
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') writer.flush(true)
    }
    const onPageHide = () => writer.flush(true)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
      writer.flush()
    }
  }, [writer])
  return writer
}

function WorkoutItemLive({ routineId, item }) {
  const store = useStore()
  const active = store.activeWorkout
  const ex = liveExercise(store, item)
  const last = lastSetsForExercise(store.workouts, item.exerciseId)
  const state = itemLoggingState(active, item)
  const { needsWu, workCount, currentWorkIndex, plannedDone } = state
  const currentType = needsWu ? 'wu' : 'work'
  // req-106 — the target rule moved to setTargetFor (shared with the preview).
  const target = setTargetFor(item, currentType, currentWorkIndex)
  const { resting } = useRestCountdown(active)
  // req-125 — the log form's values are kept as a draft on the active workout
  // (`setDraft`, see setDraftKey in workout-log.js) so navigation and a tab reload don't
  // lose them. The draft is written as the user edits (useSetDraftWriter, debounced) and
  // read only when the current set changes (draftSnap below).
  const setSeedKey = setDraftKey(item, currentType, currentWorkIndex)
  const draftWriter = useSetDraftWriter(store)

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

  function completeSet({ weight, reps, rpe, note, durationSec }) {
    // req-154 — `22,5` → 22.5. A kg that can't be read logs nothing: SetLogForm already
    // refuses Complete with an inline error, this is the backstop (never 0 or NaN).
    const loggedWeight = liveSetWeight(weight, isWeightedType(ex.type))
    if (loggedWeight == null) return
    recordButton('complete-set')
    // req-31 — completing a set is the gesture that arms the rest; use it to
    // unlock/resume the AudioContext (iOS only lets a gesture start audio) so the
    // rest-end beep can play when the timer runs out. Fail-silent.
    unlockAudio()
    const done = finishAfterThisSet()
    // req-125 — the set is logged: drop any pending draft write and clear its draft.
    draftWriter.cancel()
    // req-109 (review) — logging a set disarms a pending Skip exercise.
    setSkipArmed(false)
    // req-83 (N9) — a field entered differently from the seed becomes the seed for
    // this exercise's remaining sets this session. Compared against `seed` (what the
    // form presented, incl. any earlier override); only a changed field propagates.
    // Merged into the same activeWorkout patch as the rest timer. req-108 (DEC-052) —
    // weight only; a reps change stays on its own set.
    const seedOverrides = nextSeedOverrides(active.seedOverrides, {
      exerciseId: item.exerciseId,
      setType: currentType,
      weighted,
      seed,
      // req-154 — the parsed kg, not the typed text: `22,5` must compare (and carry) as 22.5.
      logged: { weight: loggedWeight, reps },
    })
    store.completeSet(
      {
        routineItemId: itemKey(item),
        exerciseId: item.exerciseId,
        setType: currentType,
        weight: loggedWeight,
        reps: reps || '',
        // req-85 — a timed work set logs seconds in place of reps; only set when present.
        // req-155 — already whole seconds from SetLogForm (seconds-input.js).
        ...(durationSec != null ? { durationSec } : {}),
        rpe: rpe ? Number(rpe) : null,
        note,
        targetReps: target || '',
        targetWeight:
          currentType === 'work' && item.suggestedWeights?.[currentWorkIndex] != null
            ? item.suggestedWeights[currentWorkIndex]
            : null,
      },
      { ...restAfterSet(), seedOverrides },
      { draftKey: setSeedKey },
    )
    if (done) markDoneAndGoToOverview(store, active, routineId, item)
  }

  function skipSet() {
    recordButton('skip-set')
    draftWriter.cancel()
    setSkipArmed(false)
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
      { draftKey: setSeedKey },
    )
    if (done) markDoneAndGoToOverview(store, active, routineId, item)
  }

  function previousSet() {
    const index = lastLoggedSetIndex(active, item)
    const lastLogged = index >= 0 ? active.sets[index] : null
    if (!lastLogged) return
    recordButton('previous-set')
    setSkipArmed(false)
    draftWriter.cancel()
    // req-125 — the un-logged set's values become the draft of the set Previous returns
    // to (was the `restore` component state, which a reload lost).
    const workIndex = lastLogged.setType === 'wu' ? 0 : state.workLogged.length - 1
    const key = setDraftKey(item, lastLogged.setType || 'work', workIndex)
    // req-25 — removeActiveSet clears the armed rest (restEndsAt/restPausedRemaining)
    // so going back then forward re-arms a fresh timer rather than double-counting.
    store.removeActiveSet(index)
    store.patchActive({ setDraft: setDraftFromLoggedSet(key, lastLogged) })
  }

  // req-109 — Skip exercise needs two taps: the first arms it ("Tap again to skip"),
  // which disarms by itself after SKIP_EXERCISE_ARM_MS; the second logs every remaining
  // set of this exercise as skipped, marks it done and returns to the overview. No
  // native confirm: it's a mis-tap guard, not a warning (Emilio, 2026-09-23).
  const [skipArmed, setSkipArmed] = useState(false)
  useEffect(() => {
    if (!skipArmed) return undefined
    const id = setTimeout(() => setSkipArmed(false), SKIP_EXERCISE_ARM_MS)
    return () => clearTimeout(id)
  }, [skipArmed])

  // req-117 — "Remove set": undo an "Add set" whose set hasn't been logged yet. Pops
  // the last (unlogged, added) set and recomputes done; when every remaining set is
  // logged the exercise is done again and this returns to the overview, as completing
  // its last set does (DEC-013).
  const removable = canRemoveAddedSet(active, item)
  function removeSet() {
    const patch = removeAddedSetPatch(active, itemKey(item))
    if (!patch) return
    recordButton('remove-set')
    setSkipArmed(false)
    store.patchActive(patch)
    if ((patch.completedItemIds || []).includes(itemKey(item))) {
      go(`/workout/${routineId}`, { replace: true })
    }
  }

  function skipExercise() {
    if (!skipArmed) {
      setSkipArmed(true)
      return
    }
    recordButton('skip-exercise')
    setSkipArmed(false)
    store.skipItem(itemKey(item))
    go(`/workout/${routineId}`, { replace: true })
  }

  const canGoBack = state.logged.length > 0
  const weighted = isWeightedType(ex.type)
  const repsLabel = ex?.type === 'cardio' || isDurationTarget(target) ? 'Duration' : 'Reps'
  const showEffort = currentType === 'work' && ex?.type !== 'cardio'
  // req-85 — a timed exercise counts down a duration on its WORK sets (a warmup set
  // stays reps-based). Target seconds: this set's routine duration, else the last one
  // in the list, else the exercise default, else the app default. Never invents beyond
  // that default target (the value is editable and logged as the target, v1).
  // req-106 — the rule itself moved to durationTargetFor (shared with the preview).
  const timedSet = Boolean(ex?.hasDuration) && currentType === 'work'
  const durationTarget = durationTargetFor(item, ex, currentWorkIndex)
  // Seed the set-log fields from the same sources the app has always used —
  // carry (no-history working set), then history / target. Domain logic stays here;
  // the ui/ SetLogForm only holds the values. req-125 — Previous no longer seeds via
  // `restore`: it writes the un-logged set as the draft, laid over this seed below.
  const historyPrefill = historySetPrefill(last, { setType: currentType, workIndex: currentWorkIndex })
  // req-83 (N9) — the live, session-scoped seed override for this exercise+setType:
  // once a value entered this session differs from the presented seed, it seeds the
  // remaining sets (see nextSeedOverrides, applied on completeSet below). Absent for
  // an untouched field, so the normal carry/history/target seed shows through.
  const override = (active.seedOverrides || {})[seedOverrideKey(item.exerciseId, currentType)]
  // req-78 — the weight seed comes from restore/carry/history only; the req-27
  // upcoming-weight override is gone (the next set's form is now the editable surface).
  const seed = initialSetFields({
    weighted,
    fromRestore: false,
    restore: null,
    hasHistory: Boolean(last),
    historyHasSet: historyHasSetAt(last, { setType: currentType, workIndex: currentWorkIndex }),
    history: historyPrefill,
    carry: carryForSet(currentType, state.workLogged),
    target,
    override,
  })

  // req-80 — the note affordance moved out of SetLogForm to sit beside the exercise
  // title. The value lives here (passed straight to completeSet), and the reveal
  // (req-26 pattern) starts open only when a note is already seeded (draft/history),
  // so it is never lost. Both reset per set: SetLogForm remounts by `key`, but this
  // state lives above it, so the effect re-seeds it whenever the current set changes.
  // req-125 — the draft is read ONCE per set: captured when setSeedKey changes (the
  // same moment SetLogForm remounts), never as a live seed, so a debounced write landing
  // mid-typing can't reset a field. The form starts from seed + draft; `seed` alone stays
  // req-83's comparison base in completeSet.
  const [draftSnap, setDraftSnap] = useState(() => ({ key: setSeedKey, draft: setDraftFor(active, setSeedKey) }))
  if (draftSnap.key !== setSeedKey) setDraftSnap({ key: setSeedKey, draft: setDraftFor(active, setSeedKey) })
  const draft = draftSnap.key === setSeedKey ? draftSnap.draft : setDraftFor(active, setSeedKey)
  const formInit = formFieldsWithDraft({ seed, draft, weighted, durationTarget })
  const noteSeed = formInit.note
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
  // req-106 — at the start of the exercise (no set of it logged yet), a small read-only
  // preview of every set's weight/reps so all the weights can be picked up at once.
  // Each line is exactly what that set's form would prefill (setPreview → the same
  // initialSetFields inputs as `seed` above). Gone once the first set is completed or
  // skipped.
  const preview =
    logging && state.logged.length === 0
      ? setPreview({
          item,
          ex,
          weighted,
          hasHistory: Boolean(last),
          historyFor: (at) => historySetPrefill(last, at),
          seedOverrides: active.seedOverrides,
        })
      : null

  return (
    <Screen className="ui-screen--rest">
      <ExercisesLink routineId={routineId} />
      {/* req-78 — the running rest is a small floating pill (self-hides when no rest). */}
      <RestPill />
      <ExerciseTitle
        routineId={routineId}
        item={item}
        ex={ex}
        bits={[
          roleTag(item.role),
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
        <Field
          label="Note"
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
            draftWriter.note(setSeedKey, e.target.value, {
              weight: formInit.weight,
              reps: formInit.reps,
              effort: formInit.effort,
              durationSec: timedSet ? formInit.durationSec : undefined,
            })
          }}
          autoFocus={!noteSeed}
        />
      ) : null}
      {/* req-78 — the next set's log form shows immediately on completing a set, during
          rest included (no intermediate rest panel, no extra tap). Its Complete is live
          while the pill counts down (D2, self-paced). The form remounts per set by
          `key`; rest ending doesn't change the key, so in-progress edits survive. Once
          the exercise is planned-done, completeSet has already advanced to the overview. */}
      {plannedDone ? null : (
        <SetLogForm
          key={setSeedKey}
          weighted={weighted}
          timed={timedSet}
          showEffort={showEffort}
          repsLabel={repsLabel}
          effortOptions={RPE_OPTIONS}
          initialWeight={formInit.weight}
          initialReps={formInit.reps}
          initialDuration={formInit.durationSec}
          initialEffort={formInit.effort}
          canGoBack={canGoBack}
          onComplete={({ weight, reps, effort, durationSec }) =>
            completeSet({ weight, reps, rpe: effort, note, durationSec })
          }
          onSkip={skipSet}
          onPrevious={previousSet}
          onChange={(values) => draftWriter.form(setSeedKey, values, note)}
        />
      )}
      {preview ? (
        <ul className="ui-setpreview" aria-label="Sets">
          {preview.map((line) => (
            <li key={`${line.setType}-${line.workIndex}`}>{line.text}</li>
          ))}
        </ul>
      ) : null}
      {/* req-109 — exercise-level lateral actions, in normal flow below the form (the
          set-level Previous · Skip · Complete bar stays pinned at the bottom). Skip
          exercise writes (a Button, two taps); Replace exercise only opens the picker
          (a NavLink wearing the button look, DEC-040). */}
      {logging ? (
        <Actions
          className="ui-exercise-actions"
          lateral={
            <>
              {/* req-117 — only on an unlogged extra set (canRemoveAddedSet). */}
              {removable ? (
                <Button variant="quiet" onClick={removeSet}>
                  Remove set
                </Button>
              ) : null}
              <Button variant="quiet" onClick={skipExercise}>
                {skipArmed ? 'Tap again to skip' : 'Skip exercise'}
              </Button>
              <NavLink to={itemReplacePath(routineId, item)} look="quiet">
                Replace exercise
              </NavLink>
            </>
          }
        />
      ) : null}
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

  if (!mine) return <NotInWorkout routineId={routineId} />
  if (!item) return <MissingItem />

  // req-104 — no "Previous" section here (Emilio: "Don't need to show previous");
  // the log screen still reads the last finished sets for its prefills.
  const today = itemLoggingState(active, item).logged

  return (
    <Screen className="ui-screen--rest">
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
      <ExerciseTitle
        routineId={routineId}
        item={item}
        ex={liveExercise(store, item)}
        bits={[roleTag(item.role)]}
      />
      <ExerciseSetupHeader item={item} ex={liveExercise(store, item)} />
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

  if (workout?.routineId !== routineId) return <NotInWorkout routineId={routineId} />
  if (!set) {
    return <Missing>Not found.</Missing>
  }

  return (
    <Screen className="ui-screen--rest">
      <Back to={itemPath} />
      <RestPill />
      <p className="ui-sub">{workout.snapshot?.routineName || workout.snapshot?.sessionName}</p>
      <Title>Set</Title>
      <SetEditForm
        set={set}
        showLoad={usesLoad}
        showEffort={usesRpe}
        cancelTo={itemPath}
        onSave={(values) => {
          // req-154 — `22,5` → 22.5; unreadable kg → null (the form already shows why).
          const patch = activeSetPatch(values, { showLoad: usesLoad })
          if (!patch) return
          store.updateActiveSet(index, patch)
          go(itemPath)
        }}
      />
    </Screen>
  )
}
