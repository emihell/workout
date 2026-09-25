// req-125 — typed-but-not-completed set values survive navigation and reload. The draft
// is one optional field on the active workout (`setDraft`), exercised through the REAL
// migrateState (what storage.loadState runs on every load), the store's patch merge,
// finishedState (store.finishWorkout) and the same seed chain the log form uses
// (initialSetFields → nextSeedOverrides).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildPlannedWorkout, migrateState, planSnapshot } from './model.js'
import {
  createSetDraftWriter,
  finishedState,
  formFieldsWithDraft,
  initialSetFields,
  itemKey,
  itemLoggingState,
  nextSeedOverrides,
  replacementItem,
  seedOverrideKey,
  setDraftFor,
  setDraftFromForm,
  setDraftFromLoggedSet,
  setDraftKey,
  withLoggedSet,
} from './workout-log.js'

const EXERCISES = [
  { id: 'ex-a', name: 'Chest Press', equipment: 'Machine', type: 'machine', weightStep: '5' },
  { id: 'ex-b', name: 'Row', equipment: 'Machine', type: 'machine', weightStep: '5' },
  { id: 'ex-p', name: 'Plank', equipment: '', type: 'bodyweight', weightStep: 'n/a', hasDuration: true },
]

// Current-schema state: routine r1 = A (warm-up + 3 sets 10/8/6) then P (timed plank),
// started the real way (buildPlannedWorkout → planSnapshot). No setDraft — the shape of
// every active workout saved before req-125.
function baseState() {
  const state = migrateState({
    schemaVersion: 9,
    exercises: EXERCISES,
    routines: [
      {
        id: 'r1',
        name: 'Push',
        exercises: [
          { id: 'ri-a', exerciseId: 'ex-a', role: 'main', restSec: 120, warmup: { reps: 10 }, sets: 3, targets: ['10', '8', '6'], suggestedWeights: [40, 45, 50] },
          { id: 'ri-p', exerciseId: 'ex-p', role: 'main', restSec: 60, sets: 2, targets: ['30s', '30s'] },
        ],
      },
    ],
    schedule: { loopWeeks: 1, slots: [] },
    workouts: [],
    activeWorkout: null,
  })
  const plan = buildPlannedWorkout(state, { routineId: 'r1', date: '2026-09-23' })
  state.activeWorkout = {
    id: 'wo-live',
    routineId: 'r1',
    performedOn: '2026-09-23',
    occurrenceId: plan.occurrenceId,
    snapshot: planSnapshot(plan),
    startedAt: '2026-09-23T10:00:00.000Z',
    finishedAt: null,
    completedItemIds: [],
    restEndsAt: null,
    restPausedRemaining: null,
    sets: [],
    seedOverrides: {},
  }
  return state
}

// storage round trip: saveState's JSON.stringify, then loadState's migrateState.
const reload = (state) => migrateState(JSON.parse(JSON.stringify(state)))
// store.patchActive / store.completeSet merge.
const withActive = (state, patch) => ({ ...state, activeWorkout: { ...state.activeWorkout, ...patch } })
const itemA = (state) => state.activeWorkout.snapshot.items[0]

function logged(item, { setType = 'work', weight = 40, reps = 10, rpe = 3, note = '' } = {}) {
  return { routineItemId: itemKey(item), exerciseId: item.exerciseId, setType, weight, reps: String(reps), rpe: setType === 'wu' ? null : rpe, note, targetReps: '', targetWeight: null }
}

// The key WorkoutItemLive computes for the item's current set (setSeedKey).
function currentKey(state, item) {
  const { needsWu, currentWorkIndex } = itemLoggingState(state.activeWorkout, item)
  return setDraftKey(item, needsWu ? 'wu' : 'work', currentWorkIndex)
}

// What the form starts from, as item.jsx computes it: chain seed (with-history exercise,
// history kg 40) + the draft read for the current key.
function formFor(state, item, { history = { weight: '40' }, target = '8', override } = {}) {
  const seed = initialSetFields({ weighted: true, fromRestore: false, restore: null, hasHistory: true, history, carry: null, target, override })
  const draft = setDraftFor(state.activeWorkout, currentKey(state, item))
  return { seed, form: formFieldsWithDraft({ seed, draft, weighted: true, durationTarget: 30 }) }
}

