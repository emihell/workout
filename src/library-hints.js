// req-217 (DEC-119 §6) — what the log screen reads from the exercise library at display time:
// "each side" for a unilateral exercise, and the form cues shown during rest. Resolved through
// libraryEntryFor (libraryId → exact name → alias, no fuzzy guess) — never from the exercise's
// name, never copied into stored data. No entry → nothing extra (DESIGN §1: absent is absent).
import { libraryEntryFor } from './exerciseLibrary.js'
import { itemKey, restRemaining } from './workout-log.js'

export const REST_CUES_MAX = 3

// True only when the exercise resolves to a library entry marked `unilateral: true`.
export function isEachSide(exercise, library) {
  return libraryEntryFor(exercise, library)?.unilateral === true
}

// req-219 — the quiet line under the exercise head (log screen + review) when isEachSide.
// "One side", not "one arm": the flag also covers legs and stretches.
export const ONE_SIDE_LINE = 'One side at a time — all reps on one side, then the other.'

// The rest block's content: the routine item's note (if any), then up to REST_CUES_MAX of the
// resolved entry's formCues. Null when there is neither (scope 3: nothing shows).
export function restNotesFor(item, exercise, library) {
  const note = String(item?.notes || '').trim()
  const entry = libraryEntryFor(exercise, library)
  const cues = (Array.isArray(entry?.formCues) ? entry.formCues : [])
    .filter((cue) => typeof cue === 'string' && cue.trim() !== '')
    .slice(0, REST_CUES_MAX)
  if (!note && !cues.length) return null
  return { note, cues }
}

// The block shows while THIS exercise's rest runs: the workout's rest is running
// (restRemaining — restEndsAt in the future, or paused) and the latest set record is this
// item's (the set that armed it). Skip rest clears restEndsAt → false.
export function restNotesShowing(workout, item, now) {
  if (!workout || !item) return false
  if (!restRemaining(workout, now).resting) return false
  const sets = workout.sets || []
  const last = sets[sets.length - 1]
  return Boolean(last) && last.routineItemId === itemKey(item)
}
