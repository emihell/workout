// req-174 — an empty home offers "Create your first routine" (primary, -> /routines/new)
// with Import as the secondary action; the subtitle drops "start empty".
//
// Today.jsx is JSX, so plain `node --test` can't render it; the first-run block is locked
// as source text (the approach of req-121.test.js). The rendered check is the browser
// receipt in reports/req-174.md.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { isFirstRun } from './history-queries.js'
import { emptyState } from './persistence.js'

const here = dirname(fileURLToPath(import.meta.url))
const today = readFileSync(join(here, 'views/Today.jsx'), 'utf8')

// The first-run early return: from `if (isFirstRun(store))` to the normal layout's title.
const start = today.indexOf('if (isFirstRun(store)) {')
const end = today.indexOf('<Title>{greeting()}</Title>')
const firstRun = today.slice(start, end)
const label = 'Create your first routine'

test('req-174: the button lives only inside the unchanged isFirstRun(store) gate', () => {
  assert.ok(start > 0 && end > start, 'first-run block not found')
  assert.equal(today.split(label).length - 1, 1)
  const at = today.indexOf(label)
  assert.ok(at > start && at < end)
})

test('req-174: primary first-routine link to /routines/new, Import secondary beside it', () => {
  assert.match(firstRun, /<Title subtitle="Nothing here yet\.">Today<\/Title>/)
  assert.doesNotMatch(firstRun, /subtitle="[^"]*start empty/)
  assert.match(firstRun, /<NavLink to="\/routines\/new" look="primary" block>\s*Create your first routine\s*<\/NavLink>\s*<FileButton\s+label="Import"/)
  assert.doesNotMatch(firstRun, /<FileButton[^>]*variant=/) // Import keeps FileButton's secondary default
  assert.match(firstRun, /importWithBackup\(\{ store, payload \}\)/) // Import behaviour unchanged
})

test('req-174: which stores are first-run (main condition, unchanged)', () => {
  assert.equal(isFirstRun(emptyState()), true)
  assert.equal(isFirstRun({ ...emptyState(), workouts: [{ id: 'w1' }] }), false) // history, no routines
  assert.equal(isFirstRun({ ...emptyState(), routines: [{ id: 'r1' }] }), false) // routine, no history
})
