// req-139 / DEC-064 — library polish: our display names, the missing staples, search =
// our library only, common first with the rest on request, and the Search row match.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { catalogItemToExercise, searchCommonFirst, searchExerciseCatalog } from './exerciseCatalog.js'
import { catalogNameKey, libraryEntryFor, libraryProblems, shownName } from './exerciseLibrary.js'
import { exerciseFromData, libraryItemMatch } from './exercise-names.js'
import { DISPLAY_NAMES } from './library/common.js'

const library = JSON.parse(readFileSync(fileURLToPath(new URL('./library/exercises.json', import.meta.url)), 'utf8'))
const byId = (id) => library.find((entry) => entry.id === id)
const common = library.filter((entry) => entry.common)
const source = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

// What Search shows first for a query (common, else the rest directly).
const firstShown = (query) => {
  const { common: hits, rest } = searchCommonFirst(library, query)
  return (hits.length ? hits : rest)[0]?.id
}

const STAPLES = [
  'own-landmine-press', 'own-belt-squat', 'own-pendulum-squat', 'own-seal-row', 'own-meadows-row',
  'own-bayesian-curl', 'own-z-press', 'own-copenhagen-plank', 'own-bird-dog', 'own-single-leg-rdl',
]
const EXTRA_STAPLES = ['own-pendlay-row', 'own-hollow-body-hold', 'own-suitcase-carry', 'own-wall-sit', 'own-cossack-squat']

describe('display names', () => {
  it('only on common entries, never equal to the name, from the DISPLAY_NAMES table', () => {
    for (const entry of library) {
      if (entry.displayName === undefined) continue
      assert.ok(entry.common, entry.id)
      assert.notEqual(entry.displayName, entry.name, entry.id)
      assert.equal(entry.displayName, DISPLAY_NAMES[entry.id], entry.id)
    }
    assert.equal(library.filter((entry) => entry.displayName !== undefined).length, Object.keys(DISPLAY_NAMES).length)
  })

  it('every common entry\'s shown name is unique by name key', () => {
    const keys = common.map((entry) => catalogNameKey(shownName(entry)))
    assert.equal(new Set(keys).size, keys.length)
  })

  it('no stored alias repeats its own display name', () => {
    for (const entry of common) {
      if (entry.displayName === undefined) continue
      for (const alias of entry.aliases || []) assert.notEqual(catalogNameKey(alias), catalogNameKey(entry.displayName), `${entry.id} ${alias}`)
    }
  })

  it('the old free-db name still finds the entry', () => {
    assert.equal(firstShown('barbell bench press - medium grip'), 'Barbell_Bench_Press_-_Medium_Grip')
    assert.equal(firstShown('running, treadmill'), 'Running_Treadmill')
    assert.equal(firstShown('machine shoulder (military) press'), 'Machine_Shoulder_Military_Press')
    assert.equal(shownName(byId('Barbell_Bench_Press_-_Medium_Grip')), 'Bench Press')
  })

  it('an added exercise saves the display name, keeps libraryId', () => {
    const record = exerciseFromData(catalogItemToExercise(byId('Barbell_Bench_Press_-_Medium_Grip')), 'ex-1')
    assert.equal(record.name, 'Bench Press')
    assert.equal(record.libraryId, 'Barbell_Bench_Press_-_Medium_Grip')
    assert.equal(catalogItemToExercise(byId('Plank')).name, 'Plank')
  })

  it('the resolver: name, then display name, then alias; exact name beats a shadowing alias', () => {
    assert.equal(libraryEntryFor({ name: 'Bench Press' }, library).id, 'Barbell_Bench_Press_-_Medium_Grip')
    assert.equal(libraryEntryFor({ name: 'Barbell Bench Press - Medium Grip' }, library).id, 'Barbell_Bench_Press_-_Medium_Grip')
    assert.equal(libraryEntryFor({ name: 'Triceps Pushdown (Rope)' }, library).id, 'Triceps_Pushdown_-_Rope_Attachment')
    assert.equal(libraryEntryFor({ name: 'Air Bike' }, library).id, 'Air_Bike')
    assert.equal(libraryEntryFor({ name: 'Air Bike', libraryId: 'own-fan-bike' }, library).id, 'own-fan-bike')
  })
})

