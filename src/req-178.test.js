// req-178 (DEC-096, DEC-100) — the routine sets the workout's weight: a work set seeds the
// routine's kg (not history's), the "update routine" offer carries today's kg back to that
// routine on a tap, and a one-time fill brings stored routine kg in line with history.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { linkSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { act, importJsx, render } from './test-support/render.js'
import { carryForSet, initialSetFields, nextSeedOverrides, replacementItem, routineKgFor, setPreview } from './workout-log.js'
import { historyPrescription, historySetPrefill, lastSetsForExercise } from './history-queries.js'
import { emptyState, getLoadUnreadable, loadState, saveState } from './persistence.js'
import { migrateState } from './model.js'
import { buildBackup, applyBackup } from './exchange.js'
import { replaceItemInState } from './state-reducers.js'
import { DEVICE_FILL_KEY, fillRoutineKgFromHistory } from './routine-kg-fill.js'
import { routineUpdateOffer } from './routine-update-offer.js'

const h = React.createElement
const DB = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
const work = (exerciseId, weight, reps = '8', extra = {}) => ({ exerciseId, setType: 'work', weight, reps: String(reps), rpe: 3, note: '', ...extra })
const finished = (id, sets, finishedAt = '2026-09-20T10:00:00Z', items = []) => ({ id, routineId: 'r', finishedAt, sets, snapshot: { items } })

// One set's form seed, the way item.jsx asks for it.
function seedFor(item, workouts, workIndex, { carry = null, override } = {}) {
  const last = lastSetsForExercise(workouts, item.exerciseId)
  return initialSetFields({
    weighted: true,
    fromRestore: false,
    restore: null,
    hasHistory: Boolean(last),
    history: historySetPrefill(last, { setType: 'work', workIndex }),
    carry,
    target: item.targets?.[workIndex] ?? '',
    override,
    routineKg: routineKgFor(item, 'work', workIndex),
  })
}

describe('req-178 AC1–4 — the seed: routine kg, not history', () => {
  const history = [finished('w1', [work('ex', 50), work('ex', 50), work('ex', 50)])]
  const item = { exerciseId: 'ex', routineItemId: 'ri', sets: 3, targets: ['8', '8', '8'], suggestedWeights: [60, 65, 70] }

  it('AC1: routine [60,65,70], history [50,50,50] → sets 1–3 seed 60/65/70', () => {
    assert.deepEqual([0, 1, 2].map((i) => seedFor(item, history, i).weight), ['60', '65', '70'])
  })

  it('AC2: the routine answers — routine 70 vs history 50 → 70; history alone would have said 50', () => {
    const one = { ...item, suggestedWeights: [70, 70, 70] }
    assert.equal(seedFor(one, history, 0).weight, '70')
    assert.equal(historySetPrefill(lastSetsForExercise(history, 'ex'), { setType: 'work', workIndex: 0 }).weight, '50')
  })

  it('AC3 (empty input): routine kg blank, history [80] → set 1 blank; log 40 → set 2 seeds 40', () => {
    const blank = { ...item, suggestedWeights: [] }
    const h80 = [finished('w1', [work('ex', 80)])]
    const first = seedFor(blank, h80, 0)
    assert.equal(first.weight, '')
    // The override path (req-83): 40 differs from the presented blank seed.
    const overrides = nextSeedOverrides({}, { exerciseId: 'ex', setType: 'work', weighted: true, seed: first, logged: { weight: '40' } })
    assert.equal(seedFor(blank, h80, 1, { override: overrides['ex::work'] }).weight, '40')
    // The carry path (DEC-002) alone gives the same.
    const carry = carryForSet('work', [{ setType: 'work', weight: 40, reps: '8' }])
    assert.equal(seedFor(blank, h80, 1, { carry }).weight, '40')
    // A routine kg beats the carry.
    assert.equal(seedFor({ ...item, suggestedWeights: [0, 55] }, h80, 1, { carry }).weight, '55')
  })

  it('AC4: preview lines equal each set\'s form seed; the warm-up stays on history', () => {
    const wuHistory = [finished('w1', [{ ...work('ex', 25), setType: 'wu' }, work('ex', 50), work('ex', 50), work('ex', 50)])]
    const withWu = { ...item, warmup: { reps: 10 } }
    const last = lastSetsForExercise(wuHistory, 'ex')
    const lines = setPreview({ item: withWu, ex: {}, weighted: true, hasHistory: true, historyFor: (at) => historySetPrefill(last, at) })
    assert.deepEqual(lines.map((l) => l.text), ['Warm-up · 25 kg × 10', '1 · 60 kg × 8', '2 · 65 kg × 8', '3 · 70 kg × 8'])
    lines.slice(1).forEach((line, i) => assert.equal(line.weight, seedFor(withWu, wuHistory, i).weight))
    assert.equal(routineKgFor(withWu, 'wu', 0), undefined, 'warm-up: no routine kg, history path')
  })
})

