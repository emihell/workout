// req-140 — library parity, batch 1 (DEC-065/066/067): the `staple` flag and the search
// split on it, our `difficulty` with its anchors, the 40 agreed promote/add entries and
// the 17 agreed aliases.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { searchCommonFirst } from './exerciseCatalog.js'
import { catalogNameKey, DIFFICULTY, libraryProblems, OWN_EXERCISES, OWN_FIELDS } from './exerciseLibrary.js'

const library = JSON.parse(readFileSync(fileURLToPath(new URL('./library/exercises.json', import.meta.url)), 'utf8'))
const common = library.filter((entry) => entry.common)
const byId = (id) => library.find((entry) => entry.id === id)
const problemsFor = (id, change) => libraryProblems(library.map((entry) => (entry.id === id ? { ...entry, ...change } : entry)))
  .filter((line) => line.startsWith(`${id}:`))
const firstShown = (query) => {
  const { common: hits, rest } = searchCommonFirst(library, query)
  return (hits.length ? hits : rest)[0]?.id
}

// The agreed batch-1 list (planning's reply, verbatim ids and staple marks).
const PROMOTE = {
  Smith_Machine_Incline_Bench_Press: true, Smith_Machine_Overhead_Shoulder_Press: true, Smith_Machine_Calf_Raise: true,
  Machine_Preacher_Curls: true, Decline_Crunch: true, Cable_Chest_Press: true, Underhand_Cable_Pulldowns: true,
  Seated_Barbell_Military_Press: true, Box_Squat: false, Floor_Press: false, Dumbbell_Floor_Press: false, Hang_Clean: false,
  Clean: false, Overhead_Squat: false, Deficit_Deadlift: false, Spider_Curl: false, Zottman_Curl: false,
  Incline_Hammer_Curls: false, Standing_Dumbbell_Reverse_Curl: false, Standing_Dumbbell_Upright_Row: false,
  // planner coach review (sanctioned edit): Dumbbell Sumo Squat is a staple.
  Plie_Dumbbell_Squat: true, Freehand_Jump_Squat: false, Superman: false, Flutter_Kicks: false, Muscle_Up: false,
  'Handstand_Push-Ups': false, Hanging_Pike: false,
}
const ADD = {
  'own-split-squat': true, 'own-lateral-lunge': true, 'own-knee-push-up': true, 'own-outdoor-run': true,
  'own-outdoor-walk': true, 'own-cable-triceps-kickback': true, 'own-pistol-squat': false, 'own-pike-push-up': false,
  'own-thruster': false, 'own-dead-hang': false, 'own-dumbbell-snatch': false, 'own-jumping-jacks': false,
  'own-high-knees': false,
}
const BATCH = { ...PROMOTE, ...ADD }
// req-145 — batch 2's 40 ids (req-145.test.js pins their staple marks).
const BATCH_2 = [
  'Dumbbell_Squat', 'Step-up_with_Knee_Raise', 'own-dumbbell-deadlift', 'own-machine-back-extension', 'Leverage_High_Row',
  'Lying_T-Bar_Row', 'Decline_Dumbbell_Bench_Press', 'Close-Grip_Dumbbell_Press', 'Cross_Body_Hammer_Curl',
  'One_Arm_Dumbbell_Preacher_Curl', 'Standing_One-Arm_Dumbbell_Triceps_Extension', 'One_Arm_Lat_Pulldown',
  'Smith_Machine_Stiff-Legged_Deadlift', 'Standing_Barbell_Calf_Raise', 'Single-Leg_Leg_Extension', 'Front_Cable_Raise',
  'Front_Plate_Raise', 'Upright_Cable_Row', 'Cable_Hip_Adduction', 'External_Rotation_with_Band', 'Lateral_Raise_-_With_Bands',
  'Triceps_Stretch', 'Monster_Walk', 'own-lateral-band-walk', 'own-clamshell', 'own-fire-hydrant', 'own-wall-push-up',
  'Oblique_Crunches', 'Alternate_Heel_Touchers', 'Exercise_Ball_Crunch', 'Scissor_Kick', 'Plate_Twist', 'Hamstring_Stretch',
  'Quad_Stretch', 'Childs_Pose', 'Cat_Stretch', 'Kneeling_Hip_Flexor', 'Standing_Gastrocnemius_Calf_Stretch',
  'own-cross-body-shoulder-stretch', 'own-doorway-chest-stretch',
]
const ALIASES = [
  ['Bench Pull', 'own-seal-row'], ['Cable Tricep Pushdown', 'Triceps_Pushdown'],
  ['Dumbbell Reverse Fly', 'Seated_Bent-Over_Rear_Delt_Raise'], ['Dumbbell Tricep Extension', 'Standing_Dumbbell_Triceps_Extension'],
  ['Dumbbell Tricep Kickback', 'Tricep_Dumbbell_Kickback'], ['Incline Barbell Bench Press', 'Barbell_Incline_Bench_Press_-_Medium_Grip'],
  ['Lying Tricep Extension', 'EZ-Bar_Skullcrusher'], ['Machine Calf Raise', 'Standing_Calf_Raises'],
  ['Seated Dumbbell Shoulder Press', 'Dumbbell_Shoulder_Press'], ['V-Bar Lat Pulldown', 'V-Bar_Pulldown'],
  ['Wide Grip Pull-Up', 'Pullups'], ["Dumbbell Farmer's Walk", 'Farmers_Walk'], ["Kettlebell Farmer's Walk", 'Farmers_Walk'],
  ['Machine Hip Abduction', 'Thigh_Abductor'], ['Sumo Squat', 'Plie_Dumbbell_Squat'], ['Hang Power Clean', 'Hang_Clean'],
  ['Dumbbell Split Squat', 'own-split-squat'],
]

