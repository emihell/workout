import { Checkbox, Field } from '../ui/index.jsx'

// req-126 / DEC-059 §2 — the weight step as "Increment (kg)" plus an "Alternating (4/5)"
// checkbox, shared by the exercise editor and the in-workout setup screen. The logic
// (parse, note, what Save writes) is pure in ../weight-step.js and unit-tested there; the
// state hook is ./use-weight-step.js (req-165: this file exports components only).
export function WeightStepField({ step }) {
  const { fields, note } = step
  return (
    <>
      <Field
        label="Increment (kg)"
        inputMode="decimal"
        value={fields.alternating ? '' : fields.amount}
        disabled={fields.alternating}
        aria-invalid={Boolean(note)}
        onChange={(e) => step.setAmount(e.target.value)}
      />
      {note ? (
        <p className="ui-field-error" role="alert">
          {note}
        </p>
      ) : null}
      <Checkbox label="Alternating (4/5)" checked={fields.alternating} onChange={step.setAlternating} />
    </>
  )
}
