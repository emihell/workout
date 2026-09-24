// req-133 / DEC-062 — the library tagging pass: the muscle tree, the fixed lists, the
// common entries' completeness and consistency (each rule proved by a failing fixture),
// derived groups, own-* legacy fields, and the 25 search receipts.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { catalogItemToExercise, searchExerciseCatalog } from './exerciseCatalog.js'
import {
  COMMON_COUNT_RANGE,
  FREE_DB_MUSCLE_TO_TREE,
  libraryProblems,
  MUSCLE_GROUPS,
  MUSCLE_TREE,
  muscleGroupOf,
  muscleGroupsFor,
  muscleTreeProblems,
  OWN_EXERCISES,
} from './exerciseLibrary.js'
import { EQUIPMENT_EXCEPTIONS, GROUP_EXCEPTIONS } from './library/common.js'
import { EXTRA_EXERCISES } from './exerciseExtras.js'

const library = JSON.parse(readFileSync(fileURLToPath(new URL('./library/exercises.json', import.meta.url)), 'utf8'))
const common = library.filter((entry) => entry.common)
const isFreeDb = (entry) => !entry.id.startsWith('extra-') && !entry.id.startsWith('own-')

// The library with one entry changed — a fixture that must fail.
function withEntry(id, change) {
  return library.map((entry) => (entry.id === id ? { ...entry, ...change } : entry))
}
function problemsFor(id, change) {
  return libraryProblems(withEntry(id, change)).filter((line) => line.startsWith(`${id}:`))
}

describe('muscle tree', () => {
  it('is clean: every node chains to a group, keys unique across nodes', () => {
    assert.deepEqual(muscleTreeProblems(), [])
    for (const id of Object.keys(MUSCLE_TREE)) assert.ok(muscleGroupOf(id) in MUSCLE_GROUPS, id)
  })

  it('the six groups are the MUSCLE_GROUPS labels', () => {
    const roots = Object.values(MUSCLE_TREE).filter((node) => !node.parent).map((node) => node.label)
    assert.deepEqual([...roots].sort(), Object.keys(MUSCLE_GROUPS).sort())
  })

  it('fails on a key shared by two nodes, an unknown parent, and a root off the groups', () => {
    const dupe = { ...MUSCLE_TREE, lats: { ...MUSCLE_TREE.lats, aliases: ['delts'] } }
    assert.match(muscleTreeProblems(dupe).join('\n'), /muscle key "delts"/)
    const orphan = { ...MUSCLE_TREE, serratus: { label: 'Serratus', parent: 'ribs', aliases: [] } }
    assert.match(muscleTreeProblems(orphan).join('\n'), /serratus: parent chain hits unknown node "ribs"/)
    const root = { ...MUSCLE_TREE, neck: { ...MUSCLE_TREE.neck, parent: null } }
    assert.match(muscleTreeProblems(root).join('\n'), /group "Neck" is not a MUSCLE_GROUPS label/)
  })

  it('the free-db→tree map covers the req-130 table\'s 19 strings, onto tree nodes', () => {
    const strings = new Set([
      ...library.filter(isFreeDb).flatMap((entry) => [...entry.primaryMuscles, ...entry.secondaryMuscles]),
      ...EXTRA_EXERCISES.flatMap((entry) => entry.primaryMuscles),
    ])
    assert.equal(strings.size, 19)
    assert.deepEqual([...strings].sort(), Object.keys(FREE_DB_MUSCLE_TO_TREE).sort())
    for (const node of Object.values(FREE_DB_MUSCLE_TO_TREE)) assert.ok(node in MUSCLE_TREE, node)
  })
})

