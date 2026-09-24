// req-143 — library triage (DEC-070): every rough entry is finish / merge / merge-later /
// hide (src/library/triage.js); hidden entries leave Search except ones the user has, and
// stay resolvable; merged names people type are aliases on the target. Reads nothing
// from handoff/.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { listable, searchCommonFirst, searchExerciseCatalog } from './exerciseCatalog.js'
import { libraryEntryFor, libraryProblems, OWN_FIELDS, triageProblems } from './exerciseLibrary.js'
import { libraryItemMatch } from './exercise-names.js'
import { PENDING_ADDS, triageRows } from './library/triage.js'

const LIBRARY_TEXT = readFileSync(fileURLToPath(new URL('./library/exercises.json', import.meta.url)), 'utf8')
const library = JSON.parse(LIBRARY_TEXT)
const byId = new Map(library.map((entry) => [entry.id, entry]))
const rows = triageRows()
const rowOf = new Map(rows.map((row) => [row.id, row]))
const hidden = library.filter((entry) => entry.hidden)
const problemsFor = (id, change, options) => libraryProblems(library.map((entry) => (entry.id === id ? { ...entry, ...change } : entry)), options)
  .filter((line) => line.startsWith(`${id}:`))
const firstShown = (query) => {
  const { common, rest } = searchCommonFirst(library, query)
  return (common.length ? common : rest)[0]?.id
}

// The req-140 parity queue's promote list (79 free-db ids), copied here so the test
// reads nothing from handoff/.
const QUEUED = [
  'Band_Good_Morning', 'Band_Hip_Adductions', 'Barbell_Ab_Rollout', 'Barbell_Rear_Delt_Row', 'Barbell_Shrug_Behind_The_Back',
  'Bent-Arm_Barbell_Pullover', 'Body_Tricep_Press', 'Cable_Wrist_Curl', 'Cat_Stretch', 'Childs_Pose', 'Close-Grip_Dumbbell_Press',
  'Cross_Body_Hammer_Curl', 'Decline_Dumbbell_Flyes', 'Donkey_Calf_Raises', 'Drag_Curl', 'Dumbbell_Squat', 'Exercise_Ball_Pull-In',
  'External_Rotation_with_Cable', 'Flat_Bench_Leg_Pull-In', 'Front_Cable_Raise', 'Hug_Knees_To_Chest',
  'Isometric_Neck_Exercise_-_Sides', 'Kettlebell_Halo', 'Kettlebell_Sumo_High_Pull', 'Kettlebell_Windmill',
  'Kneeling_Forearm_Stretch', 'Kneeling_High_Pulley_Row', 'Kneeling_Hip_Flexor', 'Leverage_Shrug', 'Lying_One-Arm_Lateral_Raise',
  'Monster_Walk', 'One-Arm_Kettlebell_Military_Press_To_The_Side', 'One_Arm_Lat_Pulldown', 'Physioball_Hip_Bridge', 'Plate_Pinch',
  'Plyo_Push-up', 'Power_Jerk', 'Preacher_Hammer_Dumbbell_Curl', 'Push-Up_Wide', 'Push-Ups_With_Feet_On_An_Exercise_Ball',
  'Quad_Stretch', 'Reverse_Grip_Bent-Over_Rows', 'Ring_Dips', 'Rope_Climb', 'Scapular_Pull-Up', 'Scissor_Kick',
  'Seated_Side_Lateral_Raise', 'Seated_Triceps_Press', 'Side_Leg_Raises', 'Side_Neck_Stretch', 'Single-Leg_Leg_Extension',
  'Smith_Machine_Bent_Over_Row', 'Smith_Machine_Decline_Press', 'Smith_Machine_Hip_Raise', 'Smith_Machine_Stiff-Legged_Deadlift',
  'Smith_Machine_Upright_Row', 'Smith_Single-Leg_Split_Squat', 'Split_Jerk', 'Split_Squats', 'Standing_Barbell_Calf_Raise',
  'Standing_Barbell_Press_Behind_Neck', 'Standing_Front_Barbell_Raise_Over_Head', 'Standing_Gastrocnemius_Calf_Stretch',
  'Standing_One-Arm_Dumbbell_Triceps_Extension', 'Standing_Overhead_Barbell_Triceps_Extension', 'Suspended_Push-Up',
  'Suspended_Split_Squat', 'Svend_Press', 'The_Straddle', 'Triceps_Stretch', 'Two-Arm_Kettlebell_Clean',
  'Two-Arm_Kettlebell_Military_Press', 'Two-Arm_Kettlebell_Row', 'Upright_Cable_Row', 'V-Bar_Pullup',
  'Wide-Grip_Barbell_Bench_Press', 'Wide-Grip_Pulldown_Behind_The_Neck', 'Windmills', 'Wrist_Roller',
]

