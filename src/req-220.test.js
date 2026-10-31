// req-220 (DEC-121 §1, DEC-123 §2–3) — "Export for your AI" and the import preview.
//  scope 2–3: the export describes every stored field (FIELDS), and a field added without a
//             description fails here (the receipt: a deliberately undocumented fixture field).
//  scope 4:   importPreview counts what a file changes; Keep my history leaves the device's
//             logged records byte-identical; Replace everything takes the file; Cancel and a bad
//             file write nothing. Runs the real persistence.js against an in-memory localStorage and
//             a store stand-in that saves the way store.jsx's setState does (as req-157).
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import {
  ASSISTANT,
  FIELDS,
  applyBackup,
  buildBackup,
  commitBackup,
  importPreview,
  keptHistoryState,
  previewLines,
  undocumentedFields,
} from './exchange.js'
import { HISTORY_CHANGED_TITLE, IMPORT_CHOICES, REPLACE_MESSAGE, exportBackup, importMode, importWithBackup } from './import-backup.js'
import { migrateState } from './model.js'
import { loadState, saveState } from './persistence.js'
import { answerConfirm, getPendingConfirm } from './ui/confirm.js'
import { fullState } from './test-support/full-state.js'

const KEY = 'workout-mvp-v9'
const fixture = () => JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
const plain = (value) => JSON.parse(JSON.stringify(value))

let previous
let disk
beforeEach(() => {
  previous = globalThis.localStorage
  disk = new Map()
  globalThis.localStorage = {
    getItem: (key) => (disk.has(key) ? disk.get(key) : null),
    setItem: (key, value) => disk.set(key, String(value)),
    removeItem: (key) => disk.delete(key),
    get length() {
      return disk.size
    },
    key: (i) => [...disk.keys()][i] ?? null,
  }
})
afterEach(() => {
  globalThis.localStorage = previous
})

// store.jsx: setState(updater) → next = updater(prev); saveState(next); applyBackup is
// commitBackup(payload, setState, { keepHistory, current: state }).
function makeStore(state) {
  const store = { ...state }
  const setState = (updater) => {
    const next = updater(store)
    saveState(next)
    for (const key of Object.keys(store)) if (typeof store[key] !== 'function') delete store[key]
    Object.assign(store, next)
  }
  store.applyBackup = (payload, { keepHistory = false } = {}) =>
    commitBackup(payload, setState, { keepHistory, current: { ...store } })
  return store
}

// A device holding db.json (13 logged workouts), loaded through the real loadState.
function device(data = fixture()) {
  disk.set(KEY, JSON.stringify({ ...data, schemaVersion: 9 }))
  return makeStore(loadState())
}

// The file a user exports from `store` and gets back, edited by `edit`.
function exported(store, edit = () => {}) {
  const pack = plain(buildBackup(store, { includeAssistant: true }))
  edit(pack.state)
  return pack
}

function run(store, payload, answer) {
  const calls = { asked: [], downloads: [] }
  const done = importWithBackup({
    store,
    payload,
    ask: (message, preview) => {
      calls.asked.push({ message, preview })
      return answer
    },
    download: (name, data) => calls.downloads.push({ name, data, diskAtDownload: disk.get(KEY) }),
  })
  return { calls, done }
}

const golden = (name) => JSON.parse(gunzipSync(readFileSync(new URL(name, import.meta.url))).toString('utf8'))
function statesIn(value, found = []) {
  if (value && typeof value === 'object') {
    if (Array.isArray(value.exercises) && value.schedule) found.push(value)
    for (const child of Object.values(value)) statesIn(child, found)
  }
  return found
}

