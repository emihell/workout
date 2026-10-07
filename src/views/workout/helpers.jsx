import { inWorkoutFallback } from '../../workout-paths'
import { useEffect } from 'react'
import { go, hashPath } from '../../route'
import { routineById } from '../../model.js'
import { useStore } from '../../store-context'
import { Missing } from '../shared'
import { improvementText } from '../../beat-last-time.js'

// The in-workout screens' shared COMPONENTS. req-165 (F-LINT-1) — their shared plain
// helpers moved to ./workout-helpers.js, so this file exports components only (Fast
// Refresh: only-export-components).

export function MissingItem() {
  return <Missing>Not found.</Missing>
}

// req-153 — the render for an in-workout route that can't show: with no active workout
// for this (known) routine it redirects, replacing, to the routine's overview; otherwise
// "Not found." (inWorkoutFallback decides). The redirect re-checks the browser's CURRENT
// path when it runs, so a Finish exit that already moved to Today isn't pulled back.
export function NotInWorkout({ routineId }) {
  const store = useStore()
  const args = {
    active: store.activeWorkout,
    routineId,
    routineKnown: Boolean(routineById(store.routines, routineId)),
  }
  const outcome = inWorkoutFallback({ ...args, currentPath: hashPath(window.location.hash) })
  useEffect(() => {
    if (inWorkoutFallback({ ...args, currentPath: hashPath(window.location.hash) }) === 'redirect') {
      go(`/workout/${routineId}`, { replace: true })
    }
  })
  return outcome === 'missing' ? <MissingItem /> : null
}

// req-210 (DEC-117 §1) — the finish screens' per-exercise "↑ N%": one quiet line per exercise
// that beat last time (improvementList); nothing for one that didn't, nothing at all when
// none did.
export function ImprovementLines({ list }) {
  if (!list?.length) return null
  return list.map((entry) => (
    <p key={entry.exerciseId} className="ui-sub ui-improvement">
      {entry.name}
      <span className="ui-arrow">{improvementText(entry.pct)}</span>
    </p>
  ))
}
