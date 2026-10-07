// req-201 (DEC-110 §2, review F9/F13/F18) — UI vocabulary: a routine is a "Workout" on
// screen, and a logged session is named by its workout and date ("session" where no name is
// in hand). Code identifiers, routes (/routines, F13), storage keys and export fields keep
// "routine".
//
// The static test parses every UI module (rolldown's parser, already shipped with Vite)
// and reads its rendered strings: JSX text, string literals and template-literal text. A
// path ("/routines/…"), a kebab-case id ("routine-update-apply") and the allow-list below
// are code, not copy; any other "routine" fails.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseAst } from 'rolldown/parseAst'
import { deletionConfirmHead, routineScheduledDaysText } from './state-reducers.js'
import { machinesPlan, SPLIT_AB, SPLIT_SAME } from './plan-templates.js'
import { offerSheetText, offerText } from './routine-update-offer.js'
import { ABANDON_ON_NEW_WARNING, abandonInProgress } from './workout-actions.js'
import { answerConfirm, getPendingConfirm, subscribeConfirm } from './ui/confirm.js'

const here = dirname(fileURLToPath(import.meta.url))
const ROUTINE = /\broutines?\b/i

// The UI: src/views, src/ui, App.jsx — plus the root modules whose strings reach the screen
// (confirms, sheets, default names, the crash screen).
const COPY_MODULES = [
  'App.jsx',
  'workout-actions.js',
  'state-reducers.js',
  'routine-update-offer.js',
  'error-boundary.js',
  'plan-templates.js',
  'store.jsx',
]
// Code-only uses of the word, by file and exact string. Keep this short; each entry says why.
const ALLOW = [
  // a route name (App.jsx dispatch on parseRoute's name; the route stays, F13)
  ['App.jsx', 'routines'],
  ['App.jsx', 'routine'],
  // an id-pool kind (plan-templates.js idsFor: next('routine'))
  ['plan-templates.js', 'routine'],
]

function walkFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walkFiles(path) : [path]
  })
}

const uiFiles = () =>
  [
    ...walkFiles(join(here, 'views')),
    ...walkFiles(join(here, 'ui')),
    ...COPY_MODULES.map((file) => join(here, file)),
  ].filter((path) => /\.jsx?$/.test(path) && !/\.test\.js$/.test(path))

// Every string a module could render: JSX text, string literals, template text — not import
// sources, and not comments (the parser drops them).
export function renderedStrings(source, file) {
  const ast = parseAst(source, { lang: file.endsWith('.jsx') ? 'jsx' : 'js' }, file)
  const found = []
  const visit = (node, parent) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach((child) => visit(child, parent))
    let text = null
    if (node.type === 'JSXText') text = node.value
    else if (node.type === 'Literal' && typeof node.value === 'string') text = node.value
    else if (node.type === 'TemplateElement') text = node.value.cooked
    const code = parent && /^(Import|Export)/.test(parent.type)
    if (text != null && !code) found.push({ text, line: source.slice(0, node.start).split('\n').length })
    for (const key of Object.keys(node)) if (node[key] && typeof node[key] === 'object') visit(node[key], node)
  }
  visit(ast, null)
  return found
}

const isCode = (text) => text.startsWith('/') || /^[a-z]+(-[a-z0-9]+)+$/.test(text)

export function routineCopy(files = uiFiles()) {
  const hits = []
  for (const path of files) {
    const file = relative(here, path)
    for (const { text, line } of renderedStrings(readFileSync(path, 'utf8'), file)) {
      if (!ROUTINE.test(text) || isCode(text)) continue
      if (ALLOW.some(([f, s]) => f === file && s === text)) continue
      hits.push(`${file}:${line}: ${JSON.stringify(text.trim())}`)
    }
  }
  return hits
}

