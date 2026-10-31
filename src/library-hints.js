// req-217 (DEC-119 §6) — what the log screen reads from the exercise library at display time:
// "each side" for a unilateral exercise, and the form cues shown during rest. Resolved through
// libraryEntryFor (libraryId → exact name → alias, no fuzzy guess) — never from the exercise's
// name, never copied into stored data. No entry → nothing extra (DESIGN §1: absent is absent).
import { libraryEntryFor } from './exerciseLibrary.js'
import { setMatchesItem } from './workout-items.js'
import { restRemaining } from './workout-timers.js'

export const REST_CUES_MAX = 3

// The resolved entry's form cues as the rest block shows them: non-blank strings, at most
// REST_CUES_MAX. Shared by restNotesFor and libraryHintEntries so the two cannot drift.
function restCuesOf(entry) {
  return (Array.isArray(entry?.formCues) ? entry.formCues : [])
    .filter((cue) => typeof cue === 'string' && cue.trim() !== '')
    .slice(0, REST_CUES_MAX)
}

// req-265 — the hint list (src/library/hints.json, written by scripts/build-library.mjs from the
// same derived list as exercises.json; never hand-edited): per library entry only what
// libraryEntryFor resolves on (id, name, displayName, aliases) and what the two hints read
// (unilateral: true, the rest cues). Absent stays absent. ~28 kB gzip vs ~264 kB for the full
// library, so the log screen no longer downloads the whole library (useExerciseLibrary).
export function libraryHintEntries(library) {
  return library.map((entry) => {
    const hint = { id: entry.id, name: entry.name }
    if (entry.displayName !== undefined) hint.displayName = entry.displayName
    if (Array.isArray(entry.aliases) && entry.aliases.length) hint.aliases = entry.aliases
    if (entry.unilateral === true) hint.unilateral = true
    const cues = restCuesOf(entry)
    if (cues.length) hint.formCues = cues
    return hint
  })
}

// The file's bytes: one entry per line, so a library rebuild diffs per exercise.
export function libraryHintsText(library) {
  return `[\n${libraryHintEntries(library).map((hint) => JSON.stringify(hint)).join(',\n')}\n]\n`
}

// req-240 (DEC-137, DEC-063 §3) — the exercise's own `unilateral` boolean (the Details
// checkbox, written only by the user's edit) wins when present; absent → the library entry,
// true only when it is marked `unilateral: true`. Never for cardio (the spec: every type but
// cardio; Details hides the box there, so a stored true left from an earlier type can't be unticked).
export function isEachSide(exercise, library) {
  if (exercise?.type === 'cardio') return false
  if (typeof exercise?.unilateral === 'boolean') return exercise.unilateral
  return libraryEachSide(exercise, library)
}

// The library's answer alone (the Details checkbox's starting value when the field is absent).
export function libraryEachSide(exercise, library) {
  return libraryEntryFor(exercise, library)?.unilateral === true
}

// req-240 — what the Details Save writes for the "One side at a time" box. `choice`: the box's
// value if the user changed it, else null (untouched → nothing written, the field stays absent).
// A choice equal to the library's answer on an exercise with no own value writes nothing either
// (still follows the library); once the field exists, Save keeps it current.
export function unilateralPatch(exercise, library, choice) {
  if (typeof choice !== 'boolean') return {}
  if (typeof exercise?.unilateral !== 'boolean' && choice === libraryEachSide(exercise, library)) return {}
  return { unilateral: choice }
}

// req-219 — the quiet line under the exercise head (log screen + review) when isEachSide.
// "One side", not "one arm": the flag also covers legs and stretches.
export const ONE_SIDE_LINE = 'One side at a time — all reps on one side, then the other.'
// req-240 — a timed exercise holds, it has no reps: its work sets are the full time per side.
export const ONE_SIDE_LINE_TIMED = 'One side at a time — the full time on one side, then the other.'

export function oneSideLine(exercise) {
  return exercise?.hasDuration ? ONE_SIDE_LINE_TIMED : ONE_SIDE_LINE
}

// req-240 — the timed field's label: "Duration each side (s)" when isEachSide.
export function durationLabel(eachSide) {
  return eachSide ? 'Duration each side (s)' : 'Duration (s)'
}

// The rest block's content: the routine item's note (if any), then up to REST_CUES_MAX of the
// resolved entry's formCues. Null when there is neither (scope 3: nothing shows).
export function restNotesFor(item, exercise, library) {
  const note = String(item?.notes || '').trim()
  const entry = libraryEntryFor(exercise, library)
  const cues = restCuesOf(entry)
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
  // req-274 — the shared set↔item matcher (was `last.routineItemId === itemKey(item)`).
  return Boolean(last) && setMatchesItem(last, item)
}
