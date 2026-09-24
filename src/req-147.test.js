// req-147 — library batch 3 (DEC-066 §2, beginner-first per DEC-067/071): 40 queue entries
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

// id → staple. 35 promoted (incl. the two extras), 5 own adds.
const BATCH_3 = {
  Bicycling: true,
  'own-kettlebell-deadlift': false, 'Seated_Dumbbell_Palms-Up_Wrist_Curl': false, 'Seated_Dumbbell_Palms-Down_Wrist_Curl': false,
  Leverage_Shrug: false, Smith_Machine_Bent_Over_Row: false, Smith_Machine_Upright_Row: false, Smith_Machine_Decline_Press: false,
  'Smith_Single-Leg_Split_Squat': false, Decline_Dumbbell_Flyes: false, Preacher_Hammer_Dumbbell_Curl: false,
  Cable_Preacher_Curl: false, High_Cable_Curls: false, Cable_Wrist_Curl: false, Standing_Overhead_Barbell_Triceps_Extension: false,
  'Shoulder_Press_-_With_Bands': false, External_Rotation_with_Cable: false, External_Rotation: false, Band_Good_Morning: false,
  Band_Hip_Adductions: false, Side_Leg_Raises: false, Physioball_Hip_Bridge: false, 'Flat_Bench_Leg_Pull-In': false,
  'Exercise_Ball_Pull-In': false, 'One-Arm_Kettlebell_Row': false, Kettlebell_Halo: false, 'Scapular_Pull-Up': false,
  'own-bear-crawl': false, 'extra-prone-ytw': false, 'extra-reverse-snow-angels': false, Inchworm: false,
  Worlds_Greatest_Stretch: false, Knee_Across_The_Body: false, Ankle_On_The_Knee: false, Front_Leg_Raises: false,
  Hug_Knees_To_Chest: false, 'own-butterfly-stretch': false, 'own-pigeon-stretch': false, 'own-couch-stretch': false,
  Side_Neck_Stretch: false,
}
const ADDS = Object.keys(BATCH_3).filter((id) => id.startsWith('own-'))

describe('batch 3', () => {
  it('40 entries (35 promoted, 5 own adds), all common, staple as judged, library clean', () => {
    assert.equal(Object.keys(BATCH_3).length, 40)
    assert.equal(ADDS.length, 5)
    assert.deepEqual(libraryProblems(library), [])
    assert.deepEqual(triageProblems(library), [])
    for (const [id, staple] of Object.entries(BATCH_3)) {
      assert.ok(byId.get(id)?.common, id)
      assert.equal(byId.get(id).staple, staple, id)
    }
  })

  it('a promoted id is a finish row and keeps its id; no own add shares a name key with a free-db entry', () => {
    const rows = new Map(triageRows().map((row) => [row.id, row]))
    for (const id of Object.keys(BATCH_3)) if (!id.startsWith('own-')) assert.equal(rows.get(id)?.class, 'finish', id)
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
    for (const id of Object.keys(BATCH_3)) assert.equal(firstShown(shownName(byId.get(id))), id, id)
  })

  it('merged names now find the written entry, and there are no merge-later rows to a queued add left', () => {
    assert.equal(firstShown('groin and back stretch'), 'own-butterfly-stretch')
    assert.equal(firstShown('alternating kettlebell row'), 'One-Arm_Kettlebell_Row')
    assert.equal(firstShown('overhead cable curl'), 'High_Cable_Curls')
    assert.deepEqual(triageRows().filter((row) => row.class === 'merge-later' && PENDING_ADDS.includes(row.target)), [])
  })
})
