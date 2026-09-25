import { useState } from 'react'
import { RPE_OPTIONS, rpeOptionValue } from '../ids'
import { kgError } from '../kg-input.js'
import { secondsError } from '../seconds-input.js'
import { Actions, Button, Field, NavLink, NumberField, SectionHeader, SegmentedControl } from '../ui/index.jsx'

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
export function SetEditForm({ set, showLoad, showEffort, showDuration = false, setTypeOptions, onSave, cancelTo }) {
  const [weight, setWeight] = useState(set?.weight ?? '')
  const [reps, setReps] = useState(set?.reps ?? '')
  const [rpe, setRpe] = useState(() =>
    set?.rpe != null && set.rpe !== '' ? String(rpeOptionValue(set.rpe)) : '',
  )
  const [note, setNote] = useState(set?.note || '')
  const [setType, setSetType] = useState(set?.setType || 'work')
  const [weightError, setWeightError] = useState(null)
  const [duration, setDuration] = useState(set?.durationSec != null && set.durationSec !== '' ? String(set.durationSec) : '')
  const [durationError, setDurationError] = useState(null)
  const effortShown = typeof showEffort === 'function' ? showEffort(setType) : Boolean(showEffort)
  const durationShown = typeof showDuration === 'function' ? showDuration(setType) : Boolean(showDuration)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        // req-156 — a hidden Effort saves no effort ('' → rpe null), not the stored value
        // the user can't see (an old warm-up's rpe 3).
        const error = showLoad ? kgError(weight) : null
        const secondsProblem = durationShown ? secondsError(duration) : null
        if (error || secondsProblem) {
          setWeightError(error)
          setDurationError(secondsProblem)
          return
        }
        onSave({
          weight,
          reps,
          rpe: effortShown ? rpe : '',
          note,
          setType,
          ...(durationShown ? { durationSec: duration } : {}),
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
          label="kg"
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
      <Field label="Reps" value={reps} onChange={(event) => setReps(event.target.value)} />
      {durationShown ? (
        <NumberField
          label="Duration (s)"
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
