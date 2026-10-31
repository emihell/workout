import { Fragment, useEffect, useState } from 'react'
import { isWeightedType, roleTag } from '../../ids'
import { go, hashPath, parseRoute } from '../../route'
import { recordButton } from '../../analytics'
import { isDurationTarget } from '../../progress'
import { historyHasSetAt, historySetPrefill, lastSetsForExercise } from '../../history-queries.js'
import { useStore } from '../../store-context'
import {
  canRemoveAddedSet,
  itemEffort,
  itemIsMarkedDone,
  itemKey,
  itemLoggingState,
  removeAddedSetPatch,
  setMatchesItem,
  skipItemPatch,
} from '../../workout-items.js'
import {
  carryForSet,
  uniformRepsTargets,
  durationTargetFor,
  initialSetFields,
  routineKgFor,
  nextSeedOverrides,
  seedOverrideKey,
  setTargetFor,
  setupSeedFor,
} from '../../set-seed.js'
import {
  formFieldsWithDraft,
  setDraftFor,
  setDraftKey,
} from '../../set-drafts.js'
import { setListRows } from '../../set-display.js'
import { nextNotDoneItem } from '../../workout-progress.js'
import {
  restPatchAfterSet,
  startStopwatchPatch,
  stopwatchFor,
  stopwatchOwner,
} from '../../workout-timers.js'
import { liveSetWeight } from '../set-values.js'
import { ExercisesLink, Missing } from '../shared'
import {
  Actions,
  Button,
  Field,
  RestNotes,
  Screen,
  SetList,
  SetLogForm,
} from '../../ui/index.jsx'
import { MissingItem, NotInWorkout } from './helpers'
import {
  exerciseName,
  findItem,
  finishTarget,
  isActiveFor,
  itemDonePath,
  itemLogPath,
  itemSetsPath,
  skipExercise,
} from './workout-helpers.js'
import { arrivalFor, clearArrival, markArrival } from '../../up-next.js'
import { WorkoutPill } from './rest'
import { useRestCountdown } from './rest-countdown.js'
import { unlockAudio } from '../../rest-cue'
import { askChoice } from '../../ui/confirm.js'
import {
  SETUP_FEELS,
  SETUP_TEXT,
  firstTimeSetupFor,
  firstTimeSetupPatch,
  setupAnsweredPatch,
  setupPromptShows,
  setupSheetShows,
} from '../../first-time-setup.js'
import { offerOnFinishingSet } from '../../routine-update-offer.js'
import { kgLabelFor } from '../../kg-label.js'
import { clockText, lastDistanceUnit, targetDurationSec, withCardioValues } from '../../cardio-set.js'
import { durationLabel, isEachSide, restNotesFor, restNotesShowing } from '../../library-hints.js'
import { useExerciseLibrary } from './use-library.js'
import { liveExercise, markDoneAndGoToReview, askRoutineUpdate, useSetDraftWriter } from './item-actions.js'
import { ExerciseTitle } from './item-header.jsx'
import { UpNextBar } from './up-next-bar.jsx'
import { LoggedSetSheet } from './logged-set-sheet.jsx'

