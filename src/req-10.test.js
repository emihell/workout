// req-10 (DEC-012, amended by DEC-123 §1) — first-time guided setup. "First time — [Set it up]
// [I'll enter it]" at the first work set of a no-history weighted / bodyweight exercise; in setup,
// set 1's Done asks "How was that?" once and the answer ONLY seeds set 2 (an editable prefill with
// a reason line). Never a kg on set 1 the routine didn't have; the answer is never stored on a set.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, importJsx, render } from './test-support/render.js'
import { emptyState } from './persistence.js'
import { migrateState } from './model.js'
import { DEVICE_FILL_KEY } from './routine-kg-fill.js'
import { moveToValidWeight } from './progress.js'
import { answerConfirm, getPendingConfirm } from './ui/confirm.js'
import { finishedState, initialSetFields, setLogSeed, setPreview, setupSeedFor } from './workout-log.js'
import { SETUP_TEXT, setTwoSeed, setupPromptShows, setupSheetShows } from './first-time-setup.js'

const h = React.createElement
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

const weighted = (extra = {}) => ({ id: 'ex', name: 'Leg Press', type: 'machine', weightStep: '2.5', ...extra })
const bodyweight = (extra = {}) => ({ id: 'bw', name: 'Push-up', type: 'bodyweight', weightStep: '', ...extra })
const set1 = (weight, reps = '10', extra = {}) => ({ setType: 'work', weight, reps, rpe: null, note: '', ...extra })
const seed = (ex, s, feel, target1 = '10', target2 = '10') => setTwoSeed({ ex, set1: s, feel, target1, target2 })

