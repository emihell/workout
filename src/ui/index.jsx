// req-13 / DEC-017 — the minimal, colorless, Apple-inspired component library.
//
// First iteration: as little code as possible, grayscale only, every interactive
// target ≥44px. These are bare primitives. Every component lives here + in
// the #/components showcase until the per-screen styling pass migrates screens onto it.
//
// The one stylesheet (./ui.css) is imported once at the app root (main.jsx).
import { useEffect, useId, useRef, useState } from 'react'
import { defaultBeep, unlockAudio } from '../rest-cue.js'
import { workoutPillLines } from './workout-pill.js'
import { kgError, readKg } from '../kg-input.js'
import { kgHints } from '../kg-hints.js'
import { readSeconds, secondsToSave } from '../seconds-input.js'
import { DISTANCE_UNITS, cardioValues, clockText, readDuration, stopwatchSeconds } from '../cardio-set.js'
import { cx } from './cx.js'
import { Button, SegmentedControl } from './controls.jsx'
import { Field, NumberField } from './fields.jsx'
import { Title } from './layout.jsx'
export { Button, NavLink, Actions, SegmentedControl, Checkbox, FileButton } from './controls.jsx'
export { Field, SearchField, NumberField, Textarea, Select } from './fields.jsx'
export { Screen, Title, SectionHeader, List, Row, Banner } from './layout.jsx'
export { ConfirmSheet } from './confirm-sheet.jsx'

// ---- Molecules (compose the atoms) ----

// WorkoutPill (req-186, DEC-103 §3; was RestPill, req-78) — one floating pill for the
// whole workout. Resting: the rest clock; rest over (or none armed): "GO" (req-244: the
// counts sit on a second line), set apart by .ui-restpill--go (a pulse; static under reduced motion). The
// whole pill is one tap-target that opens the current exercise — it no longer skips the
// rest (that moved to "Skip rest" on the exercise screen). Presentational: the real
// screen wires onOpen; the showcase passes a stub.
// req-192 (DEC-108 §3) — `skip`: resting, on the current exercise's own log screen, a tap
// skips the rest; the pill then says so on line 2 (req-244: "Tap to skip rest").
// req-222 (DEC-125 §3) — the whole-workout count, after the set count; not shown while
// `skip` (DEC-108 §3).
export function WorkoutPill({ clock = null, set = null, exercise = null, go = false, skip = false, onOpen }) {
  const { top, bottom, label } = workoutPillLines({ clock, set, exercise, go, skip })
  return (
    <button
      type="button"
      className={cx('ui-restpill', go && 'ui-restpill--go')}
      onClick={onOpen}
      aria-label={label}
    >
      <span className="ui-restpill__time">{top}</span>
      {bottom ? <span className="ui-restpill__sub">{bottom}</span> : null}
    </button>
  )
}

