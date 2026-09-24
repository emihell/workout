// req-130 — our own exercise library (DEC-060): the pinned free-db copy, ids, groups,
// aliases, the resolver, search via aliases, libraryId on add, and no RepDB data.
import { afterEach, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  catalogItemToExercise,
  fromRepdbItem,
  loadExerciseCatalog,
  mergeCatalogs,
  resetExerciseCatalog,
  searchExerciseCatalog,
} from './exerciseCatalog.js'
import {
  catalogNameKey,
  deriveLibrary,
  FREE_DB_SHA256,
  libraryEntryFor,
  loadExerciseLibrary,
  MUSCLE_GROUPS,
  OWN_FIELDS,
} from './exerciseLibrary.js'
import { EXTRA_EXERCISES } from './exerciseExtras.js'
import { exerciseFromData, patchExercise } from './exercise-names.js'
import { migrateState } from './model.js'
import { applyBackup, buildBackup } from './exchange.js'

const LIBRARY_PATH = fileURLToPath(new URL('./library/exercises.json', import.meta.url))
const LIBRARY_TEXT = readFileSync(LIBRARY_PATH, 'utf8')
const library = JSON.parse(LIBRARY_TEXT)
const seed = JSON.parse(readFileSync(fileURLToPath(new URL('./db.json', import.meta.url)), 'utf8'))

const isFreeDb = (entry) => !entry.id.startsWith('extra-') && !entry.id.startsWith('own-')

// The pinned source, rebuilt by removing our fields from the free-db entries.
function pinnedSourceText() {
  const stripped = library.filter(isFreeDb).map((entry) => {
    const copy = { ...entry }
    for (const field of OWN_FIELDS) delete copy[field]
    return copy
  })
  return `${JSON.stringify(stripped, null, 2)}\n`
}

const SEED_TABLE = {
  'Rowing': 'Rowing, Stationary',
  'Chest Press': 'Leverage Chest Press',
  'Lat Pulldown': 'Wide-Grip Lat Pulldown',
  'Shoulder Press': 'Machine Shoulder (Military) Press',
  'Biceps Curl': 'Machine Bicep Curl',
  'Triceps Press': 'Dip Machine',
  'Ab Machine': 'Ab Crunch Machine',
  'Plank': 'Plank',
  'Push-Ups': 'Pushups',
  'Stairs': 'Stairmaster',
  'Leg Press': 'Leg Press',
  'Leg Extension': 'Leg Extensions',
  'Leg Curl': 'Seated Leg Curl',
  'Abduction': 'Thigh Abductor',
  'Adduction': 'Thigh Adductor',
  'Calf Raises (Leg Press)': 'Calf Press On The Leg Press Machine',
  'Incline DB Press': 'Incline Dumbbell Press',
  'One-Arm DB Row': 'One-Arm Dumbbell Row',
  'Overhead DB Press': 'Dumbbell Shoulder Press',
  'Pull-Ups (BW)': 'Pullups',
  'Dips (BW)': 'Dips - Triceps Version',
  'Hanging Knee Raises': 'Hanging Knee Raise',
}