describe('req-10 — setTwoSeed: set 2 from set 1 + "How was that?" (the shared progression rule)', () => {
  it('Easy → one valid step up, equal to moveToValidWeight(+1), with the reason', () => {
    const ex = weighted()
    const out = seed(ex, set1(20), 'easy')
    assert.equal(out.weight, String(moveToValidWeight(20, ex, 1)))
    assert.equal(out.weight, '22.5')
    assert.equal(out.reason, 'Up one step — set 1 felt easy')
    assert.equal(out.workIndex, 1)
    assert.equal(out.reps, undefined, 'weighted: reps untouched')
  })

  it('Medium → same kg; Hard → same kg (Hard holds, progress.js)', () => {
    assert.deepEqual(seed(weighted(), set1(20), 'medium'), { workIndex: 1, weight: '20', reason: 'Same kg — set 1 felt medium' })
    assert.deepEqual(seed(weighted(), set1(20), 'hard'), { workIndex: 1, weight: '20', reason: 'Same kg — set 1 felt hard' })
  })

  it('missed reps → one step down, whatever the answer (Easy included)', () => {
    const ex = weighted()
    for (const feel of ['easy', 'medium', 'hard']) {
      const out = seed(ex, set1(20, '7'), feel)
      assert.equal(out.weight, String(moveToValidWeight(20, ex, -1)), feel)
      assert.equal(out.weight, '17.5')
      assert.equal(out.reason, 'Down one step — set 1 missed reps')
    }
  })

  it('no weight step (n/a, blank) → same kg, "No weight steps set for this exercise"', () => {
    for (const weightStep of ['n/a', '']) {
      const easy = seed(weighted({ weightStep }), set1(20), 'easy')
      assert.deepEqual(easy, { workIndex: 1, weight: '20', reason: SETUP_TEXT.noStep }, weightStep)
      const missed = seed(weighted({ weightStep }), set1(20, '5'), 'hard')
      assert.equal(missed.weight, '20')
      assert.equal(missed.reason, SETUP_TEXT.noStep)
    }
  })

  it('Alt 4/5 → the real alternating sequence (9, 14, 18, 23 …)', () => {
    const ex = weighted({ weightStep: 'Alt 4/5' })
    assert.equal(seed(ex, set1(14), 'easy').weight, '18')
    assert.equal(seed(ex, set1(18), 'easy').weight, '23')
    assert.equal(seed(ex, set1(18, '6'), 'medium').weight, '14')
    // Between two stack weights: up to the next one, down to the one below.
    assert.equal(seed(ex, set1(16), 'easy').weight, '18')
    assert.equal(seed(ex, set1(16, '6'), 'easy').weight, '14')
  })

  it('Steps A/B → 4, 9, 13, 18 … from 0 (the first step first)', () => {
    const ex = weighted({ weightStep: 'Steps 4/5' })
    assert.equal(seed(ex, set1(9), 'easy').weight, '13')
    assert.equal(seed(ex, set1(13), 'easy').weight, '18')
    assert.equal(seed(ex, set1(13, '3'), 'hard').weight, '9')
  })

  it('lightest-weight floor: missed reps at the lightest weight hold, and say so', () => {
    const ex = weighted({ weightStep: '5', lightestWeight: '10' })
    const atFloor = seed(ex, set1(10, '4'), 'medium')
    assert.equal(atFloor.weight, '10')
    assert.equal(atFloor.reason, 'Same kg — already the lightest weight')
    // Below the floor (the user typed less than the stack's first plate): still never a jump up.
    assert.equal(seed(ex, set1(7, '4'), 'medium').weight, '7')
    // Easy from the floor steps up the series (10 → 15).
    assert.equal(seed(ex, set1(10), 'easy').weight, '15')
  })

  it('the helper\'s other holds: assisted, a target that isn\'t one number', () => {
    const assisted = seed(weighted({ name: 'Assisted Pull-up' }), set1(30), 'easy')
    assert.deepEqual(assisted, { workIndex: 1, weight: '30', reason: 'Same kg — assisted, kept as is' })
    const range = seed(weighted(), set1(20), 'easy', '8-12', '8-12')
    assert.deepEqual(range, { workIndex: 1, weight: '20', reason: "Same kg — the target isn't a single number" })
  })

  it('bodyweight: reps ±1 on set 2 (Easy +1, missed −1, Medium/Hard same), never below 1', () => {
    const ex = bodyweight()
    assert.deepEqual(seed(ex, set1(0, '10'), 'easy'), { workIndex: 1, reps: '11', reason: 'One more rep — set 1 felt easy' })
    assert.deepEqual(seed(ex, set1(0, '8'), 'medium'), { workIndex: 1, reps: '9', reason: 'One rep fewer — set 1 missed reps' })
    assert.deepEqual(seed(ex, set1(0, '10'), 'medium'), { workIndex: 1, reason: 'Same reps — set 1 felt medium' })
    assert.deepEqual(seed(ex, set1(0, '10'), 'hard'), { workIndex: 1, reason: 'Same reps — set 1 felt hard' })
    // The ±1 lands on set 2's own target (12/10 plan: Easy on set 1 → set 2 at 11).
    assert.equal(seed(ex, set1(0, '12'), 'easy', '12', '10').reps, '11')
    assert.deepEqual(seed(ex, set1(0, '0'), 'easy', '1', '1'), { workIndex: 1, reason: 'Same reps — already at 1 rep' }, 'missed at 1 rep: never below 1')
    assert.equal(seed(ex, set1(0, '10'), 'easy').weight, undefined, 'bodyweight never seeds a kg')
  })

  it('failure cases: Skip / no answer / a skipped set 1 / a blank-kg weighted set 1 / cardio / timed → null', () => {
    assert.equal(seed(weighted(), set1(20), null), null)
    assert.equal(seed(weighted(), set1(20), 'skip'), null)
    assert.equal(seed(weighted(), set1(0, 'skipped', { note: 'skipped' }), 'easy'), null)
    assert.equal(seed(weighted(), set1(0), 'easy'), null, 'nothing to step from: never an invented kg')
    assert.equal(seed(weighted({ type: 'cardio' }), set1(0), 'easy'), null)
    assert.equal(seed(weighted({ hasDuration: true }), set1(20), 'easy'), null)
  })

  it('pure: the input set is not mutated (its rpe stays null)', () => {
    const s = set1(20)
    seed(weighted(), s, 'easy')
    assert.equal(s.rpe, null)
  })
})

