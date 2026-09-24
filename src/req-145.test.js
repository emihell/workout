// req-145 — library batch 2 (DEC-066 §2, beginner-first per DEC-067/071): 40 queue entries
// fully written, under req-140's rules. Reads nothing from handoff/.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { searchCommonFirst, shownName } from './exerciseCatalog.js'
import { catalogNameKey, libraryProblems, OWN_EXERCISES, triageProblems } from './exerciseLibrary.js'
import { PENDING_ADDS, triageRows } from './library/triage.js'

const library = JSON.parse(readFileSync(fileURLToPath(new URL('./library/exercises.json', import.meta.url)), 'utf8'))
const byId = new Map(library.map((entry) => [entry.id, entry]))
const firstShown = (query) => {
  const { common, rest } = searchCommonFirst(library, query)
  return (common.length ? common : rest)[0]?.id
}

// id → staple. 32 promoted free-db ids, 8 own adds.
const BATCH_2 = {
  Dumbbell_Squat: true, 'Step-up_with_Knee_Raise': true, 'own-dumbbell-deadlift': true, 'own-machine-back-extension': true,
  Leverage_High_Row: true, 'Lying_T-Bar_Row': true,
  Decline_Dumbbell_Bench_Press: false, 'Close-Grip_Dumbbell_Press': false, Cross_Body_Hammer_Curl: false,
  One_Arm_Dumbbell_Preacher_Curl: false, 'Standing_One-Arm_Dumbbell_Triceps_Extension': false, One_Arm_Lat_Pulldown: false,
  'Smith_Machine_Stiff-Legged_Deadlift': false, Standing_Barbell_Calf_Raise: false, 'Single-Leg_Leg_Extension': false,
  Front_Cable_Raise: false, Front_Plate_Raise: false, Upright_Cable_Row: false, Cable_Hip_Adduction: false,
  External_Rotation_with_Band: false, 'Lateral_Raise_-_With_Bands': false, Triceps_Stretch: false, Monster_Walk: false,
  'own-lateral-band-walk': false, 'own-clamshell': false, 'own-fire-hydrant': false, 'own-wall-push-up': false,
  Oblique_Crunches: false, Alternate_Heel_Touchers: false, Exercise_Ball_Crunch: false, Scissor_Kick: false, Plate_Twist: false,
  Hamstring_Stretch: false, Quad_Stretch: false, Childs_Pose: false, Cat_Stretch: false, Kneeling_Hip_Flexor: false,
  Standing_Gastrocnemius_Calf_Stretch: false, 'own-cross-body-shoulder-stretch': false, 'own-doorway-chest-stretch': false,
}
const ADDS = Object.keys(BATCH_2).filter((id) => id.startsWith('own-'))

describe('batch 2', () => {
  it('40 entries (32 promoted, 8 own adds), all common, staple as judged, library clean', () => {
    assert.equal(Object.keys(BATCH_2).length, 40)
    assert.equal(ADDS.length, 8)
    assert.deepEqual(libraryProblems(library), [])
    assert.deepEqual(triageProblems(library), [])
    for (const [id, staple] of Object.entries(BATCH_2)) {
      assert.ok(byId.get(id)?.common, id)
      assert.equal(byId.get(id).staple, staple, id)
    }
  })

  it('a promoted id is a finish row and keeps its id; no own add shares a name key with a free-db entry', () => {
    const rows = new Map(triageRows().map((row) => [row.id, row]))
    for (const id of Object.keys(BATCH_2)) if (!id.startsWith('own-')) assert.equal(rows.get(id)?.class, 'finish', id)
    const freeDbKeys = new Set(library.filter((e) => !e.id.startsWith('own-') && !e.id.startsWith('extra-')).map((e) => catalogNameKey(e.name)))
    for (const id of ADDS) {
      const entry = byId.get(id)
      for (const name of [entry.name, ...(entry.aliases || [])]) assert.ok(!freeDbKeys.has(catalogNameKey(name)), `${id}: ${name}`)
    }
  })

  it('own adds: legacy level equals difficulty; written ids are gone from PENDING_ADDS', () => {
    for (const id of ADDS) {
      const own = OWN_EXERCISES.find((entry) => entry.id === id)
      assert.equal(own.level, byId.get(id).difficulty, id)
      assert.ok(!PENDING_ADDS.includes(id), id)
    }
    for (const id of PENDING_ADDS) assert.ok(!byId.has(id), id)
  })

  it('no merge-later row points at a written entry any more (re-checked: those are merges now)', () => {
    for (const row of triageRows()) if (row.class === 'merge-later') assert.ok(!byId.get(row.target)?.common, row.id)
  })

  it('batch note: Plate_Twist ships as "Weighted Russian Twist", weight-reps', () => {
    assert.equal(shownName(byId.get('Plate_Twist')), 'Weighted Russian Twist')
    assert.equal(byId.get('Plate_Twist').logAs, 'weight-reps')
  })

  it('each is found first by its shown name', () => {
    for (const id of Object.keys(BATCH_2)) assert.equal(firstShown(shownName(byId.get(id))), id, id)
  })

  it('merged names now find the written entry ("runners stretch", "shoulder stretch", "dumbbell squat to a bench")', () => {
    assert.equal(firstShown('runners stretch'), 'Hamstring_Stretch')
    assert.equal(firstShown('shoulder stretch'), 'own-cross-body-shoulder-stretch')
    assert.equal(firstShown('dumbbell squat to a bench'), 'Dumbbell_Squat')
  })
})
