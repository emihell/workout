// req-276 — split from views/workout/item.jsx: the sheet that edits a logged set.
import { isWeightedType } from '../../ids'
import { recordButton } from '../../analytics'
import { isDurationTarget } from '../../progress'
import { lastSetsForExercise } from '../../history-queries.js'
import { useStore } from '../../store-context'
import {
  itemLoggingState,
} from '../../workout-items.js'
import {
  durationTargetFor,
  setTargetFor,
} from '../../set-seed.js'
import {
  setDraftFromLoggedSet,
} from '../../set-drafts.js'
import { isSkippedSet } from '../../set-rules.js'
import { skippedSetSave, viewedSetSave } from '../set-values.js'
import {
  SetEditSheet,
} from '../../ui/index.jsx'
import {
  setupAfterSetOneEdit,
} from '../../first-time-setup.js'
import { kgLabelFor } from '../../kg-label.js'
import { cardioFormText, lastDistanceUnit } from '../../cardio-set.js'
import { durationLabel } from '../../library-hints.js'

// req-212 (DEC-119 §1) — one logged set in the edit sheet (SetEditSheet), opened from a done
// row of the set list (live screen) or a set line (review). Its own fields only — kg + reps,
// a timed set's seconds, or a cardio set's fields; no effort. Save writes through
// store.updateActiveSet (the sets array only: restEndsAt / restPausedRemaining untouched, as
// req-186's Save did) with the same patch and seed-override rerun (viewedSetSave, DEC-052);
// `loggedAt` is never in the patch, so it is kept. `onSaved` runs after the write (the review
// re-applies its effort). Cancel / backdrop / Escape write nothing.
export function LoggedSetSheet({ item, ex, index, eachSide = false, onClose, onSaved }) {
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
    // req-10 review round 1 — set 1 edited before set 2 is logged: the first-time setup's set-2
    // seed is recomputed from the edited set (same answer), against the state the writes above
    // leave (a functional patch, queued after them). Any other set / no setup → nothing.
    if (type === 'work' && workIndex === 0) store.patchActive((current) => setupAfterSetOneEdit(current, item, ex))
    onSaved?.()
    onClose()
  }
  // req-241 — Done tapped by mistake: the set becomes a skip record through the same writes as
  // Save (one updateActiveSet, the carry re-run, set 1's setup seed); no confirm, since filling it
  // back in and saving un-skips it. A skip has no effort, so the review's onSaved isn't run.
  function skip() {
    const result = skippedSetSave({ weighted, set, seedOverrides: active.seedOverrides, sets: active.sets || [], setIndex: index })
    recordButton('skip-done-set')
    store.updateActiveSet(index, result.setPatch)
    if (result.seedOverrides !== active.seedOverrides) store.patchActive({ seedOverrides: result.seedOverrides })
    if (type === 'work' && workIndex === 0) store.patchActive((current) => setupAfterSetOneEdit(current, item, ex))
    onClose()
  }
  return (
    <SetEditSheet
      title={type === 'wu' ? 'Warm-up set' : `Set ${workIndex + 1}`}
      weighted={weighted}
      timed={timed}
      cardio={cardio}
      repsLabel={ex?.type === 'cardio' || isDurationTarget(target) ? 'Duration' : eachSide ? 'Reps each side' : 'Reps'}
      durationLabel={durationLabel(eachSide)}
      kgLabel={kgLabelFor(ex)}
      initialWeight={weighted ? init.weight : ''}
      initialReps={init.reps}
      // Review round 1 — a skipped timed set starts blank: the target is never written as if measured.
      initialDuration={timed && !skipped ? init.durationSec ?? durationTargetFor(item, ex, workIndex) : ''}
      skipped={skipped}
      onSkip={skipped ? undefined : skip}
      initialCardio={cardio ? cardioFormText(set, lastDistanceUnit(last?.sets)) : null}
      cardioHint={cardio && set.durationSec == null && init.reps ? `Logged as ${init.reps}` : ''}
      onSave={save}
      onCancel={onClose}
    />
  )
}
