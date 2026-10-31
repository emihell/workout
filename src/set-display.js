// req-270 — split from workout-log.js: set text and rows.
import { cardioBits, hasCardioFields } from './cardio-set.js'
import { isSkippedSet } from './set-rules.js'
import { carryForSet, durationTargetFor, initialSetFields, routineKgFor, seedOverrideKey, setTargetFor, setupSeedFor, uniformRepsTargets } from './set-seed.js'
import { itemLoggingState, workCountFor } from './workout-items.js'

// req-106 — the start-of-exercise preview: one entry per set of the item (warm-up
// first when there is one), each holding EXACTLY what that set's log form would
// prefill if you reached it now. At the start nothing is logged, so restore and carry
// are null; weight/reps go through initialSetFields with the same history / target /
// session seed-override inputs the form uses (DESIGN §1 — a set with no history has no
// kg, never a guessed or copied one). `historyFor({ setType, workIndex })` is the
// caller's historySetPrefill bound to the exercise's last finished sets (a callback so
// this module stays free of history-queries.js). Timed work sets carry their target seconds
// in place of reps, as the form does.
// req-186 — `workLogged` (optional) is this item's logged work sets this session: when
// given, an upcoming work set's kg follows the same in-session carry its form will use
// (carryForSet — DEC-002 / req-152; still below the routine kg). Absent = the req-106
// start-of-exercise preview (nothing logged, no carry), as before.
// req-217 — `eachSide` (the exercise's library entry is unilateral, library-hints.js): reps read
// "12 each side".
// req-10 — `setupSeed` (setupSeedFor below): the first-time setup's set-2 seed, applied to the
// work set it names, so the list shows what that set's form will prefill.
export function setPreview({ item, ex, weighted, hasHistory, historyFor, seedOverrides, workLogged = null, eachSide = false, setupSeed = null }) {
  const overrides = seedOverrides || {}
  const uniformReps = uniformRepsTargets(item)
  const slots = []
  if (item?.warmup) slots.push({ setType: 'wu', workIndex: 0 })
  for (let i = 0; i < workCountFor(item); i++) slots.push({ setType: 'work', workIndex: i })
  return slots.map(({ setType, workIndex }) => {
    const fields = initialSetFields({
      weighted,
      fromRestore: false,
      restore: null,
      hasHistory,
      history: historyFor({ setType, workIndex }),
      carry: workLogged ? carryForSet(setType, workLogged) : null,
      target: setTargetFor(item, setType, workIndex),
      override: overrides[seedOverrideKey(item.exerciseId, setType)],
      routineKg: routineKgFor(item, setType, workIndex),
      uniformReps,
      setup: setupSeed && setType === 'work' && Number(setupSeed.workIndex) === workIndex ? setupSeed : null,
    })
    const timed = Boolean(ex?.hasDuration) && setType === 'work'
    const entry = {
      setType,
      workIndex,
      label: setType === 'wu' ? 'Warm-up' : String(workIndex + 1),
      weight: fields.weight,
      reps: timed ? '' : fields.reps,
      durationSec: timed ? durationTargetFor(item, ex, workIndex) : null,
    }
    return { ...entry, text: setPreviewText(entry, weighted, eachSide) }
  })
}

// req-106 — one preview line: "1 · 20 kg × 8". A weighted set with no kg shows "—" in
// the kg slot (absent, not invented); bodyweight shows the reps alone; a timed set
// shows its seconds ("30s", as formatSetLine does) in place of reps.
// req-217 — `eachSide`: a reps amount reads "12 each side" (a set = both sides, reps per side);
// a blank "—" is unchanged. req-240 — seconds too: "30s each side" (a hold per side).
export function setPreviewText({ label, weight, reps, durationSec }, weighted, eachSide = false) {
  const amount = durationSec != null ? eachSideReps(`${durationSec}s`, eachSide) : reps ? eachSideReps(reps, eachSide) : '—'
  const body = weighted ? `${weight ? `${weight} kg` : '—'} × ${amount}` : amount
  return `${label} · ${body}`
}