// A: warm-up and working set 1 logged → set 2 is current.
function onSet2() {
  const state = baseState()
  const a = itemA(state)
  return withActive(state, { sets: [logged(a, { setType: 'wu', weight: 20 }), logged(a, { weight: 40, reps: 10 })] })
}

describe('req-125 setDraft — reload and navigation', () => {
  it('key names item | set kind | work index; a warm-up is always index 0', () => {
    const a = itemA(baseState())
    assert.equal(setDraftKey(a, 'work', 1), `${itemKey(a)}|work|1`)
    assert.equal(setDraftKey(a, 'wu', 3), `${itemKey(a)}|wu|0`)
  })

  it('typed 42 kg / 7 reps on set 2 survives a reload and seeds the form', () => {
    let state = onSet2()
    const a = itemA(state)
    const key = currentKey(state, a)
    assert.equal(key, `${itemKey(a)}|work|1`)
    state = withActive(state, { setDraft: setDraftFromForm(key, { weight: '42', reps: '7', effort: 4 }, 'felt heavy') })
    state = reload(state)
    assert.deepEqual(state.activeWorkout.setDraft, { key, weight: '42', reps: '7', effort: 4, note: 'felt heavy' })
    const { seed, form } = formFor(state, itemA(state))
    assert.deepEqual(form, { weight: '42', reps: '7', effort: 4, note: 'felt heavy', durationSec: 30 })
    // the chain seed is untouched by the draft
    assert.equal(seed.weight, '40')
    assert.equal(seed.reps, '8')
  })

  it('an old active workout (no setDraft) loads without one, and the form shows the seed', () => {
    const state = reload(onSet2())
    assert.equal('setDraft' in state.activeWorkout, false)
    assert.equal(setDraftFor(state.activeWorkout, currentKey(state, itemA(state))), null)
    const { seed, form } = formFor(state, itemA(state))
    assert.equal(form.weight, seed.weight)
    assert.equal(form.reps, seed.reps)
    assert.equal(form.effort, 3)
  })

  it('kg is gated by `weighted`; a timed draft keeps its typed seconds', () => {
    const seed = { weight: '', reps: '', effort: 3, note: '' }
    const draft = { key: 'k', weight: '42', reps: '', effort: '', durationSec: '45', note: '' }
    const form = formFieldsWithDraft({ seed, draft, weighted: false, durationTarget: 30 })
    assert.equal(form.weight, '')
    assert.equal(form.durationSec, '45')
    assert.equal(form.effort, 3) // an empty effort falls back to the seed's default
  })
})

describe('req-125 req-83 carry still compares against the chain seed', () => {
  it('draft 42 on set 2 (seed 40), Complete → set 3 seeds 42 via seedOverrides', () => {
    let state = reload(withActive(onSet2(), {}))
    const a = itemA(state)
    const key = currentKey(state, a)
    state = reload(withActive(state, { setDraft: setDraftFromForm(key, { weight: '42', reps: '8', effort: 3 }, '') }))
    const { seed, form } = formFor(state, itemA(state))
    assert.equal(seed.weight, '40')
    assert.equal(form.weight, '42')
    // completeSet: compare the logged values against `seed` (NOT the draft)
    const seedOverrides = nextSeedOverrides(state.activeWorkout.seedOverrides, {
      exerciseId: a.exerciseId,
      setType: 'work',
      weighted: true,
      seed,
      logged: { weight: form.weight, reps: form.reps },
    })
    assert.deepEqual(seedOverrides[seedOverrideKey(a.exerciseId, 'work')], { weight: '42' })
    state = { ...state, activeWorkout: withLoggedSet(state.activeWorkout, logged(a, { weight: 42, reps: 8 }), { seedOverrides }, key) }
    state = reload(state)
    assert.equal(currentKey(state, itemA(state)), `${itemKey(a)}|work|2`)
    const next = formFor(state, itemA(state), { target: '6', override: state.activeWorkout.seedOverrides[seedOverrideKey(a.exerciseId, 'work')] })
    assert.equal(next.seed.weight, '42')
    assert.equal(next.form.weight, '42')
    // the counterfactual the spec guards against: had the draft been the comparison
    // base, nothing would have carried
    const wrong = nextSeedOverrides({}, { exerciseId: a.exerciseId, setType: 'work', weighted: true, seed: form, logged: { weight: '42', reps: '8' } })
    assert.deepEqual(wrong, {})
  })
})

