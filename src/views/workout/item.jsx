import { Fragment, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { EFFORT_OPTIONS, isWeightedType, roleTag } from '../../ids'
import { go } from '../../route'
import { recordButton } from '../../analytics'
import { isDurationTarget } from '../../progress'
import { exerciseById } from '../../model.js'
import { historyHasSetAt, historySetPrefill, lastSetsForExercise } from '../../history-queries.js'
import { useStore } from '../../store-context'
import {
  autoCompleteArmed,
  canRemoveAddedSet,
  carryForSet,
  uniformRepsTargets,
  createSetDraftWriter,
  durationTargetFor,
  formFieldsWithDraft,
  initialSetFields,
  routineKgFor,
  itemEffort,
  itemEffortSets,
  itemIsMarkedDone,
  itemKey,
  isSkippedSet,
  itemLoggingState,
  loggedSetRowText,
  markItemDonePatch,
  nextNotDoneItem,
  nextSeedOverrides,
  removeAddedSetPatch,
  reopenItemPatch,
  restPatchAfterSet,
  seedOverrideKey,
  sessionExercise,
  setDraftFor,
  setDraftFromLoggedSet,
  setDraftKey,
  setListRows,
  setTargetFor,
  setupSeedFor,
  startStopwatchPatch,
  stopwatchFor,
  stopwatchOwner,
} from '../../workout-log'
import { liveSetWeight, viewedSetSave } from '../set-values.js'
import { ExercisesLink, Missing } from '../shared'
import {
  Actions,
  Button,
  ExerciseHead,
  Field,
  NavLink,
  RestNotes,
  Screen,
  SectionHeader,
  SegmentedControl,
  SetEditSheet,
  SetList,
  SetLogForm,
} from '../../ui/index.jsx'
import { MissingItem, NotInWorkout } from './helpers'
import { exerciseName, findItem, isActiveFor, itemDonePath, itemLogPath, itemSetsPath } from './workout-helpers.js'
import { WorkoutPill } from './rest'
import { useRestCountdown } from './rest-countdown.js'
import { unlockAudio } from '../../rest-cue'
import { askChoice, askConfirm } from '../../ui/confirm.js'
import {
  SETUP_FEELS,
  SETUP_TEXT,
  firstTimeSetupFor,
  firstTimeSetupPatch,
  setTwoSeed,
  setupPromptShows,
  setupSheetShows,
} from '../../first-time-setup.js'
import { offerOnFinishingSet, offerSheetText } from '../../routine-update-offer.js'
import { kgLabelFor } from '../../kg-label.js'
import { cardioFormText, clockText, lastDistanceUnit, targetDurationSec, withCardioValues } from '../../cardio-set.js'
import { equipmentLabel } from '../../equipment-label.js'
import { exerciseImprovementPct, improvementText } from '../../beat-last-time.js'
import { previousSameRoutineWorkouts } from '../../history-queries.js'
import { isEachSide, restNotesFor, restNotesShowing } from '../../library-hints.js'
import { useExerciseLibrary } from './use-library.js'

// req-119 — type / Timed / name / equipment come from the snapshot (sessionExercise,
// workout-log.js); weight step and cues stay live. Old snapshots read live as before.
function liveExercise(store, item) {
  return sessionExercise(exerciseById(store.exercises, item.exerciseId), item)
}

function exerciseEditorPath(routineId, item) {
  return `/workout/${routineId}/item/${itemKey(item)}/exercise`
}

// `aside` (req-80) renders a small control beside the title — the live log screen
// passes the "Add note" toggle here so it sits next to the exercise name.
// req-212 (H5) — the head is the library's ExerciseHead (was ad-hoc markup here).
function ExerciseTitle({ routineId, item, ex, bits, aside }) {
  const inLibrary = Boolean(item?.exerciseId && ex?.id === item.exerciseId)
  const name = exerciseName(item)
  return (
    <ExerciseHead
      title={inLibrary ? <NavLink to={exerciseEditorPath(routineId, item)} look="plain">{name}</NavLink> : name}
      aside={aside}
      subtitle={(bits || []).filter(Boolean).join(' · ')}
    />
  )
}

// The review's setup lines under the title (the old done view's): equipment, then the routine's
// note for this exercise. Review round 1 — restored (the spec never asked to remove them).
function ExerciseSetupHeader({ item, ex }) {
  return (
    <>
      {ex?.equipment ? <p className="ui-sub">{equipmentLabel(ex.equipment)}</p> : null}
      {item?.notes ? <p className="ui-sub">{item.notes}</p> : null}
    </>
  )
}

// req-11 / DEC-013 — completing the last set marks the exercise done. req-212 (DEC-119 §1)
// — it then lands on the exercise review (WorkoutItemDone: the sets, the one effort, Next),
// not the overview. Re-entering a completed exercise from the overview opens the same review.
function markDoneAndGoToReview(store, workout, routineId, item) {
  store.patchActive(markItemDonePatch(workout, item))
  go(itemDonePath(routineId, item), { replace: true })
}

// req-187 (DEC-103 §1) — the routine-kg confirm, opened on the set that finishes the
// exercise when its kg differs from the routine (offerOnFinishingSet). It is the one
// ConfirmSheet with `stayOn`: req-212 — the exercise review, so the navigation there
// (markDoneAndGoToReview, called first) does not dismiss it. Update → store.applyRoutineUpdate (the existing write
// path); Keep / backdrop / Escape / any other navigation → nothing written. Rest is
// untouched either way: it was armed by store.completeSet before this opens.
function askRoutineUpdate(store, routineId, item, offer) {
  const text = offerSheetText(offer, exerciseName(item))
  askConfirm(text.body, {
    title: text.title,
    confirmLabel: text.updateLabel,
    cancelLabel: text.keepLabel,
    stayOn: itemDonePath(routineId, item),
  }).then((update) => {
    recordButton(update ? 'routine-update-apply' : 'routine-update-keep')
    if (update) store.applyRoutineUpdate(offer)
  })
}

export function WorkoutItemLog({ routineId, itemId }) {
  const store = useStore()
  const active = store.activeWorkout
  const mine = isActiveFor(active, routineId)
  const item = mine ? findItem(active.snapshot?.items, itemId) : null
  const markedDone = Boolean(item && itemIsMarkedDone(active, item))

  // req-212 — a marked-done item belongs on its review (where the last Done lands).
  useEffect(() => {
    if (markedDone && item) go(itemDonePath(routineId, item), { replace: true })
  }, [markedDone, routineId, item])

  if (!mine) return <NotInWorkout routineId={routineId} />
  if (!item) return <MissingItem />
  // req-162 — a marked-done item (just skipped, or done) is leaving: the effect above
  // replaces the route (req-212: with its review). Render nothing meanwhile — "Not found." here
  // flashed for one render after Skip exercise. An unknown item still says Not found.
  if (markedDone) return null

  // req-186 — keyed by item, so the view state (req-212: the set open in the edit sheet)
  // never carries over when the pill opens another exercise on this same route shape.
  return <WorkoutItemLive key={itemKey(item)} routineId={routineId} item={item} />
}

// req-117 — restoreFromLoggedSet moved to workout-log.js (pure, unit-tested; it now
// also restores a timed set's logged seconds).

// req-78 — the req-27 RestUpcoming panel (an editable "next weight" shown during a
// blocking rest) is gone. Rest no longer blocks: the next set's own log form is shown
// immediately on completing a set, and its weight field IS the editable surface, so the
// separate panel and its nextSetWeight override folded away. The rest itself now shows
// only as the floating pill (req-186: the WorkoutPill).

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
  const { resting, now } = useRestCountdown(active)
  // req-217 (DEC-119 §6) — read from the library at display time (lazy chunk; null until it
  // loads, and then the screen reads as before): a unilateral entry's reps read "12 each side";
  // during this exercise's rest the routine note + up to 3 form cues show under the set list.
  const library = useExerciseLibrary()
  const eachSide = isEachSide(ex, library)
  // req-125 — the log form's values are kept as a draft on the active workout
  // (`setDraft`, see setDraftKey in workout-log.js) so navigation and a tab reload don't
  // lose them. The draft is written as the user edits (useSetDraftWriter, debounced) and
  // read only when the current set changes (draftSnap below).
  const setSeedKey = setDraftKey(item, currentType, currentWorkIndex)
  const draftWriter = useSetDraftWriter(store)
  // req-212 — the logged set open in the edit sheet (an index into active.sets), as view
  // state; null = none. The set form underneath stays mounted, its typing untouched.
  const [editIndex, setEditIndex] = useState(null)

  useEffect(() => {
    if (!resting && plannedDone) markDoneAndGoToReview(store, active, routineId, item)
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

  function completeSet({ weight, reps, note, durationSec, cardio }) {
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
    // req-83 (N9) — a field entered differently from the seed becomes the seed for
    // this exercise's remaining sets this session. Compared against `seed` (what the
    // form presented, incl. any earlier override); only a changed field propagates.
    // Merged into the same activeWorkout patch as the rest timer. req-108 (DEC-052) —
    // weight only; a reps change stays on its own set.
    const seedOverrides = nextSeedOverrides(active.seedOverrides, {
      exerciseId: item.exerciseId,
      setType: currentType,
      weighted,
      // req-10 — compared against the seed WITHOUT the setup suggestion (plainSeed): set 2
      // logged at the suggested kg is this session's new kg, carried to the remaining sets.
      seed: plainSeed,
      // req-154 — the parsed kg, not the typed text: `22,5` must compare (and carry) as 22.5.
      logged: { weight: loggedWeight, reps },
    })
    const fields = {
      routineItemId: itemKey(item),
      exerciseId: item.exerciseId,
      setType: currentType,
      weight: loggedWeight,
      reps: reps || '',
      // req-85 — a timed work set logs seconds in place of reps; only set when present.
      // req-155 — already whole seconds from SetLogForm (seconds-input.js).
      ...(durationSec != null ? { durationSec } : {}),
      // req-212 (DEC-119 §1) — no effort on the set: the exercise review writes one effort onto
      // every work set of the item (store.setItemEffort); left unpicked, it stays null.
      // Review round 1 — effort is per exercise: a work set logged on an item that already has a
      // picked effort (Add set after the review) gets that same effort.
      rpe: currentType === 'work' && itemEffort(active, item) !== '' ? itemEffort(active, item) : null,
      note,
      targetReps: target || '',
      targetWeight:
        currentType === 'work' && item.suggestedWeights?.[currentWorkIndex] != null
          ? item.suggestedWeights[currentWorkIndex]
          : null,
      // req-212 — when the set was logged (ISO). Editing never changes it; nothing shows it yet.
      loggedAt: new Date().toISOString(),
    }
    // req-194 — a cardio set's duration / level / distance: each only when entered.
    const setRecord = cardio ? withCardioValues(fields, cardio) : fields
    store.completeSet(setRecord, { ...restAfterSet(), seedOverrides }, { draftKey: setSeedKey })
    if (done) finishExercise(setRecord)
    else if (currentType === 'work' && currentWorkIndex === 0) askHowItFelt(setRecord)
  }

  // req-10 (DEC-123 §1) — in setup mode, set 1's Done asks "How was that?" once. The answer
  // only seeds set 2 (setTwoSeed: an editable prefill + its reason); it is never written onto a
  // set (set 1 keeps rpe null — req-212 would spread it as the exercise effort). Skip, the
  // backdrop, Escape or navigating away → nothing written: set 2 keeps the plain carry.
  function askHowItFelt(set1) {
    if (!setupSheetShows({ ex, entry: setupEntry, set1, exerciseDone: false })) return
    askChoice('', {
      title: SETUP_TEXT.sheetTitle,
      choices: SETUP_FEELS.map(({ value, label }) => ({ value, label })),
      cancelLabel: SETUP_TEXT.sheetSkip,
    }).then((feel) => {
      recordButton(feel ? `setup-feel-${feel}` : 'setup-feel-skip')
      const seed = feel
        ? setTwoSeed({ ex, set1, feel, target1: target, target2: setTargetFor(item, 'work', 1) })
        : null
      // Skip is remembered too (the sheet never asks again for this exercise).
      store.patchActive(
        firstTimeSetupPatch(active, item.exerciseId, {
          mode: 'setup',
          answered: feel || 'skip',
          ...(seed ? { seed: { ...seed, itemKey: itemKey(item) } } : {}),
        }),
      )
    })
  }

  // req-187 — the set that finishes the exercise: req-212 — the exercise review, then (only
  // when the logged kg differs from the routine) the routine-kg sheet over it.
  function finishExercise(setRecord) {
    const offer = offerOnFinishingSet(active, store.routines, item, setRecord, true)
    markDoneAndGoToReview(store, active, routineId, item)
    if (offer) askRoutineUpdate(store, routineId, item, offer)
  }

  function skipSet() {
    recordButton('skip-set')
    draftWriter.cancel()
    const done = finishAfterThisSet()
    const setRecord = {
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
      // req-212 — Skip set records when, too.
      loggedAt: new Date().toISOString(),
    }
    store.completeSet(setRecord, restAfterSet(true), { draftKey: setSeedKey })
    // req-187 — skipping the last set also finishes the exercise: the sheet offers the kg of
    // the sets that were logged (the skipped one keeps the routine's kg, routineUpdateOffer).
    if (done) finishExercise(setRecord)
  }

  // req-212 (DEC-119 §1) — Previous / Next are gone: a tap on a done row of the set list
  // opens that logged set in the edit sheet (LoggedSetSheet: Save via updateActiveSet, the
  // rest untouched). Upcoming rows stay inert.
  function openLoggedSet(row) {
    if (!state.logged.includes((active.sets || [])[row.setIndex])) return
    recordButton('open-logged-set')
    setEditIndex(row.setIndex)
  }

  // req-117 — "Remove set": undo an "Add set" whose set hasn't been logged yet. Pops
  // the last (unlogged, added) set and recomputes done; when every remaining set is
  // logged the exercise is done again and this returns to the overview, as completing
  // its last set does (DEC-013).
  const removable = canRemoveAddedSet(active, item)
  function removeSet() {
    const patch = removeAddedSetPatch(active, itemKey(item))
    if (!patch) return
    recordButton('remove-set')
    store.patchActive(patch)
    if ((patch.completedItemIds || []).includes(itemKey(item))) {
      go(itemDonePath(routineId, item), { replace: true })
    }
  }

  const weighted = isWeightedType(ex.type)
  const repsLabel = ex?.type === 'cardio' || isDurationTarget(target) ? 'Duration' : eachSide ? 'Reps each side' : 'Reps'
  // req-85 — a timed exercise counts down a duration on its WORK sets (a warmup set
  // stays reps-based). Target seconds: this set's routine duration, else the last one
  // in the list, else the exercise default, else the app default. Never invents beyond
  // that default target (the value is editable and logged as the target, v1).
  // req-106 — the rule itself moved to durationTargetFor (shared with the preview).
  const timedSet = Boolean(ex?.hasDuration) && currentType === 'work'
  // req-194 (DEC-108 §4) — a cardio exercise that isn't timed logs Duration (stopwatch),
  // Level and Distance (the timed countdown is unchanged). The unit starts on the one this
  // exercise's last finished distance used, else m.
  const cardioForm = ex?.type === 'cardio' && !timedSet
  const distanceUnit = lastDistanceUnit(last?.sets)
  // Review fix 3 — a single-time target ("20 min", "12:30") prefills Duration (DESIGN §1, the
  // set's target, as Reps was for cardio before); a range ("5-8 min") stays a note.
  const targetSec = cardioForm ? targetDurationSec(target) : null
  // Review fix 1 — the stopwatch is its own activeWorkout field (workout-log.js): this set's,
  // or the exercise whose live stopwatch refuses a second Start here.
  const stopwatch = cardioForm ? stopwatchFor(active, setSeedKey) : null
  const stopwatchHolder = cardioForm && !stopwatch ? stopwatchOwner(active) : null
  function startStopwatch(baseSec) {
    const patch = startStopwatchPatch(active, setSeedKey, baseSec)
    if (!patch) return
    recordButton('stopwatch-start')
    store.patchActive(patch)
  }
  function stopStopwatch() {
    if (!stopwatchFor(active, setSeedKey)) return
    recordButton('stopwatch-stop')
    store.patchActive({ stopwatch: null })
  }
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
  // req-78 — the req-27 upcoming-weight override is gone (the next set's form is now the
  // editable surface). req-178 — a work set's kg comes from the routine, not history.
  // req-183 — also handed to SetLogForm with historyPrefill.weight, for the kg notes only
  // (kg-hints.js: last time / big change); the box's value is still the seed's.
  const routineKg = routineKgFor(item, currentType, currentWorkIndex)
  const seedInputs = {
    weighted,
    fromRestore: false,
    restore: null,
    hasHistory: Boolean(last),
    historyHasSet: historyHasSetAt(last, { setType: currentType, workIndex: currentWorkIndex }),
    history: historyPrefill,
    carry: carryForSet(currentType, state.workLogged),
    target,
    override,
    // req-178 / DEC-096 §1 — a work set's kg is the routine's (the snapshot item's).
    routineKg,
    // req-210 / DEC-117 §3 — a changed rep count carries only on a uniform plan (3 × 10).
    uniformReps: uniformRepsTargets(item),
  }
  // req-10 (DEC-123 §1) — first-time setup. `setupEntry`: this exercise's answer this workout
  // (activeWorkout.firstTimeSetup); `setupSeed`: set 2's seed from set 1 + "How was that?",
  // only on the set it names. `plainSeed` (without it) is req-83's comparison base, so a kept
  // suggestion counts as this session's kg change and carries on to sets 3+ (DEC-052).
  const setupEntry = firstTimeSetupFor(active, item.exerciseId)
  const setupSeed = setupSeedFor(active, item, currentType, currentWorkIndex)
  const plainSeed = initialSetFields(seedInputs)
  const seed = setupSeed ? initialSetFields({ ...seedInputs, setup: setupSeed }) : plainSeed
  const showSetupPrompt = setupPromptShows({ ex, hasHistory: Boolean(last), currentType, workLogged: state.workLogged, entry: setupEntry })
  const showSetupGuide = setupEntry?.mode === 'setup' && currentType === 'work' && state.workLogged.length === 0
  function answerSetupPrompt(mode) {
    recordButton(mode === 'setup' ? 'setup-start' : 'setup-manual')
    store.patchActive(firstTimeSetupPatch(active, item.exerciseId, { mode }))
  }

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
  // req-165 (F-LINT-1) — re-seeded when the set (or its seed) changes by adjusting state
  // during render, as draftSnap above does, rather than in an effect (which rendered one
  // pass with the old set's note first). Same trigger: setSeedKey or noteSeed.
  const noteKey = `${setSeedKey}\u0000${noteSeed}`
  const [noteState, setNoteState] = useState(() => ({ key: noteKey, note: noteSeed, show: Boolean(noteSeed) }))
  if (noteState.key !== noteKey) setNoteState({ key: noteKey, note: noteSeed, show: Boolean(noteSeed) })
  const current = noteState.key === noteKey ? noteState : { note: noteSeed, show: Boolean(noteSeed) }
  const { note, show: showNote } = current
  const setNote = (value) => setNoteState((s) => ({ ...s, note: value }))
  const setShowNote = (value) => setNoteState((s) => ({ ...s, show: value }))
  // req-78 — the next set's log form is now shown throughout rest (rest doesn't block
  // input), so the note affordance shows whenever the form does: any time the exercise
  // isn't planned-done. (`resting` no longer gates the form.)
  const logging = !plannedDone
  // req-106 — at the start of the exercise (no set of it logged yet), a small read-only
  // preview of every set's weight/reps so all the weights can be picked up at once.
  // Each line is exactly what that set's form would prefill (setPreview → the same
  // initialSetFields inputs as `seed` above). Gone once the first set is completed or
  // skipped.
  // req-186 (DEC-103 §4) — the list now stays for the whole exercise (setListRows): done
  // sets show what was logged, the set on screen is highlighted (aria-current), upcoming
  // sets show what their form would prefill — the same rule as before, plus the session
  // carry their form will apply.
  const setRows = logging
    ? setListRows({
        workout: active,
        item,
        ex,
        weighted,
        hasHistory: Boolean(last),
        historyFor: (at) => historySetPrefill(last, at),
        viewingIndex: editIndex,
        eachSide,
      })
    : null
  const restNotes = logging && restNotesShowing(active, item, now) ? restNotesFor(item, ex, library) : null

  return (
    <Screen className="ui-screen--rest">
      <ExercisesLink routineId={routineId} name={active.snapshot?.routineName} />
      {/* req-186 — the workout pill (rest clock / GO + set N/M; self-hides with no current exercise).
          req-192 — told which item this screen is, so on the current exercise a tap skips the rest. */}
      <WorkoutPill ownItemKey={itemKey(item)} />
      <ExerciseTitle
        routineId={routineId}
        item={item}
        ex={ex}
        bits={[
          roleTag(item.role),
          // req-186 — the small "N/M" left the title: the set list and the workout pill
          // carry it (itemSetPosition, workout-log.js).
          currentType === 'wu' ? 'Warm-up set' : null,
        ]}
        aside={
          logging && !showNote ? (
            <Button variant="quiet" className="ui-addnote" onClick={() => setShowNote(true)}>
              Add note
            </Button>
          ) : null
        }
      />
      {/* req-217 (DEC-119 §6) — the routine's note for this exercise left the title area: it
          shows in the rest notes under the set list (below), while this exercise's rest runs. */}
      {/* req-192 (DEC-108 §6) — the set list sits under the title, above kg / reps.
          req-212 — the library SetList; a done row opens that set in the edit sheet. */}
      {setRows ? <SetList rows={setRows} onOpen={openLoggedSet} /> : null}
      {/* req-217 — the routine note, then up to 3 form cues; gone when the rest ends or is skipped. */}
      {restNotes ? <RestNotes note={restNotes.note} cues={restNotes.cues} /> : null}
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
              durationSec: timedSet ? formInit.durationSec : undefined,
              ...(cardioForm && formInit.cardio ? { cardio: formInit.cardio } : {}),
            })
          }}
          autoFocus={!noteSeed}
        />
      ) : null}
      {/* req-78 — the next set's log form shows immediately on completing a set, during
          rest included (no intermediate rest panel, no extra tap). Its log buttons are live
          while the pill counts down (D2, self-paced). The form remounts per set by
          `key`; rest ending doesn't change the key, so in-progress edits survive. Once
          the exercise is planned-done, completeSet has already advanced to the overview. */}
      {/* req-10 (DEC-123 §1) — first-time setup, kept beside the form (SetLogForm untouched):
          the prompt at the first work set of a no-history exercise; in setup, the guide line on
          set 1; on set 2, the reason for its suggested prefill. */}
      {logging && showSetupPrompt ? (
        <div className="ui-first-time" role="group" aria-label="First time">
          <p className="ui-sub">{SETUP_TEXT.prompt}</p>
          <Actions
            lateral={
              <Button variant="quiet" onClick={() => answerSetupPrompt('manual')}>
                {SETUP_TEXT.manual}
              </Button>
            }
            forward={
              <Button variant="secondary" onClick={() => answerSetupPrompt('setup')}>
                {SETUP_TEXT.setUp}
              </Button>
            }
          />
        </div>
      ) : null}
      {logging && showSetupGuide ? (
        <p className="ui-field-note ui-first-time__guide">{ex.type === 'bodyweight' ? SETUP_TEXT.guideBodyweight : SETUP_TEXT.guideWeighted}</p>
      ) : null}
      {logging && setupSeed?.reason ? <p className="ui-field-note ui-first-time__reason">{setupSeed.reason}</p> : null}
      {/* req-10 — the keyed Fragment remounts the form once when the setup seed lands (the sheet
          is answered after set 2's form is already up); the form itself stays keyed per set. */}
      {plannedDone ? null : (
        <Fragment key={setupSeed ? 'setup-seed' : 'plain'}>
        <SetLogForm
          key={setSeedKey}
          weighted={weighted}
          timed={timedSet}
          repsLabel={repsLabel}
          initialWeight={formInit.weight}
          initialReps={formInit.reps}
          initialDuration={formInit.durationSec}
          cardio={cardioForm}
          initialCardio={
            cardioForm ? formInit.cardio || { distanceUnit, duration: targetSec ? clockText(targetSec) : '' } : null
          }
          cardioHint={cardioForm && target && !targetSec ? `Target ${target}` : ''}
          stopwatch={stopwatch}
          stopwatchBlockedBy={stopwatchHolder ? exerciseName(stopwatchHolder) : ''}
          onStopwatchStart={startStopwatch}
          onStopwatchStop={stopStopwatch}
          routineKg={routineKg}
          lastKg={historyPrefill.weight}
          kgLabel={kgLabelFor(ex)}
          onComplete={({ weight, reps, durationSec, cardio }) => completeSet({ weight, reps, note, durationSec, cardio })}
          onSkip={skipSet}
          onChange={(values, opts) => {
            draftWriter.form(setSeedKey, values, note)
            // req-194 — a stopwatch Start / Stop is written now, not after the debounce.
            if (opts?.now) draftWriter.flush()
          }}
        />
        </Fragment>
      )}
      {/* req-109 — exercise-level lateral actions, in normal flow below the form (the
          set-level bar stays pinned at the bottom).
          req-188 (DEC-103 §2) — Skip exercise and Swap exercise moved to the workout list's
          row "⋯" sheet. req-192 (DEC-108 §3) — Skip rest is gone: the pill skips it here.
          req-117 — Remove set, only on an unlogged extra set (canRemoveAddedSet). */}
      {logging && removable ? (
        <Actions
          className="ui-exercise-actions"
          lateral={
            <Button variant="quiet" onClick={removeSet}>
              Remove set
            </Button>
          }
        />
      ) : null}
      {editIndex != null ? (
        <LoggedSetSheet key={editIndex} item={item} ex={ex} index={editIndex} eachSide={eachSide} onClose={() => setEditIndex(null)} />
      ) : null}
      {/* req-26 — the equipment + cues block that sat under the buttons is removed
          to declutter the mid-set screen. Cues stay reachable: the exercise Title
          is a link to the exercise editor (which shows them). */}
    </Screen>
  )
}

