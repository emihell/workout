// req-209 — Noa run fixes: developer tools hidden, History detail sets inline, one set
// format, "Last time" on the exercise page, the routine row shows the plan, one equipment
// label map, Schedule's today row after a finished workout.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { act, importJsx, render } from './test-support/render.js'
import { formatSetLine, routineItemMeta } from './ids.js'
import { parseRoute } from './route.js'
import { equipmentLabel } from './equipment-label.js'
import { scheduleRowText } from './views/schedule-day.js'
import { exerciseLastTimeText, historyGroupSetsText, shortDate, topSetText } from './views/history/helpers.js'

const here = dirname(fileURLToPath(import.meta.url))
const read = (path) => readFileSync(join(here, path), 'utf8')
const h = React.createElement
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
const devNotes = () => importJsx('./dev/dev-notes.js', import.meta.url)

function memoryStorage() {
  const map = new Map()
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    keys: () => [...map.keys()],
  }
}

// ── §1 the developer-tools flag ──────────────────────────────────────────────────────
describe('§1 the dev-tools flag (pure)', () => {
  it('its own key; default off; on writes "true", off removes the key; never workout-mvp-v9', async () => {
    const { DEV_TOOLS_KEY, readDevTools, writeDevTools, devToolsFromQuery } = await devNotes()
    assert.equal(DEV_TOOLS_KEY, 'workout-dev-tools-v1')
    const storage = memoryStorage()
    assert.equal(readDevTools(storage), false)
    writeDevTools(storage, true)
    assert.equal(readDevTools(storage), true)
    assert.deepEqual(storage.keys(), [DEV_TOOLS_KEY])
    writeDevTools(storage, false)
    assert.deepEqual(storage.keys(), [])
    assert.equal(devToolsFromQuery('1'), true)
    assert.equal(devToolsFromQuery('0'), false)
    assert.equal(devToolsFromQuery(null), null)
    assert.equal(devToolsFromQuery('yes'), null)
  })
  it('#/settings?dev=1 parses to the settings route with dev "1"', () => {
    assert.deepEqual(parseRoute('/settings?dev=1'), { name: 'settings', dev: '1' })
    assert.deepEqual(parseRoute('/settings'), { name: 'settings' })
    assert.deepEqual(parseRoute('/settings?dev=x'), { name: 'settings' })
  })
})

// ── §2 History detail rows ───────────────────────────────────────────────────────────
describe('§2 historyGroupSetsText — the sets inline', () => {
  const s = (weight, reps, extra = {}) => ({ s: { exerciseId: 'ex', setType: 'work', weight, reps, ...extra } })
  it('kg once when every set shares it: "14 kg × 15, × 15, × 15"', () => {
    assert.equal(historyGroupSetsText({ role: 'main' }, [s(14, '15'), s(14, '15'), s(14, '15')]), '14 kg × 15, × 15, × 15')
  })
  it('kg differ → each set with its kg: "12 kg × 10, 14 kg × 8"', () => {
    assert.equal(historyGroupSetsText({}, [s(12, '10'), s(14, '8')]), '12 kg × 10, 14 kg × 8')
  })
  it('a timed exercise shows durations; skipped sets read "skipped"', () => {
    const timed = (sec) => s(0, '', { durationSec: sec })
    assert.equal(historyGroupSetsText({}, [timed(30), timed(30), s(0, 'skipped')]), '30s, 30s, skipped')
    assert.equal(historyGroupSetsText({}, [s(14, '15'), s(14, '12'), s(14, 'skipped')]), '14 kg × 15, × 12, skipped')
  })
  it('every set skipped → "skipped"; a warm-up set reads "warm-up …"; a non-main role keeps its tag', () => {
    assert.equal(historyGroupSetsText({ warmup: true }, [s(10, 'skipped', { setType: 'wu' }), s(20, 'skipped')]), 'skipped')
    assert.equal(
      historyGroupSetsText({ warmup: true }, [s(10, '12', { setType: 'wu' }), s(30, '12'), s(30, '10')]),
      'warm-up 10 kg × 12, 30 kg × 12, × 10',
    )
    assert.equal(historyGroupSetsText({ role: 'finisher' }, [s('', '20'), s('', '18')]), 'Finisher · × 20, × 18')
  })
})

