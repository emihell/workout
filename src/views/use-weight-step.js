// req-165 (F-LINT-1) — the weight-step field's state hook, moved out of
// weight-step-field.jsx so that file exports components only.
import { useState } from 'react'
import { weightStepToSave, weightStepFields, weightStepNote } from '../weight-step.js'

export function useWeightStep(stored) {
  const [fields, setFields] = useState(() => weightStepFields(stored))
  const [touched, setTouched] = useState(false)
  const update = (patch) => {
    setTouched(true)
    setFields((f) => ({ ...f, ...patch }))
  }
  return {
    fields,
    note: weightStepNote(fields),
    setAmount: (amount) => update({ amount }),
    setAlternating: (alternating) => update({ alternating }),
    // { value } to write, or { error } (a typed value that doesn't read) to block Save.
    save: () => weightStepToSave(fields, { stored, touched }),
  }
}