describe('req-10 — when the prompt and the sheet show', () => {
  const base = { ex: weighted(), hasHistory: false, currentType: 'work', workLogged: [], entry: null }
  it('the prompt: no history, first work set, unanswered, weighted or bodyweight', () => {
    assert.equal(setupPromptShows(base), true)
    assert.equal(setupPromptShows({ ...base, ex: bodyweight() }), true)
  })
  it('failure cases: history / a set already logged / warm-up / answered / cardio / timed → no prompt', () => {
    assert.equal(setupPromptShows({ ...base, hasHistory: true }), false)
    assert.equal(setupPromptShows({ ...base, workLogged: [set1(20)] }), false)
    assert.equal(setupPromptShows({ ...base, currentType: 'wu' }), false)
    assert.equal(setupPromptShows({ ...base, entry: { mode: 'manual' } }), false)
    assert.equal(setupPromptShows({ ...base, entry: { mode: 'setup' } }), false)
    assert.equal(setupPromptShows({ ...base, ex: weighted({ type: 'cardio' }) }), false)
    assert.equal(setupPromptShows({ ...base, ex: weighted({ hasDuration: true }) }), false)
  })
  it('the sheet: only in setup, once, with a set 2 to come and a set 1 to judge', () => {
    const ok = { ex: weighted(), entry: { mode: 'setup' }, set1: set1(20), exerciseDone: false }
    assert.equal(setupSheetShows(ok), true)
    assert.equal(setupSheetShows({ ...ok, entry: { mode: 'manual' } }), false)
    assert.equal(setupSheetShows({ ...ok, entry: null }), false)
    assert.equal(setupSheetShows({ ...ok, entry: { mode: 'setup', answered: 'skip' } }), false)
    assert.equal(setupSheetShows({ ...ok, exerciseDone: true }), false)
    assert.equal(setupSheetShows({ ...ok, set1: set1(0, 'skipped', { note: 'skipped' }) }), false)
    assert.equal(setupSheetShows({ ...ok, set1: set1(0) }), false, 'a weighted set 1 with no kg: nothing to step from')
    assert.equal(setupSheetShows({ ...ok, ex: bodyweight(), set1: set1(0) }), true)
  })
})

describe('req-10 — the seed seam (setLogSeed / setPreview / setupSeedFor)', () => {
  const inputs = { weighted: true, fromRestore: false, restore: null, hasHistory: false, history: { weight: '', reps: '' }, carry: { weight: '20', reps: '10' }, target: '10', override: null, routineKg: '', uniformReps: true }
  it('setup weight wins over routine kg / carry / override; absent = unchanged', () => {
    assert.equal(setLogSeed(inputs).weight, '20')
    assert.equal(setLogSeed({ ...inputs, setup: { weight: '22.5' } }).weight, '22.5')
    assert.equal(setLogSeed({ ...inputs, routineKg: 30, setup: { weight: '22.5' } }).weight, '22.5')
    assert.equal(setLogSeed({ ...inputs, override: { weight: '25' }, setup: { weight: '22.5' } }).weight, '22.5')
    assert.equal(setLogSeed({ ...inputs, setup: { reason: 'x' } }).weight, '20', 'no weight on the seed → plain')
  })
  it('setup reps (bodyweight) win; a bodyweight set never gets a kg', () => {
    const bw = { ...inputs, weighted: false, carry: { weight: '', reps: '10' } }
    assert.deepEqual(setLogSeed({ ...bw, setup: { reps: '11' } }), { weight: '', reps: '11' })
    assert.deepEqual(setLogSeed({ ...bw, setup: { weight: '22.5' } }), { weight: '', reps: '10' })
  })
  it('set 1 is never seeded: setupSeedFor only answers for the work set the seed names, on its own item', () => {
    const item = { routineItemId: 'i1', exerciseId: 'ex', sets: 3 }
    const workout = { firstTimeSetup: { ex: { mode: 'setup', seed: { itemKey: 'i1', workIndex: 1, weight: '22.5', reason: 'r' } } } }
    assert.equal(setupSeedFor(workout, item, 'work', 0), null)
    assert.equal(setupSeedFor(workout, item, 'work', 1).weight, '22.5')
    assert.equal(setupSeedFor(workout, item, 'work', 2), null)
    assert.equal(setupSeedFor(workout, item, 'wu', 1), null)
    assert.equal(setupSeedFor(workout, { ...item, routineItemId: 'i2' }, 'work', 1), null)
    assert.equal(setupSeedFor({}, item, 'work', 1), null)
  })
  it('the set list shows the seeded set 2 (setPreview), set 1 and set 3 as before', () => {
    const item = { routineItemId: 'i1', exerciseId: 'ex', sets: 3, targets: ['10', '10', '10'], suggestedWeights: [] }
    const rows = setPreview({ item, ex: weighted(), weighted: true, hasHistory: false, historyFor: () => ({ weight: '', reps: '' }), seedOverrides: {}, workLogged: [set1(20)], setupSeed: { workIndex: 1, weight: '22.5' } })
    assert.deepEqual(rows.map((r) => r.weight), ['20', '22.5', '20'])
  })
  it('initialSetFields passes setup through', () => {
    assert.equal(initialSetFields({ ...inputs, setup: { weight: '17.5' } }).weight, '17.5')
  })
})