// ── scope 2–3: the export can't go stale ─────────────────────────────────────────────
describe('req-220 scope 3 — every stored field is described in the export', () => {
  it('the full sample state (built through the real writers + migrateState) has no undocumented field', () => {
    assert.deepEqual(undocumentedFields(fullState()), [])
  })

  it('so do db.json and the req-164 / req-165 golden states (old data, migrated)', () => {
    assert.deepEqual(undocumentedFields(migrateState(fixture())), [])
    for (const name of ['./req-164.golden.json.gz', './req-165.golden.json.gz']) {
      const states = statesIn(golden(name))
      assert.ok(states.length > 0, name)
      for (const state of states) assert.deepEqual(undocumentedFields(migrateState(state)), [], name)
    }
  })

  it('RECEIPT: a deliberately undocumented field in a fixture fails the check', () => {
    const state = fullState()
    state.workouts[0].sets[0].mysteryField = 1
    state.routines[0].exercises[0].tempo = '3-1-1'
    state.schedule.moves[0].reason = 'travel'
    state.exercises[0].gripWidth = 'wide'
    assert.deepEqual(undocumentedFields(state), [
      'exercise.gripWidth',
      'routineItem.tempo',
      'scheduleMove.reason',
      'set.mysteryField',
    ])
  })

  it('RECEIPT (review round 1): nested values are checked too, and an unknown nested object is reported', () => {
    const state = fullState()
    state.routines[0].exercises[1].warmup.tempo = 'slow'
    state.activeWorkout.firstTimeSetup = { 'ex-press': { mode: 'setup', itemKey: 'si-press', seed: { workIndex: 1, extra: 1 } } }
    state.activeWorkout.seedOverrides['ex-press::work'].unit = 'kg'
    state.legacyRecommendations['si-press'].note = 'x'
    state.workouts[0].sets[0].meta = { source: 'watch' }
    state.workouts[0].progression = { anything: { goes: true } } // legacy, opaque: not reported
    assert.deepEqual(undocumentedFields(state), [
      'firstTimeSetupSeed.extra',
      'legacyRecommendation.note',
      'seedOverride.unit',
      'set.meta',
      'set.meta{}',
      'warmup.tempo',
    ])
  })

  it('the full state carries the fields the req names (so the check above really covers them)', () => {
    const state = fullState()
    const sets = state.workouts.flatMap((workout) => workout.sets)
    for (const field of ['loggedAt', 'durationSec', 'level', 'distance', 'distanceUnit', 'rpe', 'targetReps', 'targetWeight']) {
      assert.ok(sets.some((set) => field in set), `set.${field}`)
    }
    assert.ok(state.exercises.some((exercise) => exercise.libraryId && exercise.lightestWeight && exercise.hasDuration === false))
    assert.ok(state.exercises.some((exercise) => exercise.hasDuration === true))
    assert.ok(state.routines[0].exercises.some((item) => item.durations.length))
    assert.equal(state.schedule.moves.length, 1)
    assert.ok(state.workouts[0].snapshot.items.some((item) => item.addedSets === 1))
    assert.ok(state.workouts[0].snapshot.items.some((item) => item.addedMidWorkout && item.replacesItemId))
  })

  it('every description is a non-empty string; the export carries the map', () => {
    for (const [entity, fields] of Object.entries(FIELDS)) {
      for (const [field, text] of Object.entries(fields)) assert.ok(typeof text === 'string' && text.length > 5, `${entity}.${field}`)
    }
    assert.deepEqual(buildBackup(fullState(), { includeAssistant: true }).assistant.fields, plain(FIELDS))
  })
})