describe('the triage', () => {
  it('every non-common entry has exactly one row, and the file is clean against the library', () => {
    assert.deepEqual(triageProblems(library), [])
    for (const entry of library) {
      if (!entry.common) assert.equal(rows.filter((row) => row.id === entry.id).length, 1, entry.id)
    }
  })

  it('697 rows: 121 finish, 133 merge, 53 merge-later, 390 hide', () => {
    const count = (triage) => rows.filter((row) => row.class === triage).length
    assert.equal(rows.length, 697)
    assert.deepEqual([count('finish'), count('merge'), count('merge-later'), count('hide')], [121, 133, 53, 390])
  })

  it('every non-common entry that isn\'t hidden is finish; no finish row is hidden', () => {
    for (const entry of library) {
      if (!entry.common && !entry.hidden) assert.equal(rowOf.get(entry.id).class, 'finish', entry.id)
    }
    for (const row of rows) if (row.class === 'finish') assert.ok(!byId.get(row.id).hidden, row.id)
  })

  it('the 79 queued promote ids are finish', () => {
    assert.equal(new Set(QUEUED).size, 79)
    for (const id of QUEUED) assert.equal(rowOf.get(id)?.class, 'finish', id)
  })

  it('hidden and mergedInto are exactly the triage: hidden on every non-finish row, target → mergedInto', () => {
    for (const row of rows) {
      const entry = byId.get(row.id)
      assert.equal(entry.hidden, row.class === 'finish' ? undefined : true, row.id)
      assert.equal(entry.mergedInto, row.target, row.id)
    }
    assert.equal(hidden.length, 697 - 121)
    for (const entry of library) if (!rowOf.has(entry.id)) assert.ok(!('hidden' in entry) && !('mergedInto' in entry), entry.id)
  })

  it('a merge target is common; a merge-later target is a finish row or a queued add', () => {
    for (const row of rows) {
      if (row.class === 'merge') assert.ok(byId.get(row.target)?.common, row.id)
      if (row.class === 'merge-later') assert.ok(rowOf.get(row.target)?.class === 'finish' || PENDING_ADDS.includes(row.target), row.id)
    }
  })
})