describe('static: no "routine" in UI copy (DEC-110 §2)', () => {
  it('scans the views, ui, App.jsx and the copy modules', () => {
    const files = uiFiles().map((path) => relative(here, path))
    assert.ok(files.includes('views/Routine.jsx') && files.includes('ui/index.jsx') && files.includes('App.jsx'))
    assert.ok(files.length > 30, `only ${files.length} files`)
  })
  it('finds no user-visible "routine"', () => {
    assert.deepEqual(routineCopy(), [])
  })
  it('has teeth: a planted "Add routine" (JSX text and a template) is caught; a path and an id are not', () => {
    const sample = [
      'export const A = () => <Title>Add routine</Title>',
      'export const B = (n) => `Remove ${n} routine${n === 1 ? "" : "s"}`',
      'export const C = () => <NavLink to="/routines/new">Add workout</NavLink>',
      "export const D = () => recordButton('routine-update-apply')",
    ].join('\n')
    const texts = renderedStrings(sample, 'planted.jsx')
      .map(({ text }) => text)
      .filter((text) => ROUTINE.test(text) && !isCode(text))
    assert.deepEqual(texts.map((t) => t.trim()), ['Add routine', 'routine'])
  })
})

describe('the session is named, never "workout"', () => {
  it('the abandon-on-new warning says "session"', () => {
    assert.equal(ABANDON_ON_NEW_WARNING, 'Starting a new session will abandon the one in progress. Continue?')
  })
  it('abandoning an unfinished session names it (the caller passes "Upper Body · Oct 6, 2026")', async () => {
    const asked = []
    // Stand in for the user at the sheet: record the question, answer Cancel (nothing discarded).
    const unsubscribe = subscribeConfirm(() => {
      const pending = getPendingConfirm()
      if (!pending) return
      asked.push(pending.message)
      answerConfirm(false)
    })
    try {
      await abandonInProgress({}, { id: 'w' }, 'Upper Body · Oct 6, 2026')
      await abandonInProgress({}, { id: 'w' })
    } finally {
      unsubscribe()
    }
    assert.deepEqual(asked, ['Abandon Upper Body · Oct 6, 2026? It will not be saved.', 'Abandon this session? It will not be saved.'])
  })
  it('the delete-confirm heads say "session"', () => {
    assert.equal(deletionConfirmHead('Bench', { inCurrentWorkout: true }), 'Bench is in the session in progress and will be archived (the session keeps it).')
    assert.equal(deletionConfirmHead('Bench', { hasHistory: true }), 'Bench has past sessions and will be archived (kept in your history).')
    assert.equal(deletionConfirmHead('Bench', { inDraft: true }), 'Bench is in an unfinished session and will be archived (kept).')
  })
})

describe('routine meaning reads "workout"', () => {
  it('default plan names are "Workout A" / "Workout B" (no "My")', () => {
    assert.deepEqual(machinesPlan({ days: 2, split: SPLIT_AB, picks: ['a', 'b'] }).routines.map((r) => r.name), ['Workout A', 'Workout B'])
    assert.deepEqual(machinesPlan({ days: 2, split: SPLIT_SAME, picks: ['a'] }).routines.map((r) => r.name), ['Workout'])
  })
  it('the kg offer says "workout"', () => {
    assert.equal(offerText({ from: [30], to: [32.5] }), 'You lifted 32.5 kg · workout says 30 kg')
    assert.equal(offerText({ from: [], to: [30] }), 'You lifted 30 kg · not in the workout yet')
    assert.equal(offerSheetText({ to: [40] }, 'Leg Press').body, 'The workout will start Leg Press at 40 kg.')
  })
})

describe('the routine delete confirm names the days (F18)', () => {
  const state = (loopWeeks, slots) => ({ schedule: { loopWeeks, slots: slots.map(([week, weekday, routineId = 'r']) => ({ id: `${week}-${weekday}`, week, weekday, routineId })) } })
  it('one-week loop: Mon-first weekday names', () => {
    assert.equal(routineScheduledDaysText(state(1, [[0, 4], [0, 1]]), 'r'), 'Mon and Thu')
    assert.equal(routineScheduledDaysText(state(1, [[0, 0], [0, 3], [0, 1]]), 'r'), 'Mon, Wed and Sun')
    assert.equal(routineScheduledDaysText(state(1, [[0, 5]]), 'r'), 'Fri')
  })
  it('a longer loop names the week', () => {
    assert.equal(routineScheduledDaysText(state(2, [[1, 1], [0, 1]]), 'r'), 'Mon (week 1) and Mon (week 2)')
  })
  it('no slot, or only another routine\'s → ""', () => {
    assert.equal(routineScheduledDaysText(state(1, [[0, 1, 'other']]), 'r'), '')
    assert.equal(routineScheduledDaysText({}, 'r'), '')
  })
})