describe('req-178 step 2 — a mid-workout replacement takes its kg from history (DEC-096 §2)', () => {
  it('replaceItemInState → suggestedWeights [history set 1 kg]; no history → []', () => {
    const state = {
      ...emptyState(),
      exercises: [{ id: 'a', name: 'A', type: 'free' }, { id: 'b', name: 'B', type: 'free' }, { id: 'c', name: 'C', type: 'free' }],
      workouts: [finished('w1', [work('b', 42), work('b', 44)])],
      activeWorkout: { id: 'act', routineId: 'r', sets: [], snapshot: { routineId: 'r', items: [{ id: 'i1', routineItemId: 'i1', exerciseId: 'a', sets: 3 }] } },
    }
    const withB = replaceItemInState(state, 'i1', 'b', 'rep-1')
    assert.deepEqual(withB.activeWorkout.snapshot.items.find((i) => i.id === 'rep-1').suggestedWeights, [42])
    const withC = replaceItemInState(state, 'i1', 'c', 'rep-2')
    assert.deepEqual(withC.activeWorkout.snapshot.items.find((i) => i.id === 'rep-2').suggestedWeights, [])
    assert.deepEqual(replacementItem({ id: 'x', original: null, exercise: { id: 'c' } }).suggestedWeights, [])
  })
})

describe('req-178 AC5 — the "update routine" offer', () => {
  const routines = [
    { id: 'dayA', name: 'Day A', exercises: [{ id: 'ia', exerciseId: 'ex', sets: 3, suggestedWeights: [100, 100, 100] }] },
    { id: 'dayB', name: 'Day B', exercises: [{ id: 'ib', exerciseId: 'ex', sets: 3, suggestedWeights: [100, 100, 100] }] },
  ]
  const item = { id: 'ia', routineItemId: 'ia', exerciseId: 'ex', exerciseType: 'free', sets: 3 }
  const logged = (kgs, extra = {}) => kgs.map((kg) => work('ex', kg, 8, { routineItemId: 'ia', ...extra }))
  const active = (sets) => ({ routineId: 'dayA', snapshot: { routineId: 'dayA', items: [item] }, sets })

  it('logged [105,105,100] vs routine [100,100,100] → to [105,105,100] for Day A\'s item', () => {
    assert.deepEqual(routineUpdateOffer(active(logged([105, 105, 100])), routines, item), {
      routineId: 'dayA',
      routineName: 'Day A',
      itemId: 'ia',
      from: [100, 100, 100],
      to: [105, 105, 100],
    })
  })

  it('null: equal kg / all skipped / replacement / deleted or archived routine / unweighted', () => {
    assert.equal(routineUpdateOffer(active(logged([100, 100, 100])), routines, item), null)
    assert.equal(routineUpdateOffer(active(logged([0, 0, 0], { reps: 'skipped', note: 'skipped' })), routines, item), null)
    assert.equal(routineUpdateOffer(active(logged([105])), routines, { ...item, addedMidWorkout: true }), null)
    assert.equal(routineUpdateOffer(active(logged([105])), routines.slice(1), item), null)
    assert.equal(routineUpdateOffer(active(logged([105])), [{ ...routines[0], archivedAt: '2026-09-01' }], item), null)
    assert.equal(routineUpdateOffer(active(logged([105])), [{ ...routines[0], exercises: [] }], item), null)
    assert.equal(routineUpdateOffer(active(logged([105])), routines, { ...item, exerciseType: 'bodyweight' }), null)
  })

  it('applying it (store.applyRoutineUpdate) changes Day A\'s item only; Day B\'s same exercise is unchanged', async () => {
    localStorage.clear()
    const state = { ...emptyState(), routines }
    localStorage.setItem(DEVICE_FILL_KEY, '2026-09-26T00:00:00.000Z')
    localStorage.setItem('workout-mvp-v9', JSON.stringify(state))
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { useStore } = await import('./store-context.js')
    const captured = {}
    function Grab() {
      // oxlint-disable-next-line react/immutability
      captured.store = useStore()
      return null
    }
    const view = await render(h(StoreProvider, null, h(Grab)))
    const offer = routineUpdateOffer(active(logged([105, 105, 100])), captured.store.routines, item)
    await act(async () => captured.store.applyRoutineUpdate(offer))
    const saved = JSON.parse(localStorage.getItem('workout-mvp-v9')).routines
    assert.deepEqual(saved[0].exercises[0].suggestedWeights, [105, 105, 100])
    assert.deepEqual(saved[1].exercises[0].suggestedWeights, [100, 100, 100])
    assert.deepEqual([saved[0].exercises[0].id, saved[0].exercises[0].exerciseId, saved[0].exercises[0].sets], ['ia', 'ex', 3])
    await view.unmount()
  })
})

