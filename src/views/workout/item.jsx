import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { RPE_OPTIONS, formatSetLine, isWeightedType, roleTag } from '../../ids'
import { go } from '../../route'
import { recordButton } from '../../analytics'
import { isDurationTarget } from '../../progress'
import { exerciseById } from '../../model.js'
import { historyHasSetAt, historySetPrefill, lastSetsForExercise } from '../../history-queries.js'
import { useStore } from '../../store-context'
import {
  canRemoveAddedSet,
  carryForSet,
  uniformRepsTargets,
  createSetDraftWriter,
  durationTargetFor,
  formFieldsWithDraft,
  initialSetFields,
  routineKgFor,
  itemIsMarkedDone,
  itemKey,
  itemLoggingState,
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
  setListRows,
  setTargetFor,
  startStopwatchPatch,
  stopwatchFor,
  stopwatchOwner,
} from '../../workout-log'
import { SetEditForm } from '../set-edit'
import { activeSetPatch, liveSetWeight, viewedSetSave } from '../set-values.js'
import { Back, ExercisesLink, Missing } from '../shared'
import { Actions, Button, Field, List, NavLink, Row, Screen, SectionHeader, SetLogForm, Title } from '../../ui/index.jsx'
import { MissingItem, NotInWorkout } from './helpers'
import { exerciseName, findItem, isActiveFor, itemLogPath, itemSetsPath } from './workout-helpers.js'
import { WorkoutPill } from './rest'
import { useRestCountdown } from './rest-countdown.js'
import { unlockAudio } from '../../rest-cue'
import { askConfirm } from '../../ui/confirm.js'
import { offerOnFinishingSet, offerSheetText } from '../../routine-update-offer.js'
import { kgLabelFor } from '../../kg-label.js'
import { cardioFormText, clockText, lastDistanceUnit, targetDurationSec, withCardioValues } from '../../cardio-set.js'
import { equipmentLabel } from '../../equipment-label.js'

// req-119 — type / Timed / name / equipment come from the snapshot (sessionExercise,
// workout-log.js); weight step and cues stay live. Old snapshots read live as before.
function liveExercise(store, item) {
  return sessionExercise(exerciseById(store.exercises, item.exerciseId), item)
}