describe('req-125 cleared, stale, stripped', () => {
  it('Complete / Skip of the draft set clears it (gone from the saved JSON)', () => {
    let state = onSet2()
    const key = currentKey(state, itemA(state))
    state = withActive(state, { setDraft: setDraftFromForm(key, { weight: '42', reps: '7', effort: 3 }, '') })
    const next = withLoggedSet(state.activeWorkout, logged(itemA(state), { weight: 42, reps: 7 }), { restEndsAt: 1 }, key)
    assert.equal('setDraft' in next, false)
    assert.equal(next.sets.length, 3)
    assert.equal(next.restEndsAt, 1)
    assert.equal('setDraft' in reload({ ...state, activeWorkout: next }).activeWorkout, false)
    // without a draftKey the reducer is the old merge (sets appended, patch merged)
    const old = withLoggedSet(state.activeWorkout, logged(itemA(state)), { restEndsAt: 2 })
    assert.deepEqual(old, { ...state.activeWorkout, restEndsAt: 2, sets: [...state.activeWorkout.sets, logged(itemA(state))] })
  })

  it('a draft written AFTER the render snapshot is still cleared (decided from the latest state)', () => {
    const rendered = onSet2() // what the render saw: no draft yet
    const key = currentKey(rendered, itemA(rendered))
    assert.equal(rendered.activeWorkout.setDraft, undefined)
    // the debounced write lands in the same tick, queued ahead of Complete's update
    const latest = withActive(rendered, { setDraft: setDraftFromForm(key, { weight: '42', reps: '7', effort: 3 }, '') })
    const next = withLoggedSet(latest.activeWorkout, logged(itemA(latest), { weight: 42, reps: 7 }), {}, key)
    assert.equal('setDraft' in next, false)
    // …so Remove set / Skip exercise + reopen can't resurface it: nothing is left under that key
    assert.equal(setDraftFor({ ...next, sets: next.sets.slice(0, -1) }, key), null)
  })

  it('logging a DIFFERENT set leaves the draft alone; a draft whose key does not match is ignored', () => {
    let state = onSet2()
    const a = itemA(state)
    const draft = setDraftFromForm(currentKey(state, a), { weight: '42', reps: '7', effort: 3 }, '')
    state = withActive(state, { setDraft: draft })
    const other = withLoggedSet(state.activeWorkout, logged(state.activeWorkout.snapshot.items[1]), {}, `${itemKey(state.activeWorkout.snapshot.items[1])}|work|0`)
    assert.deepEqual(other.setDraft, draft)
    // set 2 logged elsewhere (e.g. the history editor path) → current is set 3 → ignored
    state = withActive(state, { sets: [...state.activeWorkout.sets, logged(a, { weight: 45, reps: 8 })] })
    assert.equal(setDraftFor(state.activeWorkout, currentKey(state, a)), null)
    const { seed, form } = formFor(state, a)
    assert.equal(form.weight, seed.weight)
    // item replaced (req-124): the replacement's key differs → ignored
    const rep = replacementItem({ id: 'rep-1', original: a, exercise: EXERCISES[1], restSec: 90 })
    assert.equal(setDraftFor(withActive(onSet2(), { setDraft: draft }).activeWorkout, setDraftKey(rep, 'work', 1)), null)
    // a non-object / keyless draft is ignored, never thrown on
    assert.equal(setDraftFor({ setDraft: 'x' }, 'k'), null)
    assert.equal(setDraftFor({ setDraft: { weight: '1' } }, 'k'), null)
  })

  it('finishedState drops setDraft from the history record', () => {
    let state = onSet2()
    state = withActive(state, { setDraft: setDraftFromForm(currentKey(state, itemA(state)), { weight: '42', reps: '7', effort: 3 }, 'x') })
    const done = finishedState(state, {}, '2026-09-23T11:00:00.000Z')
    assert.equal(done.activeWorkout, null)
    assert.equal('setDraft' in done.workouts[0], false)
    assert.equal('setDraft' in reload(done).workouts[0], false)
  })
})