// req-186 (DEC-103 §4) — the log screen's set list, kept for the whole exercise. One row
// per set of the item (warm-up first), each:
//   done     → what was LOGGED (a skipped set reads "skipped"), `setIndex` = its index in
//              workout.sets;
//   current  → the set the form is on; upcoming → not reached yet. Both show what that
//              set's form would prefill (setPreview, with the in-session carry), so a
//              blank kg stays "—" (DESIGN §1).
// `highlighted` marks the one row the screen is on: the current set, or — while Previous
// is showing a logged set (`viewingIndex`, an index into workout.sets) — that set.
export function setListRows({ workout, item, ex, weighted, hasHistory, historyFor, viewingIndex = null, eachSide = false }) {
  const state = itemLoggingState(workout, item)
  const sets = workout?.sets || []
  const wuSet = state.logged.find((set) => set.setType === 'wu') || null
  const currentSlot = state.plannedDone ? null : state.needsWu ? 'wu|0' : `work|${state.currentWorkIndex}`
  const slots = setPreview({
    item,
    ex,
    weighted,
    hasHistory,
    historyFor,
    seedOverrides: workout?.seedOverrides,
    workLogged: state.workLogged,
    eachSide,
    setupSeed: setupSeedFor(workout, item),
  })
  return slots.map((slot) => {
    const logged = slot.setType === 'wu' ? wuSet : state.workLogged[slot.workIndex] || null
    if (logged) {
      const setIndex = sets.indexOf(logged)
      return {
        key: `${slot.setType}|${slot.workIndex}`,
        status: 'done',
        setIndex,
        text: loggedSetRowText(slot.label, logged, weighted, ex?.type === 'cardio' && !ex?.hasDuration, eachSide),
        highlighted: viewingIndex != null && viewingIndex === setIndex,
      }
    }
    const key = `${slot.setType}|${slot.workIndex}`
    const status = key === currentSlot ? 'current' : 'upcoming'
    return {
      key,
      status,
      setIndex: -1,
      text: slot.text,
      highlighted: viewingIndex == null && status === 'current',
    }
  })
}

// req-186 — a done row: the logged values in the preview's own shape ("1 · 20 kg × 8").
// req-194 — `cardio` (a non-timed cardio exercise) or a set carrying level / distance: its
// cardio fields, "1 · 12:30 · level 8 · 1.5 km"; an old cardio set (none) keeps its reps text.
// req-217 — `eachSide`: the logged reps read "12 each side" (setPreviewText).
export function loggedSetRowText(label, set, weighted, cardio = false, eachSide = false) {
  if (isSkippedSet(set)) return `${label} · skipped`
  const bits = cardio || hasCardioFields(set) ? cardioBits(set) : []
  if (bits.length) return `${label} · ${bits.join(' · ')}`
  const durationSec = set?.durationSec != null && set.durationSec !== '' ? Number(set.durationSec) : null
  const weight = set?.weight != null && Number(set.weight) !== 0 ? String(set.weight) : ''
  return setPreviewText({ label, weight, reps: set?.reps != null ? String(set.reps) : '', durationSec }, weighted, eachSide)
}

// req-217 (DEC-119 §6) — a unilateral exercise's reps are per side: "12" → "12 each side". Display
// only; the stored reps stay "12". Blank stays blank. req-240 — also takes "30s" (timed sets).
export function eachSideReps(reps, eachSide = true) {
  const text = reps == null ? '' : String(reps)
  return eachSide && text.trim() !== '' ? `${text} each side` : text
}

// req-186 — the pill's rest clock: whole seconds ("45s") under a minute, m:ss ("1:12")
// from 60 s.
export function restClockText(seconds) {
  const sec = Math.max(0, Math.ceil(Number(seconds) || 0))
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
