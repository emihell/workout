// req-165 (F-LINT-1) — the weight-step field's state hook, moved out of
// weight-step-field.jsx so that file exports components only.
// req-193 — also holds the "Lightest weight (kg)" box; save() returns the exercise patch.
import { useState } from 'react'
import {
  lightestWeightNote,
  lightestWeightText,
  lightestWeightToSave,
  weightStepToSave,
  weightStepFields,
  weightStepNote,
} from '../weight-step.js'

export function useWeightStep(stored, storedLightest) {
  const [fields, setFields] = useState(() => weightStepFields(stored))
  const [touched, setTouched] = useState(false)
  const [lightest, setLightestText] = useState(() => lightestWeightText(storedLightest))
  const [lightestTouched, setLightestTouched] = useState(false)
  // req-193 — a blank step-size box is an error only after a Save attempt.
  const [tried, setTried] = useState(false)
  const update = (patch) => {
    setTouched(true)
    setFields((f) => ({ ...f, ...patch }))
  }
  return {
    fields,
    note: weightStepNote(fields, { tried }),
    lightest,
    lightestNote: lightestWeightNote(lightest),
    setAmount: (amount) => update({ amount }),
    setSecond: (second) => update({ second }),
    setAlternating: (alternating) => update({ alternating }),
    setLightest: (text) => {
      setLightestTouched(true)
      setLightestText(text)
    },
    // { patch } to merge into the exercise (untouched fields left out), or { error } (a
    // typed value that doesn't read) to block Save.
    save: () => {
      setTried(true)
      const step = weightStepToSave(fields, { stored, touched })
      const low = lightestWeightToSave(lightest, { stored: storedLightest, touched: lightestTouched })
      if (step.error || low.error) return { error: step.error || low.error }
      return {
        patch: {
          ...(step.unchanged ? {} : { weightStep: step.value }),
          ...(low.unchanged ? {} : { lightestWeight: low.value }),
        },
      }
    },
  }
}
