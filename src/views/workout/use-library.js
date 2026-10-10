// req-217 — the exercise library for the log screen / review ("each side", rest cues). It is a
// lazy chunk (loadExerciseLibrary); until it arrives — or if it fails — this is null and the
// screen reads as before req-217 (plain reps, the routine note alone). Once loaded it is kept
// here so later screens start with it on their first render.
import { useEffect, useState } from 'react'
import { loadExerciseLibrary } from '../../exerciseLibrary.js'

let loaded = null

export function useExerciseLibrary() {
  const [library, setLibrary] = useState(loaded)
  useEffect(() => {
    if (library) return undefined
    let cancelled = false
    loadExerciseLibrary()
      .then((list) => {
        if (!Array.isArray(list)) return
        loaded = list
        if (!cancelled) setLibrary(list)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [library])
  return library
}