describe('missing staples', () => {
  it(`the 10 and ${EXTRA_STAPLES.length} more (≤5) exist, are common, and pass the validators`, () => {
    assert.ok(EXTRA_STAPLES.length <= 5)
    const problems = libraryProblems(library)
    for (const id of [...STAPLES, ...EXTRA_STAPLES]) {
      const entry = byId(id)
      assert.ok(entry?.common, id)
      assert.ok(entry.instructions.length >= 3 && entry.instructions.length <= 4, id)
      assert.deepEqual(problems.filter((line) => line.startsWith(`${id}:`)), [], id)
    }
  })

  it('each is found by its name and stays distinct from its near neighbour', () => {
    for (const [query, id] of [
      ['landmine press', 'own-landmine-press'],
      ['belt squat', 'own-belt-squat'],
      ['pendulum squat', 'own-pendulum-squat'],
      ['seal row', 'own-seal-row'],
      ['meadows row', 'own-meadows-row'],
      ['bayesian curl', 'own-bayesian-curl'],
      ['z press', 'own-z-press'],
      ['copenhagen plank', 'own-copenhagen-plank'],
      ['bird dog', 'own-bird-dog'],
      ['single-leg rdl', 'own-single-leg-rdl'],
      ['landmine row', 'T-Bar_Row_with_Handle'],
      ['side plank', 'Side_Bridge'],
    ]) assert.equal(firstShown(query), id, query)
    assert.equal(byId('own-copenhagen-plank').pattern, 'hip-adduction')
    assert.equal(byId('own-single-leg-rdl').equipment, 'dumbbell')
    assert.equal(byId('own-single-leg-rdl').unilateral, true)
  })
})

describe('common first, the rest on request', () => {
  it('"shoulder press": a common entry first; Shoulder Press - With Bands only in the rest', () => {
    const { common: hits, rest } = searchCommonFirst(library, 'shoulder press')
    assert.ok(hits.length > 0 && hits.every((item) => item.common))
    assert.ok(!hits.some((item) => item.id === 'Shoulder_Press_-_With_Bands'))
    assert.ok(rest.some((item) => item.id === 'Shoulder_Press_-_With_Bands'))
    assert.ok(rest.every((item) => !item.common))
  })

  // req-143 (sanctioned edit) — was `rest[0].id === 'Air_Bike'`; free-db's crunch is now
  // merged into Bicycle Crunch (hidden), so it is offered only to someone who has it.
  it('"air bike" → Fan Bike first (free-db\'s crunch only when already added)', () => {
    const { common: hits, rest } = searchCommonFirst(library, 'air bike')
    assert.equal(hits[0].id, 'own-fan-bike')
    assert.ok(!rest.some((item) => item.id === 'Air_Bike'))
    const owned = searchCommonFirst(library, 'air bike', 25, { exercises: [{ id: 'x', name: 'Air Bike', libraryId: 'Air_Bike' }] })
    assert.equal(owned.common[0].id, 'own-fan-bike')
    assert.equal(owned.rest[0].id, 'Air_Bike')
  })

  // req-143 (sanctioned edit: the car-deadlift receipt) — Car Deadlift is hidden now.
  it('only non-common hits ("zercher") → no common part; the rest shows directly', () => {
    const { common: hits, rest } = searchCommonFirst(library, 'zercher')
    assert.deepEqual(hits, [])
    assert.equal(rest[0].id, 'Zercher_Squats')
    assert.equal(firstShown('zercher'), 'Zercher_Squats')
  })

  // req-143 (sanctioned edit) — "press" has 15 rough hits left after the triage; "shoulders"
  // (a muscle query) still has > 25. restCount vs the flat search, which skips hidden too.
  it('each part is capped at 25; restCount is the untruncated count', () => {
    const { common: hits, rest, restCount } = searchCommonFirst(library, 'shoulders')
    const all = searchExerciseCatalog(library, 'shoulders', Infinity)
    assert.ok(hits.length <= 25 && rest.length === 25)
    // req-140 (edit NOT on the spec's sanctioned list; flagged in reports/req-140.md) —
    // the split reads `staple` since DEC-066 §1, so the expected parts do too.
    assert.equal(restCount, all.filter((item) => !item.staple).length)
    assert.ok(restCount > 25)
    assert.deepEqual(hits.map((item) => item.id), all.filter((item) => item.staple).slice(0, 25).map((item) => item.id))
  })

  // Planner review — a partial alias hit is per alias and from a word start: no match
  // across two aliases ("Dumbbell Forwa-rd L-unge") or inside a word ("P-row-ler").
  it('"rdl": no Dumbbell Lunge or Trap Bar Deadlift; "row": no Sled Push', () => {
    const ids = (query) => searchCommonFirst(library, query).common.map((item) => item.id)
    assert.ok(!ids('rdl').includes('Dumbbell_Lunges'))
    assert.ok(!ids('rdl').includes('Trap_Bar_Deadlift'))
    assert.deepEqual(ids('rdl'), ['Romanian_Deadlift', 'Stiff-Legged_Dumbbell_Deadlift', 'own-single-leg-rdl'])
    assert.ok(!ids('row').includes('Sled_Push'))
    assert.ok(!ids('ring').includes('Lying_Leg_Curls'))
    assert.equal(firstShown('ring'), 'Suspended_Row')
  })

  it('a word-start hit inside one alias still counts ("prowler" → Sled Push, "pushup" → Push-Up, "ohp")', () => {
    assert.equal(firstShown('prowler'), 'Sled_Push')
    assert.equal(firstShown('pushup'), 'Pushups')
    assert.equal(firstShown('pull up'), 'Pullups')
    assert.equal(firstShown('ohp'), 'Standing_Military_Press')
    assert.ok(searchCommonFirst(library, 'deck').common.some((item) => item.id === 'Butterfly'))
  })

  it('under 2 characters: nothing', () => {
    assert.deepEqual(searchCommonFirst(library, 'p'), { common: [], rest: [], restCount: 0 })
  })

  // The receipts as Search shows them: the 29 of req-133 and the 4 of req-130.
  for (const [query, id] of [
    ['bench press', 'Barbell_Bench_Press_-_Medium_Grip'], ['squat', 'Barbell_Squat'], ['deadlift', 'Barbell_Deadlift'],
    ['rdl', 'Romanian_Deadlift'], ['ohp', 'Standing_Military_Press'], ['skull crusher', 'EZ-Bar_Skullcrusher'],
    ['db row', 'One-Arm_Dumbbell_Row'], ['lat pulldown', 'Wide-Grip_Lat_Pulldown'], ['face pull', 'Face_Pull'],
    ['hip thrust', 'Barbell_Hip_Thrust'], ['lateral raise', 'Side_Lateral_Raise'], ['leg curl', 'Seated_Leg_Curl'],
    ['leg press', 'Leg_Press'], ['pull up', 'Pullups'], ['chin up', 'Chin-Up'], ['dips', 'Dips_-_Triceps_Version'],
    ['plank', 'Plank'], ['push up', 'Pushups'], ['cable fly', 'Cable_Crossover'], ['preacher curl', 'Preacher_Curl'],
    ['hammer curl', 'Hammer_Curls'], ['t-bar row', 'T-Bar_Row_with_Handle'], ['farmer walk', 'Farmers_Walk'],
    ['treadmill', 'Running_Treadmill'], ['rowing', 'Rowing_Stationary'], ['calf raise', 'Standing_Calf_Raises'],
    ['lunge', 'Dumbbell_Lunges'], ['bicycle crunch', 'own-bicycle-crunch'], ['weighted dip', 'own-weighted-dip'],
    ['ab machine', 'Ab_Crunch_Machine'], ['stairs', 'Stairmaster'], ['hanging knee raises', 'own-hanging-knee-raise'],
  ]) {
    it(`shown first: "${query}" → ${id}`, () => assert.equal(firstShown(query), id))
  }
})