describe('req-220 scope 2 — ASSISTANT is current', () => {
  it('effort per exercise (2/3/4, 5 legacy) and the progress.js rule (≤2 up, ≥5 or missed reps down)', () => {
    assert.match(FIELDS.set.rpe, /once per exercise/)
    assert.match(FIELDS.set.rpe, /2 Easy, 3 Medium, 4 Hard; 5 Failure on older sets/)
    const history = ASSISTANT.howTheAppWorks.history
    assert.match(history, /missed reps or effort 5 → one weight step down/)
    assert.match(history, /effort 2 or less with no missed reps → one weight step up/)
    assert.match(history, /loggedAt/)
    assert.deepEqual(ASSISTANT.import.enums.effort.map((option) => option.value), [2, 3, 4, 5])
  })
  it('the set shape (incl. loggedAt), cardio and timed fields, libraryId and moves are in the samples', () => {
    assert.match(ASSISTANT.howTheAppWorks.sets, /loggedAt/)
    assert.match(ASSISTANT.howTheAppWorks.sets, /level, distance and distanceUnit/)
    const [work, cardio] = ASSISTANT.import.sampleSets
    assert.ok(work.loggedAt && work.rpe === 3)
    assert.deepEqual([cardio.durationSec, cardio.level, cardio.distance, cardio.distanceUnit], [360, 8, 1.2, 'km'])
    const exercise = ASSISTANT.import.stateShape.exercises[0]
    assert.ok(exercise.libraryId && 'hasDuration' in exercise && 'durationSec' in exercise && 'lightestWeight' in exercise)
    assert.equal(ASSISTANT.import.stateShape.schedule.moves.length, 1)
    assert.ok(ASSISTANT.import.stateShape.routines[0].exercises.every((item) => Array.isArray(item.durations)))
  })
  it('never invent completed workouts or sets; progress through routines', () => {
    assert.match(ASSISTANT.prompt, /Never invent completed workouts or sets/)
    assert.match(ASSISTANT.prompt, /change the routine's suggestedWeights and targets/)
    assert.match(ASSISTANT.import.instructions, /Never add workouts or sets the user did not do/)
    assert.match(ASSISTANT.howTheAppWorks.history, /suggestedWeights .* never into history/)
  })
  it('the stateShape sample itself passes the field check (an AI copying it adds nothing undescribed)', () => {
    // stateShape.workouts is an instruction string, not data: one workout of the sample sets
    // stands in for it.
    const sample = { ...ASSISTANT.import.stateShape, workouts: [{ id: 'wo-1', sets: ASSISTANT.import.sampleSets }] }
    assert.deepEqual(undocumentedFields(migrateState(sample)), [])
  })
})

describe('req-220 scope 1 — Export for your AI', () => {
  it('writes the backup with the assistant, under its own name; Back up now stays plain', () => {
    const files = []
    const now = new Date('2026-10-11T12:00:00')
    exportBackup(fullState(), { includeAssistant: true, now, download: (name, data) => files.push({ name, data }) })
    exportBackup(fullState(), { now, download: (name, data) => files.push({ name, data }) })
    assert.deepEqual(files.map((file) => file.name), ['workout-for-ai-2026-10-11.json', 'workout-database-2026-10-11.json'])
    assert.ok(files[0].data.assistant.fields.set.loggedAt)
    assert.equal(files[1].data.assistant, undefined)
  })
})

// ── scope 4: the preview ────────────────────────────────────────────────────────────
describe('req-220 AC2 — the preview', () => {
  it('a file identical to the current data → "nothing changed"', () => {
    const store = device()
    const preview = importPreview(store, applyBackup(exported(store)).state)
    assert.equal(preview.nothingChanged, true)
    assert.equal(preview.conflict, false)
    assert.deepEqual(previewLines(preview), ['Nothing changed: this file matches the data on this device.'])
  })

  it('one routine edited → "Workouts: 1 changed", history unchanged', () => {
    const store = device()
    const file = exported(store, (state) => {
      state.routines[0].exercises[0].suggestedWeights = [99]
    })
    const preview = importPreview(store, applyBackup(file).state)
    assert.deepEqual(preview.routines, { added: 0, changed: 1, removed: 0, unchanged: store.routines.length - 1 })
    assert.equal(preview.history.changed + preview.history.removed + preview.history.added, 0)
    assert.equal(preview.conflict, false)
    assert.deepEqual(previewLines(preview), ['Workouts: 1 changed', 'Exercises: unchanged', 'Schedule: unchanged', 'Logged history: unchanged'])
  })

  it('counts added / removed routines and exercises, and a schedule change', () => {
    const store = device()
    const file = exported(store, (state) => {
      state.routines.push({ id: 'rtn-new', name: 'New', focus: 'Machines', exercises: [] })
      state.exercises.push({ id: 'ex-new', name: 'New', equipment: 'Barbell', type: 'free', weightStep: '2.5' })
      state.schedule.loopWeeks = 2
    })
    const lines = previewLines(importPreview(store, applyBackup(file).state))
    assert.deepEqual(lines, ['Workouts: 1 added', 'Exercises: 1 added', 'Schedule: changed', 'Logged history: unchanged'])
  })

  it('a just-finished workout (no schemaVersion until the next load) still compares equal', () => {
    const store = device()
    const file = exported(store)
    const { schemaVersion: version, ...fresh } = store.workouts[0]
    assert.equal(version, 9)
    store.workouts = [fresh, ...store.workouts.slice(1)]
    assert.equal(importPreview(store, applyBackup(file).state).nothingChanged, true)
  })

  it('restoring onto a device with no history: workouts added, no Keep/Replace choice', () => {
    const store = makeStore(loadState())
    const preview = importPreview(store, applyBackup(fixture()).state)
    assert.equal(preview.history.added, 13)
    assert.equal(preview.conflict, false)
  })
})

describe('req-220 AC3 (failure case) — a logged set kg altered', () => {
  const altered = (store) =>
    exported(store, (state) => {
      state.workouts[0].sets[0].weight = Number(state.workouts[0].sets[0].weight) + 50
      state.routines[0].name = 'Renamed by the AI'
    })

  it('preview: "1 logged workout changed", a conflict', () => {
    const store = device()
    const preview = importPreview(store, applyBackup(altered(store)).state)
    assert.equal(preview.conflict, true)
    assert.ok(previewLines(preview).includes('Logged history: 1 logged workout changed'))
  })

  it('Keep my history (the default answer) → stored workouts byte-identical; routines from the file', async () => {
    const store = device()
    const storedBefore = disk.get(KEY)
    const before = JSON.stringify(JSON.parse(storedBefore).workouts)
    const { calls, done } = run(store, altered(store), true)
    const result = await done
    assert.equal(calls.asked.length, 1)
    assert.equal(calls.asked[0].message, REPLACE_MESSAGE)
    assert.equal(calls.asked[0].preview.conflict, true)
    const saved = JSON.parse(disk.get(KEY))
    assert.equal(JSON.stringify(saved.workouts), before, 'workouts byte-identical')
    assert.equal(JSON.stringify(store.workouts), before)
    assert.equal(saved.routines[0].name, 'Renamed by the AI', 'routines taken from the file')
    assert.equal(result.keptHistory, true)
    assert.equal(result.summary.workouts, 13)
    // req-07: the safety copy of the current data downloaded first, before anything was written
    assert.equal(calls.downloads.length, 1)
    assert.match(calls.downloads[0].name, /^workout-database-.*\.json$/)
    assert.equal(calls.downloads[0].diskAtDownload, storedBefore, 'downloaded before the write')
    assert.equal(JSON.stringify(calls.downloads[0].data.state.workouts), before, 'the copy holds the pre-import data')
    assert.notEqual(calls.downloads[0].data.state.routines[0].name, 'Renamed by the AI')
  })

  it("an explicit 'keep' does the same; 'replace' takes the file's history", async () => {
    const keep = device()
    const before = JSON.stringify(keep.workouts)
    await run(keep, altered(keep), 'keep').done
    assert.equal(JSON.stringify(JSON.parse(disk.get(KEY)).workouts), before)

    const replace = device()
    const file = altered(replace)
    await run(replace, file, 'replace').done
    const saved = JSON.parse(disk.get(KEY))
    assert.equal(saved.workouts[0].sets[0].weight, file.state.workouts[0].sets[0].weight)
  })
})

describe('req-220 AC4 — Cancel and a bad file write nothing', () => {
  for (const answer of [false, null, undefined, 'nonsense']) {
    it(`a conflict answered ${JSON.stringify(answer)} → nothing downloaded, nothing written`, async () => {
      const store = device()
      const stored = disk.get(KEY)
      const file = exported(store, (state) => state.workouts.pop())
      const { calls, done } = run(store, file, answer)
      assert.equal(await done, null)
      assert.equal(calls.downloads.length, 0)
      assert.equal(disk.get(KEY), stored)
    })
  }
  it('Cancel on a plain (no-conflict) confirm → nothing written', async () => {
    const store = device()
    const stored = disk.get(KEY)
    const { calls, done } = run(store, exported(store, (state) => (state.routines[0].name = 'x')), false)
    assert.equal(await done, null)
    assert.equal(calls.downloads.length, 0)
    assert.equal(disk.get(KEY), stored)
  })
  it('an invalid file → the existing friendly error, no preview asked, nothing written', async () => {
    const store = device()
    const stored = disk.get(KEY)
    const { calls, done } = run(store, { kind: 'workout-mvp-backup', version: 1, state: { workouts: [null] } }, true)
    await assert.rejects(done, /Not a workout database backup\./)
    assert.equal(calls.asked.length, 0)
    assert.equal(calls.downloads.length, 0)
    assert.equal(disk.get(KEY), stored)
  })
})

describe('req-220 AC5 — round-trip', () => {
  it('export → import unchanged → state deep-equal (loggedAt, moves, cardio fields included)', async () => {
    const full = fullState()
    const { activeWorkout: _active, ...rest } = full
    const data = { ...rest, activeWorkout: null } // a stopwatch never survives an import (req-194)
    const store = device(data)
    const before = plain(store)
    delete before.applyBackup
    const { calls, done } = run(store, exported(store), true)
    await done
    assert.equal(calls.asked[0].preview.nothingChanged, true)
    const after = JSON.parse(disk.get(KEY))
    assert.deepEqual(after, before)
    assert.equal(after.workouts[0].sets[0].loggedAt, '2026-10-07T17:01:00.000Z')
    assert.equal(after.workouts[0].sets[0].distanceUnit, 'km')
    assert.deepEqual(after.schedule.moves, [{ id: 'mv-1', slotId: 'slot-a', from: '2026-10-05', to: '2026-10-07' }])
  })
})

describe('req-220 — Keep my history: the open calls', () => {
  it('a kept workout whose routine (and its exercise) the file removed → the device copy comes back, archived', () => {
    const current = fullState()
    const incoming = applyBackup(
      exported(makeStore(current), (state) => {
        state.routines = []
        state.exercises = state.exercises.filter((exercise) => exercise.id !== 'ex-press')
        state.schedule.slots = []
        state.schedule.moves = []
      }),
    ).state
    const preview = importPreview(current, incoming)
    assert.equal(preview.conflict, false, 'history itself is unchanged')
    assert.deepEqual(preview.archived, { replace: { routines: 1, exercises: 1 }, keep: { routines: 1, exercises: 1 } })
    const kept = keptHistoryState(incoming, current, '2026-10-11T00:00:00.000Z')
    assert.deepEqual(kept.routines.map((routine) => [routine.id, routine.archivedAt]), [['rtn-a', '2026-10-11T00:00:00.000Z']])
    assert.deepEqual(kept.exercises.find((exercise) => exercise.id === 'ex-press').archivedAt, '2026-10-11T00:00:00.000Z')
    assert.equal(kept.workouts, current.workouts, 'the same array')
  })

  it("the device's workout in progress and drafts are kept; the file's are not taken", () => {
    const current = fullState()
    const incoming = { ...applyBackup(exported(makeStore(current))).state, activeWorkout: null, draftWorkouts: [{ id: 'd' }] }
    const preview = importPreview(current, incoming)
    assert.equal(preview.active, 'removed')
    assert.equal(preview.conflict, true)
    assert.ok(previewLines(preview).includes('Workout in progress: not in the file.'))
    const kept = keptHistoryState(incoming, current)
    assert.equal(kept.activeWorkout, current.activeWorkout)
    assert.equal(kept.draftWorkouts, current.draftWorkouts)
  })

  it('workouts added by the file while the device has history → a conflict; Keep drops them', () => {
    const store = device()
    const file = exported(store, (state) => state.workouts.push({ ...state.workouts[0], id: 'wo-invented' }))
    const incoming = applyBackup(file).state
    const preview = importPreview(store, incoming)
    assert.equal(preview.conflict, true)
    assert.ok(previewLines(preview).includes('Logged history: 1 logged workout added'))
    assert.equal(keptHistoryState(incoming, store).workouts.length, 13)
  })

  it('importMode: Keep only on a conflict; true = the default (keep); falsy cancels', () => {
    const conflict = { conflict: true }
    assert.equal(importMode(true, conflict), 'keep')
    assert.equal(importMode('keep', conflict), 'keep')
    assert.equal(importMode('replace', conflict), 'replace')
    assert.equal(importMode('other', conflict), null)
    assert.equal(importMode(null, conflict), null)
    assert.equal(importMode(true, { conflict: false }), 'replace')
    assert.equal(importMode('keep', { conflict: false }), 'replace')
    assert.equal(importMode(true, null), 'replace') // the unreadable state: no preview
    assert.equal(importMode(false, null), null)
  })
})

describe('req-220 — through the real in-app sheet (the default ask)', () => {
  it('a conflict opens the choice sheet: Keep my history first, then Replace everything; Keep keeps', async () => {
    const store = device()
    const before = JSON.stringify(store.workouts)
    const file = exported(store, (state) => state.workouts.pop())
    const done = importWithBackup({ store, payload: file, download: () => {} })
    await Promise.resolve()
    const pending = getPendingConfirm()
    assert.equal(pending.title, HISTORY_CHANGED_TITLE)
    assert.deepEqual(pending.choices, IMPORT_CHOICES)
    assert.deepEqual(IMPORT_CHOICES.map((choice) => choice.label), ['Keep my history', 'Replace everything'])
    // req-264 test edit (DEC-155 §2 reverses review round 1 item 7): Keep my history is the
    // highlighted (primary) choice; neither carries the destructive marking.
    assert.deepEqual(IMPORT_CHOICES.map((choice) => [Boolean(choice.primary), Boolean(choice.destructive)]), [[true, false], [false, false]])
    assert.match(pending.message, /Logged history: 1 logged workout removed/)
    assert.match(pending.message, /A copy of your current data downloads first\./)
    answerConfirm('keep')
    await done
    assert.equal(JSON.stringify(JSON.parse(disk.get(KEY)).workouts), before)
  })
  it('Cancel on the choice sheet writes nothing', async () => {
    const store = device()
    const stored = disk.get(KEY)
    const done = importWithBackup({ store, payload: exported(store, (state) => state.workouts.pop()), download: () => assert.fail('no download') })
    await Promise.resolve()
    answerConfirm(null)
    assert.equal(await done, null)
    assert.equal(disk.get(KEY), stored)
  })
  it('no conflict: the plain confirm with the preview above "Replace all data on this device?"', async () => {
    const store = device()
    const done = importWithBackup({ store, payload: exported(store), download: () => {} })
    await Promise.resolve()
    const pending = getPendingConfirm()
    assert.equal(pending.choices, undefined)
    assert.equal(pending.message, `Nothing changed: this file matches the data on this device.\n\n${REPLACE_MESSAGE}`)
    assert.equal(pending.confirmLabel, 'Replace')
    answerConfirm(false)
    assert.equal(await done, null)
  })
})

// ── Review round 1 ──────────────────────────────────────────────────────────────────
const dangling = (state) => {
  const routines = new Set(state.routines.map((routine) => routine.id))
  const exercises = new Set(state.exercises.map((exercise) => exercise.id))
  const records = [...state.workouts, ...state.draftWorkouts, ...(state.activeWorkout ? [state.activeWorkout] : [])]
  return [
    ...records.filter((record) => !routines.has(record.routineId)).map((record) => `routine ${record.routineId} (${record.id})`),
    ...records.flatMap((record) => record.sets.filter((set) => !exercises.has(set.exerciseId)).map((set) => `exercise ${set.exerciseId} (${record.id})`)),
    ...state.schedule.slots.filter((slot) => !routines.has(slot.routineId)).map((slot) => `slot ${slot.id}`),
  ]
}

describe('req-220 review round 1 — item 1: no import hard-deletes setup that history uses', () => {
  it('PROBE: the file drops all 3 routines and leaves history alone → plain replace; the 3 come back archived, no dangling refs, the preview says so', async () => {
    const store = device()
    const file = exported(store, (state) => {
      state.routines = []
    })
    const { calls, done } = run(store, file, true)
    await done
    const { preview } = calls.asked[0]
    assert.equal(preview.conflict, false)
    assert.deepEqual(previewLines(preview), [
      'Workouts: 3 removed',
      'Exercises: unchanged',
      'Schedule: changed', // the 3 archived routines' slots are dropped (item 6)
      'Logged history: unchanged',
      '3 workouts kept as archived — your history uses them.',
    ])
    const saved = JSON.parse(disk.get(KEY))
    assert.deepEqual(saved.routines.map((routine) => routine.id).sort(), ['sess-lower', 'sess-push-pull', 'sess-upper'])
    assert.ok(saved.routines.every((routine) => typeof routine.archivedAt === 'string'), 'archived')
    assert.deepEqual(dangling(saved), [])
    // item 6 — the archived routines' slots go, as removeRoutineFromState drops them
    assert.equal(saved.schedule.slots.length, 0)
    assert.equal(saved.workouts.length, 13)
  })

  it('an exercise history uses, dropped by the file, comes back archived (exercise only)', async () => {
    const store = device()
    const used = store.workouts[0].sets[0].exerciseId
    const file = exported(store, (state) => {
      state.exercises = state.exercises.filter((exercise) => exercise.id !== used)
      for (const routine of state.routines) routine.exercises = routine.exercises.filter((item) => item.exerciseId !== used)
    })
    const { calls, done } = run(store, file, true)
    await done
    assert.ok(previewLines(calls.asked[0].preview).includes('1 exercise kept as archived — your history uses it.'))
    const saved = JSON.parse(disk.get(KEY))
    assert.ok(saved.exercises.find((exercise) => exercise.id === used).archivedAt)
    assert.deepEqual(dangling(saved), [])
  })

  it("Replace everything: the references come from the file's own workouts", async () => {
    const store = device()
    const file = exported(store, (state) => {
      state.workouts = state.workouts.filter((workout) => workout.routineId !== 'sess-upper') // history changed → conflict
      state.routines = state.routines.filter((routine) => routine.id !== 'sess-lower') // still used by the file's workouts
      state.routines = state.routines.filter((routine) => routine.id !== 'sess-upper') // used by none of the file's
      state.schedule.slots = state.schedule.slots.filter((slot) => slot.routineId === 'sess-push-pull')
    })
    const { calls, done } = run(store, file, 'replace')
    await done
    assert.equal(calls.asked[0].preview.conflict, true)
    assert.deepEqual(calls.asked[0].preview.archived, { replace: { routines: 1, exercises: 0 }, keep: { routines: 2, exercises: 0 } })
    const saved = JSON.parse(disk.get(KEY))
    assert.deepEqual(saved.routines.filter((routine) => routine.archivedAt).map((routine) => routine.id), ['sess-lower'])
    assert.equal(saved.routines.some((routine) => routine.id === 'sess-upper'), false, 'unused by the written history: gone')
    assert.deepEqual(dangling(saved), [])
  })

  it('nothing to bring back → the replace writes exactly the file (the pre-req-220 replace)', () => {
    const store = device()
    const file = exported(store, (state) => (state.routines[0].name = 'x'))
    const incoming = applyBackup(file).state
    const written = []
    commitBackup(file, (updater) => written.push(updater()), { current: { ...store } })
    assert.equal(JSON.stringify(written[0]), JSON.stringify(incoming))
  })
})

describe('req-220 review round 1 — item 6: Keep drops the slots of a routine it brings back archived', () => {
  it('the file removed rtn-a but kept its slot and move → Keep: rtn-a archived, slot and move gone', () => {
    const current = fullState()
    const incoming = applyBackup(
      exported(makeStore(current), (state) => {
        state.routines = []
        state.workouts[0].overallNote = 'edited' // a conflict, so Keep is offered
      }),
    ).state
    assert.equal(importPreview(current, incoming).conflict, true)
    assert.equal(incoming.schedule.slots.length, 1)
    const kept = keptHistoryState(incoming, current, 'T')
    assert.deepEqual(kept.routines.map((routine) => [routine.id, routine.archivedAt]), [['rtn-a', 'T']])
    assert.deepEqual(kept.schedule.slots, [])
    assert.deepEqual(kept.schedule.moves, [])
  })
})

describe('req-220 review round 1 — item 2: legacy drafts are logged history', () => {
  const draft = () => ({ ...fixture().workouts[0], id: 'draft-1', finishedAt: null })
  it('a file without the device draft → a conflict, "1 logged workout removed"; Keep keeps it; Replace drops it', async () => {
    const keep = device({ ...fixture(), draftWorkouts: [draft()] })
    const drafts = JSON.stringify(keep.draftWorkouts)
    const file = exported(keep, (state) => (state.draftWorkouts = []))
    const { calls, done } = run(keep, file, true)
    await done
    assert.equal(calls.asked[0].preview.conflict, true)
    assert.ok(previewLines(calls.asked[0].preview).includes('Logged history: 1 logged workout removed'))
    assert.equal(JSON.stringify(JSON.parse(disk.get(KEY)).draftWorkouts), drafts)

    const replace = device({ ...fixture(), draftWorkouts: [draft()] })
    await run(replace, exported(replace, (state) => (state.draftWorkouts = [])), 'replace').done
    assert.deepEqual(JSON.parse(disk.get(KEY)).draftWorkouts, [])
  })
  it('a draft edited by the file → "1 logged workout changed"', () => {
    const store = device({ ...fixture(), draftWorkouts: [draft()] })
    const incoming = applyBackup(exported(store, (state) => (state.draftWorkouts[0].sets[0].weight = 1))).state
    const preview = importPreview(store, incoming)
    assert.equal(preview.conflict, true)
    assert.deepEqual(preview.history, { added: 0, changed: 1, removed: 0, unchanged: 13 })
  })
})

describe('req-220 review round 1 — item 3: a change outside the counts says "Other data: changed"', () => {
  it('a reorder of the exercises', () => {
    const store = device()
    const preview = importPreview(store, applyBackup(exported(store, (state) => state.exercises.reverse())).state)
    assert.equal(preview.nothingChanged, false)
    assert.deepEqual(previewLines(preview), ['Workouts: unchanged', 'Exercises: unchanged', 'Schedule: unchanged', 'Logged history: unchanged', 'Other data: changed'])
  })
  it('legacyRecommendations / plannedWorkouts', () => {
    const store = device()
    const edits = [
      (state) => (state.legacyRecommendations = { x: { sets: 1, targets: [], suggestedWeights: [] } }),
      (state) => (state.plannedWorkouts = [{ id: 'p', items: [] }]),
    ]
    for (const edit of edits) {
      assert.ok(previewLines(importPreview(store, applyBackup(exported(store, edit)).state)).includes('Other data: changed'))
    }
  })
  it('not shown when only counted areas changed', () => {
    const store = device()
    const lines = previewLines(importPreview(store, applyBackup(exported(store, (state) => (state.routines[0].name = 'x'))).state))
    assert.equal(lines.includes('Other data: changed'), false)
  })
})

// ── Review round 2 ──────────────────────────────────────────────────────────────────
describe('req-220 review round 2 — A: only exercises the records use come back', () => {
  it("PROBE: ex-unused in rtn-a (never logged); the file drops rtn-a and ex-unused → rtn-a archived, ex-unused not written, stripped from rtn-a", async () => {
    const base = fullState()
    base.exercises.push({ id: 'ex-unused', name: 'Unused', equipment: 'Machine', muscles: '', cues: '', type: 'machine', weightStep: '5', archivedAt: null, hasDuration: false, durationSec: 30 })
    base.routines[0].exercises.push({ id: 'si-unused', exerciseId: 'ex-unused', role: 'main', sets: 1, targets: ['10'], suggestedWeights: [], durations: [], restSec: 60, notes: '', warmup: null })
    const { activeWorkout: _active, ...rest } = base
    const store = device({ ...rest, activeWorkout: null })
    const file = exported(store, (state) => {
      state.routines = []
      state.exercises = state.exercises.filter((exercise) => exercise.id !== 'ex-unused')
    })
    const { calls, done } = run(store, file, true)
    await done
    const { preview } = calls.asked[0]
    assert.equal(preview.conflict, false)
    assert.deepEqual(preview.archived.replace, { routines: 1, exercises: 0 })
    assert.ok(previewLines(preview).includes('1 workout kept as archived — your history uses it.'), previewLines(preview).join(' | '))
    const saved = JSON.parse(disk.get(KEY))
    assert.equal(saved.exercises.some((exercise) => exercise.id === 'ex-unused'), false, 'ex-unused is not written')
    const rtn = saved.routines.find((routine) => routine.id === 'rtn-a')
    assert.ok(rtn.archivedAt)
    assert.equal(rtn.exercises.some((item) => item.exerciseId === 'ex-unused'), false, 'stripped from the restored routine')
    assert.deepEqual(rtn.exercises.map((item) => item.id), ['si-bike', 'si-press', 'si-plank'], 'the items history used stay')
    assert.deepEqual(dangling(saved), [])
  })
})

describe('req-220 review round 2 — B: the conflict sheet says which choice its lines describe', () => {
  it('"With Keep my history: …" on the archived line; the schedule line names both when they differ', () => {
    const store = device()
    const incoming = applyBackup(
      exported(store, (state) => {
        state.workouts = state.workouts.filter((workout) => workout.routineId !== 'sess-upper') // conflict
        state.routines = state.routines.filter((routine) => routine.id !== 'sess-upper') // only Keep's history uses it
      }),
    ).state
    const preview = importPreview(store, incoming)
    assert.equal(preview.conflict, true)
    const lines = previewLines(preview)
    assert.ok(lines.includes('With Keep my history: 1 workout kept as archived — your history uses it.'), lines.join(' | '))
    assert.ok(lines.includes('Schedule: changed with Keep my history, unchanged with Replace everything'), lines.join(' | '))
    // the plain confirm (no conflict) keeps the unlabelled line
    assert.equal(previewLines({ ...preview, conflict: false }, 'replace').some((line) => line.startsWith('With Keep')), false)
  })
})
