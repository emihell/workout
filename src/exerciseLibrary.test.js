// req-130 — our own exercise library (DEC-060): the pinned free-db copy, ids, groups,
// aliases, the resolver, search via aliases, libraryId on add, and no RepDB data.
import { afterEach, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  catalogItemToExercise,
  loadExerciseCatalog,
  resetExerciseCatalog,
  searchExerciseCatalog,
} from './exerciseCatalog.js'
import {
  catalogNameKey,
  deriveLibrary,
  FREE_DB_SHA256,
  libraryEntryFor,
  libraryProblems,
  loadExerciseLibrary,
  MUSCLE_GROUPS,
  OWN_FIELDS,
} from './exerciseLibrary.js'
import { EXTRA_EXERCISES } from './exerciseExtras.js'
import { OWN_EXERCISES } from './library/own-exercises.js'
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

// req-133 / DEC-063 — the seed aliases re-judged: the kept ones still resolve as before…
const SEED_TABLE = {
  'Rowing': 'Rowing, Stationary',
  'Chest Press': 'Leverage Chest Press',
  'Lat Pulldown': 'Wide-Grip Lat Pulldown',
  'Ab Machine': 'Ab Crunch Machine',
  'Push-Ups': 'Pushups',
  'Stairs': 'Stairmaster',
  'Leg Extension': 'Leg Extensions',
  'Leg Curl': 'Seated Leg Curl',
  'Abduction': 'Thigh Abductor',
  'Adduction': 'Thigh Adductor',
  'Incline DB Press': 'Incline Dumbbell Press',
  'One-Arm DB Row': 'One-Arm Dumbbell Row',
  'Overhead DB Press': 'Dumbbell Shoulder Press',
  'Hanging Knee Raises': 'Hanging Knee Raise',
}