describe('req-178 AC6 / AC8 — the one-time fill', () => {
  const state = () => ({
    ...emptyState(),
    exercises: [
      { id: 'w', name: 'Press', type: 'free' },
      { id: 'bw', name: 'Push-up', type: 'bodyweight' },
      { id: 'never', name: 'New', type: 'machine' },
      { id: 'short', name: 'Short', type: 'machine' },
    ],
    routines: [
      {
        id: 'r1',
        name: 'Day A',
        exercises: [
          { id: 'i-w', exerciseId: 'w', sets: 3, targets: ['8', '8', '8'], suggestedWeights: [40, 40, 40], restSec: 90, notes: 'n' },
          { id: 'i-bw', exerciseId: 'bw', sets: 2, suggestedWeights: [] },
          { id: 'i-never', exerciseId: 'never', sets: 3, suggestedWeights: [30, 30, 30] },
          { id: 'i-short', exerciseId: 'short', sets: 3, suggestedWeights: [] },
        ],
      },
    ],
    workouts: [
      finished('old', [work('w', 30), work('w', 30), work('w', 30)], '2026-09-01T10:00:00Z'),
      finished('new', [work('w', 45), work('w', 47.5), work('w', 0, 'skipped', { note: 'skipped' }), work('bw', 0, 12), work('short', 20)]),
    ],
  })

  it('overwrite: latest history kg per set (> 0); a skipped / missing set keeps the routine; others untouched', () => {
    const before = state()
    const { state: after, changes } = fillRoutineKgFromHistory(before)
    const items = Object.fromEntries(after.routines[0].exercises.map((i) => [i.id, i]))
    assert.deepEqual(items['i-w'].suggestedWeights, [45, 47.5, 40], 'set 3 was skipped: routine kept')
    assert.deepEqual(items['i-short'].suggestedWeights, [20], 'blank routine filled at set 1 only')
    assert.deepEqual(changes.map((c) => [c.itemId, c.from, c.to]), [['i-w', [40, 40, 40], [45, 47.5, 40]], ['i-short', [], [20]]])
    // AC8 — never logged, and bodyweight: untouched (same object).
    assert.equal(items['i-never'], before.routines[0].exercises[2])
    assert.equal(items['i-bw'], before.routines[0].exercises[1])
    assert.deepEqual({ ...items['i-w'], suggestedWeights: null }, { ...before.routines[0].exercises[0], suggestedWeights: null })
    for (const key of ['workouts', 'exercises', 'schedule']) assert.equal(after[key], before[key], key)
    assert.equal('routineKgFilledAt' in after, false, 'no marker in the state document')
    assert.equal(fillRoutineKgFromHistory(after).changes.length, 0, 'idempotent on its own output')
  })

  it('blanks (Q1 b, dry run only): only items with no kg at all', () => {
    const { changes } = fillRoutineKgFromHistory(state(), { mode: 'blanks' })
    assert.deepEqual(changes.map((c) => c.itemId), ['i-short'])
  })

  it('AC6: through loadState — fills once, saves, sets the DEVICE marker key; a second load writes nothing', () => {
    localStorage.clear()
    localStorage.setItem('workout-mvp-v9', JSON.stringify(state()))
    const first = loadState()
    assert.deepEqual(first.routines[0].exercises[0].suggestedWeights, [45, 47.5, 40])
    const marker = localStorage.getItem(DEVICE_FILL_KEY)
    assert.ok(marker, 'device marker set')
    const disk = localStorage.getItem('workout-mvp-v9')
    assert.deepEqual(JSON.parse(disk).routines[0].exercises[0].suggestedWeights, [45, 47.5, 40], 'saved')
    assert.equal('routineKgFilledAt' in JSON.parse(disk), false)
    const edited = JSON.parse(disk)
    edited.routines[0].exercises[0].suggestedWeights = [99, 99, 99]
    localStorage.setItem('workout-mvp-v9', JSON.stringify(edited))
    const again = loadState()
    assert.deepEqual(again.routines[0].exercises[0].suggestedWeights, [99, 99, 99])
    assert.equal(localStorage.getItem('workout-mvp-v9'), JSON.stringify(edited), 'nothing written')
    assert.equal(localStorage.getItem(DEVICE_FILL_KEY), marker, 'marker unchanged')
  })

  it('review blocker: an Import of a doc without any marker after the fill → reload → kg unchanged', () => {
    // The assistant round trip: Export → assistant (returns the state, sets biceps 20/20/20,
    // knows nothing of any marker) → Import → reload. The device marker survives the Import.
    localStorage.clear()
    localStorage.setItem('workout-mvp-v9', JSON.stringify(state()))
    loadState() // the fill runs once
    const reply = JSON.parse(JSON.stringify(buildBackup(state())))
    reply.state.routines[0].exercises[0].suggestedWeights = [20, 20, 20]
    const { state: imported } = applyBackup(reply)
    localStorage.setItem('workout-mvp-v9', JSON.stringify(imported)) // commitBackup → setState → saveState
    const reloaded = loadState()
    assert.deepEqual(reloaded.routines[0].exercises[0].suggestedWeights, [20, 20, 20], 'not re-filled from history')
    assert.equal(localStorage.getItem('workout-mvp-v9'), JSON.stringify(imported), 'nothing written')
  })

  it('re-review: the load-time save fails (quota) → the first later successful save sets the marker → reload keeps the edit', () => {
    // A Map-backed localStorage whose v9 setItem throws (quota) only during the first load.
    const previous = globalThis.localStorage
    const map = new Map([['workout-mvp-v9', JSON.stringify(state())]])
    let failV9 = true
    globalThis.localStorage = {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => {
        if (failV9 && key === 'workout-mvp-v9') throw new Error('QuotaExceededError')
        map.set(key, String(value))
      },
      removeItem: (key) => map.delete(key),
    }
    try {
      const loaded = loadState()
      failV9 = false
      assert.deepEqual(loaded.routines[0].exercises[0].suggestedWeights, [45, 47.5, 40], 'filled in memory')
      assert.equal(map.get(DEVICE_FILL_KEY), undefined, 'not marked while the fill is not on disk')
      // The user edits a routine kg; the store saves (this save works).
      const edited = structuredClone(loaded)
      edited.routines[0].exercises[0].suggestedWeights = [25, 25, 25]
      assert.equal(saveState(edited), true)
      assert.ok(map.get(DEVICE_FILL_KEY), 'marked on the first successful save')
      assert.deepEqual(loadState().routines[0].exercises[0].suggestedWeights, [25, 25, 25], 'the edit survives the reload')
    } finally {
      globalThis.localStorage = previous
    }
  })

  it('a blank device sets the marker at start, so a routine typed on it is never filled later', () => {
    localStorage.clear()
    loadState()
    assert.ok(localStorage.getItem(DEVICE_FILL_KEY))
    localStorage.setItem('workout-mvp-v9', JSON.stringify(state()))
    assert.deepEqual(loadState().routines[0].exercises[0].suggestedWeights, [40, 40, 40])
  })

  it('review latent: a throw in the fill → readable data loads, no "unreadable", no marker, logged', () => {
    localStorage.clear()
    localStorage.setItem('workout-mvp-v9', JSON.stringify(state()))
    const errors = []
    const original = console.error
    console.error = (...args) => errors.push(args.join(' '))
    // Make only the fill throw: its history lookup sorts workouts (finishedNewestFirst);
    // parse / migrate / anchor don't sort, so the load itself stays readable. The logged
    // line proves the throw came from the fill.
    const sort = Array.prototype.sort
    Array.prototype.sort = function () {
      throw new Error('boom')
    }
    let loaded
    try {
      loaded = loadState()
    } finally {
      Array.prototype.sort = sort
      console.error = original
    }
    assert.equal(getLoadUnreadable(), false, 'no unreadable banner')
    assert.deepEqual(loaded.routines[0].exercises[0].suggestedWeights, [40, 40, 40], 'loaded, unfilled')
    assert.equal(localStorage.getItem(DEVICE_FILL_KEY), null, 'no marker: retried next load')
    assert.ok(errors.some((line) => line.includes('routine kg fill skipped')), 'logged')
    // Next load (no throw) fills.
    assert.deepEqual(loadState().routines[0].exercises[0].suggestedWeights, [45, 47.5, 40])
    assert.ok(localStorage.getItem(DEVICE_FILL_KEY))
  })

  it('no marker field travels in the state: migrateState / Export → Import carry none', () => {
    const { state: imported } = applyBackup(JSON.parse(JSON.stringify(buildBackup(state()))))
    assert.equal('routineKgFilledAt' in imported, false)
  })
})

