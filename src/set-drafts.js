// req-270 — split from workout-log.js: unsaved set drafts.
import { rpeOptionValue } from './ids.js'
import { restoreFromLoggedSet } from './set-seed.js'
import { itemKey } from './workout-items.js'

// req-125 — the set-form draft: what the user has typed on the CURRENT, not-yet-logged
// set (weight / reps / effort / duration / note), kept as ONE optional field on the
// active workout, `activeWorkout.setDraft = { key, weight, reps, effort, durationSec,
// note }`, so leaving the screen (‹ Exercises, the name link, the rest pill) or iOS
// reloading the tab doesn't lose it. Not a schema field: absent on every workout before
// req-125 (reads as "no draft"); migrateState keeps it via workoutSnapshot's spread;
// finishedState strips it; Abandon drops the whole workout. It is only ever what the user
// typed (or, via Previous, the set they just un-logged) — never invented (DESIGN §1).
//
// The key names one set of one item: `<itemKey>|<wu|work>|<workIndex>` (a warm-up is
// always index 0). It doubles as the log form's per-set React key (setSeedKey), so the
// draft is read exactly when the form remounts — on mount / set change, never live.
export function setDraftKey(item, setType, workIndex) {
  const wu = setType === 'wu'
  return `${itemKey(item)}|${wu ? 'wu' : 'work'}|${wu ? 0 : Number(workIndex) || 0}`
}

// The draft for the set `key`, or null — a draft whose key doesn't match the current set
// (that set was logged elsewhere, the item was replaced, a stale draft) is ignored.
export function setDraftFor(workout, key) {
  const draft = workout?.setDraft
  return draft && typeof draft === 'object' && draft.key === key ? draft : null
}

// The draft written as the user edits the form: the form's current values plus the
// note (which lives beside the title, req-80). `durationSec` is the typed seconds as
// entered (a string while editing); absent on a non-timed form.
// req-194 — `cardio` (a cardio form only): the raw Duration / Level / Distance text and the
// unit (+ `watched`: Duration holds the stopwatch's time). The running stopwatch is NOT here
// (review fix 1): it is activeWorkout.stopwatch, see startStopwatchPatch.
export function setDraftFromForm(key, { weight, reps, effort, durationSec, cardio } = {}, note = '') {
  return {
    key,
    weight: weight ?? '',
    reps: reps ?? '',
    effort: effort ?? '',
    ...(durationSec != null ? { durationSec } : {}),
    ...(cardio != null ? { cardio: { ...cardio } } : {}),
    note: note ?? '',
  }
}

// Previous (req-125 replaces the old `restore` component state) — the un-logged set's
// values become the draft of the set it returns to, so Previous + reload keeps them.
// Same values restoreFromLoggedSet always gave the form: weight/reps/note of the logged
// set (a skipped set restores empty), its effort mapped to the segment value, a timed
// set's logged seconds. An empty RPE (warm-up) leaves effort to the seed's default.
export function setDraftFromLoggedSet(key, set) {
  const restored = restoreFromLoggedSet(set)
  const effort = restored.rpe !== '' ? rpeOptionValue(restored.rpe) || restored.rpe : ''
  return {
    key,
    weight: restored.weight,
    reps: restored.reps,
    effort,
    ...(restored.durationSec != null ? { durationSec: restored.durationSec } : {}),
    note: restored.note,
  }
}

// The values the log form starts from: the chain `seed` (initialSetFields — req-106/108
// history / carry / target / req-83 override) with a matching draft laid over it, field
// by field. `seed` itself is NOT changed: it stays req-83's comparison base
// (nextSeedOverrides), so a drafted weight change still carries to later sets.
// `weighted` still gates kg; `durationTarget` is the timed set's target seconds.
export function formFieldsWithDraft({ seed, draft, weighted, durationTarget }) {
  const d = draft || {}
  const has = (v) => v != null && v !== ''
  return {
    weight: weighted && d.weight != null ? String(d.weight) : seed.weight,
    reps: d.reps != null ? String(d.reps) : seed.reps,
    effort: has(d.effort) ? d.effort : seed.effort,
    note: d.note != null ? d.note : seed.note,
    durationSec: d.durationSec != null ? d.durationSec : durationTarget,
    // req-194 — a cardio form's drafted fields + running stopwatch; absent when not drafted.
    ...(d.cardio && typeof d.cardio === 'object' ? { cardio: d.cardio } : {}),
  }
}

// req-125 — the draft writer: collects edits and writes the latest draft once the user
// pauses for `delayMs` (so a keystroke doesn't re-save the whole state to localStorage).
// `write(setDraft, sync)` does the store write; `flush(sync)` writes a pending draft now
// (leaving the screen, the tab hiding); `cancel()` drops it (the set was just logged or
// un-logged, so a late write can't resurrect it). `form` / `note` remember the latest
// form values per set key, so a note edit is written with the form's values and
// vice-versa; `startValues` is what the form started from, until it reports an edit.
// Timers are injectable so the debounce is unit-tested without waiting.
export const DRAFT_WRITE_MS = 300

export function createSetDraftWriter({
  write,
  delayMs = DRAFT_WRITE_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let pending = null
  let timer = null
  let latest = { key: null, values: null }
  const stop = () => {
    if (timer != null) clearTimer(timer)
    timer = null
  }
  const flush = (sync = false) => {
    stop()
    const setDraft = pending
    pending = null
    if (setDraft) write(setDraft, sync)
  }
  const schedule = (setDraft) => {
    pending = setDraft
    stop()
    timer = setTimer(() => flush(), delayMs)
  }
  const remember = (key) => {
    if (latest.key !== key) latest = { key, values: null }
    return latest
  }
  return {
    flush,
    cancel() {
      stop()
      pending = null
      latest = { key: null, values: null }
    },
    form(key, values, note) {
      remember(key).values = values
      schedule(setDraftFromForm(key, values, note))
    },
    note(key, note, startValues) {
      schedule(setDraftFromForm(key, remember(key).values || startValues, note))
    },
  }
}