// …and each dropped one resolves to null or its new target (reasons: reports/req-133.md).
const DROPPED_SEED_ALIASES = {
  'Shoulder Press': null, // misleading: barbell, dumbbell and machine all go by it
  'Biceps Curl': 'Dumbbell Bicep Curl', // misleading on the machine; now the standard dumbbell curl's
  'Triceps Press': null, // misleading: not the Dip Machine
  'Plank': 'Plank', // redundant: the entry's own name key
  'Leg Press': 'Leg Press', // redundant: the entry's own name key
  'Calf Raises (Leg Press)': null, // tagged form
  'Pull-Ups (BW)': null, // tagged form
  'Dips (BW)': null, // tagged form
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

  // req-139 (sanctioned edit) — was + 9: own-* grew by the staples (DEC-064).
  it('count = 876 free-db + extras + N of ours', () => {
    assert.equal(library.filter(isFreeDb).length, 876)
    assert.equal(library.length, 876 + EXTRA_EXERCISES.length + OWN_EXERCISES.length)
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

// req-139 (sanctioned edit) — rewritten to the key rules: an alias or display name key on
// a common entry may equal a non-common entry's name; never any common entry's name,
// display name or alias; no two entries share a display name key.
describe('alias integrity', () => {
  it('alias and display name keys follow the key rules', () => {
    const byId = new Map(library.map((entry) => [entry.id, entry]))
    const nameOwner = new Map(library.map((entry) => [catalogNameKey(entry.name), entry.id]))
    const keyOwner = new Map()
    for (const entry of library) {
      const keys = [
        ...(entry.displayName !== undefined ? [catalogNameKey(entry.displayName)] : []),
        ...new Set((entry.aliases || []).map(catalogNameKey)),
      ]
      for (const key of keys) {
        assert.ok(!keyOwner.has(key) || keyOwner.get(key) === entry.id, `${key} on ${keyOwner.get(key)} and ${entry.id}`)
        keyOwner.set(key, entry.id)
        const owner = nameOwner.get(key)
        if (owner && owner !== entry.id) {
          assert.ok(entry.common && !byId.get(owner).common, `${entry.id}: ${key} is ${owner}'s name`)
        }
      }
    }
    for (const entry of library) {
      if (entry.displayName !== undefined) assert.notEqual(entry.displayName, entry.name, entry.id)
    }
  })

  it('a common alias may shadow a non-common name; a common or display-name clash fails', () => {
    const fanBike = library.find((entry) => entry.id === 'own-fan-bike')
    assert.ok(fanBike.aliases.includes('Air Bike'))
    assert.equal(library.find((entry) => entry.id === 'Air_Bike').common, undefined)
    const shadow = library.map((entry) => (entry.id === 'Barbell_Curl' ? { ...entry, aliases: [...entry.aliases, 'Car Deadlift'] } : entry))
    assert.deepEqual(libraryProblems(shadow), [])
    const clash = library.map((entry) => (entry.id === 'Barbell_Curl' ? { ...entry, aliases: [...entry.aliases, 'Lat Pulldown'] } : entry))
    assert.match(libraryProblems(clash).join('\n'), /Barbell_Curl: alias "Lat Pulldown" is also on Wide-Grip_Lat_Pulldown \(its display name\)/)
    const twin = library.map((entry) => (entry.id === 'Barbell_Curl' ? { ...entry, displayName: 'Bench Press' } : entry))
    assert.match(libraryProblems(twin).join('\n'), /Barbell_Curl: display name "Bench Press" is also on Barbell_Bench_Press_-_Medium_Grip/)
    const same = library.map((entry) => (entry.id === 'Barbell_Curl' ? { ...entry, displayName: 'Barbell Curl' } : entry))
    assert.match(libraryProblems(same).join('\n'), /Barbell_Curl: display name equals its name/)
    const repeat = library.map((entry) => (entry.id === 'Barbell_Hip_Thrust' ? { ...entry, aliases: [...entry.aliases, 'Hip Thrust'] } : entry))
    assert.match(libraryProblems(repeat).join('\n'), /Barbell_Hip_Thrust: alias "Hip Thrust" repeats its display name/)
  })
})

describe('resolver', () => {
  it('all 22 seed names resolve per the tables (kept aliases, dropped ones)', () => {
    const names = seed.exercises.map((ex) => ex.name)
    assert.equal(names.length, 22)
    assert.deepEqual([...names].sort(), [...Object.keys(SEED_TABLE), ...Object.keys(DROPPED_SEED_ALIASES)].sort())
    for (const name of names) {
      const expected = name in SEED_TABLE ? SEED_TABLE[name] : DROPPED_SEED_ALIASES[name]
      assert.equal(libraryEntryFor({ name }, library)?.name ?? null, expected, name)
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

// req-139 (sanctioned edit) — over our library (no RepDB merge any more), compared by ids.
describe('search via aliases', () => {
  for (const [query, first] of [
    ['ab machine', 'Ab_Crunch_Machine'],
    ['stairs', 'Stairmaster'],
    ['leg curl', 'Seated_Leg_Curl'],
    ['hanging knee raises', 'own-hanging-knee-raise'],
  ]) {
    it(`"${query}" → ${first} first`, () => {
      assert.equal(searchExerciseCatalog(library, query)[0]?.id, first)
    })
  }

  // req-130 review — the seed aliases must not reorder single-word queries: a word
  // inside a multi-word alias ranks below every name hit (was: tier 1 via a word split,
  // which put Dip Machine first for "press"). "Without" = the stored aliases stripped.
  const noAliases = library.map(({ aliases, ...entry }) => entry)
  for (const [query, notFirst] of [
    ['press', 'Dip_Machine'],
    ['row', 'One-Arm_Dumbbell_Row'],
    ['machine', 'Ab_Crunch_Machine'],
  ]) {
    it(`"${query}": top 10 identical with and without aliases; ${notFirst} not first`, () => {
      const ids = (list) => searchExerciseCatalog(list, query, 10).map((item) => item.id)
      assert.deepEqual(ids(library), ids(noAliases))
      assert.notEqual(ids(library)[0], notFirst)
    })
  }
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

  // req-139 (sanctioned edit) — was ≥1 request incl. RepDB: search is our library only.
  it('loadExerciseCatalog reads our file and fetches nothing (no RepDB, no free-db CDN)', async () => {
    const list = await loadExerciseCatalog()
    assert.deepEqual(requested, [])
    assert.ok(list.some((item) => item.id === '3_4_Sit-Up'))
    assert.ok(list.every((item) => !String(item.id).startsWith('repdb-')))
    assert.deepEqual(await loadExerciseLibrary(), library)
  })

  // req-139 (sanctioned edit) — no RepDB fallback: a failed library chunk is an error,
  // nothing is cached, and the next open retries.
  it('a failed library load errors, uncached; the next open retries', async () => {
    let calls = 0
    const failing = () => {
      calls += 1
      return Promise.reject(new Error('chunk failed'))
    }
    await assert.rejects(loadExerciseCatalog({ loadLibrary: failing }), /Could not load\./)
    const second = await loadExerciseCatalog({ loadLibrary: loadExerciseLibrary })
    assert.equal(calls, 1)
    assert.ok(second.some((item) => item.id === '3_4_Sit-Up'))
    assert.deepEqual(requested, [])
  })
})

describe('stored data: libraryId', () => {
  const byId = (id) => library.find((entry) => entry.id === id)

  it('adding a library hit saves libraryId', () => {
    const record = exerciseFromData(catalogItemToExercise(byId('Stairmaster')), 'ex-1')
    assert.equal(record.libraryId, 'Stairmaster')
  })

  // req-139 (sanctioned edit) — the RepDB half left with RepDB search.
  it('a manual add saves no key', () => {
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