describe('req-178 AC7 — migration: a workout-mvp-v8 key → migrated, filled, saved to v9', () => {
  it('workouts and sets deep-equal before and after; only suggestedWeights of the listed items changed; v8 removed after read-back', () => {
    localStorage.clear()
    localStorage.setItem('workout-mvp-v8', JSON.stringify(DB))
    const loaded = loadState()
    const migrated = migrateState(structuredClone(DB), { legacy: true })
    const { changes } = fillRoutineKgFromHistory(migrated)
    assert.equal(changes.length, 12)
    assert.deepEqual(loaded.workouts, migrated.workouts, 'every workout and set unchanged')
    const changed = new Set(changes.map((c) => c.itemId))
    loaded.routines.forEach((routine, r) =>
      routine.exercises.forEach((item, i) => {
        const was = migrated.routines[r].exercises[i]
        assert.deepEqual({ ...item, suggestedWeights: null }, { ...was, suggestedWeights: null }, item.id)
        if (changed.has(item.id)) assert.deepEqual(item.suggestedWeights, changes.find((c) => c.itemId === item.id).to)
        else assert.deepEqual(item.suggestedWeights, was.suggestedWeights)
      }),
    )
    const v9 = JSON.parse(localStorage.getItem('workout-mvp-v9'))
    assert.deepEqual(v9.routines, JSON.parse(JSON.stringify(loaded.routines)), 'saved to v9')
    assert.ok(localStorage.getItem(DEVICE_FILL_KEY), 'device marker set')
    assert.equal(localStorage.getItem('workout-mvp-v8'), null, 'v8 removed after the v9 read-back')
    // A second load: nothing written, nothing changed.
    const disk = localStorage.getItem('workout-mvp-v9')
    assert.deepEqual(JSON.parse(JSON.stringify(loadState())), JSON.parse(disk))
    assert.equal(localStorage.getItem('workout-mvp-v9'), disk)
  })
})