describe('common entries', () => {
  it('the library has no problems (fixed lists, completeness, consistency, aliases)', () => {
    assert.deepEqual(libraryProblems(library), [])
  })

  it(`count is within ${COMMON_COUNT_RANGE.join('–')}`, () => {
    assert.ok(common.length >= COMMON_COUNT_RANGE[0] && common.length <= COMMON_COUNT_RANGE[1], String(common.length))
  })

  it('each has a primary muscle, one pattern, equipment, logAs, unilateral and a family', () => {
    for (const entry of common) {
      assert.ok(entry.muscles.some((m) => m.role === 'primary'), entry.id)
      assert.equal(typeof entry.pattern, 'string', entry.id)
      assert.ok(entry.equipmentList.length >= 1, entry.id)
      assert.equal(typeof entry.logAs, 'string', entry.id)
      assert.equal(typeof entry.unilateral, 'boolean', entry.id)
      assert.match(entry.family, /^fam-/, entry.id)
    }
  })

  it('own-hanging-knee-raise stays and is common', () => {
    assert.ok(common.some((entry) => entry.id === 'own-hanging-knee-raise'))
  })

  // Tag review — free-db's "Air Bike" is a crunch, not the bike: not common, no aliases;
  // the bicycle crunch is our own entry.
  it('Air_Bike is not common; own-bicycle-crunch is', () => {
    const airBike = library.find((entry) => entry.id === 'Air_Bike')
    assert.equal(airBike.common, undefined)
    assert.equal(airBike.aliases, undefined)
    assert.ok(common.some((entry) => entry.id === 'own-bicycle-crunch'))
  })

  it('the captain\'s chair knee raise does not carry the straight-leg name', () => {
    const chair = library.find((entry) => entry.id === 'Knee_Hip_Raise_On_Parallel_Bars')
    assert.ok(!chair.aliases.includes("Captain's Chair Leg Raise"))
  })

  it('a non-common entry carries none of the new fields', () => {
    assert.match(problemsFor('3_4_Sit-Up', { pattern: 'core-flexion' }).join('\n'), /pattern on a non-common entry/)
  })
})

describe('fixed lists: an off-list value fails', () => {
  const curl = library.find((entry) => entry.id === 'Barbell_Curl')

  for (const [label, change, message] of [
    ['muscle', { muscles: [{ id: 'serratus', role: 'primary' }, { id: 'biceps', role: 'primary' }] }, /muscle "serratus" is off the tree/],
    ['muscle role', { muscles: [{ id: 'biceps', role: 'main' }] }, /muscle role "main"/],
    ['pattern', { pattern: 'dance' }, /pattern "dance" is off the list/],
    ['equipment', { equipmentList: ['barbell', 'rack'] }, /equipment "rack" is off the list/],
    ['logAs', { logAs: 'reps' }, /logAs "reps" is off the list/],
    ['family', { family: 'Curl Family' }, /not fam-kebab-case/],
  ]) {
    it(label, () => {
      assert.ok(curl.common)
      assert.match(problemsFor('Barbell_Curl', change).join('\n'), message)
    })
  }

  it('a missing primary, pattern, equipment or unilateral each fails', () => {
    assert.match(problemsFor('Barbell_Curl', { muscles: [{ id: 'forearms', role: 'secondary' }] }).join('\n'), /no primary muscle/)
    assert.match(problemsFor('Barbell_Curl', { pattern: undefined }).join('\n'), /pattern "undefined"/)
    assert.match(problemsFor('Barbell_Curl', { equipmentList: [] }).join('\n'), /no equipment/)
    assert.match(problemsFor('Barbell_Curl', { unilateral: undefined }).join('\n'), /unilateral is not a boolean/)
  })
})