export function WorkoutItemLog({ routineId, itemId }) {
  const store = useStore()
  const active = store.activeWorkout
  const mine = isActiveFor(active, routineId)
  const item = mine ? findItem(active.snapshot?.items, itemId) : null
  const markedDone = Boolean(item && itemIsMarkedDone(active, item))

  // req-212 — a marked-done item belongs on its review (where the last Done lands).
  // req-223 — only while the browser is still ON this log screen: the Up next bar's Skip marks
  // the item done and has already moved on to the next exercise (or Finish) in the same tap.
  useEffect(() => {
    if (!markedDone || !item) return
    // Compared as the parsed route (review fix 1), so `…/log?x=1` or `…/log/` still redirects.
    const here = parseRoute(hashPath(window.location.hash))
    if (here.name !== 'workout-item-log' || here.routineId !== routineId || here.itemId !== itemId) return
    go(itemDonePath(routineId, item), { replace: true })
  }, [markedDone, routineId, itemId, item])

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

function WorkoutItemLive({ routineId, item }) {
  const store = useStore()
  const active = store.activeWorkout
  const ex = liveExercise(store, item)
  const last = lastSetsForExercise(store.workouts, item.exerciseId)
  const state = itemLoggingState(active, item)
  // req-223 — the Up next bar: this screen was arrived at from a new Start, a review's Next or
  // the bar's Skip (a pure read of the in-memory marker, then cleared below), and no set of
  // this exercise is logged. Hidden by the countdown, Start now, or the first logged set.
  const [upNext, setUpNext] = useState(() => arrivalFor(routineId, item) && state.logged.length === 0)
  useEffect(() => clearArrival(), [])
  // Review fix 3 — a logged set ends the bar for good (state adjusted during render, as draftSnap
  // below), so it can never come back with a fresh countdown even if the set count drops again.
  if (upNext && state.logged.length > 0) setUpNext(false)
  const showUpNext = upNext && state.logged.length === 0
  // Skip from the bar: the list's Skip exercise, then ARRIVE at the next not-done exercise (its
  // own bar); none left → the review's Finish target. Computed on the workout as the skip leaves
  // it (the same pure patch store.skipItem applies). Replaces this entry: the skipped exercise's
  // log screen is gone (it would only bounce to its review).
  function skipFromBar() {
    const after = { ...active, ...skipItemPatch(active, itemKey(item)) }
    skipExercise(store, item)
    const next = nextNotDoneItem(after, item)
    if (next) {
      markArrival(routineId, next)
      go(itemLogPath(routineId, next), { replace: true })
    } else {
      go(finishTarget(after, routineId), { replace: true })
    }
  }
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
  // (`setDraft`, see setDraftKey in set-drafts.js) so navigation and a tab reload don't
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
  // backdrop, Escape or navigating away → no seed: set 2 keeps the plain carry (the Skip is
  // remembered, so the sheet never asks again for this exercise).
  // Review round 1 — the patch is built from the active workout at answer time (a functional
  // patch), not this render's pre-set-1 copy.
  function askHowItFelt(set1) {
    if (!setupSheetShows({ ex, entry: setupEntry, set1, exerciseDone: false, key: itemKey(item) })) return
    askChoice('', {
      title: SETUP_TEXT.sheetTitle,
      choices: SETUP_FEELS.map(({ value, label }) => ({ value, label })),
      cancelLabel: SETUP_TEXT.sheetSkip,
    }).then((feel) => {
      recordButton(feel ? `setup-feel-${feel}` : 'setup-feel-skip')
      store.patchActive((current) => setupAnsweredPatch(current, item, ex, feel))
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
    // req-241 — the form underneath may remount when the sheet changes the carry (formKey
    // below); write any typing still waiting on the debounce first, so the remount reads it.
    draftWriter.flush()
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
  // Review fix 1 — the stopwatch is its own activeWorkout field (workout-timers.js): this set's,
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
  // Review round 1 — the guide belongs to the item the prompt was answered on.
  const showSetupGuide =
    setupEntry?.mode === 'setup' && setupEntry.itemKey === itemKey(item) && currentType === 'work' && state.workLogged.length === 0
  // req-239 — the only answer now: 'manual' is never written (old entries still hide the link).
  function startSetup() {
    recordButton('setup-start')
    store.patchActive((current) => firstTimeSetupPatch(current, item.exerciseId, { mode: 'setup', itemKey: itemKey(item) }))
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
  // req-241 — `formKey`: also a new carry for this set kind (a done set's Save or Skip set in the
  // sheet re-runs it, DEC-052), so the form re-seeds from it, with the draft read again.
  const formKey = `${setSeedKey}\u0000${override?.weight ?? ''}`
  const [draftSnap, setDraftSnap] = useState(() => ({ key: formKey, draft: setDraftFor(active, setSeedKey) }))
  if (draftSnap.key !== formKey) setDraftSnap({ key: formKey, draft: setDraftFor(active, setSeedKey) })
  const draft = draftSnap.key === formKey ? draftSnap.draft : setDraftFor(active, setSeedKey)
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
  const nextItem = nextNotDoneItem(active, item)

  return (
    <Screen className="ui-screen--rest">
      <ExercisesLink routineId={routineId} name={active.snapshot?.routineName} />
      {/* req-186 — the workout pill (rest clock / GO + set N/M; self-hides with no current exercise).
          req-192 — told which item this screen is, so on the current exercise a tap skips the rest. */}
      <WorkoutPill ownItemKey={itemKey(item)} />
      {/* req-223 — the Up next bar sits above the exercise, under the pill. */}
      {showUpNext ? <UpNextBar item={item} routineId={routineId} onHide={() => setUpNext(false)} onSkip={skipFromBar} /> : null}
      <ExerciseTitle
        routineId={routineId}
        item={item}
        ex={ex}
        bits={[
          roleTag(item.role),
          // req-186 — the small "N/M" left the title: the set list and the workout pill
          // carry it (itemSetPosition, workout-progress.js).
          currentType === 'wu' ? 'Warm-up set' : null,
        ]}
        eachSide={eachSide}
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
      {/* req-241 — what comes after this exercise (the review's Next), quiet; the Up next bar
          already says it, so not while that shows. None left → nothing. */}
      {nextItem && !showUpNext ? <p className="ui-sub">Next: {exerciseName(nextItem)}</p> : null}
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
      {/* req-10 (DEC-123 §1) — first-time setup, kept beside the form (SetLogForm untouched): in
          setup, the guide line on set 1; on set 2, the reason for its suggested prefill. req-239
          (DEC-138) — the "First time" question is gone; its trigger is the link under the form. */}
      {logging && showSetupGuide ? (
        <p className="ui-field-note ui-first-time__guide">{ex.type === 'bodyweight' ? SETUP_TEXT.guideBodyweight : SETUP_TEXT.guideWeighted}</p>
      ) : null}
      {logging && setupSeed?.reason ? <p className="ui-field-note ui-first-time__reason">{setupSeed.reason}</p> : null}
      {/* req-10 — the keyed Fragment remounts the form when the setup seed lands or changes (the
          sheet is answered after set 2's form is already up; review round 1 — an edit of set 1
          re-seeds it); the form itself stays keyed per set. */}
      {plannedDone ? null : (
        <Fragment key={setupSeed ? `setup|${setupSeed.weight ?? ''}|${setupSeed.reps ?? ''}` : 'plain'}>
        <SetLogForm
          key={formKey}
          weighted={weighted}
          timed={timedSet}
          repsLabel={repsLabel}
          durationLabel={durationLabel(eachSide)}
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
      {/* req-239 (DEC-138) — no question: the form logs set 1 as is; this quiet link starts the
          guided setup (today's [Set it up]) at the first work set of a no-history exercise. */}
      {logging && showSetupPrompt ? (
        <Actions
          className="ui-first-time"
          lateral={
            <Button variant="quiet" onClick={startSetup}>
              {SETUP_TEXT.helpLink}
            </Button>
          }
        />
      ) : null}
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

// req-212 review round 1 — the old per-set edit route (/workout/<id>/set/<n>) no longer has a
// screen: nothing links to it, and its form offered per-set effort (Failure included) on a live
// set (DEC-119 §1). An old link or Back entry is replaced by that set's exercise — its review
// when done, else its log screen — where the edit sheet edits the set. Nothing is written.
export function WorkoutSetEdit({ routineId, index }) {
  const store = useStore()
  const workout = store.activeWorkout
  const set = workout?.routineId === routineId ? workout.sets?.[index] : null
  // req-274 — the shared set↔item matcher (was itemKey(candidate) === set.routineItemId).
  const item = set ? workout?.snapshot?.items?.find((candidate) => setMatchesItem(set, candidate, workout.snapshot.items)) : null
  const target = item ? itemSetsPath(routineId, item, workout) : null

  useEffect(() => {
    if (target) go(target, { replace: true })
  }, [target])

  if (workout?.routineId !== routineId) return <NotInWorkout routineId={routineId} />
  if (!set || !item) return <Missing>Not found.</Missing>
  return null
}