describe('req-178 AC9 — the dry-run script (same function, read-only)', () => {
  it('node scripts/fill-routine-kg.mjs src/db.json → 12 under (a), and the file is untouched', () => {
    const path = new URL('./db.json', import.meta.url).pathname
    const before = readFileSync(path, 'utf8')
    const run = spawnSync(process.execPath, [new URL('../scripts/fill-routine-kg.mjs', import.meta.url).pathname, path], { encoding: 'utf8' })
    assert.equal(run.status, 0, run.stderr)
    assert.match(run.stdout, /\(a\) overwrite — the shipped rule \(DEC-100\): 12 item\(s\) change/)
    assert.match(run.stdout, /Lower Body · Leg Extension: \[20, 24, 24\] → \[18, 22, 25\]/)
    assert.equal(readFileSync(path, 'utf8'), before)
  })

  it('--out writes a filled COPY: the input sha unchanged, the output has the filled kg; --out = input refused', () => {
    const path = new URL('./db.json', import.meta.url).pathname
    const sha = () => createHash('sha256').update(readFileSync(path)).digest('hex')
    const before = sha()
    const dir = mkdtempSync(join(tmpdir(), 'fill-'))
    const out = join(dir, 'filled.json')
    const script = new URL('../scripts/fill-routine-kg.mjs', import.meta.url).pathname
    const run = spawnSync(process.execPath, [script, path, '--out', out], { encoding: 'utf8' })
    assert.equal(run.status, 0, run.stderr)
    assert.equal(sha(), before, 'input untouched')
    const { state: copy } = applyBackup(JSON.parse(readFileSync(out, 'utf8')))
    const leg = copy.routines.find((r) => r.id === 'sess-lower').exercises.find((i) => i.exerciseId === 'ex-leg-extension')
    assert.deepEqual(leg.suggestedWeights, [18, 22, 25])
    assert.equal(fillRoutineKgFromHistory(copy).changes.length, 0, 'the copy is already filled')
    assert.deepEqual(copy.workouts, applyBackup(JSON.parse(readFileSync(path, 'utf8'))).state.workouts, 'history untouched')
    const refused = spawnSync(process.execPath, [script, path, '--out', path], { encoding: 'utf8' })
    assert.equal(refused.status, 1)
    // A hard link to the input is the same file too (re-review nit): refused.
    const hard = join(dir, 'hard-link.json')
    linkSync(path, hard)
    const refusedLink = spawnSync(process.execPath, [script, path, '--out', hard], { encoding: 'utf8' })
    assert.equal(refusedLink.status, 1, refusedLink.stdout)
    assert.equal(sha(), before)
  })
})