describe('own copy of free-exercise-db', () => {
  it('free-db entries, minus our fields, are the pinned source byte for byte', () => {
    const sha = createHash('sha256').update(pinnedSourceText()).digest('hex')
    assert.equal(sha, FREE_DB_SHA256)
  })

  it('the committed file is exactly what the derive script writes', () => {
    const source = JSON.parse(pinnedSourceText())
    assert.equal(`${JSON.stringify(deriveLibrary(source), null, 2)}\n`, LIBRARY_TEXT)
  })

  it('count = 876 free-db + extras + 1 of ours', () => {
    assert.equal(library.filter(isFreeDb).length, 876)
    assert.equal(library.length, 876 + EXTRA_EXERCISES.length + 1)
  })

  it('provenance and the Unlicense are recorded beside it', () => {
    const provenance = readFileSync(new URL('./library/PROVENANCE.md', import.meta.url), 'utf8')
    assert.match(provenance, /a859101d633a01c4a1a920d6a8ce41dabba0705f/)
    assert.match(provenance, new RegExp(FREE_DB_SHA256))
    assert.match(provenance, /Unlicense/)
    const licence = readFileSync(new URL('./library/LICENSE-free-exercise-db.md', import.meta.url), 'utf8')
    assert.match(licence, /released into the public domain/)
  })

  it('photos link the pinned commit, never @main', () => {
    const withImages = library.filter((entry) => (entry.images || []).length)
    assert.ok(withImages.length >= 873)
    for (const entry of withImages) {
      assert.equal(entry.photos.length, entry.images.length)
      for (const url of entry.photos) {
        assert.match(url, /^https:\/\/cdn\.jsdelivr\.net\/gh\/yuhonas\/free-exercise-db@a859101d633a01c4a1a920d6a8ce41dabba0705f\/exercises\//)
      }
    }
  })
})

describe('library ids', () => {
  it('are unique; extras are extra-*, ours own-*', () => {
    const ids = library.map((entry) => entry.id)
    assert.equal(new Set(ids).size, ids.length)
    for (const extra of EXTRA_EXERCISES) assert.ok(ids.includes(extra.id) && extra.id.startsWith('extra-'))
    assert.ok(ids.includes('own-hanging-knee-raise'))
    const ours = library.slice(876 + EXTRA_EXERCISES.length)
    assert.ok(ours.every((entry) => entry.id.startsWith('own-')))
  })
})

describe('muscle groups', () => {
  it('the table covers every primary muscle, extras included', () => {
    const mapped = new Set(Object.values(MUSCLE_GROUPS).flat())
    const unmapped = [...new Set(library.flatMap((entry) => entry.primaryMuscles || []))].filter((m) => !mapped.has(m))
    assert.deepEqual(unmapped, [])
  })

  it('every entry with a primary muscle has at least one group', () => {
    for (const entry of library) {
      if ((entry.primaryMuscles || []).length) assert.ok(entry.muscleGroups.length >= 1, entry.id)
    }
  })

  it('groups are derived, e.g. Prone YTW → Back + Shoulders', () => {
    const ytw = library.find((entry) => entry.id === 'extra-prone-ytw')
    assert.deepEqual(ytw.muscleGroups, ['Back', 'Shoulders'])
  })
})

describe('alias integrity', () => {
  it('an alias key is on at most one entry and never equals another entry\'s name key', () => {
    const owner = new Map()
    const nameOwner = new Map(library.map((entry) => [catalogNameKey(entry.name), entry.id]))
    for (const entry of library) {
      for (const alias of entry.aliases || []) {
        const key = catalogNameKey(alias)
        assert.ok(!owner.has(key) || owner.get(key) === entry.id, `alias ${alias} on two entries`)
        owner.set(key, entry.id)
        if (nameOwner.has(key)) assert.equal(nameOwner.get(key), entry.id, `alias ${alias} is another entry's name`)
      }
    }
  })
})

describe('resolver', () => {
  it('all 22 seed names resolve per the table', () => {
    const names = seed.exercises.map((ex) => ex.name)
    assert.equal(names.length, 22)
    for (const name of names) {
      assert.equal(libraryEntryFor({ name }, library)?.name, SEED_TABLE[name], name)
    }
  })

  it('an unknown name → null', () => {
    assert.equal(libraryEntryFor({ name: 'Zercher Moonwalk' }, library), null)
  })

  it('a found libraryId wins over the name', () => {
    assert.equal(libraryEntryFor({ name: 'Plank', libraryId: 'Pullups' }, library).id, 'Pullups')
  })

  it('an unknown libraryId falls through to name, then alias', () => {
    assert.equal(libraryEntryFor({ name: 'Plank', libraryId: 'gone' }, library).id, 'Plank')
    assert.equal(libraryEntryFor({ name: 'Stairs', libraryId: 'gone' }, library).id, 'Stairmaster')
  })
})

describe('search via aliases', () => {
  const repdb = [
    fromRepdbItem({ id: 'lat-pulldown', name_en: 'Lat Pulldown', equipment: 'cable' }),
    fromRepdbItem({ id: 'leg-extension', name_en: 'Leg Extension', equipment: 'machine' }),
    fromRepdbItem({ id: 'hanging-knee-raise', name_en: 'Hanging Knee Raise', is_bodyweight: true }),
  ]
  const merged = mergeCatalogs(library, repdb)

  for (const [query, first] of [
    ['ab machine', 'Ab Crunch Machine'],
    ['stairs', 'Stairmaster'],
    ['biceps curl', 'Machine Bicep Curl'],
    ['triceps press', 'Dip Machine'],
    ['leg curl', 'Seated Leg Curl'],
    ['hanging knee raises', 'Hanging Knee Raise'],
  ]) {
    it(`"${query}" → ${first} first`, () => {
      assert.equal(searchExerciseCatalog(merged, query)[0]?.name, first)
    })
  }

  it('RepDB "Lat Pulldown" and "Leg Extension" stay in the merged list (name-only dedupe)', () => {
    assert.ok(merged.some((item) => item.id === 'repdb-lat-pulldown'))
    assert.ok(merged.some((item) => item.id === 'repdb-leg-extension'))
  })

  // req-130 review — the seed aliases must not reorder single-word queries: a word
  // inside a multi-word alias ranks below every name hit (was: tier 1 via a word split,
  // which put Dip Machine first for "press").
  const noAliases = mergeCatalogs(
    library.map(({ aliases, ...entry }) => entry),
    repdb,
  )
  for (const [query, notFirst] of [
    ['press', 'Dip Machine'],
    ['row', 'One-Arm Dumbbell Row'],
    ['machine', 'Ab Crunch Machine'],
  ]) {
    it(`"${query}": top 10 identical with and without aliases; ${notFirst} not first`, () => {
      const names = (list) => searchExerciseCatalog(list, query, 10).map((item) => item.name)
      assert.deepEqual(names(merged), names(noAliases))
      assert.notEqual(names(merged)[0], notFirst)
    })
  }

  it('our Hanging Knee Raise (with instructions) is the one kept', () => {
    const hits = merged.filter((item) => catalogNameKey(item.name) === 'hangingkneeraise')
    assert.equal(hits.length, 1)
    assert.equal(hits[0].id, 'own-hanging-knee-raise')
    assert.ok(hits[0].instructions.length >= 3)
  })
})

describe('no RepDB data in the library', () => {
  it('no repdb ids, urls or RepDB fields', () => {
    assert.doesNotMatch(LIBRARY_TEXT, /repdb/i)
    for (const entry of library) {
      for (const key of Object.keys(entry)) {
        assert.doesNotMatch(key, /^(description|tips|instructions|name)_/, `${entry.id}.${key}`)
      }
    }
  })
})

describe('loading', () => {
  const realFetch = globalThis.fetch
  let requested
  beforeEach(() => {
    requested = []
    globalThis.fetch = async (url) => {
      requested.push(String(url))
      return { ok: true, json: async () => ({ exercises: [{ id: 'x', name_en: 'Lat Pulldown' }] }) }
    }
  })
  afterEach(() => {
    globalThis.fetch = realFetch
    resetExerciseCatalog()
  })

  it('loadExerciseCatalog reads our file and never fetches the free-db CDN JSON', async () => {
    const list = await loadExerciseCatalog()
    assert.ok(requested.length >= 1)
    assert.ok(requested.every((url) => !url.includes('free-exercise-db')), requested.join(', '))
    assert.ok(list.some((item) => item.id === '3_4_Sit-Up'))
    assert.ok(list.some((item) => item.id === 'repdb-x'))
    assert.deepEqual(await loadExerciseLibrary(), library)
  })

  // req-130 review — a failed library chunk must not leave a RepDB-only catalog cached.
  it('a failed library load returns RepDB only, uncached; the next open retries', async () => {
    let calls = 0
    const failing = () => {
      calls += 1
      return Promise.reject(new Error('chunk failed'))
    }
    const first = await loadExerciseCatalog({ loadLibrary: failing })
    assert.deepEqual(first.map((item) => item.id), ['repdb-x'])
    const second = await loadExerciseCatalog({ loadLibrary: loadExerciseLibrary })
    assert.equal(calls, 1)
    assert.ok(second.some((item) => item.id === '3_4_Sit-Up'))
  })
})

describe('stored data: libraryId', () => {
  const byId = (id) => library.find((entry) => entry.id === id)

  it('adding a library hit saves libraryId', () => {
    const record = exerciseFromData(catalogItemToExercise(byId('Stairmaster')), 'ex-1')
    assert.equal(record.libraryId, 'Stairmaster')
  })

  it('a RepDB hit and a manual add save no key', () => {
    const repdb = exerciseFromData(catalogItemToExercise(fromRepdbItem({ id: 'plank', name_en: 'Plank' })), 'ex-2')
    assert.equal('libraryId' in repdb, false)
    const manual = exerciseFromData({ name: 'My Thing', type: 'free', equipment: '', weightStep: '', muscles: '', cues: '' }, 'ex-3')
    assert.equal('libraryId' in manual, false)
  })

  it('migrateState passes libraryId through and adds none', () => {
    const store = {
      exercises: [
        { id: 'a', name: 'Stairs', libraryId: 'Stairmaster' },
        { id: 'b', name: 'Plank' },
      ],
    }
    const out = migrateState(store)
    assert.equal(out.exercises[0].libraryId, 'Stairmaster')
    assert.equal('libraryId' in out.exercises[1], false)
  })

  it('buildBackup → applyBackup round-trips libraryId', () => {
    const state = migrateState({ exercises: [{ id: 'a', name: 'Stairs', libraryId: 'Stairmaster' }, { id: 'b', name: 'Plank' }] })
    const { state: restored } = applyBackup(JSON.parse(JSON.stringify(buildBackup(state))))
    assert.equal(restored.exercises[0].libraryId, 'Stairmaster')
    assert.equal('libraryId' in restored.exercises[1], false)
  })

  // req-130 review — behavioural (was a source regex): store.updateExercise writes
  // patchExercise(ex, patch); ExerciseEdit's rename patch carries no libraryId.
  it('a rename keeps libraryId', () => {
    const record = exerciseFromData(catalogItemToExercise(byId('Stairmaster')), 'ex-1')
    const renamed = patchExercise(record, {
      name: 'Stairs (gym 2)',
      type: record.type,
      equipment: record.equipment,
      muscles: record.muscles,
      cues: record.cues,
      hasDuration: false,
      durationSec: 30,
    })
    assert.equal(renamed.name, 'Stairs (gym 2)')
    assert.equal(renamed.libraryId, 'Stairmaster')
  })
})