// SetLogForm — the single most important gym surface: a kg NumberField, a big reps
// field, and a bar pinned to the absolute bottom of the screen (req-80): a quiet
// Skip set row over one primary Done that logs the set (req-212, DEC-119 §1 — effort is
// asked once per exercise on the review, not per set).
// Presentational: it owns only the in-progress field values (local state, seeded
// from the `initial*` props), remounted per-set by the caller with a `key`. All
// the domain logic — history prefill, carry, targets — lives in the caller (the workout
// screen), which passes the seeds in and reads {weight, reps, durationSec} back out of
// onComplete.
//
// The note affordance is NOT here (req-80): "Add note" is a small control beside
// the exercise title (item.jsx), and the note value is owned by the caller and
// passed to completeSet directly — so it sits by the title, not in this field group.
//
// Props: `weighted` shows the kg field; `repsLabel` is "Reps" or "Duration";
// `onChange` (req-125) hears edits. The reps field is a full keyboard (not decimal-only)
// so durations like "30 min" can be typed.
// req-85 — the in-set count-down for a timed exercise. A SECOND, concurrent timer
// with its OWN local state (a deadline + a 250ms tick) — deliberately NOT the
// persisted restEndsAt, so starting it never touches the rest pill/cue and the two
// countdowns run independently. Start counts down from the (editable) target seconds
// and beeps once at zero (defaultBeep, fail-silent); the logged value is the target,
// not a stopwatch actual (v1). Local state resets per set because SetLogForm remounts
// by `key`.
function DurationTimer({ seconds, onSecondsChange, label = 'Duration (s)' }) {
  const [deadline, setDeadline] = useState(null)
  const [now, setNow] = useState(() => 0)
  const firedRef = useRef(false)

  useEffect(() => {
    if (deadline == null) return undefined
    const tick = () => {
      const t = Date.now()
      setNow(t)
      if (t >= deadline && !firedRef.current) {
        firedRef.current = true
        defaultBeep()
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [deadline])

  const running = deadline != null
  // req-155 — the typed seconds read like the saved value (`30,5` → 31); unreadable shows 0.
  const typed = readSeconds(seconds).value ?? 0
  const remaining = running ? Math.max(0, Math.ceil((deadline - now) / 1000)) : typed
  const start = () => {
    unlockAudio()
    firedRef.current = false
    const secs = Math.max(1, typed)
    setNow(Date.now())
    setDeadline(Date.now() + secs * 1000)
  }
  return (
    <div className="ui-setlog__timer">
      <NumberField
        label={label}
        min="1"
        selectOnFocus
        value={seconds}
        onChange={(e) => onSecondsChange(e.target.value)}
      />
      <div className="ui-timer__count" aria-live="polite">
        {remaining}s
      </div>
      <Button variant="secondary" onClick={start}>
        {running ? 'Restart' : 'Start'}
      </Button>
    </div>
  )
}

// req-194 (DEC-108 §4) — a cardio set's fields: Duration with a stopwatch, an optional
// Level, an optional Distance with its unit. The stopwatch is NOT component state (review
// fix 1): `stopwatch` is the active workout's own field ({ draftKey, startedAt, baseSec },
// workout-timers.js startStopwatchPatch), passed in by the caller, so leaving the screen,
// another exercise's typing or a reload can't drop it. Start runs from 0:00 — or, after a
// Stop (`watched`: the box holds the stopwatch's own time, not a typed or prefilled one),
// resumes from it. Stop writes the time into Duration, which stays editable by hand. While
// running the box shows the live time. `blockedBy`: another exercise's stopwatch is live,
// so Start is refused here (one stopwatch at a time).
function CardioFields({ values, errors, onEdit, stopwatch = null, onStart, onStop, blockedBy = '', viewing = false, hint = '' }) {
  const { duration, level, distance, distanceUnit, watched } = values
  const running = stopwatch != null
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return undefined
    const tick = () => setNow(Date.now())
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [running])
  const elapsed = running ? stopwatchSeconds(stopwatch, now) : null
  const resumable = Boolean(watched) && (readDuration(duration).value ?? 0) > 0
  const start = () => onStart?.(resumable ? readDuration(duration).value : 0)
  const stop = () => onStop?.(secondsNow(stopwatch))
  return (
    <div className="ui-cardio">
      <div className="ui-cardio__timer">
        <Field
          label="Duration"
          className="ui-input--num"
          selectOnFocus
          placeholder="mm:ss"
          readOnly={running}
          value={running ? clockText(elapsed) : duration}
          onChange={(e) => onEdit('duration', e.target.value)}
        />
        {viewing ? null : running ? (
          <Button variant="primary" className="ui-cardio__watch" onClick={stop}>
            Stop
          </Button>
        ) : (
          <Button variant="secondary" className="ui-cardio__watch" onClick={start} disabled={Boolean(blockedBy)}>
            {resumable ? 'Resume' : 'Start'}
          </Button>
        )}
      </div>
      {hint ? <p className="ui-field-note">{hint}</p> : null}
      {blockedBy && !viewing && !running ? (
        <p className="ui-field-note">The stopwatch is running on {blockedBy} — stop it there first.</p>
      ) : null}
      {errors.duration ? (
        <p className="ui-field-error" role="alert">
          {errors.duration}
        </p>
      ) : null}
      <div className="ui-cardio__nums">
        <Field
          label="Level"
          className="ui-input--num"
          inputMode="decimal"
          selectOnFocus
          value={level}
          onChange={(e) => onEdit('level', e.target.value)}
        />
        <Field
          label="Distance"
          className="ui-input--num"
          inputMode="decimal"
          selectOnFocus
          value={distance}
          onChange={(e) => onEdit('distance', e.target.value)}
        />
        <SegmentedControl
          options={DISTANCE_UNITS}
          value={distanceUnit}
          onChange={(unit) => onEdit('distanceUnit', unit)}
          ariaLabel="Distance unit"
        />
      </div>
      {errors.level ? (
        <p className="ui-field-error" role="alert">
          {errors.level}
        </p>
      ) : null}
      {errors.distance ? (
        <p className="ui-field-error" role="alert">
          {errors.distance}
        </p>
      ) : null}
    </div>
  )
}

// The running stopwatch's whole seconds right now — read at a tap (Stop / Done).
function secondsNow(stopwatch) {
  return stopwatchSeconds(stopwatch, Date.now())
}

const EMPTY_CARDIO = { duration: '', level: '', distance: '', distanceUnit: 'm' }

export function SetLogForm({
  weighted = true,
  timed = false,
  repsLabel = 'Reps',
  // req-240 — the timed field's label ("Duration each side (s)" on a one-sided exercise).
  durationLabel = 'Duration (s)',
  initialWeight = '',
  initialReps = '',
  initialDuration = 0,
  routineKg,
  lastKg = '',
  // req-189 — "kg per dumbbell" on a dumbbell exercise (kg-label.js); the caller decides.
  kgLabel = 'kg',
  onComplete,
  onSkip,
  onChange,
  // req-212 (DEC-119 §1) — no effort, no Previous / Next / viewing mode: every set is logged by
  // one Done (effort is asked once per exercise, on the review); a logged set is edited in
  // SetEditSheet. onComplete gets { weight, reps, durationSec } (+ `cardio` on a cardio set).
  // req-194 — `cardio`: the cardio form (Duration + stopwatch, Level, Distance) in place of
  // Reps; `initialCardio` its starting text (draft, viewed set, or a single-time target
  // prefill); `cardioHint` a quiet note under Duration (a range target, never put in the box).
  // Review fix 1 — `stopwatch` (this set's running stopwatch or null), `onStopwatchStart(baseSec)`,
  // `onStopwatchStop()`, `stopwatchBlockedBy` (the exercise whose stopwatch is live, or '').
  stopwatch = null,
  onStopwatchStart,
  onStopwatchStop,
  stopwatchBlockedBy = '',
  // onComplete then carries `cardio: { durationSec, level, distance, distanceUnit }`.
  cardio = false,
  initialCardio = null,
  cardioHint = '',
}) {
  const [weight, setWeight] = useState(initialWeight)
  const [cardioState, setCardioState] = useState(() => ({ ...EMPTY_CARDIO, ...(initialCardio || {}) }))
  const [cardioErrors, setCardioErrors] = useState({})
  const [reps, setReps] = useState(initialReps)
  const [duration, setDuration] = useState(String(initialDuration || ''))
  // req-154 — set by Complete when the kg can't be read (`abc`, `2,5,5`); cleared by the
  // next kg edit. `22,5` is a number (DEC-058 §1) and never lands here.
  const [weightError, setWeightError] = useState(null)
  // req-155 — the same for a timed set's Duration (`30,5` is 31 s; `abc` is refused).
  const [durationError, setDurationError] = useState(null)
  // req-189 — Reps blank on Complete: an inline "Enter reps" (no browser bubble — the box is no
  // longer `required`); cleared by the next reps edit. Nothing is prefilled (DESIGN §1).
  const [repsError, setRepsError] = useState(null)
  // req-125 — `onChange` (optional) hears every user edit with the form's full current
  // values, so the caller can keep a draft of the un-logged set. It fires from the edit
  // itself (not an effect), so mounting or remounting writes nothing. `durationSec` is the
  // typed seconds as entered, present only on a timed form.
  // req-194 — a cardio edit (or a stopwatch Start / Stop, `now`: written to the draft at
  // once, not debounced, so a reload right after Start keeps it running).
  function editCardio(patch, { now = false } = {}) {
    const next = { ...cardioState, ...patch }
    setCardioState(next)
    setCardioErrors({})
    onChange?.({ weight, reps, durationSec: undefined, cardio: next }, { now })
  }
  function edit(field, value) {
    const next = { weight, reps, duration, [field]: value }
    if (field === 'weight') {
      setWeight(value)
      setWeightError(null)
    } else if (field === 'reps') {
      setReps(value)
      setRepsError(null)
    } else {
      setDuration(value)
      setDurationError(null)
    }
    onChange?.({
      weight: next.weight,
      reps: next.reps,
      durationSec: timed ? next.duration : undefined,
      ...(cardio ? { cardio: cardioState } : {}),
    })
  }
  const hints = kgHints({ weighted, kg: weight, routineKg, lastKg })
  // req-192 — the one logging path: validation (kg error, "Enter reps", duration) first, then
  // onComplete. req-212 — reached only by Done (or Enter); there is no effort here.
  function submit() {
    if (cardio) {
      submitCardio()
      return
    }
    // req-189 — what `required` blocked before, the same cases (a non-timed set, blank box).
    const missingReps = !timed && String(reps ?? '').trim() === '' ? `Enter ${repsLabel.toLowerCase()}` : null
    const error = weighted ? kgError(weight) : null
    // req-155 — a blank Duration logs 0 s, as before; unreadable text logs nothing.
    const seconds = timed ? secondsToSave(duration, 0) : null
    if (error || seconds?.error || missingReps) {
      setWeightError(error)
      setRepsError(missingReps)
      setDurationError(seconds?.error ?? null)
      return
    }
    onComplete?.({
      weight,
      reps: timed ? '' : reps,
      durationSec: timed ? seconds.value : undefined,
    })
  }
  // req-194 — Done on a cardio set: a running stopwatch is stopped at this moment and its
  // time logged; Duration is required (blank → "Enter duration"), Level / Distance optional
  // (blank → absent, unreadable → an inline error and nothing logged).
  function submitCardio() {
    const raw = stopwatch ? { ...cardioState, duration: clockText(secondsNow(stopwatch)) } : cardioState
    const read = cardioValues(raw, { durationRequired: true })
    if (read.errors) {
      setCardioErrors(read.errors)
      return
    }
    onComplete?.({ weight, reps: '', durationSec: undefined, cardio: read.values })
  }
  return (
    <form
      className="ui-setlog"
      onSubmit={(e) => {
        e.preventDefault()
        // req-212 — Enter in a field logs the set, as Done does (every set, warm-up or work).
        submit()
      }}
    >
      <div className="ui-setlog__nums">
        {weighted ? (
          <NumberField label={kgLabel} selectOnFocus value={weight} onChange={(e) => edit('weight', e.target.value)} />
        ) : null}
        {cardio ? (
          <CardioFields
            values={cardioState}
            errors={cardioErrors}
            hint={cardioHint}
            stopwatch={stopwatch}
            blockedBy={stopwatchBlockedBy}
            // A typed Duration is the user's own number: Start then runs from 0:00.
            onEdit={(field, value) => editCardio(field === 'duration' ? { duration: value, watched: false } : { [field]: value })}
            onStart={(baseSec) => onStopwatchStart?.(baseSec)}
            onStop={(secs) => {
              editCardio({ duration: clockText(secs), watched: true }, { now: true })
              onStopwatchStop?.()
            }}
          />
        ) : timed ? (
          <DurationTimer seconds={duration} label={durationLabel} onSecondsChange={(value) => edit('duration', value)} />
        ) : (
          <Field
            label={repsLabel}
            className="ui-input--num"
            selectOnFocus
            value={reps}
            onChange={(e) => edit('reps', e.target.value)}
          />
        )}
      </div>
      {repsError ? (
        <p className="ui-field-error" role="alert">
          {repsError}
        </p>
      ) : null}
      {/* req-173 (DEC-093) — a weighted set with an empty kg box says so, quietly. Not a
          block or a confirm: Complete still logs it in one tap, as 0 (set-values.js
          liveSetWeight), exactly as before. Never a default weight (DESIGN core rule). */}
      {/* req-183 (DEC-102) — beside it, two more quiet notes (kg-hints.js): the last-time kg
          when it differs from the routine kg here (req-219; named, never put in the box), and a big-change
          note on a > 50% jump. Neither blocks Complete. */}
      {weighted && readKg(weight).empty ? (
        <p className="ui-field-note">
          {hints.lastTime != null ? `No weight entered · last time ${hints.lastTime} kg` : 'No weight entered'}
        </p>
      ) : hints.lastTime != null ? (
        <p className="ui-field-note">Last time: {hints.lastTime} kg</p>
      ) : null}
      {hints.bigJumpFrom != null ? (
        <p className="ui-field-note">That&apos;s a big change from {hints.bigJumpFrom} kg</p>
      ) : null}
      {weightError ? (
        <p className="ui-field-error" role="alert">
          {weightError}
        </p>
      ) : null}
      {durationError ? (
        <p className="ui-field-error" role="alert">
          {durationError}
        </p>
      ) : null}
      {/* req-80 — pinned to the absolute bottom (thumb reach) via .ui-setlog__actions.
          req-212 (DEC-119 §1) — every set, warm-up, work or cardio: a quiet Skip set row over one
          primary Done that logs it. No effort here (asked once, on the exercise review) and no
          Previous / Next (a done row of the set list opens SetEditSheet). Markup order =
          visual/focus order (DESIGN §4). */}
      <div className="ui-setlog__actions">
        <div className="ui-setlog__nav">
          {/* req-188 — the screen's only Skip: this set (Skip exercise is on the list). */}
          <Button variant="quiet" onClick={onSkip}>Skip set</Button>
        </div>
        <Button type="submit" variant="primary" block>
          Done
        </Button>
      </div>
    </form>
  )
}

// ExerciseHead (req-212, H5) — an exercise screen's head: the Title (a node: the name, or a
// link to the exercise) with an optional small control beside it (`aside`, e.g. "Add note"),
// and an optional caption line under it (`subtitle`). Was ad-hoc markup in item.jsx.
export function ExerciseHead({ title, aside = null, subtitle = '' }) {
  return (
    <>
      <div className="ui-exercise-head">
        <Title>{title}</Title>
        {aside ? <div className="ui-exercise-head__aside">{aside}</div> : null}
      </div>
      {subtitle ? <p className="ui-sub">{subtitle}</p> : null}
    </>
  )
}

// RestNotes (req-217, DEC-119 §6) — a quiet block under the set list while the exercise's rest
// runs: the routine's note for it (`note`), then a few form cues (`cues`, strings). Read-only.
// Renders nothing when both are empty.
export function RestNotes({ note = '', cues = [] }) {
  const list = (cues || []).filter(Boolean)
  if (!note && !list.length) return null
  return (
    <section className="ui-restnotes" aria-label="While you rest">
      {note ? <p className="ui-restnotes__note">{note}</p> : null}
      {list.length ? (
        <ul className="ui-restnotes__cues">
          {list.map((cue) => (
            <li key={cue}>{cue}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

// SetList (req-212, H5; was item.jsx's ad-hoc `ui-setpreview` list, req-106 / req-186) — one
// small line per set of an exercise. `rows`: [{ key, status: 'done' | 'current' | 'upcoming',
// text, highlighted }]. A done row is a button when `onOpen` is given (onOpen(row) — the
// caller opens that logged set); current / upcoming rows are plain text. The row on screen
// (`highlighted`) is set apart by fill and weight and marked aria-current.
export function SetList({ rows, onOpen, label = 'Sets' }) {
  return (
    <ul className="ui-setpreview" aria-label={label}>
      {(rows || []).map((row) => (
        <li
          key={row.key}
          className={cx('ui-setpreview__row', `is-${row.status}`, row.highlighted && 'is-here')}
          aria-current={row.highlighted ? 'step' : undefined}
        >
          {row.status === 'done' && onOpen ? (
            <button type="button" className="ui-setpreview__tap" onClick={() => onOpen(row)}>
              <span className="ui-setpreview__mark" aria-hidden="true">✓</span>
              <span className="ui-visually-hidden">Done: </span>
              {row.text}
            </button>
          ) : (
            <>
              <span className="ui-setpreview__mark" aria-hidden="true">
                {row.status === 'done' ? '✓' : ''}
              </span>
              {row.text}
            </>
          )}
        </li>
      ))}
    </ul>
  )
}

// SetEditSheet (req-212, DEC-119 §1) — edit ONE logged set over the screen it was opened
// from: that set's own fields (kg + reps, a timed set's seconds, or a cardio set's Duration /
// Level / Distance), Cancel and Save. No effort (asked once per exercise, on the review).
// Presentational, like SetLogForm: it owns the field text, validates it the same way (kg
// that can't be read, blank reps, unreadable seconds / cardio values → inline errors, no
// Save), and hands onSave({ weight, reps, durationSec, cardio }) to the caller, who writes it.
// Cancel, the backdrop and Escape call onCancel and write nothing. A cardio set's typed reps
// (an old "20 min") are passed back unchanged; `cardioHint` shows them.
// Review round 1 — Save is disabled until a field is edited (an untouched Save wrote a skipped
// set's prefill back as logged). `skipped`: the set is a skipped record, so un-skipping needs a
// real entered value — reps, a typed Duration (s) on a timed set, a Duration on a cardio set.
export function SetEditSheet({
  title = 'Set',
  weighted = true,
  timed = false,
  cardio = false,
  repsLabel = 'Reps',
  // req-240 — as SetLogForm's.
  durationLabel = 'Duration (s)',
  kgLabel = 'kg',
  initialWeight = '',
  initialReps = '',
  initialDuration = '',
  initialCardio = null,
  cardioHint = '',
  skipped = false,
  // req-241 — a done (not skipped) set offers "Skip set": the caller rewrites it as a skip record.
  onSkip,
  onSave,
  onCancel,
}) {
  const [edited, setEdited] = useState(false)
  const [weight, setWeight] = useState(String(initialWeight ?? ''))
  const [reps, setReps] = useState(String(initialReps ?? ''))
  const [duration, setDuration] = useState(initialDuration != null ? String(initialDuration) : '')
  const [cardioState, setCardioState] = useState(() => ({ ...EMPTY_CARDIO, ...(initialCardio || {}) }))
  const [errors, setErrors] = useState({})
  const titleId = useId()
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])
  function save() {
    const next = {}
    if (weighted) next.weight = kgError(weight)
    const seconds = timed ? secondsToSave(duration, 0) : null
    if (seconds?.error) next.duration = seconds.error
    else if (timed && skipped && duration.trim() === '') next.duration = 'Enter duration'
    // Review round 2 — 0 s is not a done set either (as cardio-set.js refuses a zero duration).
    else if (timed && skipped && seconds.value === 0) next.duration = 'Duration must be more than 0.'
    if (!timed && !cardio && reps.trim() === '') next.reps = `Enter ${repsLabel.toLowerCase()}`
    const read = cardio ? cardioValues(cardioState, { durationRequired: skipped }) : null
    if (read?.errors) next.cardio = read.errors
    if (Object.values(next).some(Boolean)) {
      setErrors(next)
      return
    }
    onSave?.({
      weight,
      reps: timed ? '' : reps,
      durationSec: timed ? seconds.value : undefined,
      ...(cardio ? { cardio: read.values } : {}),
    })
  }
  return (
    <div className="ui-sheet-backdrop" onClick={() => onCancel?.()}>
      <div className="ui-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <p id={titleId} className="ui-sheet__title">
          {title}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (edited) save()
          }}
          onInput={() => setEdited(true)}
        >
          <div className="ui-setlog__nums">
            {weighted ? (
              <NumberField
                label={kgLabel}
                selectOnFocus
                value={weight}
                onChange={(e) => {
                  setWeight(e.target.value)
                  setErrors((x) => ({ ...x, weight: null }))
                }}
              />
            ) : null}
            {cardio ? (
              <CardioFields
                values={cardioState}
                errors={errors.cardio || {}}
                viewing
                hint={cardioHint}
                onEdit={(field, value) => {
                  setEdited(true)
                  setCardioState((c) => ({ ...c, [field]: value, ...(field === 'duration' ? { watched: false } : {}) }))
                  setErrors((x) => ({ ...x, cardio: null }))
                }}
              />
            ) : timed ? (
              <NumberField
                label={durationLabel}
                selectOnFocus
                value={duration}
                onChange={(e) => {
                  setDuration(e.target.value)
                  setErrors((x) => ({ ...x, duration: null }))
                }}
              />
            ) : (
              <Field
                label={repsLabel}
                className="ui-input--num"
                selectOnFocus
                value={reps}
                onChange={(e) => {
                  setReps(e.target.value)
                  setErrors((x) => ({ ...x, reps: null }))
                }}
              />
            )}
          </div>
          {['weight', 'reps', 'duration'].map((key) =>
            errors[key] ? (
              <p key={key} className="ui-field-error" role="alert">
                {errors[key]}
              </p>
            ) : null,
          )}
          {onSkip && !skipped ? (
            <Button variant="quiet" block onClick={onSkip}>
              Skip set
            </Button>
          ) : null}
          <div className="ui-sheet__actions">
            <Button variant="secondary" onClick={() => onCancel?.()}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!edited}>
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