// ── §3 one set format ────────────────────────────────────────────────────────────────
describe('§3 one set format: "{kg} kg × {reps}"', () => {
  it('formatSetLine gives "14 kg × 15 · Easy"', () => {
    assert.equal(formatSetLine({ setType: 'work', weight: 14, reps: '15', rpe: 2 }), '14 kg × 15 · Easy')
    assert.equal(formatSetLine({ setType: 'work', weight: 0, reps: '', durationSec: 30 }), '30s')
  })
  it('By exercise (topSetText) reads through the same formatter', () => {
    assert.equal(topSetText([{ exerciseId: 'ex', setType: 'work', weight: 14, reps: '15' }], 'ex'), '14 kg × 15')
    assert.match(read('views/history/helpers.js'), /return setValueText\(\{ weight: top\.set\.weight, reps: top\.set\.reps \}\)/)
  })
  it('the History exercise page and the log list render formatSetLine; By exercise renders topSetText', () => {
    assert.match(read('views/history/detail.jsx'), /\{formatSetLine\(s, /)
    // req-212 test edit — the done view (now the exercise review) lists its sets in the set list's
    // shape (loggedSetRowText → setPreviewText: "1 · {kg} kg × {reps}", the same kg × reps format);
    // the per-set effort word left those lines (one effort per exercise, DEC-119 §1).
    assert.match(read('views/workout/item.jsx'), /loggedSetRowText\(label, set, weighted, cardioFields\)/)
    assert.match(read('views/history/list.jsx'), /topSetText\(w\.sets, exerciseId\)/)
  })
})

// ── §4 "Last time" (pure) ────────────────────────────────────────────────────────────
describe('§4 exerciseLastTimeText — finished history only', () => {
  const NOW = new Date(2026, 9, 7, 20)
  const set = (weight, reps, extra = {}) => ({ exerciseId: 'ex', setType: 'work', weight, reps, ...extra })
  it('failure case: no history → null (the page shows nothing)', () => {
    assert.equal(exerciseLastTimeText([], 'ex', NOW), null)
    // a workout with no readable time is not history (finishedNewestFirst)
    assert.equal(exerciseLastTimeText([{ id: 'live', sets: [set(14, '15')] }], 'ex', NOW), null)
    // every set skipped is not a last time
    assert.equal(exerciseLastTimeText([{ id: 'w', finishedAt: '2026-10-07T10:00:00Z', performedOn: '2026-10-07', sets: [set(14, 'skipped')] }], 'ex', NOW), null)
  })
  it('"Last time: Oct 7 · 14 kg × 15" from the newest finished workout', () => {
    const workouts = [
      { id: 'old', finishedAt: '2026-10-01T10:00:00Z', performedOn: '2026-10-01', sets: [set(20, '10')] },
      { id: 'new', finishedAt: '2026-10-07T10:00:00Z', performedOn: '2026-10-07', sets: [set(14, '15'), set(14, '15')] },
    ]
    assert.equal(exerciseLastTimeText(workouts, 'ex', NOW), 'Last time: Oct 7 · 14 kg × 15')
  })
  it('no kg → the set count; the year shows only when it is not this year', () => {
    const bw = [{ id: 'w', finishedAt: '2025-03-02T10:00:00Z', performedOn: '2025-03-02', sets: [set('', '15'), set('', '12')] }]
    assert.equal(exerciseLastTimeText(bw, 'ex', NOW), 'Last time: Mar 2, 2025 · 2 sets')
    assert.equal(shortDate('2026-10-07', NOW), 'Oct 7')
  })
})

// ── §5 the routine row ───────────────────────────────────────────────────────────────
describe('§5 routineItemMeta — the plan on the row', () => {
  it('"4 × 15 · 14 kg" after reps are edited to 15 on a 4-set item', () => {
    assert.equal(routineItemMeta({ sets: 4, targets: ['15', '15', '15', '15'], suggestedWeights: [14, 14, 14, 14] }), '4 × 15 · 14 kg')
  })
  it('the slash form stays only when kg differ per set; differing reps read "12/10/8"', () => {
    assert.equal(routineItemMeta({ sets: 3, targets: ['12', '10', '8'], suggestedWeights: [20, 22, 24] }), '3 × 12/10/8 · 20/22/24 kg')
    assert.equal(routineItemMeta({ sets: 3, targets: ['10', '10', '10'], suggestedWeights: [20, 20, 20] }), '3 × 10 · 20 kg')
  })
  it('a timed exercise reads "{sets} × {duration}"; no targets keep "N sets"', () => {
    assert.equal(routineItemMeta({ sets: 3, targets: ['', '', ''], durations: [30, 30, 30] }, { timed: true }), '3 × 30s')
    assert.equal(routineItemMeta({ sets: 2, suggestedWeights: [] }), '2 sets')
  })
})

// ── §6 equipment labels ──────────────────────────────────────────────────────────────
describe('§6 equipmentLabel — one display map', () => {
  it('"Bodyweight" for both "body only" and "bodyweight"', () => {
    assert.equal(equipmentLabel('body only'), 'Bodyweight')
    assert.equal(equipmentLabel('bodyweight'), 'Bodyweight')
    assert.equal(equipmentLabel('Bodyweight'), 'Bodyweight')
  })
  it('Title case, a typed value otherwise kept; empty → the fallback', () => {
    assert.equal(equipmentLabel('dumbbell'), 'Dumbbell')
    assert.equal(equipmentLabel('Dumbbell'), 'Dumbbell')
    assert.equal(equipmentLabel('medicine ball'), 'Medicine Ball')
    assert.equal(equipmentLabel('Chest Press (Star Trac)'), 'Chest Press (Star Trac)')
    assert.equal(equipmentLabel(''), '')
    assert.equal(equipmentLabel(null, 'Bodyweight'), 'Bodyweight')
  })
  it('every screen that shows equipment reads it through the map', () => {
    // req-212 test edit — views/workout/item.jsx left the list: its done view (the one place it
    // showed equipment) became the exercise review, which shows no equipment line (DEC-119 §1).
    for (const file of ['views/Exercises.jsx', 'views/ExercisePicker.jsx', 'views/workout/setup.jsx']) {
      const source = read(file)
      assert.doesNotMatch(source, /— \{ex\.equipment\}|— \$\{ex\.equipment\}|\|\| 'bodyweight'|"ui-sub">\{ex\.equipment\}/, file)
      assert.match(source, /equipmentLabel\(/, file)
    }
  })
})

// ── §7 Schedule's today row ──────────────────────────────────────────────────────────
describe('§7 scheduleRowText', () => {
  it('today with a finished workout → "Today · Done ✓", never "Rest"', () => {
    assert.deepEqual(scheduleRowText({ names: '', isToday: true, doneNames: ['New workout #1'] }), { label: 'New workout #1', value: 'Today · Done ✓' })
    assert.deepEqual(scheduleRowText({ names: 'Legs', isToday: true, doneNames: ['Legs'] }), { label: 'Legs', value: 'Today · Done ✓' })
  })
  it('unchanged otherwise', () => {
    assert.deepEqual(scheduleRowText({ names: '', isToday: true }), { label: 'Rest', value: 'Today' })
    assert.deepEqual(scheduleRowText({ names: 'Legs', isToday: false, doneNames: ['x'] }), { label: 'Legs', value: null })
  })
})

// ── Screens (the whole App) ──────────────────────────────────────────────────────────
const seed = JSON.parse(read('db.json'))
const CALF = { id: 'ex-calf', name: 'Dumbbell Calf Raise', equipment: 'dumbbell', weightStep: '2', muscles: 'Calves', cues: '', type: 'free', archivedAt: null }
const BARE = { id: 'ex-bare', name: 'Never Done', equipment: 'body only', weightStep: 'n/a', muscles: '', cues: '', type: 'bodyweight', archivedAt: null }
function noaLike() {
  const data = structuredClone(seed)
  data.exercises.push(CALF, BARE)
  const item = 'si-noa-calf'
  data.workouts.push({
    id: 'wo-noa',
    routineId: 'sess-lower',
    startedAt: new Date(2026, 9, 7, 9).toISOString(),
    finishedAt: new Date(2026, 9, 7, 10).toISOString(),
    performedOn: '2026-10-07',
    scheduledFor: '2026-10-07',
    overallNote: '',
    overallFeel: '',
    sets: [1, 2, 3].map(() => ({ exerciseId: 'ex-calf', setType: 'work', weight: 14, reps: '15', rpe: 2, note: '', routineItemId: item })),
    snapshot: {
      routineId: 'sess-lower',
      routineName: 'Lower Body',
      items: [{ routineItemId: item, exerciseId: 'ex-calf', exerciseName: 'Dumbbell Calf Raise', equipment: 'dumbbell', exerciseType: 'free', role: 'main', targets: ['15', '15', '15'], suggestedWeights: [14, 14, 14] }],
    },
  })
  return data
}

let view = null
afterEach(async () => {
  if (view) await view.unmount()
  view = null
})
async function open(hash, data = seed, { clear = true } = {}) {
  if (clear) localStorage.clear()
  localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
  if (clear) localStorage.setItem('workout-mvp-v8', JSON.stringify(data))
  window.location.hash = `#${hash}`
  const { default: App } = await importJsx('./App.jsx', import.meta.url)
  view = await render(h(App))
  await flush()
}

describe('§1 Backup & data (rendered)', () => {
  it('no "Developer" by default; ?dev=1 shows it and it stays; workout-mvp-v9 is untouched by the flag', async () => {
    const { DEV_TOOLS_KEY, setDevTools } = await devNotes()
    try {
      await open('/settings')
      assert.doesNotMatch(view.text(), /Developer|Export analytics|Feedback notes|Components|Assistant prompt/)
      assert.match(view.text(), /Back up now/)
      assert.match(view.text(), /Restore from a backup/)
      const before = localStorage.getItem('workout-mvp-v9')
      await view.unmount()
      await open('/settings?dev=1', seed, { clear: false })
      assert.match(view.text(), /Developer/)
      assert.match(view.text(), /Export analytics/)
      assert.equal(localStorage.getItem(DEV_TOOLS_KEY), 'true')
      assert.equal(localStorage.getItem('workout-mvp-v9'), before, 'the flag never writes workout-mvp-v9')
      await view.unmount()
      await open('/settings', seed, { clear: false })
      assert.match(view.text(), /Developer/, 'stays on without the query')
    } finally {
      setDevTools(false)
    }
  })
})

describe('§2/§4/§6 screens', () => {
  it('History detail reads "Dumbbell Calf Raise — 14 kg × 15, × 15, × 15" and the row opens the exercise', async () => {
    await open('/history/wo-noa', noaLike())
    assert.match(view.text(), /Dumbbell Calf Raise — 14 kg × 15, × 15, × 15/)
    const row = view.all('a').find((a) => a.textContent.includes('Dumbbell Calf Raise'))
    assert.match(row.getAttribute('href'), /^#\/history\/wo-noa\/exercise\/si-noa-calf/)
  })
  it('the exercise page: "Last time: Oct 7 · 14 kg × 15" and its History link; none without history', async () => {
    await open('/exercises/ex-calf', noaLike())
    const text = view.text()
    assert.ok(text.includes(`Last time: ${shortDate('2026-10-07')} · 14 kg × 15`), text)
    const link = view.all('a').find((a) => a.textContent.trim().startsWith('History'))
    assert.equal(link.getAttribute('href'), `#/history/exercise/ex-calf?from=${encodeURIComponent('/exercises/ex-calf')}`)
    assert.match(text, /Dumbbell ·/, 'equipment through the label map')
    await view.unmount()
    await open('/exercises/ex-bare', noaLike())
    assert.doesNotMatch(view.text(), /Last time/)
    assert.match(view.text(), /Bodyweight/)
  })
  it('History › By exercise opened from the exercise page goes Back there', async () => {
    await open(`/history/exercise/ex-calf?from=${encodeURIComponent('/exercises/ex-calf')}`, noaLike())
    const back = view.all('a').find((a) => a.textContent.includes('Back'))
    assert.equal(back.getAttribute('href'), '#/exercises/ex-calf')
  })
})