describe('req-125 Previous writes the un-logged set as the draft', () => {
  it('log set 1, Previous, reload → set 1 values are in the form', () => {
    let state = baseState()
    const a = itemA(state)
    const set1 = logged(a, { weight: 45, reps: 9, rpe: 4, note: 'grip' })
    state = withActive(state, { sets: [logged(a, { setType: 'wu', weight: 20 }), set1] })
    // previousSet(): workIndex = workLogged.length - 1 BEFORE removal; remove; write draft
    const workIndex = itemLoggingState(state.activeWorkout, a).workLogged.length - 1
    const key = setDraftKey(a, 'work', workIndex)
    state = withActive(state, { sets: state.activeWorkout.sets.slice(0, 1) })
    state = withActive(state, { setDraft: setDraftFromLoggedSet(key, set1) })
    state = reload(state)
    assert.equal(currentKey(state, itemA(state)), key)
    const { form } = formFor(state, itemA(state), { target: '10' })
    assert.deepEqual(form, { weight: '45', reps: '9', effort: 4, note: 'grip', durationSec: 30 })
  })

  it('same values the old restore gave: skipped → empty, warm-up → seed effort, timed → its seconds', () => {
    const a = itemA(baseState())
    const skipped = setDraftFromLoggedSet('k', { ...logged(a), weight: 0, reps: 'skipped', rpe: null, note: 'skipped' })
    assert.deepEqual(skipped, { key: 'k', weight: '', reps: '', effort: '', note: '' })
    const wu = setDraftFromLoggedSet('k', logged(a, { setType: 'wu', weight: 20 }))
    assert.equal(formFieldsWithDraft({ seed: { weight: '', reps: '10', effort: 3, note: '' }, draft: wu, weighted: true, durationTarget: 30 }).effort, 3)
    const timed = setDraftFromLoggedSet('k', { ...logged(a, { reps: '' }), durationSec: 42 })
    assert.equal(timed.durationSec, 42)
    assert.equal(formFieldsWithDraft({ seed: { weight: '', reps: '', effort: 3, note: '' }, draft: timed, weighted: false, durationTarget: 30 }).durationSec, 42)
    // RPE 1 maps to the lowest segment, as initialSetFields did for restore
    assert.equal(setDraftFromLoggedSet('k', logged(a, { rpe: 1 })).effort, 2)
  })
})

describe('req-125 draft writer (debounced)', () => {
  function fakeTimers() {
    const timers = new Map()
    let id = 0
    return {
      setTimer: (fn) => {
        timers.set(++id, fn)
        return id
      },
      clearTimer: (t) => timers.delete(t),
      fire: () => [...timers.values()].forEach((fn) => fn()),
      count: () => timers.size,
    }
  }

  it('20 keystrokes → one write of the latest values once typing pauses', () => {
    const t = fakeTimers()
    const writes = []
    const w = createSetDraftWriter({ write: (d, sync) => writes.push([d, sync]), ...t })
    for (let i = 1; i <= 20; i++) w.form('k', { weight: String(i), reps: '7', effort: 3 }, '')
    assert.equal(writes.length, 0)
    assert.equal(t.count(), 1)
    t.fire()
    assert.deepEqual(writes, [[{ key: 'k', weight: '20', reps: '7', effort: 3, note: '' }, false]])
  })

  it('flush(true) writes a pending draft synchronously; cancel drops it; nothing pending → no write', () => {
    const t = fakeTimers()
    const writes = []
    const w = createSetDraftWriter({ write: (d, sync) => writes.push([d.weight, sync]), ...t })
    w.flush(true)
    assert.equal(writes.length, 0)
    w.form('k', { weight: '42', reps: '7', effort: 3 }, '')
    w.flush(true)
    assert.deepEqual(writes, [['42', true]])
    w.form('k', { weight: '43', reps: '7', effort: 3 }, '')
    w.cancel()
    t.fire()
    w.flush()
    assert.deepEqual(writes, [['42', true]])
  })

  it('a note edit carries the latest form values (or the start values before any edit)', () => {
    const t = fakeTimers()
    const writes = []
    const w = createSetDraftWriter({ write: (d) => writes.push(d), ...t })
    w.note('k', 'n', { weight: '40', reps: '8', effort: 3 })
    w.flush()
    assert.deepEqual(writes.at(-1), { key: 'k', weight: '40', reps: '8', effort: 3, note: 'n' })
    w.form('k', { weight: '42', reps: '8', effort: 3 }, 'n')
    w.note('k', 'no', { weight: '40', reps: '8', effort: 3 })
    w.flush()
    assert.deepEqual(writes.at(-1), { key: 'k', weight: '42', reps: '8', effort: 3, note: 'no' })
    // a new set key forgets the previous set's values
    w.note('k2', '', { weight: '50', reps: '6', effort: 3 })
    w.flush()
    assert.equal(writes.at(-1).weight, '50')
  })
})

