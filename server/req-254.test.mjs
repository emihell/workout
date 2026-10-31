// req-254 — `ops plan build`: Coach's change list → a checked plan file that `ops plan preview` accepts.
// Temp data dirs only (BACKEND rule 8); the CLI runs with WORKOUT_DATA_DIR set to one.
import { tempDir } from './test-helpers.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fullState } from '../src/test-support/full-state.js'
import { groupSetsByExercise, historyPrescription } from '../src/history-queries.js'
import { pickerItem } from '../src/routine-picker.js'
import { bootstrapUser, findUser } from './auth.mjs'
import { DB_FILE } from './config.mjs'
import { openDataDir } from './db.mjs'
import { buildPlan, onlyNamedChanged } from './plan-build.mjs'
import { readPlanFile } from './plan.mjs'
import { getState, putState } from './store.mjs'

const CLI = fileURLToPath(new URL('./ops-cli.mjs', import.meta.url))
const LIBRARY = JSON.parse(readFileSync(new URL('../src/library/exercises.json', import.meta.url), 'utf8'))
// A hidden entry with no merge target, and a merged one (its target named in the refusal).
const HIDDEN = LIBRARY.find((e) => e.hidden && !e.mergedInto).id
const T0 = new Date('2026-10-20T10:00:00.000Z')
const NOW = '2026-10-31T12:00:00.000Z'

// req-245's phoneState (fullState, no workout in progress) plus two routines and a slot, so a
// routine can be archived while the one with history stays, and one routine is never named.
function phoneState() {
  const s = { ...fullState(), activeWorkout: null }
  s.routines.push(
    { id: 'rtn-old', name: 'Legs old', focus: 'Legs', archivedAt: null, exercises: [{ id: 'si-row-old', exerciseId: 'ex-row', role: 'main', restSec: 60, notes: '', warmup: null, sets: 2, targets: ['12', '12'], suggestedWeights: [], durations: [] }] },
    { id: 'rtn-core', name: 'Core', focus: 'Core', archivedAt: null, exercises: [{ id: 'si-plank-core', exerciseId: 'ex-plank', role: 'main', restSec: 45, notes: '', warmup: null, sets: 2, targets: [], suggestedWeights: [], durations: [40, 40] }] },
  )
  s.schedule.slots.push({ id: 'slot-old', week: 0, weekday: 3, routineId: 'rtn-old' }, { id: 'slot-core', week: 0, weekday: 5, routineId: 'rtn-core' })
  return s
}

async function seeded(state = phoneState()) {
  const dataDir = tempDir('workout-req254-')
  const deps = openDataDir(dataDir)
  await bootstrapUser(deps.db, { username: 'emilio', password: 'sixsix' })
  const id = findUser(deps.db, 'emilio').id
  putState(deps.db, id, { baseRev: 0, state }, T0)
  const base = getState(deps.db, id).state
  deps.db.close() // closed: the DB file's bytes are the whole state
  return { dataDir, base, dbFile: join(dataDir, DB_FILE), cleanup: () => rmSync(dataDir, { recursive: true, force: true }) }
}

const cli = (dataDir, ...args) => spawnSync(process.execPath, [CLI, 'plan', ...args], { encoding: 'utf8', env: { ...process.env, WORKOUT_DATA_DIR: dataDir } })
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const changesFile = (dir, changes, name = 'changes.json') => {
  const file = join(dir, name)
  writeFileSync(file, JSON.stringify({ kind: 'workout-plan-changes', version: 1, changes }, null, 2))
  return file
}
const counter = () => {
  let n = 0
  return (prefix) => `${prefix}-t${++n}`
}
const build = (base, changes) => buildPlan(base, { kind: 'workout-plan-changes', version: 1, changes }, { library: LIBRARY, makeId: counter(), now: NOW })