describe('hidden and mergedInto fields', () => {
  it('are our fields (OWN_FIELDS), emitted only when set', () => {
    assert.ok(OWN_FIELDS.includes('hidden') && OWN_FIELDS.includes('mergedInto'))
    assert.doesNotMatch(LIBRARY_TEXT, /"hidden": false/)
    assert.ok(library.every((entry) => !('hidden' in entry) || entry.hidden === true))
  })

  it('hidden ⇒ not common, and hidden is only ever true (fixtures)', () => {
    assert.deepEqual(problemsFor('Plank', { hidden: true }), ['Plank: hidden on a common entry'])
    assert.deepEqual(problemsFor('Car_Deadlift', { hidden: false }), ['Car_Deadlift: hidden is false, not true'])
    assert.deepEqual(problemsFor('Car_Deadlift', {}), [])
  })

  it('mergedInto needs hidden, and a target in the library (or a queued add) that isn\'t hidden (fixtures)', () => {
    assert.deepEqual(problemsFor('Hamstring_Stretch', { mergedInto: 'Plank' }), ['Hamstring_Stretch: mergedInto without hidden'])
    assert.deepEqual(problemsFor('Car_Deadlift', { mergedInto: 'Nope' }), ['Car_Deadlift: mergedInto "Nope" is not in the library'])
    assert.deepEqual(problemsFor('Car_Deadlift', { mergedInto: 'Atlas_Stones' }), ['Car_Deadlift: mergedInto "Atlas_Stones", which is hidden'])
    assert.equal(byId.get('Groin_and_Back_Stretch').mergedInto, 'own-butterfly-stretch')
    assert.deepEqual(problemsFor('Groin_and_Back_Stretch', {}), [])
    assert.deepEqual(problemsFor('Groin_and_Back_Stretch', {}, { pendingTargets: [] }),
      ['Groin_and_Back_Stretch: mergedInto "own-butterfly-stretch" is not in the library'])
  })

  it('triageProblems catches a missing, doubled, unknown or mis-targeted row (fixtures)', () => {
    const edit = (id, change) => rows.map((row) => (row.id === id ? { ...row, ...change } : row))
    assert.deepEqual(triageProblems(library, rows.filter((row) => row.id !== 'Car_Deadlift')), ['Car_Deadlift: 0 triage rows, not 1'])
    assert.deepEqual(triageProblems(library, [...rows, rowOf.get('Car_Deadlift')]), ['Car_Deadlift: 2 triage rows, not 1'])
    assert.deepEqual(triageProblems(library, edit('Car_Deadlift', { class: 'drop' })), ['triage Car_Deadlift: class "drop"'])
    assert.deepEqual(triageProblems(library, edit('Car_Deadlift', { reason: ' ' })), ['triage Car_Deadlift: no reason'])
    assert.deepEqual(triageProblems(library, edit('Car_Deadlift', { target: 'Plank' })), ['triage Car_Deadlift: a target on a non-merge row'])
    assert.deepEqual(triageProblems(library, edit('Air_Bike', { target: 'Hamstring_Stretch' })),
      ['triage Air_Bike: merge target "Hamstring_Stretch" is not a common entry'])
    assert.deepEqual(triageProblems(library, edit('90_90_Hamstring', { target: 'Plank' })),
      ['triage 90_90_Hamstring: merge-later target "Plank" is neither a finish row nor a queued add'])
  })
})

describe('Search skips hidden entries', () => {
  it('listable = not hidden', () => {
    assert.equal(listable(byId.get('Car_Deadlift')), false)
    assert.equal(listable(byId.get('Hamstring_Stretch')), true)
    assert.equal(listable(byId.get('Plank')), true)
  })

  it(`none of the ${697 - 121} hidden entries appears in common or rest, searched by its own name`, () => {
    for (const entry of hidden) {
      const { common, rest } = searchCommonFirst(library, entry.name, Infinity)
      assert.ok(![...common, ...rest].some((item) => item.id === entry.id), entry.id)
      assert.ok(!searchExerciseCatalog(library, entry.name, Infinity).some((item) => item.id === entry.id), entry.id)
    }
  })

  it('"car deadlift" and "front cone hops": no hits', () => {
    assert.deepEqual(searchCommonFirst(library, 'car deadlift'), { common: [], rest: [], restCount: 0 })
    assert.deepEqual(searchCommonFirst(library, 'front cone hops'), { common: [], rest: [], restCount: 0 })
  })

  it('"Show more" holds only written non-staples and finish rows', () => {
    const shown = library.filter((entry) => listable(entry) && !entry.staple)
    for (const entry of shown) assert.ok(entry.common || rowOf.get(entry.id)?.class === 'finish', entry.id)
    assert.equal(shown.filter((entry) => !entry.common).length, 121)
  })

  it('a hidden entry the user already has still shows: Already added (live), Restore (archived)', () => {
    const live = [{ id: 'a', name: 'Car Deadlift', libraryId: 'Car_Deadlift' }]
    const found = searchCommonFirst(library, 'car deadlift', 25, { exercises: live })
    assert.deepEqual(found.rest.map((item) => item.id), ['Car_Deadlift'])
    assert.deepEqual(libraryItemMatch(live, found.rest[0]), { kind: 'live', exercise: live[0] })
    const archived = [{ id: 'b', name: 'Car Deadlift', archivedAt: '2026-09-01T00:00:00Z' }]
    const restore = searchCommonFirst(library, 'car deadlift', 25, { exercises: archived })
    assert.deepEqual(restore.rest.map((item) => item.id), ['Car_Deadlift'])
    assert.equal(libraryItemMatch(archived, restore.rest[0]).kind, 'archived')
    // Someone else's exercises don't reopen it.
    assert.deepEqual(searchCommonFirst(library, 'car deadlift', 25, { exercises: [{ id: 'c', name: 'Plank' }] }).rest, [])
  })
})

