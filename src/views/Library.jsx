import { go } from '../route'
import { SegmentedControl } from '../ui/index.jsx'
import { Exercises } from './Exercises'
import { Routines } from './Routine'

// req-14 / DEC-024 — the Library tab. A [Routines | Exercises] segmented toggle
// hosting the EXISTING Routines and Exercises list screens, both first-class.
// The toggle is the shared SegmentedControl primitive (already accessible: a
// radiogroup, ≥44px segments, grayscale) — no new primitive, one less thing to
// keep in sync. The active segment is derived from the route (`tab`), not local
// state, so drilling into a routine/exercise detail and backing out to the list
// keeps the toggle correct; tapping a segment navigates to that list's route.
//
// The screens themselves are hosted unchanged (spec: do NOT redesign them); this
// only wraps them in the toggle. Their own routes/behaviour — detail, edit, pick,
// + New — are untouched and render directly (not through here).
const SEGMENTS = [
  { value: 'routines', label: 'Routines' },
  { value: 'exercises', label: 'Exercises' },
]

export function Library({ tab }) {
  return (
    <>
      <div className="ui-library-toggle">
        <SegmentedControl
          options={SEGMENTS}
          value={tab}
          onChange={(value) => {
            if (value !== tab) go(value === 'exercises' ? '/exercises' : '/routines')
          }}
          ariaLabel="Library section"
        />
      </div>
      {tab === 'exercises' ? <Exercises /> : <Routines />}
    </>
  )
}
