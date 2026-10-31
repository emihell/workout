// req-276 — split from views/workout/item.jsx: what the exercise screens do: the exercise as logged, the editor path, done → review, the routine-kg offer, the next-exercise arrival mark, the set-draft writer hook.
import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { go } from '../../route'
import { recordButton } from '../../analytics'
import { exerciseById } from '../../model.js'
import {
  itemKey,
  markItemDonePatch,
  sessionExercise,
} from '../../workout-items.js'
import {
  createSetDraftWriter,
} from '../../set-drafts.js'
import {
  exerciseName,
  itemDonePath,
} from './workout-helpers.js'
import { markArrival } from '../../up-next.js'
import { askConfirm } from '../../ui/confirm.js'
import { offerSheetText } from '../../routine-update-offer.js'

// req-119 — type / Timed / name / equipment come from the snapshot (sessionExercise,
// workout-items.js); weight step and cues stay live. Old snapshots read live as before.
export function liveExercise(store, item) {
  return sessionExercise(exerciseById(store.exercises, item.exerciseId), item)
}

export function exerciseEditorPath(routineId, item) {
  return `/workout/${routineId}/item/${itemKey(item)}/exercise`
}

// req-11 / DEC-013 — completing the last set marks the exercise done. req-212 (DEC-119 §1)
// — it then lands on the exercise review (WorkoutItemDone: the sets, the one effort, Next),
// not the overview. Re-entering a completed exercise from the overview opens the same review.
export function markDoneAndGoToReview(store, workout, routineId, item) {
  store.patchActive(markItemDonePatch(workout, item))
  go(itemDonePath(routineId, item), { replace: true })
}

// req-187 (DEC-103 §1) — the routine-kg confirm, opened on the set that finishes the
// exercise when its kg differs from the routine (offerOnFinishingSet). It is the one
// ConfirmSheet with `stayOn`: req-212 — the exercise review, so the navigation there
// (markDoneAndGoToReview, called first) does not dismiss it. Update → store.applyRoutineUpdate (the existing write
// path); Keep / backdrop / Escape / any other navigation → nothing written. Rest is
// untouched either way: it was armed by store.completeSet before this opens.
export function askRoutineUpdate(store, routineId, item, offer) {
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

// req-117 — restoreFromLoggedSet moved to workout-log.js, now set-seed.js (pure, unit-tested; it now
// also restores a timed set's logged seconds).

// req-78 — the req-27 RestUpcoming panel (an editable "next weight" shown during a
// blocking rest) is gone. Rest no longer blocks: the next set's own log form is shown
// immediately on completing a set, and its weight field IS the editable surface, so the
// separate panel and its nextSetWeight override folded away. The rest itself now shows
// only as the floating pill (req-186: the WorkoutPill).

// req-125 — the set-form draft writer (createSetDraftWriter, set-drafts.js: debounced,
// unit-tested) bound to the store. store.patchActive only calls the store's stable
// setState, so the first render's function stays valid for the component's life. A
// pending write is flushed on unmount (leaving the screen) and synchronously
// (flushSync, so saveState runs before the page goes) when the tab is hidden or
// unloaded — iOS reloading a backgrounded tab.
export function useSetDraftWriter(store) {
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

// req-223 review fix 2 — only a plain left click navigates THIS tab; a modified or middle click
// (new tab / window, download) must not leave a marker behind for a later list-row open.
export function markNextArrival(e, routineId, next) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
  markArrival(routineId, next)
}