describe('resolver unchanged', () => {
  it('libraryEntryFor resolves every hidden entry by libraryId and by its exact name', () => {
    for (const entry of hidden) {
      assert.equal(libraryEntryFor({ name: 'Renamed', libraryId: entry.id }, library).id, entry.id)
      assert.equal(libraryEntryFor({ name: entry.name }, library).id, entry.id)
    }
  })
})

describe('merge aliases', () => {
  // 20 merged entries whose free-db name people type: it now finds the written target first.
  const SAMPLES = [
    ['Barbell Shoulder Press', 'Seated_Barbell_Military_Press'], ['Barbell Walking Lunge', 'Barbell_Lunge'],
    ['Calf Press', 'Calf_Press_On_The_Leg_Press_Machine'], ['Close-Grip EZ Bar Curl', 'EZ-Bar_Curl'],
    ['Cross-Body Crunch', 'own-bicycle-crunch'], ['Decline Reverse Crunch', 'Reverse_Crunch'],
    ['Kipping Muscle Up', 'Muscle_Up'], ['Standing Cable Chest Press', 'Cable_Chest_Press'],
    ['Lying Triceps Press', 'EZ-Bar_Skullcrusher'], ['Machine Bench Press', 'Leverage_Chest_Press'],
    ['Parallel Bar Dip', 'Dips_-_Triceps_Version'], ['Rope Crunch', 'Cable_Crunch'],
    ['Rope Straight-Arm Pulldown', 'Straight-Arm_Pulldown'], ['Seated Dumbbell Curl', 'Dumbbell_Bicep_Curl'],
    ['Seated Dumbbell Press', 'Dumbbell_Shoulder_Press'], ['Single-Arm Cable Crossover', 'Cable_Crossover'],
    ['Standing Dumbbell Press', 'Dumbbell_Shoulder_Press'], ['Step Mill', 'Stairmaster'],
    ['Tuck Crunch', 'Crunches'], ['Weighted Crunches', 'Crunches'],
  ]
  for (const [name, target] of SAMPLES) {
    it(`"${name}" → ${target} first`, () => {
      const merged = library.find((entry) => entry.name === name)
      assert.equal(merged.mergedInto, target)
      assert.equal(rowOf.get(merged.id).class, 'merge')
      assert.equal(firstShown(name), target)
    })
  }

  // Captured before the triage (same code over the pre-triage exercises.json).
  it('press / row / machine: the first-tier top 10 is unchanged', () => {
    const top = (query) => searchCommonFirst(library, query).common.slice(0, 10).map((item) => item.id)
    assert.deepEqual(top('press'), ['Arnold_Dumbbell_Press', 'Barbell_Bench_Press_-_Medium_Grip', 'Cable_Chest_Press',
      'Close-Grip_Barbell_Bench_Press', 'Decline_Barbell_Bench_Press', 'Dumbbell_Bench_Press', 'Dumbbell_Shoulder_Press',
      'Barbell_Incline_Bench_Press_-_Medium_Grip', 'Incline_Dumbbell_Press', 'own-landmine-press'])
    assert.deepEqual(top('row'), ['Rowing_Stationary', 'Bent_Over_Barbell_Row', 'Bent_Over_Two-Dumbbell_Row',
      'Dumbbell_Incline_Row', 'Inverted_Row', 'Leverage_Iso_Row', 'own-meadows-row', 'One-Arm_Dumbbell_Row',
      'own-pendlay-row', 'own-seal-row'])
    assert.deepEqual(top('machine'), ['Machine_Bicep_Curl', 'Leverage_Chest_Press', 'Leverage_Incline_Chest_Press',
      'own-machine-lateral-raise', 'Machine_Preacher_Curls', 'Leverage_Iso_Row', 'Machine_Shoulder_Military_Press',
      'Machine_Triceps_Extension', 'Ab_Crunch_Machine', 'Dip_Machine'])
  })
})