describe('req-10 — firstTimeSetup is transient session state', () => {
  const answers = { ex: { mode: 'setup', answered: 'easy', seed: { itemKey: 'i1', workIndex: 1, weight: '22.5', reason: 'r' } } }
  it('migrateState keeps it on the active workout (the reload path)', () => {
    const state = { ...emptyState(), activeWorkout: { id: 'w', routineId: 'r', snapshot: { routineId: 'r', items: [] }, sets: [], startedAt: '2026-10-11T10:00:00.000Z', firstTimeSetup: answers } }
    assert.deepEqual(migrateState(state).activeWorkout.firstTimeSetup, answers)
  })
  it('finishedState drops it: never on the finished-history record', () => {
    const state = { ...emptyState(), activeWorkout: { id: 'w', routineId: 'r', snapshot: { routineId: 'r', items: [] }, sets: [], startedAt: '2026-10-11T10:00:00.000Z', firstTimeSetup: answers } }
    const done = finishedState(state)
    assert.equal(done.activeWorkout, null)
    assert.equal('firstTimeSetup' in done.workouts[0], false)
  })
})

// ---- Rendered against the real store and the real ConfirmSheet (one StoreProvider, L-051) ----
describe('req-10 (rendered) — prompt → Set it up → Done → sheet → set 2', () => {
  let view
  afterEach(async () => {
    if (getPendingConfirm()) answerConfirm(false)
    await view?.unmount()
    view = null
  })

  const routineItem = (id, exerciseId, sets, kg = [], targets = Array(sets).fill('10')) => ({ id, exerciseId, role: 'main', restSec: 90, notes: '', warmup: null, sets, targets, suggestedWeights: kg, durations: [] })
  const finishedWith = (exerciseId) => ({
    id: 'old', routineId: 'up', startedAt: '2026-10-01T10:00:00.000Z', finishedAt: '2026-10-01T11:00:00.000Z',
    snapshot: { routineId: 'up', items: [] },
    sets: [{ routineItemId: 'ia', exerciseId, setType: 'work', weight: 40, reps: '10', rpe: 3, note: '' }],
  })

  async function harness(items, { exercises = [weighted()], workouts = [] } = {}) {
    const state = { ...emptyState(), exercises, routines: [{ id: 'up', name: 'Legs', focus: '', exercises: items }], workouts }
    localStorage.clear()
    localStorage.setItem(DEVICE_FILL_KEY, '2026-09-26T00:00:00.000Z')
    localStorage.setItem('workout-mvp-v9', JSON.stringify(state))
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { useStore } = await import('./store-context.js')
    const { WorkoutItemLog } = await importJsx('./views/workout/item.jsx', import.meta.url)
    const { ConfirmSheet } = await importJsx('./ui/index.jsx', import.meta.url)
    const captured = {}
    function Screen({ child }) {
      // oxlint-disable-next-line react/immutability
      captured.store = useStore()
      return child
    }
    function Host() {
      const [child, setChild] = React.useState(null)
      // oxlint-disable-next-line react/immutability
      captured.setChild = setChild
      return h(StoreProvider, null, h(Screen, { child }), h(ConfirmSheet))
    }
    view = await render(h(Host))
    await act(async () => captured.store.startWorkout('up'))
    const stored = () => JSON.parse(localStorage.getItem('workout-mvp-v9'))
    const open = async (itemId) => act(async () => captured.setChild(h(WorkoutItemLog, { routineId: 'up', itemId })))
    return { stored, open }
  }

  const sheet = () => view.all('[role="alertdialog"]')[0] ?? null
  const kg = () => view.input('kg')?.value
  const reps = () => view.input('Reps')?.value

  it('weighted, routine kg blank: prompt → Set it up → set 1 blank + guide → Done → sheet → Easy → set 2 = one step up, with the reason; sets keep rpe null', async () => {
    const t = await harness([routineItem('ia', 'ex', 3)])
    await t.open('ia')
    assert.ok(view.button('Set it up'), 'the prompt shows')
    assert.ok(view.button("I'll enter it"))
    assert.match(view.text(), /First time/)
    await view.click(view.button('Set it up'))
    assert.equal(view.button('Set it up'), null, 'answered: the prompt is gone')
    assert.match(view.text(), /Pick a weight you could lift about 15 times/)
    assert.equal(kg(), '', 'set 1: no kg the routine did not have (DESIGN §1)')
    await view.type(view.input('kg'), '20')
    await view.click(view.button('Done'))
    const open = sheet()
    assert.ok(open, 'the sheet opens after set 1')
    assert.equal(open.querySelector('.ui-sheet__title').textContent, 'How was that?')
    assert.deepEqual([...open.querySelectorAll('button')].map((b) => b.textContent), ['Easy', 'Medium', 'Hard', 'Skip'])
    await view.click(view.button('Easy'))
    await flush()
    assert.equal(sheet(), null)
    assert.equal(kg(), '22.5', 'set 2 = one valid step up (2.5 kg step)')
    assert.match(view.text(), /Up one step — set 1 felt easy/)
    assert.doesNotMatch(view.text(), /Pick a weight/, 'the guide was for set 1')
    // Editable: overwrite before logging.
    await view.type(view.input('kg'), '25')
    await view.click(view.button('Done'))
    const sets = t.stored().activeWorkout.sets
    assert.deepEqual(sets.map((s) => [s.weight, s.rpe]), [[20, null], [25, null]], 'the answer is never stored on a set')
    assert.equal(kg(), '25', 'set 3 carries as usual (the kg just logged)')
    assert.doesNotMatch(view.text(), /felt easy/, 'the reason belongs to set 2 only')
    assert.equal(sheet(), null, 'asked once')
  })

  it('a kept suggestion carries to set 3 even over a routine kg (DEC-052); set 1 shows the routine kg only', async () => {
    const t = await harness([routineItem('ia', 'ex', 3, [20, 20, 20])])
    await t.open('ia')
    await view.click(view.button('Set it up'))
    assert.equal(kg(), '20', 'set 1 = the routine kg, nothing else')
    await view.click(view.button('Done'))
    await view.click(view.button('Easy'))
    await flush()
    assert.equal(kg(), '22.5')
    await view.click(view.button('Done'))
    assert.equal(kg(), '22.5', 'set 3: the kept 22.5 is this session\'s kg')
    assert.deepEqual(t.stored().activeWorkout.sets.map((s) => s.rpe), [null, null])
  })

  it('failure case: Skip on the sheet → set 2 is the plain carry, no reason line', async () => {
    const t = await harness([routineItem('ia', 'ex', 3)])
    await t.open('ia')
    await view.click(view.button('Set it up'))
    await view.type(view.input('kg'), '20')
    await view.click(view.button('Done'))
    await view.click(view.button('Skip'))
    await flush()
    assert.equal(kg(), '20', 'the plain carry')
    assert.doesNotMatch(view.text(), /Up one step|Same kg|Down one step/)
    assert.equal(t.stored().activeWorkout.firstTimeSetup.ex.answered, 'skip')
    assert.equal(t.stored().activeWorkout.firstTimeSetup.ex.seed, undefined)
  })

  it('failure case: an exercise with history shows no prompt and no sheet', async () => {
    await harness([routineItem('ia', 'ex', 3)], { workouts: [finishedWith('ex')] }).then((t) => t.open('ia'))
    assert.equal(view.button('Set it up'), null)
    assert.doesNotMatch(view.text(), /First time/)
    await view.type(view.input('kg'), '40')
    await view.click(view.button('Done'))
    assert.equal(sheet(), null)
  })

  it("I'll enter it → today's form: no guide, no sheet after set 1, plain carry", async () => {
    const t = await harness([routineItem('ia', 'ex', 3)])
    await t.open('ia')
    await view.click(view.button("I'll enter it"))
    assert.equal(view.button('Set it up'), null)
    assert.doesNotMatch(view.text(), /Pick a weight/)
    assert.equal(kg(), '')
    await view.type(view.input('kg'), '20')
    await view.click(view.button('Done'))
    assert.equal(sheet(), null)
    assert.equal(kg(), '20')
    assert.equal(t.stored().activeWorkout.firstTimeSetup.ex.mode, 'manual')
  })

  it('bodyweight: Set it up → Done → Easy → set 2 reps +1, no kg box', async () => {
    const t = await harness([routineItem('ib', 'bw', 3)], { exercises: [bodyweight()] })
    await t.open('ib')
    await view.click(view.button('Set it up'))
    assert.match(view.text(), /Do the reps you can do with good form/)
    assert.equal(view.input('kg'), null)
    assert.equal(reps(), '10')
    await view.click(view.button('Done'))
    await view.click(view.button('Easy'))
    await flush()
    assert.equal(reps(), '11')
    assert.match(view.text(), /One more rep — set 1 felt easy/)
    assert.deepEqual(t.stored().activeWorkout.sets.map((s) => s.rpe), [null])
  })

  it('failure case: a cardio exercise shows no prompt', async () => {
    await harness([routineItem('ic', 'cx', 1, [], ['20 min'])], { exercises: [{ id: 'cx', name: 'Bike', type: 'cardio', weightStep: '' }] }).then((t) => t.open('ic'))
    assert.equal(view.button('Set it up'), null)
    assert.doesNotMatch(view.text(), /First time/)
  })
})