describe('req-125 no mid-typing reset (static)', () => {
  const item = readFileSync(new URL('./views/workout/item.jsx', import.meta.url), 'utf8')
  const ui = readFileSync(new URL('./ui/index.jsx', import.meta.url), 'utf8')

  it('item.jsx reads the draft only in the setSeedKey-keyed snapshot, and keys the form by it', () => {
    const reads = item.split('\n').filter((line) => line.includes('setDraftFor('))
    assert.equal(reads.length, 3)
    for (const line of reads) assert.match(line, /setDraftFor\(active, setSeedKey\)/)
    assert.match(item, /if \(draftSnap\.key !== setSeedKey\) setDraftSnap\(/)
    assert.match(item, /key=\{setSeedKey\}/)
    // the form's initial values come from formInit (seed + snapshot), never active.setDraft
    assert.doesNotMatch(item, /active\.setDraft|activeWorkout\.setDraft/)
  })

  it('SetLogForm reads its initial* props only as useState initialisers', () => {
    const body = ui.slice(ui.indexOf('export function SetLogForm'))
    for (const prop of ['initialWeight', 'initialReps', 'initialDuration', 'initialEffort']) {
      const uses = body.split('\n').filter((line) => line.includes(prop) && !/^\s*initial\w+ = /.test(line))
      assert.equal(uses.length, 1, prop)
      assert.match(uses[0], /useState\(/, prop)
    }
  })
})

describe('req-125 Complete / Skip wiring (static)', () => {
  const item = readFileSync(new URL('./views/workout/item.jsx', import.meta.url), 'utf8')
  const store = readFileSync(new URL('./store.jsx', import.meta.url), 'utf8')
  const body = (name) => {
    const start = item.indexOf(`  function ${name}(`)
    assert.ok(start >= 0, name)
    return item.slice(start, item.indexOf('\n  }\n', start))
  }

  for (const name of ['completeSet', 'skipSet']) {
    it(`${name} cancels the pending write first, then logs with draftKey: setSeedKey`, () => {
      const src = body(name)
      const cancel = src.indexOf('draftWriter.cancel()')
      const log = src.indexOf('store.completeSet(')
      assert.ok(cancel >= 0, `${name} calls draftWriter.cancel()`)
      assert.ok(log > cancel, `${name} cancels before store.completeSet`)
      assert.match(src.slice(log), /\{ draftKey: setSeedKey \},?\s*\)/, `${name} passes draftKey to store.completeSet`)
    })
  }

  // req-164 — the updater moved to state-reducers.js (setLoggedState); the pin follows it:
  // the store delegates inside its functional update, and the reducer calls withLoggedSet.
  it('store.completeSet clears inside its functional update via withLoggedSet', () => {
    assert.match(store, /completeSet\(setRecord, activePatch = \{\}, \{ draftKey = null \} = \{\}\) \{\s*setState\(\(s\) => setLoggedState\(s, setRecord, activePatch, draftKey\)\)/)
    const reducers = readFileSync(new URL('./state-reducers.js', import.meta.url), 'utf8')
    assert.match(reducers, /export function setLoggedState\(s, setRecord, activePatch = \{\}, draftKey = null\) \{[\s\S]*?withLoggedSet\(s\.activeWorkout, setRecord, activePatch, draftKey\)/)
  })
})