// AC1's change list: one item's kg and rest, a library exercise added to a routine, a routine archived, the schedule set.
const AC1_CHANGES = [
  { op: 'exercise.add', ref: 'rdl', libraryId: 'Romanian_Deadlift', set: { weightStep: '2.5' } },
  { op: 'item.set', routine: 'Upper', exercise: 'Chest Press', set: { suggestedWeights: [25, 25], restSec: 120 } },
  { op: 'routine.items', routine: 'rtn-a', items: [{ exercise: 'Bike' }, { exercise: 'ex-press' }, { exercise: 'Plank' }, { exercise: 'rdl' }] },
  { op: 'routine.archive', routine: 'Legs old' },
  { op: 'schedule.set', loopWeeks: 1, slots: [{ week: 0, weekday: 1, routine: 'Upper' }, { week: 0, weekday: 5, routine: 'Core' }, { week: 0, weekday: 4, routine: 'Upper' }] },
]

const countsBlock = (stdout) => stdout.slice(stdout.indexOf('\ncounts\n'), stdout.indexOf('workout in progress'))

test('AC1 + AC6 + AC8 — build exits 0, writes a file preview accepts with no refusals and the same counts; the DB is byte-unchanged', async () => {
  const s = await seeded()
  const dir = tempDir('workout-req254-file-')
  try {
    const before = sha(s.dbFile)
    const out = join(dir, 'plan.json')
    const b = cli(s.dataDir, 'build', changesFile(dir, AC1_CHANGES), '--out', out)
    console.log(b.stdout)
    assert.equal(b.status, 0, b.stdout + b.stderr)
    assert.match(b.stdout, /^built on rev 1 for emilio$/m)
    assert.match(b.stdout, /^ {2}Upper · Chest Press: kg 20\/20 → 25\/25; rest 90 → 120$/m)
    assert.match(b.stdout, /^ {4}Upper · \+ item Romanian Deadlift \(starting plan, no kg\)$/m)
    assert.match(b.stdout, /^ {2}routine Legs old: archived/m)
    assert.match(b.stdout, /^next: \.\/server\/ops plan preview .*plan\.json$/m)
    assert.ok(existsSync(out))
    assert.equal(sha(s.dbFile), before, 'AC6: workout.db byte-unchanged by build')

    const p = cli(s.dataDir, 'preview', out)
    console.log(p.stdout)
    assert.equal(p.status, 0, p.stdout + p.stderr)
    assert.doesNotMatch(p.stdout, /REFUSED/)
    assert.equal(countsBlock(p.stdout), countsBlock(b.stdout), 'preview’s counts = the ones build printed')
    assert.match(p.stdout, /^ {2}routines: 0 added, 2 changed, 0 removed, 1 archived$/m)
    assert.match(p.stdout, /^ {2}exercises: 1 added, 0 changed, 0 removed$/m)
    assert.match(p.stdout, /^ {2}schedule slots: 3 → 3$/m)
    assert.equal(sha(s.dbFile), before)
  } finally {
    s.cleanup()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('AC2 — only what was named: unnamed records deep-equal, the edited item keeps its id, workouts deep-equal', async () => {
  const s = await seeded()
  const r = build(s.base, AC1_CHANGES)
  assert.deepEqual(r.refusals, [])
  const file = readPlanFile(r.file)
  for (const state of [r.state, file]) {
    const ex = new Map(state.exercises.map((e) => [e.id, e]))
    for (const e of s.base.exercises) assert.deepEqual(ex.get(e.id), e, `exercise ${e.id} unchanged`)
    assert.deepEqual(state.routines.find((x) => x.id === 'rtn-core'), s.base.routines.find((x) => x.id === 'rtn-core'), 'unnamed routine unchanged')
    const upper = state.routines.find((x) => x.id === 'rtn-a')
    const press = upper.exercises.find((i) => i.exerciseId === 'ex-press')
    assert.equal(press.id, 'si-press', 'the edited item keeps its id')
    assert.deepEqual(press.suggestedWeights, [25, 25])
    assert.equal(press.restSec, 120)
    assert.deepEqual(upper.exercises.map((i) => i.id).slice(0, 3), ['si-bike', 'si-press', 'si-plank'])
    assert.deepEqual(upper.exercises[0], s.base.routines[0].exercises[0], 'an item listed with no fields is kept as it was')
    assert.equal(state.routines.find((x) => x.id === 'rtn-old').archivedAt, NOW)
    const slots = new Map(state.schedule.slots.map((x) => [x.id, x]))
    assert.deepEqual(slots.get('slot-a'), s.base.schedule.slots[0], 'a slot equal to a current one keeps its id')
    assert.deepEqual(slots.get('slot-core'), s.base.schedule.slots[2])
    assert.ok(!slots.has('slot-old'))
    assert.deepEqual(state.schedule.moves, s.base.schedule.moves)
    assert.equal(state.schedule.anchor, s.base.schedule.anchor)
    for (const k of ['workouts', 'draftWorkouts', 'activeWorkout', 'plannedWorkouts', 'legacyRecommendations']) assert.deepEqual(state[k], s.base[k], k)
  }
  s.cleanup()
})

test('AC3 — C2 from the two states: an unnamed routine’s altered item is refused, naming that routine', async () => {
  const s = await seeded()
  const r = build(s.base, AC1_CHANGES)
  const named = { exercises: new Set(r.state.exercises.filter((e) => !s.base.exercises.some((b) => b.id === e.id)).map((e) => e.id)), routines: new Set(['rtn-a', 'rtn-old']), schedule: true }
  assert.deepEqual(onlyNamedChanged(s.base, r.state, named), [], 'the real result passes')
  const tampered = structuredClone(r.state)
  tampered.routines.find((x) => x.id === 'rtn-core').exercises[0].restSec = 10
  const out = onlyNamedChanged(s.base, tampered, named)
  assert.equal(out.length, 1)
  assert.match(out[0], /^C2: routine rtn-core "Core" changed, but no change names it\.$/)
  // and an unnamed exercise, a deleted routine, a schedule edit without schedule.set
  const t2 = structuredClone(s.base)
  t2.exercises[1].cues = 'x'
  t2.routines = t2.routines.filter((x) => x.id !== 'rtn-core')
  t2.schedule.loopWeeks = 2
  const out2 = onlyNamedChanged(s.base, t2, { exercises: new Set(), routines: new Set(), schedule: false })
  assert.ok(out2.some((m) => /exercise ex-plank "Plank" changed/.test(m)))
  assert.ok(out2.some((m) => /routine rtn-core "Core" was removed/.test(m)))
  assert.ok(out2.some((m) => /loopWeeks changed/.test(m)))
  s.cleanup()
})

test('AC4 — a new item comes from pickerItem: history → its values, "from history"; none → blank kg, "starting plan"; kg 40 there → C5', async () => {
  const s = await seeded()
  const press = s.base.exercises.find((e) => e.id === 'ex-press')
  assert.ok(historyPrescription(s.base.workouts, 'ex-press'), 'Chest Press has history')
  const r = build(s.base, [
    { op: 'exercise.add', ref: 'rdl', libraryId: 'Romanian_Deadlift' },
    { op: 'routine.add', ref: 'B', name: 'Push B', focus: 'Push', items: [{ exercise: 'Chest Press' }, { exercise: 'rdl' }] },
  ])
  assert.deepEqual(r.refusals, [])
  const b = r.state.routines.find((x) => x.name === 'Push B')
  const { id: _a, exerciseId: _b, ...pressItem } = b.exercises[0]
  const expected = pickerItem(s.base.workouts, press).item
  for (const [k, v] of Object.entries(expected)) assert.deepEqual(pressItem[k], v, k)
  assert.deepEqual(pressItem.suggestedWeights, [20, 20])
  assert.match(b.exercises[0].id, /^si-/)
  assert.deepEqual(b.exercises[1].suggestedWeights, [])
  assert.deepEqual(b.exercises[1].targets, ['10', '10', '10'])
  assert.ok(r.lines.includes('  Push B · + item Chest Press (from history: 2 × 10/9 · 20 kg)'), r.lines.join('\n'))
  assert.ok(r.lines.includes('  Push B · + item Romanian Deadlift (starting plan, no kg)'), r.lines.join('\n'))

  const c5 = build(s.base, [
    { op: 'exercise.add', ref: 'rdl', libraryId: 'Romanian_Deadlift' },
    { op: 'routine.items', routine: 'Upper', items: [{ exercise: 'Bike' }, { exercise: 'Chest Press' }, { exercise: 'Plank' }, { exercise: 'rdl', suggestedWeights: [40, 40, 40] }] },
  ])
  assert.equal(c5.file, null)
  assert.equal(c5.refusals.length, 1)
  assert.match(c5.refusals[0], /^Upper · Romanian Deadlift: kg 40\/40\/40 on Romanian Deadlift, which has no logged history/)
  s.cleanup()
})

test('AC5 — failure cases: exit 1, the refusal on screen, no --out file', async () => {
  const s = await seeded()
  const live = await seeded({ ...fullState(), routines: phoneState().routines, schedule: phoneState().schedule })
  const dir = tempDir('workout-req254-file-')
  try {
    const twoNames = structuredClone(s.base)
    const cases = [
      ['empty changes', s, [], /"changes" is empty/],
      ['unknown op', s, [{ op: 'routine.delete', routine: 'Upper' }], /unknown op "routine\.delete"/],
      ['unknown field', s, [{ op: 'routine.archive', routine: 'Upper', why: 'x' }], /unknown field\(s\) why/],
      ['hidden library id', s, [{ op: 'exercise.add', libraryId: HIDDEN }], new RegExp(`library entry "${HIDDEN}" is hidden`)],
      ['merged library id names its target', s, [{ op: 'exercise.add', libraryId: LIBRARY.find((e) => e.mergedInto).id }], new RegExp(`merged into "${LIBRARY.find((e) => e.mergedInto).mergedInto}"`)],
      ['library id already an exercise', s, [{ op: 'exercise.add', libraryId: 'Leverage_Chest_Press' }], /already exercise ex-press "Chest Press" — use that one/],
      ['"12 reps" on a strength item', s, [{ op: 'item.set', routine: 'Upper', exercise: 'Chest Press', set: { targets: ['12 reps', '12 reps'] } }], /target "12 reps" shows as Duration on a reps item: write reps as a bare number/],
      ['timed 3-set item, rest 20', s, [{ op: 'routine.items', routine: 'Core', items: [{ exercise: 'Plank', sets: 3, durations: [40, 40, 40], restSec: 20 }] }], /a timed 3-set item with restSec 20/],
      ['a workout in progress (C7)', live, [{ op: 'item.set', routine: 'Upper', exercise: 'Chest Press', set: { restSec: 120 } }], /REFUSED: A workout is in progress \(the server’s activeWorkout\)/],
      ['kg 40 on an exercise without history (C5)', s, [{ op: 'exercise.add', ref: 'rdl', libraryId: 'Romanian_Deadlift' }, { op: 'routine.items', routine: 'Core', items: [{ exercise: 'Plank' }, { exercise: 'rdl', suggestedWeights: [40, 40, 40] }] }], /kg 40\/40\/40 on Romanian Deadlift, which has no logged history/],
      ['wrong kind', s, null, /"kind" must be "workout-plan-changes"/],
    ]
    for (const [name, seed, changes, why] of cases) {
      const file = changes ? changesFile(dir, changes, `${name.replace(/\W+/g, '-')}.json`) : join(dir, 'wrong.json')
      if (!changes) writeFileSync(file, JSON.stringify({ kind: 'other', version: 1, changes: [{ op: 'routine.archive', routine: 'Upper' }] }))
      const out = join(dir, `${name.replace(/\W+/g, '-')}.out.json`)
      const before = sha(seed.dbFile)
      const r = cli(seed.dataDir, 'build', file, '--out', out)
      assert.equal(r.status, 1, `${name}: ${r.stdout}${r.stderr}`)
      assert.match(r.stdout + r.stderr, why, name)
      assert.ok(!existsSync(out), `${name}: no file`)
      assert.equal(sha(seed.dbFile), before, `${name}: DB unchanged`)
    }
    // a name matching two exercises: both ids in the message
    twoNames.exercises.push({ ...twoNames.exercises[0], id: 'ex-press-2', libraryId: undefined })
    const two = build(twoNames, [{ op: 'item.set', routine: 'Upper', exercise: 'Chest Press', set: { restSec: 60 } }])
    assert.equal(two.file, null)
    assert.match(two.refusals[0], /"Chest Press" names 2 exercises: ex-press, ex-press-2 — use the id/)
    // --out already existing: refused before anything, the file untouched
    const existing = join(dir, 'exists.json')
    writeFileSync(existing, 'keep me')
    const r = cli(s.dataDir, 'build', changesFile(dir, AC1_CHANGES, 'ok.json'), '--out', existing)
    assert.equal(r.status, 1)
    assert.match(r.stderr, /already exists \(build never overwrites\)/)
    assert.equal(readFileSync(existing, 'utf8'), 'keep me')
  } finally {
    s.cleanup()
    live.cleanup()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('C3 — archiving a scheduled routine without setting the schedule is refused; kept slots must point at live routines', async () => {
  const s = await seeded()
  const r = build(s.base, [{ op: 'routine.archive', routine: 'Core' }])
  assert.equal(r.file, null)
  assert.match(r.refusals.join('\n'), /C3: schedule slot slot-core .* points at routine rtn-core, which is archived/)
  s.cleanup()
})

test('warnings print but do not refuse: a range target, a short duration, rest 0 with notes, a superset note', async () => {
  const s = await seeded()
  const r = build(s.base, [
    { op: 'item.set', routine: 'Upper', exercise: 'Chest Press', set: { targets: ['10-12', '10'], restSec: 0, notes: 'superset with row' } },
    { op: 'item.set', routine: 'Core', exercise: 'Plank', set: { durations: [20, 20] } },
  ])
  assert.deepEqual(r.refusals, [])
  assert.ok(r.file)
  const text = r.warnings.join('\n')
  assert.match(text, /target "10-12" is not a plain number/)
  assert.match(text, /restSec 0 with notes/)
  assert.match(text, /notes mention "superset"/)
  assert.match(text, /a duration under 30 s \(20\/20\)/)
  s.cleanup()
})

test('item ids carry history: a rebuilt item with a fresh id loses its logged sets (why routine.items keeps ids)', async () => {
  const s = await seeded()
  const workout = s.base.workouts.find((w) => w.sets.some((x) => x.routineItemId === 'si-press'))
  const routine = s.base.routines[0]
  const linked = groupSetsByExercise(workout.sets, routine).find((g) => g.routineItemId === 'si-press')
  assert.ok(linked.items.length > 0)
  const rebuilt = { ...routine, exercises: routine.exercises.map((i) => (i.id === 'si-press' ? { ...i, id: 'si-new' } : i)) }
  const groups = groupSetsByExercise(workout.sets, rebuilt)
  assert.equal(groups.find((g) => g.routineItemId === 'si-new').items.length, 0, 'the fresh item has none of its sets')
  // and the builder keeps the id through routine.items
  const r = build(s.base, [{ op: 'routine.items', routine: 'Upper', items: [{ exercise: 'Chest Press', restSec: 100 }, { exercise: 'Bike' }, { exercise: 'Plank' }] }])
  assert.deepEqual(r.refusals, [])
  assert.deepEqual(r.state.routines[0].exercises.map((i) => i.id), ['si-press', 'si-bike', 'si-plank'])
  assert.ok(r.lines.includes('  Upper · order changed'))
  s.cleanup()
})