// req-212 (DEC-119 §1) — one logged set in the edit sheet (SetEditSheet), opened from a done
// row of the set list (live screen) or a set line (review). Its own fields only — kg + reps,
// a timed set's seconds, or a cardio set's fields; no effort. Save writes through
// store.updateActiveSet (the sets array only: restEndsAt / restPausedRemaining untouched, as
// req-186's Save did) with the same patch and seed-override rerun (viewedSetSave, DEC-052);
// `loggedAt` is never in the patch, so it is kept. `onSaved` runs after the write (the review
// re-applies its effort). Cancel / backdrop / Escape write nothing.
function LoggedSetSheet({ item, ex, index, eachSide = false, onClose, onSaved }) {
  const store = useStore()
  const active = store.activeWorkout
  const set = active?.sets?.[index]
  if (!set) return null
  const last = lastSetsForExercise(store.workouts, item.exerciseId)
  const workLogged = itemLoggingState(active, item).workLogged
  const type = set.setType === 'wu' ? 'wu' : 'work'
  const workIndex = Math.max(0, workLogged.indexOf(set))
  const weighted = isWeightedType(ex?.type)
  const timed = Boolean(ex?.hasDuration) && type === 'work'
  const cardio = ex?.type === 'cardio' && !timed
  const target = setTargetFor(item, type, workIndex)
  const init = setDraftFromLoggedSet('', set)
  const skipped = isSkippedSet(set)
  function save(values) {
    const result = viewedSetSave(values, {
      weighted,
      timed,
      initialEffort: '',
      set,
      presentedWeight: weighted ? init.weight : '',
      seedOverrides: active.seedOverrides,
      sets: active.sets || [],
      setIndex: index,
    })
    if (!result) return
    recordButton('save-set')
    store.updateActiveSet(index, result.setPatch)
    if (result.seedOverrides !== active.seedOverrides) store.patchActive({ seedOverrides: result.seedOverrides })
    onSaved?.()
    onClose()
  }
  return (
    <SetEditSheet
      title={type === 'wu' ? 'Warm-up set' : `Set ${workIndex + 1}`}
      weighted={weighted}
      timed={timed}
      cardio={cardio}
      repsLabel={ex?.type === 'cardio' || isDurationTarget(target) ? 'Duration' : eachSide ? 'Reps each side' : 'Reps'}
      kgLabel={kgLabelFor(ex)}
      initialWeight={weighted ? init.weight : ''}
      initialReps={init.reps}
      // Review round 1 — a skipped timed set starts blank: the target is never written as if measured.
      initialDuration={timed && !skipped ? init.durationSec ?? durationTargetFor(item, ex, workIndex) : ''}
      skipped={skipped}
      initialCardio={cardio ? cardioFormText(set, lastDistanceUnit(last?.sets)) : null}
      cardioHint={cardio && set.durationSec == null && init.reps ? `Logged as ${init.reps}` : ''}
      onSave={save}
      onCancel={onClose}
    />
  )
}

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
      <ExerciseTitle routineId={routineId} item={item} ex={ex} bits={[roleTag(item.role)]} />
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
          {/* Review round 1 — clearable: "—" takes a mis-tap back to none (rpe null on those sets). */}
          <SegmentedControl clearable options={EFFORT_OPTIONS} value={effort} onChange={pickEffort} ariaLabel="Effort" />
        </>
      ) : null}
      {/* Navigation only (nothing written), so links wearing the button look (DEC-040). Finish:
          the auto-complete summary on the overview when it is armed (as the last Done reached
          before req-212), else the Finish screen. */}
      <div className="ui-workout-end">
        {next ? (
          <NavLink to={itemLogPath(routineId, next)} look="primary" block>
            Next: {exerciseName(next)}
          </NavLink>
        ) : (
          <NavLink to={autoCompleteArmed(active) ? `/workout/${routineId}` : `/workout/${routineId}/finish`} look="primary" block>
            Finish
          </NavLink>
        )}
        <NavLink to={`/workout/${routineId}`} look="secondary" block>
          Choose exercise
        </NavLink>
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

// req-212 review round 1 — the old per-set edit route (/workout/<id>/set/<n>) no longer has a
// screen: nothing links to it, and its form offered per-set effort (Failure included) on a live
// set (DEC-119 §1). An old link or Back entry is replaced by that set's exercise — its review
// when done, else its log screen — where the edit sheet edits the set. Nothing is written.
export function WorkoutSetEdit({ routineId, index }) {
  const store = useStore()
  const workout = store.activeWorkout
  const set = workout?.routineId === routineId ? workout.sets?.[index] : null
  const item = set ? workout?.snapshot?.items?.find((candidate) => itemKey(candidate) === set.routineItemId) : null
  const target = item ? itemSetsPath(routineId, item, workout) : null

  useEffect(() => {
    if (target) go(target, { replace: true })
  }, [target])

  if (workout?.routineId !== routineId) return <NotInWorkout routineId={routineId} />
  if (!set || !item) return <Missing>Not found.</Missing>
  return null
}