function exerciseEditorPath(routineId, item) {
  return `/workout/${routineId}/item/${itemKey(item)}/exercise`
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
      {ex?.equipment ? <p className="ui-sub">{equipmentLabel(ex.equipment)}</p> : null}
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

// req-187 (DEC-103 §1) — the routine-kg confirm, opened on the set that finishes the
// exercise when its kg differs from the routine (offerOnFinishingSet). It is the one
// ConfirmSheet with `stayOn` the overview, so the navigation there (markDoneAndGoToOverview,
// called first) does not dismiss it. Update → store.applyRoutineUpdate (the existing write
// path); Keep / backdrop / Escape / any other navigation → nothing written. Rest is
// untouched either way: it was armed by store.completeSet before this opens.
function askRoutineUpdate(store, routineId, item, offer) {
  const text = offerSheetText(offer, exerciseName(item))
  askConfirm(text.body, {
    title: text.title,
    confirmLabel: text.updateLabel,
    cancelLabel: text.keepLabel,
    stayOn: `/workout/${routineId}`,
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

  useEffect(() => {
    if (markedDone) go(`/workout/${routineId}`, { replace: true })
  }, [markedDone, routineId])

  if (!mine) return <NotInWorkout routineId={routineId} />
  if (!item) return <MissingItem />
  // req-162 — a marked-done item (just skipped, or done) is leaving: the effect above
  // replaces the route with the overview. Render nothing meanwhile — "Not found." here
  // flashed for one render after Skip exercise. An unknown item still says Not found.
  if (markedDone) return null

  // req-186 — keyed by item, so the view state (a logged set being viewed via Previous)
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
  const { resting } = useRestCountdown(active)
  // req-125 — the log form's values are kept as a draft on the active workout
  // (`setDraft`, see setDraftKey in workout-log.js) so navigation and a tab reload don't
  // lose them. The draft is written as the user edits (useSetDraftWriter, debounced) and
  // read only when the current set changes (draftSnap below).
  const setSeedKey = setDraftKey(item, currentType, currentWorkIndex)
  const draftWriter = useSetDraftWriter(store)
  // req-186 — the logged set Previous is showing (an index into active.sets), as view
  // state; null = the current set. Valid only while it is one of this item's logged sets.
  const [viewIndex, setViewIndex] = useState(null)
  const loggedIndexes = state.logged.map((set) => (active.sets || []).indexOf(set))
  const viewing = viewIndex != null && loggedIndexes.includes(viewIndex)
  const viewPos = viewing ? loggedIndexes.indexOf(viewIndex) : loggedIndexes.length
  const viewedSet = viewing ? active.sets[viewIndex] : null
  const viewedType = viewedSet?.setType === 'wu' ? 'wu' : 'work'
  const viewedWorkIndex = viewedSet ? Math.max(0, state.workLogged.indexOf(viewedSet)) : 0
  const viewedTimed = Boolean(ex?.hasDuration) && viewedType === 'work'

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

  function completeSet({ weight, reps, rpe, note, durationSec, cardio }) {
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
      seed,
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
      rpe: rpe ? Number(rpe) : null,
      note,
      targetReps: target || '',
      targetWeight:
        currentType === 'work' && item.suggestedWeights?.[currentWorkIndex] != null
          ? item.suggestedWeights[currentWorkIndex]
          : null,
    }
    // req-194 — a cardio set's duration / level / distance: each only when entered.
    const setRecord = cardio ? withCardioValues(fields, cardio) : fields
    store.completeSet(setRecord, { ...restAfterSet(), seedOverrides }, { draftKey: setSeedKey })
    if (done) finishExercise(setRecord)
  }

  // req-187 — the set that finishes the exercise: the overview as before, then (only when
  // the logged kg differs from the routine) the routine-kg sheet over it.
  function finishExercise(setRecord) {
    const offer = offerOnFinishingSet(active, store.routines, item, setRecord, true)
    markDoneAndGoToOverview(store, active, routineId, item)
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
    }
    store.completeSet(setRecord, restAfterSet(true), { draftKey: setSeedKey })
    // req-187 — skipping the last set also finishes the exercise: the sheet offers the kg of
    // the sets that were logged (the skipped one keeps the routine's kg, routineUpdateOffer).
    if (done) finishExercise(setRecord)
  }

  // req-186 (DEC-103 §4) — Previous VIEWS a logged set; it no longer un-logs it (was
  // removeActiveSet + a draft, req-25/req-125, which also cleared the armed rest). Which
  // set is shown is view state (`viewIndex`, an index into active.sets), not a stored
  // field. From the current set it shows the last logged set of this item; while viewing,
  // the one logged before the shown one. Nothing is written and the rest is untouched.
  function previousSet() {
    const index = loggedIndexes[viewPos - 1]
    if (index == null) return
    recordButton('previous-set')
    // The current set's typing is kept: write the pending draft now, so Next can re-read it.
    if (!viewing) draftWriter.flush()
    setViewIndex(index)
  }

  // req-191 §3 — a tap on a done row of the set list opens that logged set: the same view
  // Previous reaches (view state only; nothing written, the rest untouched). Upcoming rows
  // stay inert. The current set's typing is flushed first, as Previous does.
  function openLoggedSet(index) {
    if (!loggedIndexes.includes(index) || (viewing && index === viewIndex)) return
    recordButton('open-logged-set')
    if (!viewing) draftWriter.flush()
    setViewIndex(index)
  }

  // Next: back to the current set, nothing written, the rest untouched. The current set's
  // form remounts, so re-read its draft (flushed by Previous) the way a set change does.
  function backToCurrentSet() {
    setDraftSnap({ key: setSeedKey, draft: setDraftFor(active, setSeedKey) })
    setViewIndex(null)
  }

  function nextFromViewed() {
    recordButton('next-set')
    backToCurrentSet()
  }

  // Save (offered only once a field changed): the edited values onto that logged set via
  // updateActiveSet — the sets array only, so restEndsAt / restPausedRemaining stay as they
  // were — then back to the current set.
  // Review fix 2 — a changed kg re-runs the seed overrides for that set (DEC-052), as the
  // old un-log + re-Complete path did; written as seedOverrides only (rest untouched).
  function saveViewedSet(values) {
    const save = viewedSetSave(values, {
      weighted,
      timed: viewedTimed,
      initialEffort: viewedEffort,
      set: viewedSet,
      presentedWeight: weighted ? viewedInit.weight : '',
      seedOverrides: active.seedOverrides,
      sets: active.sets || [],
      setIndex: viewIndex,
    })
    if (!save) return
    recordButton('save-set')
    store.updateActiveSet(viewIndex, save.setPatch)
    if (save.seedOverrides !== active.seedOverrides) store.patchActive({ seedOverrides: save.seedOverrides })
    backToCurrentSet()
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
      go(`/workout/${routineId}`, { replace: true })
    }
  }

  // req-186 — Previous shows when there is a logged set before the one on screen.
  const canGoBack = viewPos > 0
  const weighted = isWeightedType(ex.type)
  const repsLabel = ex?.type === 'cardio' || isDurationTarget(target) ? 'Duration' : 'Reps'
  const showEffort = currentType === 'work' && ex?.type !== 'cardio'
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
    // req-178 / DEC-096 §1 — a work set's kg is the routine's (the snapshot item's).
    routineKg,
    // req-210 / DEC-117 §3 — a changed rep count carries only on a uniform plan (3 × 10).
    uniformReps: uniformRepsTargets(item),
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
        viewingIndex: viewing ? viewIndex : null,
      })
    : null
  // req-186 — the viewed logged set's form: its logged values (setDraftFromLoggedSet, the
  // values Previous always restored), its own target/kg notes. req-192 — its effort shows as
  // the selected effort button; a set with no rpe shows none selected (no preselection).
  const viewedInit = viewedSet ? setDraftFromLoggedSet('', viewedSet) : null
  const viewedEffort = viewedInit && viewedInit.effort !== '' ? viewedInit.effort : ''
  const viewedTarget = viewedSet ? setTargetFor(item, viewedType, viewedWorkIndex) : ''

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
          // req-186 — while Previous shows a logged set, say which one, so it can't be
          // mistaken for the set about to be logged (F9).
          viewing
            ? `${viewedType === 'wu' ? 'Warm-up set' : `Set ${viewedWorkIndex + 1}`} · logged`
            : currentType === 'wu'
              ? 'Warm-up set'
              : null,
        ]}
        aside={
          logging && !viewing && !showNote ? (
            <Button variant="quiet" className="ui-addnote" onClick={() => setShowNote(true)}>
              Add note
            </Button>
          ) : null
        }
      />
      {/* req-192 (DEC-108 §6) — the routine's note for this exercise (the snapshot item's
          `notes`, set in the routine), read-only under the title. Edited in the routine. */}
      {item.notes ? <p className="ui-sub ui-item-note">{item.notes}</p> : null}
      {/* req-192 (DEC-108 §6) — the set list sits under the title, above kg / reps. */}
      {setRows ? (
        <ul className="ui-setpreview" aria-label="Sets">
          {setRows.map((row) => (
            <li
              key={row.key}
              className={`ui-setpreview__row is-${row.status}${row.highlighted ? ' is-here' : ''}`}
              aria-current={row.highlighted ? 'step' : undefined}
            >
              {row.status === 'done' ? (
                // req-191 §3 — a done row opens that logged set (openLoggedSet).
                <button type="button" className="ui-setpreview__tap" onClick={() => openLoggedSet(row.setIndex)}>
                  <span className="ui-setpreview__mark" aria-hidden="true">✓</span>
                  <span className="ui-visually-hidden">Done: </span>
                  {row.text}
                </button>
              ) : (
                <>
                  <span className="ui-setpreview__mark" aria-hidden="true" />
                  {row.text}
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {/* req-80 — the note field the "Add note" control reveals, rendered by the
          title (not inside SetLogForm). autoFocus only when opened by tapping (no
          seeded note); an empty field submits no note (unchanged behaviour). */}
      {logging && !viewing && showNote ? (
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
      {/* req-186 (DEC-103 §4) — Previous: the logged set's own values, not un-logged.
          Bar: Previous (if an earlier one) · Next (secondary) / Save once edited (primary,
          updateActiveSet). Neither touches the rest timer. Keyed per viewed set. */}
      {!plannedDone && viewing ? (
        <SetLogForm
          key={`view-${viewIndex}`}
          viewing
          weighted={weighted}
          timed={viewedTimed}
          showEffort={viewedType === 'work' && ex?.type !== 'cardio'}
          repsLabel={ex?.type === 'cardio' || isDurationTarget(viewedTarget) ? 'Duration' : 'Reps'}
          effortOptions={RPE_OPTIONS}
          initialWeight={weighted ? viewedInit.weight : ''}
          initialReps={viewedInit.reps}
          initialDuration={viewedInit.durationSec ?? durationTargetFor(item, ex, viewedWorkIndex)}
          cardio={ex?.type === 'cardio' && !viewedTimed}
          initialCardio={ex?.type === 'cardio' && !viewedTimed ? cardioFormText(viewedSet, distanceUnit) : null}
          cardioHint={
            ex?.type === 'cardio' && viewedSet?.durationSec == null && viewedInit.reps ? `Logged as ${viewedInit.reps}` : ''
          }
          initialEffort={viewedEffort}
          routineKg={routineKgFor(item, viewedType, viewedWorkIndex)}
          lastKg={historySetPrefill(last, { setType: viewedType, workIndex: viewedWorkIndex }).weight}
          kgLabel={kgLabelFor(ex)}
          canGoBack={canGoBack}
          onComplete={saveViewedSet}
          onNext={nextFromViewed}
          onPrevious={previousSet}
        />
      ) : null}
      {plannedDone || viewing ? null : (
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
          canGoBack={canGoBack}
          onComplete={({ weight, reps, effort, durationSec, cardio }) =>
            completeSet({ weight, reps, rpe: effort, note, durationSec, cardio })
          }
          onSkip={skipSet}
          onPrevious={previousSet}
          onChange={(values, opts) => {
            draftWriter.form(setSeedKey, values, note)
            // req-194 — a stopwatch Start / Stop is written now, not after the debounce.
            if (opts?.now) draftWriter.flush()
          }}
        />
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
  // req-194 — a non-timed cardio exercise's sets read "12:30 · level 8 · 1.5 km".
  const doneEx = liveExercise(store, item)
  const cardioFields = doneEx?.type === 'cardio' && !doneEx?.hasDuration

  return (
    <Screen className="ui-screen--rest">
      <ExercisesLink routineId={routineId} name={active.snapshot?.routineName} />
      <WorkoutPill />
      <SectionHeader>Today</SectionHeader>
      {today.length ? (
        <List>
          {today.map((set, index) => {
            const setIndex = (active.sets || []).indexOf(set)
            return (
              <Row key={index} to={`/workout/${routineId}/set/${setIndex}`}>
                {formatSetLine(set, { cardioFields })}
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
    (candidate) => itemKey(candidate) === (set?.routineItemId),
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
      <WorkoutPill />
      <p className="ui-sub">{workout.snapshot?.routineName}</p>
      <Title>Set</Title>
      <SetEditForm
        set={set}
        showLoad={usesLoad}
        showEffort={usesRpe}
        cardio={item?.exerciseType === 'cardio' && !item?.hasDuration}
        kgLabel={kgLabelFor(item)}
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
