import { useState } from 'react'
import { RPE_OPTIONS, rpeOptionValue } from '../ids'
import { kgError } from '../kg-input.js'
import { secondsError } from '../seconds-input.js'
import { DISTANCE_UNITS, cardioFormText, cardioValues } from '../cardio-set.js'
import { Actions, Button, Field, NavLink, NumberField, SectionHeader, SegmentedControl } from '../ui/index.jsx'

const NO_ERRORS = Object.freeze({})

// req-18 / DEC-021 #2 — the shared kg / reps / effort / note editor for a single
// already-logged set, used by both WorkoutSetEdit (a set in the active workout)
// and HistorySet (a set in a finished, historical workout). It lives here rather
// than in shared.jsx because it imports ui/ primitives, and shared.jsx is kept
// free of ui/ imports (ui/index.jsx imports NavLink from it — one-way).
//
// The two callers differ ONLY in things passed as props; the form owns the field
// state and layout:
//   - showLoad / showEffort — whether the kg and effort controls appear.
//     WorkoutSetEdit hides kg for cardio/bodyweight and effort for warm-up or
//     cardio sets; HistorySet always shows both.
//   - setTypeOptions — when passed, renders the (History-only) set-type toggle
//     above the fields; its state is seeded from set.setType.
//   - onSave(values) — receives the RAW field state ({ weight, reps, rpe, note,
//     setType } as held in the inputs). Each caller does its own coercion (an
//     empty weight becomes 0 in a live set but stays '' in history; set-values.js)
//     and runs its own store mutation + routing. Keeping coercion in the caller preserves the
//     two paths' exact, differing save behaviour.
//   - cancelTo — the Cancel link's route.
//   - req-163 — `showEffort` / `showDuration` may be a function of the form's current set
//     type (History's WU/Work toggle): History hides Effort on a warm-up or cardio set, as
//     the live forms do (DEC-087 §2), and shows a Duration (s) field on a timed exercise's
//     work set (req-117 b). A hidden field submits nothing of its own (L-038): Effort ''
//     (→ rpe null), and no `durationSec` key at all. Duration text goes through the one
//     seconds parse (seconds-input.js: `30,5` → 31); unreadable text is refused inline.
//   - req-154 — when the kg is shown, Save first checks it reads as a number (`22,5` does,
//     DEC-058 §1); if not (`abc`, `2,5,5`) the form shows the error inline and does not
//     call onSave. The callers' coercion lives in set-values.js.
//
// Everything around the form (Screen / Back / RestPill / header / History's
// Remove button) stays in the caller.
// req-189 — `kgLabel` ("kg per dumbbell" from the live workout's set edit; default "kg"), and
// the number boxes select their content on focus (the first keystroke replaces the value).
//   - req-194 — `cardio`: a non-timed cardio exercise's set shows Duration (clock text,
//     `12:30` / `20 min`), Level and Distance + unit (cardio-set.js), all optional here (an old
//     set had none). Reps shows only when the set has typed reps (an old cardio set's "20 min"),
//     so it can still be read and edited. onSave gets `cardio` (parsed; null = blank → absent).
export function SetEditForm({ set, showLoad, showEffort, showDuration = false, setTypeOptions, onSave, cancelTo, kgLabel = 'kg', cardio = false }) {
  const effortFor = (type) => (typeof showEffort === 'function' ? showEffort(type) : Boolean(showEffort))
  const [weight, setWeight] = useState(set?.weight ?? '')
  const [reps, setReps] = useState(set?.reps ?? '')
  // req-167 — the stored effort seeds the control only if Effort shows for the set's OWN
  // type: a warm-up / cardio set's legacy rpe 3 (pre-req-156) was never shown or chosen, so
  // toggling it to Work starts Effort unset, as a fresh work set would — not "Moderate".
  const [rpe, setRpe] = useState(() =>
    effortFor(set?.setType || 'work') && set?.rpe != null && set.rpe !== '' ? String(rpeOptionValue(set.rpe)) : '',
  )
  const [note, setNote] = useState(set?.note || '')
  const [setType, setSetType] = useState(set?.setType || 'work')
  const [weightError, setWeightError] = useState(null)
  const [duration, setDuration] = useState(set?.durationSec != null && set.durationSec !== '' ? String(set.durationSec) : '')
  const [durationError, setDurationError] = useState(null)
  const [cardioText, setCardioText] = useState(() => cardioFormText(set))
  const [cardioErrors, setCardioErrors] = useState({})
  const editCardio = (field, value) => {
    setCardioText((t) => ({ ...t, [field]: value }))
    setCardioErrors({})
  }
  const showReps = !cardio || String(set?.reps ?? '') !== ''
  const effortShown = effortFor(setType)
  const durationShown = typeof showDuration === 'function' ? showDuration(setType) : Boolean(showDuration)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        // req-156 — a hidden Effort saves no effort ('' → rpe null), not the stored value
        // the user can't see (an old warm-up's rpe 3).
        // req-194 — a cardio set's Duration / Level / Distance (cardio-set.js), checked with kg.
        const cardioRead = cardio ? cardioValues(cardioText) : null
        const error = showLoad ? kgError(weight) : null
        const secondsProblem = durationShown ? secondsError(duration) : null
        if (error || secondsProblem || cardioRead?.errors) {
          setWeightError(error)
          setDurationError(secondsProblem)
          setCardioErrors(cardioRead?.errors ?? NO_ERRORS)
          return
        }
        onSave({
          weight,
          reps,
          rpe: effortShown ? rpe : '',
          note,
          setType,
          ...(cardioRead ? { cardio: cardioRead.values } : {}),
          // req-167 — a warm-up saves no duration (as the live form logs a WU set): a
          // stored duration is cleared (→ null) when the set is, or is toggled to, WU.
          ...(durationShown
            ? { durationSec: duration }
            : setType === 'wu' && set?.durationSec != null && set.durationSec !== ''
              ? { durationSec: '' }
              : {}),
        })
      }}
    >
      {setTypeOptions ? (
        <>
          <SectionHeader>Type</SectionHeader>
          <SegmentedControl
            options={setTypeOptions}
            value={setType}
            onChange={setSetType}
            ariaLabel="Type"
          />
        </>
      ) : null}
      {showLoad ? (
        <NumberField
          label={kgLabel}
          selectOnFocus
          value={weight}
          onChange={(event) => {
            setWeight(event.target.value)
            setWeightError(null)
          }}
        />
      ) : null}
      {showLoad && weightError ? (
        <p className="ui-field-error" role="alert">
          {weightError}
        </p>
      ) : null}
      {showReps ? (
        <Field label="Reps" selectOnFocus value={reps} onChange={(event) => setReps(event.target.value)} />
      ) : null}
      {cardio ? (
        <>
          <Field
            label="Duration"
            placeholder="mm:ss"
            selectOnFocus
            value={cardioText.duration}
            onChange={(event) => editCardio('duration', event.target.value)}
          />
          {cardioErrors.duration ? <p className="ui-field-error" role="alert">{cardioErrors.duration}</p> : null}
          <Field
            label="Level"
            inputMode="decimal"
            selectOnFocus
            value={cardioText.level}
            onChange={(event) => editCardio('level', event.target.value)}
          />
          {cardioErrors.level ? <p className="ui-field-error" role="alert">{cardioErrors.level}</p> : null}
          <Field
            label="Distance"
            inputMode="decimal"
            selectOnFocus
            value={cardioText.distance}
            onChange={(event) => editCardio('distance', event.target.value)}
          />
          <SegmentedControl
            options={DISTANCE_UNITS}
            value={cardioText.distanceUnit}
            onChange={(unit) => editCardio('distanceUnit', unit)}
            ariaLabel="Distance unit"
          />
          {cardioErrors.distance ? <p className="ui-field-error" role="alert">{cardioErrors.distance}</p> : null}
        </>
      ) : null}
      {durationShown ? (
        <NumberField
          label="Duration (s)"
          selectOnFocus
          value={duration}
          onChange={(event) => {
            setDuration(event.target.value)
            setDurationError(null)
          }}
        />
      ) : null}
      {durationShown && durationError ? (
        <p className="ui-field-error" role="alert">
          {durationError}
        </p>
      ) : null}
      {effortShown ? (
        <>
          <SectionHeader>Effort</SectionHeader>
          {/* clearable keeps effort resettable, as the old <select> did */}
          <SegmentedControl
            clearable
            options={RPE_OPTIONS}
            value={rpe}
            onChange={setRpe}
            ariaLabel="Effort"
          />
        </>
      ) : null}
      <Field label="Note" value={note} onChange={(event) => setNote(event.target.value)} />
      <Actions
        retreat={<NavLink to={cancelTo} look="quiet">Cancel</NavLink>}
        forward={<Button type="submit" variant="primary">Save</Button>}
      />
    </form>
  )
}