describe('batch 1', () => {
  it('40 entries: 27 promoted (free-db ids kept), 13 own adds; all common, staple as agreed, all clean', () => {
    assert.equal(Object.keys(PROMOTE).length, 27)
    assert.equal(Object.keys(ADD).length, 13)
    const problems = libraryProblems(library)
    assert.deepEqual(problems, [])
    for (const [id, staple] of Object.entries(BATCH)) {
      const entry = byId(id)
      assert.ok(entry?.common, id)
      assert.equal(entry.staple, staple, id)
    }
    for (const id of Object.keys(PROMOTE)) assert.ok(!id.startsWith('own-') && !id.startsWith('extra-'), id)
    assert.equal(common.length, 258) // req-145 (sanctioned count pin): + batch 2's 40
  })

  it('no own add shares a name key with any free-db entry (promote before add)', () => {
    const freeDbKeys = new Set(library.filter((e) => !e.id.startsWith('own-') && !e.id.startsWith('extra-'))
      .map((e) => catalogNameKey(e.name)))
    for (const id of Object.keys(ADD)) {
      const entry = byId(id)
      for (const name of [entry.name, ...(entry.aliases || [])]) assert.ok(!freeDbKeys.has(catalogNameKey(name)), `${id}: ${name}`)
    }
  })

  it('new own-* entries set legacy level equal to difficulty', () => {
    for (const id of Object.keys(ADD)) {
      const own = OWN_EXERCISES.find((entry) => entry.id === id)
      assert.equal(own.level, byId(id).difficulty, id)
    }
  })

  it('the 17 agreed aliases: each is on its common entry and is the first shown hit', () => {
    for (const [alias, id] of ALIASES) {
      assert.ok(byId(id).common && byId(id).aliases.includes(alias), `${alias} on ${id}`)
      assert.equal(firstShown(alias), id, alias)
    }
  })
})

describe('staple', () => {
  it('is an own field; every prior common entry is a staple', () => {
    assert.ok(OWN_FIELDS.includes('staple'))
    // req-145 (edit NOT a count pin; flagged in reports/req-145.md) — batch 2's entries aren't
    // "prior" either (some are non-staples), so they're excluded like BATCH is.
    const prior = common.filter((entry) => !(entry.id in BATCH) && !BATCH_2.includes(entry.id))
    assert.equal(prior.length, 178)
    for (const entry of prior) assert.equal(entry.staple, true, entry.id)
    assert.equal(common.filter((entry) => entry.staple).length, 178 + 15 + 6) // req-145 (sanctioned count pin): + 6 batch-2 staples
  })

  it('staple ⇒ common: a non-common entry with staple is rejected (fixture)', () => {
    assert.deepEqual(problemsFor('Air_Bike', { staple: true }), ['Air_Bike: staple on a non-common entry'])
    assert.ok(problemsFor('Plank', { staple: 'yes' }).includes('Plank: staple is not a boolean'))
    assert.ok(problemsFor('Plank', { staple: undefined }).includes('Plank: staple is not a boolean'))
  })

  it('a common non-staple hit shows only behind "Show more"', () => {
    const { common: hits, rest } = searchCommonFirst(library, 'hammer curl')
    assert.ok(hits.length > 0)
    assert.ok(hits.every((item) => item.staple))
    assert.ok(!hits.some((item) => item.id === 'Incline_Hammer_Curls'))
    assert.ok(rest.some((item) => item.id === 'Incline_Hammer_Curls'))
  })

  it('with no staple hit, the non-staple entry is the first shown (rest shown directly)', () => {
    const { common: hits, rest } = searchCommonFirst(library, 'zottman')
    assert.deepEqual(hits, [])
    assert.equal(rest[0].id, 'Zottman_Curl')
  })
})

describe('difficulty', () => {
  it('on every common entry, from the list only; off the list is rejected (fixture)', () => {
    assert.ok(OWN_FIELDS.includes('difficulty'))
    for (const entry of common) assert.ok(DIFFICULTY.includes(entry.difficulty), entry.id)
    assert.ok(problemsFor('Plank', { difficulty: 'easy' }).includes('Plank: difficulty "easy" is off the list'))
    assert.ok(problemsFor('Plank', { difficulty: undefined }).includes('Plank: difficulty "undefined" is off the list'))
    assert.deepEqual(problemsFor('Air_Bike', { difficulty: 'beginner' }), ['Air_Bike: difficulty on a non-common entry'])
  })

  it('the anchors hold', () => {
    const level = (id) => byId(id).difficulty
    for (const id of ['Leg_Press', 'Wide-Grip_Lat_Pulldown', 'Plank', 'Seated_Leg_Curl']) assert.equal(level(id), 'beginner', id)
    for (const id of ['Barbell_Squat', 'Barbell_Deadlift', 'Bodyweight_Walking_Lunge', 'Pullups']) assert.equal(level(id), 'intermediate', id)
    for (const id of ['Power_Clean', 'own-pistol-squat']) assert.equal(level(id), 'advanced', id)
  })
})