describe('consistency: a bad tag fails', () => {
  it('pattern ⇒ required primary (curl without biceps/brachialis/forearms)', () => {
    assert.match(
      problemsFor('Barbell_Curl', { muscles: [{ id: 'triceps', role: 'primary' }, { id: 'biceps', role: 'secondary' }] }).join('\n'),
      /pattern curl needs a primary in biceps\/brachialis\/forearms/,
    )
    assert.match(problemsFor('Seated_Cable_Rows', { muscles: [{ id: 'biceps', role: 'primary' }] }).join('\n'), /pattern horizontal-pull needs/)
    assert.match(problemsFor('Leg_Extensions', { muscles: [{ id: 'hamstrings', role: 'primary' }] }).join('\n'), /pattern leg-extension needs/)
  })

  it('a part satisfies its parent (rear-delt counts for a pull)', () => {
    const face = library.find((entry) => entry.id === 'Face_Pull')
    assert.deepEqual(face.muscles.filter((m) => m.role === 'primary').map((m) => m.id), ['rear-delt'])
    assert.deepEqual(problemsFor('Face_Pull', {}), [])
  })

  it('bodyweight-reps / time ⇒ no load equipment', () => {
    assert.match(problemsFor('Pullups', { equipmentList: ['pull-up-bar', 'plate'] }).join('\n'), /bodyweight-reps with load equipment/)
    assert.match(problemsFor('Plank', { equipmentList: ['bodyweight', 'plate'] }).join('\n'), /time with load equipment/)
  })

  it('weight-reps / weight-time ⇒ load equipment', () => {
    assert.match(problemsFor('Barbell_Curl', { equipmentList: ['bench'] }).join('\n'), /weight-reps without load equipment/)
    assert.match(problemsFor('Farmers_Walk', { equipmentList: ['bodyweight'] }).join('\n'), /weight-time without load equipment/)
  })

  it('cardio pattern ⇔ cardio logAs', () => {
    assert.match(problemsFor('Running_Treadmill', { logAs: 'time' }).join('\n'), /cardio pattern and cardio logAs/)
    assert.match(problemsFor('Plank', { logAs: 'cardio' }).join('\n'), /cardio pattern and cardio logAs/)
  })

  it('equipmentList contains the obvious map of free-db equipment', () => {
    // Barbell_Curl is free-db "barbell".
    assert.match(problemsFor('Barbell_Curl', { equipmentList: ['ez-bar'] }).join('\n'), /free-db equipment "barbell"/)
    // EZ-Bar_Curl is free-db "e-z curl bar".
    assert.match(problemsFor('EZ-Bar_Curl', { equipmentList: ['barbell'] }).join('\n'), /free-db equipment "e-z curl bar"/)
  })

  it('tree groups ⊇ the table groups of free-db primaryMuscles', () => {
    // Face_Pull is free-db shoulders → Shoulders; tagging only rhomboids (Back) drops it.
    assert.match(problemsFor('Face_Pull', { muscles: [{ id: 'rhomboids', role: 'primary' }] }).join('\n'), /groups Shoulders not in the tree tags/)
  })

  it('each allow-list entry has a reason and is still needed', () => {
    for (const [exceptions, key] of [[EQUIPMENT_EXCEPTIONS, 'equipmentExceptions'], [GROUP_EXCEPTIONS, 'groupExceptions']]) {
      for (const [id, reason] of Object.entries(exceptions)) {
        assert.ok(reason.length > 20, id)
        const without = libraryProblems(library, { [key]: {} }).filter((line) => line.startsWith(`${id}:`))
        assert.equal(without.length, 1, `${id} no longer needs its exception`)
      }
    }
  })

  it('a family of one must be named after its entry', () => {
    assert.match(problemsFor('Face_Pull', { family: 'fam-pulls' }).join('\n'), /has one member; a family of one is fam-face-pull/)
  })

  it('a bare "Press", "Row" or "Machine" alias fails', () => {
    for (const alias of ['Press', 'Row', 'Machine']) {
      assert.match(problemsFor('Barbell_Curl', { aliases: [...library.find((e) => e.id === 'Barbell_Curl').aliases, alias] }).join('\n'), /bare alias/)
    }
  })

  it('an alias on two entries, or equal to another entry\'s name, fails', () => {
    assert.match(problemsFor('Barbell_Curl', { aliases: ['Bench Press'] }).join('\n'), /also on Barbell_Bench_Press_-_Medium_Grip/)
    assert.match(problemsFor('Barbell_Curl', { aliases: ['Preacher Curl'] }).join('\n'), /is Preacher_Curl's name/)
  })
})

describe('muscleGroups', () => {
  it('tagged entries: from the primary tree tags, table labels and order', () => {
    for (const entry of common) {
      const groups = new Set(entry.muscles.filter((m) => m.role === 'primary').map((m) => muscleGroupOf(m.id)))
      assert.deepEqual(entry.muscleGroups, Object.keys(MUSCLE_GROUPS).filter((group) => groups.has(group)), entry.id)
    }
    const pullover = library.find((entry) => entry.id === 'Straight-Arm_Dumbbell_Pullover')
    assert.deepEqual(pullover.muscleGroups, ['Chest', 'Back'])
  })

  it('untagged entries keep the table', () => {
    for (const entry of library.filter((e) => !e.common)) {
      assert.deepEqual(entry.muscleGroups, muscleGroupsFor(entry.primaryMuscles), entry.id)
    }
  })
})

describe('own-* entries carry the legacy fields', () => {
  it('equipment, category, instructions, and muscles today\'s readers accept', () => {
    assert.equal(OWN_EXERCISES.length, 9)
    for (const own of OWN_EXERCISES) {
      assert.ok(own.id.startsWith('own-'))
      assert.ok(own.equipment && own.category && own.instructions.length >= 3, own.id)
      assert.doesNotThrow(() => muscleGroupsFor(own.primaryMuscles), own.id)
      for (const m of own.secondaryMuscles) assert.ok(m in FREE_DB_MUSCLE_TO_TREE, `${own.id} ${m}`)
      assert.ok(library.find((entry) => entry.id === own.id).common, own.id)
    }
  })

  it('catalogItemToExercise types them as today (machine, free, bodyweight, cardio)', () => {
    const typeOf = (id) => catalogItemToExercise(library.find((entry) => entry.id === id)).type
    assert.equal(typeOf('own-assisted-pull-up'), 'machine')
    assert.equal(typeOf('own-machine-lateral-raise'), 'machine')
    assert.equal(typeOf('own-kettlebell-swing'), 'free')
    assert.equal(typeOf('own-burpee'), 'bodyweight')
    assert.equal(typeOf('own-fan-bike'), 'cardio')
    assert.equal(typeOf('own-bicycle-crunch'), 'bodyweight')
    assert.equal(typeOf('own-weighted-dip'), 'free')
  })
})

// Written before the build (spec §Search receipts); library list only, no RepDB.
describe('search receipts (top-1)', () => {
  for (const [query, first] of [
    ['bench press', 'Barbell Bench Press - Medium Grip'],
    ['squat', 'Barbell Squat'],
    ['deadlift', 'Barbell Deadlift'],
    ['rdl', 'Romanian Deadlift'],
    ['ohp', 'Standing Military Press'],
    ['skull crusher', 'EZ-Bar Skullcrusher'],
    ['db row', 'One-Arm Dumbbell Row'],
    ['lat pulldown', 'Wide-Grip Lat Pulldown'],
    ['face pull', 'Face Pull'],
    ['hip thrust', 'Barbell Hip Thrust'],
    ['lateral raise', 'Side Lateral Raise'], // free-db's standing dumbbell lateral raise
    ['leg curl', 'Seated Leg Curl'],
    ['leg press', 'Leg Press'],
    ['pull up', 'Pullups'],
    ['chin up', 'Chin-Up'],
    ['dips', 'Dips - Triceps Version'],
    ['plank', 'Plank'],
    ['push up', 'Pushups'],
    ['cable fly', 'Cable Crossover'],
    ['preacher curl', 'Preacher Curl'],
    ['hammer curl', 'Hammer Curls'],
    ['t-bar row', 'T-Bar Row with Handle'],
    ['farmer walk', "Farmer's Walk"],
    ['treadmill', 'Running, Treadmill'],
    ['rowing', 'Rowing, Stationary'],
    // Tag review additions.
    ['calf raise', 'Standing Calf Raises'],
    ['lunge', 'Dumbbell Lunges'],
    ['bike', 'Fan Bike'],
    ['bicycle crunch', 'Bicycle Crunch'],
    ['weighted dip', 'Weighted Dip'],
  ]) {
    it(`"${query}" → ${first}`, () => {
      assert.equal(searchExerciseCatalog(library, query)[0]?.name, first)
    })
  }
})