describe('req-178 DEC-096 §2 — adding to a routine prefills kg from latest history', () => {
  let view
  afterEach(async () => {
    await view?.unmount()
    view = null
  })
  it('RoutineExerciseNew for Leg Press → Save → stored suggestedWeights = historyPrescription\'s', async () => {
    localStorage.clear()
    localStorage.setItem(DEVICE_FILL_KEY, '2026-09-26T00:00:00.000Z')
    localStorage.setItem('workout-mvp-v9', JSON.stringify(migrateState(structuredClone(DB), { legacy: true })))
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { RoutineExerciseNew } = await importJsx('./views/Routine.jsx', import.meta.url)
    view = await render(h(StoreProvider, null, h(RoutineExerciseNew, { routineId: 'sess-upper', exerciseId: 'ex-leg-press' })))
    await view.click(view.button('Save'))
    const stored = JSON.parse(localStorage.getItem('workout-mvp-v9'))
    const expected = historyPrescription(stored.workouts, 'ex-leg-press').suggestedWeights
    assert.ok(expected.some((kg) => kg > 0))
    assert.deepEqual(stored.routines.find((r) => r.id === 'sess-upper').exercises.at(-1).suggestedWeights, expected)
  })
})

describe('req-178 AC10 (rendered) — Start → the set shows the routine kg → log → the offer → tap', () => {
  let view
  afterEach(async () => {
    await view?.unmount()
    view = null
  })
  // req-182 (sanctioned edit) — the offer's words: "You lifted … · routine says …", "Save to Day A",
  // then "Saved to Day A."; on the summary an open offer stops the countdown.
  it('routine kg 50, history 40 → set 1 shows 50; log 55 → overview offers "Save to Day A" → routine 55', async () => {
    const ex = (id, name) => ({ id, name, type: 'machine', equipment: 'Machine', weightStep: 'n/a', muscles: '', cues: '' })
    const state = {
      ...emptyState(),
      exercises: [ex('ex-a', 'Row Machine'), ex('ex-b', 'Leg Curl')],
      routines: [
        {
          id: 'dayA',
          name: 'Day A',
          focus: 'Machines',
          exercises: [
            { id: 'ia', exerciseId: 'ex-a', role: 'main', restSec: 0, notes: '', warmup: null, sets: 1, targets: ['8'], suggestedWeights: [50], durations: [] },
            { id: 'ib', exerciseId: 'ex-b', role: 'main', restSec: 0, notes: '', warmup: null, sets: 1, targets: ['8'], suggestedWeights: [30], durations: [] },
          ],
        },
      ],
      workouts: [finished('w0', [work('ex-a', 40, 8, { routineItemId: 'ia' }), work('ex-b', 30, 8, { routineItemId: 'ib' })])],
    }
    localStorage.clear()
    localStorage.setItem(DEVICE_FILL_KEY, '2026-09-26T00:00:00.000Z')
    localStorage.setItem('workout-mvp-v9', JSON.stringify(state))
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { useStore } = await import('./store-context.js')
    const { WorkoutItemLog } = await importJsx('./views/workout/item.jsx', import.meta.url)
    const { Workout } = await importJsx('./views/workout/overview.jsx', import.meta.url)
    const captured = {}
    function Screen({ child }) {
      // oxlint-disable-next-line react/immutability
      captured.store = useStore()
      return child
    }
    const mount = async (child) => {
      await view?.unmount()
      view = await render(h(StoreProvider, null, h(Screen, { child })))
    }
    await mount(null)
    await act(async () => captured.store.startWorkout('dayA'))
    await mount(h(WorkoutItemLog, { routineId: 'dayA', itemId: 'ia' }))
    assert.equal(view.input('kg').value, '50', 'the routine kg, not history\'s 40')
    await view.type(view.input('kg'), '55')
    await view.click(view.button('Complete'))
    await mount(h(Workout, { routineId: 'dayA' }))
    assert.match(view.text(), /You lifted 55 kg · routine says 50 kg/)
    assert.ok(view.button('Save to Day A'))
    // Leg Curl not done yet: no offer for it.
    assert.equal(view.all('button').filter((b) => b.textContent.startsWith('Save to')).length, 1)
    await view.click(view.button('Save to Day A'))
    const saved = () => JSON.parse(localStorage.getItem('workout-mvp-v9')).routines[0].exercises
    assert.deepEqual(saved()[0].suggestedWeights, [55])
    assert.equal(view.button('Save to Day A'), null, 'button gone once saved')
    assert.match(view.text(), /Saved to Day A\./)
    // The last exercise: done → the auto-finish summary shows (not the list), and carries its offer.
    await mount(h(WorkoutItemLog, { routineId: 'dayA', itemId: 'ib' }))
    await view.type(view.input('kg'), '32,5')
    await view.click(view.button('Complete'))
    await mount(h(Workout, { routineId: 'dayA' }))
    assert.match(view.text(), /Great job!/)
    assert.match(view.text(), /You lifted 32\.5 kg · routine says 30 kg/)
    await view.click(view.button('Save to Day A'))
    assert.deepEqual(saved()[1].suggestedWeights, [32.5])
    assert.deepEqual(saved()[0].suggestedWeights, [55])
  })
})