describe('Search row: Already added / Restore', () => {
  const bench = byId('Barbell_Bench_Press_-_Medium_Grip')

  it('a stored "Barbell Bench Press - Medium Grip", with or without libraryId, is Already added on "Bench Press"', () => {
    const withId = [{ id: 'a', name: 'Barbell Bench Press - Medium Grip', libraryId: bench.id }]
    const withoutId = [{ id: 'b', name: 'Barbell Bench Press - Medium Grip' }]
    assert.deepEqual(libraryItemMatch(withId, bench), { kind: 'live', exercise: withId[0] })
    assert.deepEqual(libraryItemMatch(withoutId, bench), { kind: 'live', exercise: withoutId[0] })
  })

  it('libraryId first (even renamed), then display name, then free-db name', () => {
    const renamed = { id: 'r', name: 'My Bench', libraryId: bench.id }
    const shown = { id: 's', name: 'bench press ' }
    const old = { id: 'o', name: 'Barbell Bench Press - Medium Grip' }
    assert.equal(libraryItemMatch([old, shown, renamed], bench).exercise.id, 'r')
    assert.equal(libraryItemMatch([old, shown], bench).exercise.id, 's')
    assert.equal(libraryItemMatch([old], bench).exercise.id, 'o')
    assert.equal(libraryItemMatch([{ id: 'x', name: 'Bench' }], bench), null)
  })

  it('live beats archived across the tiers; archived → Restore, newest first', () => {
    const archivedById = { id: 'a1', name: 'Bench Press', libraryId: bench.id, archivedAt: '2026-09-01T00:00:00Z' }
    const liveByName = { id: 'l', name: 'Barbell Bench Press - Medium Grip' }
    assert.deepEqual(libraryItemMatch([archivedById, liveByName], bench), { kind: 'live', exercise: liveByName })
    const newer = { ...archivedById, id: 'a2', archivedAt: '2026-09-20T00:00:00Z' }
    assert.deepEqual(libraryItemMatch([archivedById, newer], bench), { kind: 'archived', exercise: newer })
  })
})

describe('library only on screen', () => {
  it('Search shows no RepDB credit and offers "Show N more"; Settings keeps the credit', () => {
    const exercises = source('./views/Exercises.jsx')
    assert.doesNotMatch(exercises, /RepdbCredit/)
    assert.match(exercises, /more from the full library/)
    assert.match(source('./views/Settings.jsx'), /<RepdbCredit \/>/)
  })

  it('the catalog module has no RepDB fetch or merge left', () => {
    const catalog = source('./exerciseCatalog.js')
    assert.doesNotMatch(catalog, /fetch\(|REPDB_URL|fromRepdbItem|mergeCatalogs/)
  })
})
