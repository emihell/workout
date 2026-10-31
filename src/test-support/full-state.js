// req-220 — a "full" v9 state: every stored field the app writes, built where it can be
// through the real writers (Start, the live set records item.jsx makes, the exercise review's
// effort, Add set, Swap, Finish), then migrated. exchange.test.js / req-220.test.js check it
// against the export's field map (FIELDS) and round-trip it through export → import.
import { migrateState } from '../model.js'
import { addWorkingSetToState } from '../workout-items.js'
import { finishedState } from '../workout-finish.js'
import { setDraftFromForm } from '../workout-log.js'
import { itemEffortState, replaceItemInState, setLoggedState, startedWorkoutState } from '../state-reducers.js'
import { withCardioValues } from '../cardio-set.js'

const at = (time) => `2026-10-07T${time}:00.000Z`

function setup() {
  return {
    schemaVersion: 9,
    exercises: [
      {
        id: 'ex-press',
        name: 'Chest Press',
        equipment: 'Machine',
        muscles: 'Chest, Triceps',
        cues: 'Sit tall',
        type: 'machine',
        weightStep: '5',
        lightestWeight: 10,
        weightOptions: [10, 15, 20, 25, 30],
        archivedAt: null,
        hasDuration: false,
        durationSec: 30,
        libraryId: 'Leverage_Chest_Press',
      },
      { id: 'ex-plank', name: 'Plank', equipment: 'Bodyweight', muscles: 'Core', cues: '', type: 'bodyweight', weightStep: 'n/a', archivedAt: null, hasDuration: true, durationSec: 45 },
      { id: 'ex-bike', name: 'Bike', equipment: 'Bike', muscles: '', cues: '', type: 'cardio', weightStep: 'n/a', archivedAt: null, hasDuration: false, durationSec: 30 },
      { id: 'ex-row', name: 'Seated Row', equipment: 'Machine', muscles: 'Back', cues: '', type: 'machine', weightStep: 'Steps A/B', archivedAt: null, hasDuration: false, durationSec: 30 },
    ],
    routines: [
      {
        id: 'rtn-a',
        name: 'Upper',
        focus: 'Machines',
        archivedAt: null,
        exercises: [
          { id: 'si-bike', exerciseId: 'ex-bike', role: 'warmup', sets: 1, targets: ['5-8 min'], suggestedWeights: [], durations: [], restSec: 0, notes: '', warmup: null },
          { id: 'si-press', exerciseId: 'ex-press', role: 'main', sets: 2, targets: ['10', '10'], suggestedWeights: [20, 20], durations: [], restSec: 90, notes: 'slow', warmup: { reps: 12 } },
          { id: 'si-plank', exerciseId: 'ex-plank', role: 'finisher', sets: 1, targets: ['1'], suggestedWeights: [], durations: [45], restSec: 60, notes: '', warmup: null },
        ],
      },
    ],
    schedule: {
      loopWeeks: 1,
      anchor: '2026-09-28',
      slots: [{ id: 'slot-a', week: 0, weekday: 1, routineId: 'rtn-a' }],
      moves: [{ id: 'mv-1', slotId: 'slot-a', from: '2026-10-05', to: '2026-10-07' }],
    },
    // A workout from before snapshots carried hasDuration, with the legacy keys old data has.
    workouts: [
      {
        id: 'wo-old',
        routineId: 'rtn-a',
        occurrenceId: null,
        scheduleSlotId: null,
        scheduledFor: null,
        performedOn: '2026-01-05',
        startedAt: '2026-01-05T17:00:00.000Z',
        finishedAt: '2026-01-05T18:00:00.000Z',
        overallNote: '',
        overallFeel: '',
        completedItemIds: ['si-press'],
        restEndsAt: null,
        restPausedRemaining: null,
        progression: { 'si-press': { action: 'keep' } },
        snapshot: {
          programId: 'prog-1',
          programName: 'Gym',
          routineId: 'rtn-a',
          routineName: 'Upper',
          focus: 'Machines',
          items: [{ routineItemId: 'si-press', exerciseId: 'ex-press', exerciseName: 'Chest Press', equipment: 'Machine', exerciseType: 'machine', weightStep: '5', role: 'main', sets: 1, targets: ['10'], suggestedWeights: [20], restSec: 90, notes: '', warmup: null, durations: [] }],
        },
        sets: [{ exerciseId: 'ex-press', routineItemId: 'si-press', setType: 'work', weight: 20, reps: '10', rpe: 5, note: '', targetReps: '10', targetWeight: 20 }],
      },
    ],
    draftWorkouts: [],
    activeWorkout: null,
    plannedWorkouts: [],
    legacyRecommendations: { 'si-press': { sets: 1, targets: ['10'], suggestedWeights: [20] } },
  }
}

// A set record shaped exactly as item.jsx completeSet builds it.
function logged(item, setType, { weight = 0, reps = '', durationSec, targetReps = '', targetWeight = null, time }) {
  return {
    routineItemId: item,
    exerciseId: { 'si-bike': 'ex-bike', 'si-press': 'ex-press', 'si-plank': 'ex-plank' }[item],
    setType,
    weight,
    reps,
    ...(durationSec != null ? { durationSec } : {}),
    rpe: null,
    note: '',
    targetReps,
    targetWeight,
    loggedAt: at(time),
  }
}

export function fullState() {
  let s = setup()
  s = startedWorkoutState(s, { routineId: 'rtn-a', scheduledFor: '2026-10-07', scheduleSlotId: 'slot-a', id: 'wo-1', now: new Date(at('17:00')) })
  s = setLoggedState(s, withCardioValues(logged('si-bike', 'work', { targetReps: '5-8 min', time: '17:01' }), { durationSec: 360, level: 8, distance: 1.2, distanceUnit: 'km' }))
  s = setLoggedState(s, logged('si-press', 'wu', { weight: 10, reps: '12', targetReps: '12', time: '17:10' }))
  s = setLoggedState(s, logged('si-press', 'work', { weight: 20, reps: '10', targetReps: '10', targetWeight: 20, time: '17:12' }))
  s = setLoggedState(s, logged('si-press', 'work', { weight: 20, reps: '9', targetReps: '10', targetWeight: 20, time: '17:15' }))
  s = itemEffortState(s, 'si-press', 3)
  s = addWorkingSetToState(s, 'si-press')
  s = setLoggedState(s, logged('si-plank', 'work', { durationSec: 40, targetReps: '1', time: '17:30' }))
  s = replaceItemInState(s, 'si-plank', 'ex-row', 'si-swap')
  s = finishedState(s, { overallNote: 'Good one', overallFeel: 'Strong' }, at('18:00'))
  // A workout in progress, with every transient field a live session writes.
  s = startedWorkoutState(s, { routineId: 'rtn-a', scheduledFor: null, scheduleSlotId: null, id: 'wo-2', now: new Date('2026-10-09T17:00:00.000Z') })
  s = {
    ...s,
    activeWorkout: {
      ...s.activeWorkout,
      seedOverrides: { 'ex-press::work': { weight: 25 } },
      setDraft: setDraftFromForm('si-press:work:0', { weight: '25', reps: '8', effort: '' }, ''),
      autoFinishDismissed: true,
      stopwatch: { draftKey: 'si-bike:work:0', startedAt: 1, baseSec: 0 },
    },
  }
  return JSON.parse(JSON.stringify(migrateState(s)))
}
