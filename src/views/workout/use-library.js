// req-217 — the exercise library for the log screen / review / Details editor ("each side",
// rest cues). req-265: it is the hint list (src/library/hints.json, ~28 kB gzip: id, names,
// aliases, unilateral, ≤3 form cues), not the full library chunk (~264 kB gzip, which only the
// picker / search load). A lazy chunk (loadLibraryHints); until it arrives — or if it fails —
// this is null and the screen reads as before req-217 (plain reps, the routine note alone); a
// failed load is not cached, so a later mount retries. Once loaded it is kept here so later
// screens start with it on their first render. `load` is injectable for tests only.
import { useEffect, useState } from 'react'
import { loadLibraryHints } from '../../exerciseLibrary.js'

let loaded = null

export function useExerciseLibrary(load = loadLibraryHints) {
  const [library, setLibrary] = useState(loaded)
  useEffect(() => {
    if (library) return undefined
    let cancelled = false
    load()
      .then((list) => {
        if (!Array.isArray(list)) return
        loaded = list
        if (!cancelled) setLibrary(list)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [library, load])
  return library
}
