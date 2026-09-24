// req-151 — library batch 5 (the last) (DEC-066 §2, beginner-first per DEC-067/071): 40 queue entries
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

// 20 promoted, 8 own adds; no staples.
const BATCH_5 = Object.fromEntries([
  'Isometric_Neck_Exercise_-_Sides', 'Lying_One-Arm_Lateral_Raise', 'Standing_Front_Barbell_Raise_Over_Head',
  'Barbell_Rear_Delt_Row', 'Barbell_Shrug_Behind_The_Back', 'Bent-Arm_Barbell_Pullover', 'Body_Tricep_Press',
  'One-Arm_Kettlebell_Military_Press_To_The_Side', 'V-Bar_Pullup', 'JM_Press', 'Zercher_Squats', 'Tire_Flip',
  'Clean_Pull', 'Snatch_Pull', 'Power_Jerk', 'Split_Jerk', 'Hang_Snatch', 'Power_Snatch', 'Ring_Dips', 'Rope_Climb',
  'own-archer-push-up', 'own-archer-pull-up', 'own-l-sit', 'own-dragon-flag', 'own-front-lever', 'own-back-lever',
  'own-reverse-nordic', 'own-spoto-press',
].map((id) => [id, false]))
const ADDS = Object.keys(BATCH_5).filter((id) => id.startsWith('own-'))

describe('batch 5', () => {
  it('28 entries (20 promoted, 8 own adds), all common, staple as judged, library clean', () => {
    assert.equal(Object.keys(BATCH_5).length, 28)
    assert.equal(ADDS.length, 8)
    assert.deepEqual(libraryProblems(library), [])
    assert.deepEqual(triageProblems(library), [])
    for (const [id, staple] of Object.entries(BATCH_5)) {
      assert.ok(byId.get(id)?.common, id)
      assert.equal(byId.get(id).staple, staple, id)
    }
  })

  it('a promoted id is a finish row and keeps its id; no own add shares a name key with a free-db entry', () => {
    const rows = new Map(triageRows().map((row) => [row.id, row]))
    for (const id of Object.keys(BATCH_5)) if (!id.startsWith('own-')) assert.equal(rows.get(id)?.class, 'finish', id)
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
    for (const id of Object.keys(BATCH_5)) {
      if (id === 'own-l-sit') continue
      assert.equal(firstShown(shownName(byId.get(id))), id, id)
    }
    // Flagged in reports/req-151.md (search, not data; no reader changes here): "L-Sit" compacts to a substring of
    // "Wall Sit", a staple, so Wall Sit fills the first tier and L-Sit leads the rest (L-027's class, in names).
    const lsit = searchCommonFirst(library, 'L-Sit')
    assert.deepEqual(lsit.common.map((item) => item.id), ['own-wall-sit'])
    assert.equal(lsit.rest[0].id, 'own-l-sit')
  })

  it('the queue is done: PENDING_ADDS empty, no merge-later row, no rough entry offered in Search', () => {
    assert.deepEqual(PENDING_ADDS, [])
    assert.deepEqual(triageRows().filter((row) => row.class === 'merge-later'), [])
    assert.deepEqual(library.filter((entry) => !entry.common && !entry.hidden).map((entry) => entry.id), [])
    for (const row of triageRows()) if (row.class === 'finish') assert.ok(byId.get(row.id).common, row.id)
  })

  it('re-triaged to hide, with a reason: the behind-the-neck press and pulldown, and four more', () => {
    const rows = new Map(triageRows().map((row) => [row.id, row]))
    for (const id of ['Standing_Barbell_Press_Behind_Neck', 'Wide-Grip_Pulldown_Behind_The_Neck', 'Donkey_Calf_Raises',
      'Smith_Machine_Hip_Raise', 'Barbell_Ab_Rollout', 'Barbell_Ab_Rollout_-_On_Knees']) {
      assert.equal(rows.get(id).class, 'hide', id)
      assert.ok(rows.get(id).reason.length > 10, id)
    }
    assert.deepEqual(searchCommonFirst(library, 'press behind neck'), { common: [], rest: [], restCount: 0 })
  })

  it('the last merge-later rows now redirect', () => {
    assert.equal(firstShown('hang snatch - below knees'), 'Hang_Snatch')
    assert.equal(firstShown('isometric neck exercise - front and back'), 'Isometric_Neck_Exercise_-_Sides')
  })
})
