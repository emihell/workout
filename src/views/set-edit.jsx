import { useState } from 'react'
import { RPE_OPTIONS, rpeOptionValue } from '../ids'
import { Button, Field, NumberField, SectionHeader, SegmentedControl } from '../ui/index.jsx'
import { NavLink } from './shared'

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
//     empty weight becomes 0 in a live set but stays '' in history) and runs its
//     own store mutation + routing. Keeping coercion in the caller preserves the
//     two paths' exact, differing save behaviour.
//   - cancelTo — the Cancel link's route.
//
// Everything around the form (Screen / Back / RestBar / header / History's
// Remove button) stays in the caller.
export function SetEditForm({ set, showLoad, showEffort, setTypeOptions, onSave, cancelTo }) {
  const [weight, setWeight] = useState(set?.weight ?? '')
  const [reps, setReps] = useState(set?.reps ?? '')
  const [rpe, setRpe] = useState(() =>
    set?.rpe != null && set.rpe !== '' ? String(rpeOptionValue(set.rpe)) : '',
  )
  const [note, setNote] = useState(set?.note || '')
  const [setType, setSetType] = useState(set?.setType || 'work')

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSave({ weight, reps, rpe, note, setType })
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
        <NumberField label="kg" value={weight} onChange={(event) => setWeight(event.target.value)} />
      ) : null}
      <Field label="Reps" value={reps} onChange={(event) => setReps(event.target.value)} />
      {showEffort ? (
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
      <div className="ui-actions">
        <NavLink to={cancelTo}>Cancel</NavLink>
        <Button type="submit" variant="primary">
          Save
        </Button>
      </div>
    </form>
  )
}
