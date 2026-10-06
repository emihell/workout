import { Checkbox, Field } from '../ui/index.jsx'
import { weightSeriesPreview } from '../progress.js'

// req-126 / DEC-059 §2 — the weight step, shared by the exercise editor and the in-workout
// setup screen. The logic (parse, note, what Save writes) is pure in ../weight-step.js and
// unit-tested there; the state hook is ./use-weight-step.js (req-165: this file exports
// components only).
// req-193 / DEC-108 §6 — "Weight step (kg)"; "Two step sizes" shows two editable boxes
// (the increment box is no longer disabled); "Lightest weight (kg)" is optional. The
// views don't render this for a cardio exercise.
// req-193 — a preview line under the fields: what the recommendation would move through.
// `exercise` is the exercise as the recommendation will read it (type, name, weightOptions …);
// the draft step / lightest weight are laid over it.
export function WeightStepField({ step, exercise }) {
  const { fields, note, lightestNote } = step
  const draft = step.draft()
  return (
    <>
      {fields.alternating ? (
        <div className="ui-field-pair">
          <Field
            label="First step (kg)"
            inputMode="decimal"
            value={fields.amount}
            aria-invalid={Boolean(note)}
            onChange={(e) => step.setAmount(e.target.value)}
          />
          <Field
            label="Second step (kg)"
            inputMode="decimal"
            value={fields.second}
            aria-invalid={Boolean(note)}
            onChange={(e) => step.setSecond(e.target.value)}
          />
        </div>
      ) : (
        <Field
          label="Weight step (kg)"
          inputMode="decimal"
          value={fields.amount}
          aria-invalid={Boolean(note)}
          onChange={(e) => step.setAmount(e.target.value)}
        />
      )}
      {note ? (
        <p className="ui-field-error" role="alert">
          {note}
        </p>
      ) : null}
      <Checkbox label="Two step sizes" checked={fields.alternating} onChange={step.setAlternating} />
      <p className="ui-field-note">e.g. machines that go 4, 5, 4, 5 kg</p>
      <Field
        label="Lightest weight (kg)"
        inputMode="decimal"
        value={step.lightest}
        aria-invalid={Boolean(lightestNote)}
        onChange={(e) => step.setLightest(e.target.value)}
      />
      {lightestNote ? (
        <p className="ui-field-error" role="alert">
          {lightestNote}
        </p>
      ) : null}
      {draft ? <p className="ui-field-note" data-testid="weight-series">{weightSeriesPreview({ ...exercise, ...draft })}</p> : null}
    </>
  )
}
