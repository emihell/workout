import { go } from '../route'
import { SegmentedControl } from '../ui/index.jsx'
import { Exercises } from './Exercises'
import { Routines } from './Routine'
import { Schedule } from './Schedule'

// req-14 / DEC-024 — the Library tab. A segmented toggle hosting the EXISTING
// list screens, all first-class. req-56: Schedule joins as the first segment
// (order Schedule | Routines | Exercises, Emilio's) so it lives here rather than
// as a separate top-level route; its list view drops its own <Back/> (it's a
// primary tab now), the drill-down screens keep theirs. The toggle is the shared
// SegmentedControl primitive (already accessible: a radiogroup, ≥44px segments,
// grayscale) — no new primitive, one less thing to keep in sync. The active
// segment is derived from the route (`tab`), not local state, so drilling into a
// routine/exercise/schedule detail and backing out keeps the toggle correct;
// tapping a segment navigates to that list's route.
//
// The screens themselves are hosted unchanged (spec: do NOT redesign them); this
// only wraps them in the toggle. Their own routes/behaviour — detail, edit, pick,
// + New, schedule drill-downs — are untouched and render directly (not through here).
const SEGMENTS = [
  { value: 'schedule', label: 'Schedule' },
  { value: 'routines', label: 'Routines' },
  { value: 'exercises', label: 'Exercises' },
]

const SEGMENT_ROUTES = {
  schedule: '/schedule',
  routines: '/routines',
  exercises: '/exercises',
}

export function Library({ tab }) {
  return (
    <>
      <div className="ui-library-toggle">
        <SegmentedControl
          options={SEGMENTS}
          value={tab}
          onChange={(value) => {
            if (value !== tab) go(SEGMENT_ROUTES[value])
          }}
          ariaLabel="Library section"
        />
      </div>
      {tab === 'schedule' ? <Schedule /> : tab === 'exercises' ? <Exercises /> : <Routines />}
    </>
  )
}
