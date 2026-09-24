// req-148 — library batch 4 (DEC-066 §2, beginner-first per DEC-067/071): 40 queue entries
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

// 32 promoted, 8 own adds; no staples in this batch.
const BATCH_4 = Object.fromEntries([
  'Kneeling_Forearm_Stretch', 'The_Straddle', 'Round_The_World_Shoulder_Stretch', 'Plate_Pinch', 'Wrist_Roller',
  'Svend_Press', 'Drag_Curl', 'Seated_Triceps_Press', 'Kneeling_High_Pulley_Row', 'Kettlebell_Sumo_High_Pull',
  'Two-Arm_Kettlebell_Military_Press', 'Kettlebell_Windmill', 'One-Arm_Kettlebell_Clean',
  'One-Arm_Kettlebell_Snatch', 'Alternating_Renegade_Row', 'Weighted_Sissy_Squat', 'Barbell_Step_Ups',
  'Reverse_Grip_Bent-Over_Rows', 'Reverse_Hyperextension', 'Sled_Drag_-_Harness', 'Landmine_180s', 'Clean_and_Press',
  'Dumbbell_Clean', 'Knee_Tuck_Jump', 'Lateral_Bound', 'Split_Jump', 'Standing_Long_Jump', 'Plyo_Push-up',
  'Suspended_Reverse_Crunch', 'Suspended_Push-Up', 'Suspended_Split_Squat', 'own-suspension-curl',
  'own-suspension-leg-curl', 'own-dumbbell-front-squat', 'own-overhead-carry', 'own-reverse-plank',
  'own-stability-ball-pike', 'own-windshield-wipers', 'own-terminal-knee-extension',
  'Push-Ups_With_Feet_On_An_Exercise_Ball',
].map((id) => [id, false]))
const ADDS = Object.keys(BATCH_4).filter((id) => id.startsWith('own-'))

describe('batch 4', () => {
  it('40 entries (32 promoted, 8 own adds), all common, staple as judged, library clean', () => {
    assert.equal(Object.keys(BATCH_4).length, 40)
    assert.equal(ADDS.length, 8)
    assert.deepEqual(libraryProblems(library), [])
    assert.deepEqual(triageProblems(library), [])
    for (const [id, staple] of Object.entries(BATCH_4)) {
      assert.ok(byId.get(id)?.common, id)
      assert.equal(byId.get(id).staple, staple, id)
    }
  })

  it('a promoted id is a finish row and keeps its id; no own add shares a name key with a free-db entry', () => {
    const rows = new Map(triageRows().map((row) => [row.id, row]))
    for (const id of Object.keys(BATCH_4)) if (!id.startsWith('own-')) assert.equal(rows.get(id)?.class, 'finish', id)
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

  it('each is found first by its shown name', () => {
    for (const id of Object.keys(BATCH_4)) assert.equal(firstShown(shownName(byId.get(id))), id, id)
  })

  it('batch notes: Renegade Row ships with dumbbells; Sissy Squat is bodyweight-reps', () => {
    assert.equal(shownName(byId.get('Alternating_Renegade_Row')), 'Renegade Row')
    assert.deepEqual(byId.get('Alternating_Renegade_Row').equipmentList, ['dumbbell'])
    assert.equal(shownName(byId.get('Weighted_Sissy_Squat')), 'Sissy Squat')
    assert.equal(byId.get('Weighted_Sissy_Squat').logAs, 'bodyweight-reps')
  })

  it('re-checked rows: merged names find the written entry; two-bell moves and "Split Squats" are hidden', () => {
    assert.equal(firstShown('kettlebell hang clean'), 'One-Arm_Kettlebell_Clean')
    assert.equal(firstShown('alternating kettlebell press'), 'Two-Arm_Kettlebell_Military_Press')
    assert.equal(firstShown('scissors jump'), 'Split_Jump')
    for (const id of ['Double_Kettlebell_Windmill', 'Two-Arm_Kettlebell_Clean', 'Split_Squats']) assert.equal(byId.get(id).mergedInto, undefined, id)
    assert.equal(firstShown('split squats'), 'Split_Squat_with_Dumbbells')
  })
})
