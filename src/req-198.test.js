// req-198 / DEC-110 §1 — Settings leaves the bar and becomes "Backup & data" at the
// bottom of History; the save-failed banner gets its own Export.
//
// The views are JSX, so plain `node --test` can't render them; the render-only criteria
// are locked as source text (the approach of req-121/req-174), and exportBackup — the one
// Export both buttons call — is run for real with an injected download.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { exportBackup } from './import-backup.js'
import { applyBackup } from './exchange.js'
import { emptyState } from './persistence.js'

const here = dirname(fileURLToPath(import.meta.url))
const read = (path) => readFileSync(join(here, path), 'utf8')
const app = read('App.jsx')
const settings = read('views/Settings.jsx')
const list = read('views/history/list.jsx')
const today = read('views/Today.jsx')

function fnBody(src, name) {
  const start = src.indexOf(`function ${name}(`)
  assert.ok(start >= 0, `${name} not found`)
  const next = src.indexOf('\nfunction ', start + 1)
  const nextExport = src.indexOf('\nexport function ', start + 1)
  const ends = [next, nextExport].filter((i) => i > 0)
  return src.slice(start, ends.length ? Math.min(...ends) : undefined)
}

test('AC4: the save-failed banner renders an Export button that calls the shared export', () => {
  const banner = fnBody(app, 'SaveFailedBanner')
  assert.match(banner, /<Button onClick=\{\(\) => exportBackup\(store\)\}>Export<\/Button>/)
  assert.match(banner, /<Banner role="alert">/)
  assert.doesNotMatch(banner, /from Settings/) // F12: the copy no longer points at Settings
  assert.match(app, /import \{ exportBackup \} from '\.\/import-backup'/)
})

test('exportBackup downloads the same backup file Settings exported (name + payload)', () => {
  const store = { ...emptyState(), routines: [{ id: 'r1', name: 'Upper', items: [] }] }
  const calls = []
  const name = exportBackup(store, {
    now: new Date(2026, 9, 7, 12),
    download: (filename, data) => calls.push({ filename, data }),
  })
  assert.equal(name, 'workout-database-2026-10-07.json')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].filename, 'workout-database-2026-10-07.json')
  // the payload is a valid backup that round-trips the routine
  const back = applyBackup(calls[0].data)
  assert.deepEqual(back.state.routines.map((r) => r.id), ['r1'])
})

test('Settings (Backup & data) uses exportBackup too — one Export implementation', () => {
  assert.match(settings, /exportBackup\(store, \{ includeAssistant \}\)/)
  assert.doesNotMatch(settings, /buildBackup/)
})

test('/settings is titled "Backup & data", Back → /history, Export then Import first', () => {
  assert.match(settings, /<Title>Backup &amp; data<\/Title>/)
  assert.match(settings, /<Back to="\/history" \/>/)
  const at = (needle) => {
    const i = settings.indexOf(needle)
    assert.ok(i > 0, needle)
    return i
  }
  const exp = at('Export\n')
  const imp = at('label="Import"')
  const dev = at('<SectionHeader>Developer</SectionHeader>')
  assert.ok(exp < imp && imp < dev, 'Export, then Import, then the Developer group')
  // the Developer group holds the four developer tools, after the header
  for (const tool of ['label="Assistant prompt"', 'Export analytics', 'label="Feedback notes"', '<Row to="/components">']) {
    assert.ok(at(tool) > dev, `${tool} sits in the Developer group`)
  }
})

test('AC3 failure case: History always shows "Backup & data ›", outside every empty/month branch', () => {
  const body = fnBody(list, 'History')
  // the main (non-month) screen: after the month early return
  const main = body.slice(body.indexOf('  return (\n    <Screen>\n      <Back to="/" />'))
  assert.ok(main.length > 0, 'History main screen not found')
  assert.match(main, /<Row to="\/settings">Backup &amp; data<\/Row>/)
  // unconditional: the row is not inside the months / inProgress conditionals
  const row = main.indexOf('<Row to="/settings">')
  const before = main.slice(0, row)
  // every JSX expression before it is closed: balanced braces = not inside any {cond ? … }
  const opens = (before.match(/\{/g) || []).length
  const closes = (before.match(/\}/g) || []).length
  assert.equal(opens, closes, 'Backup & data must not sit inside a conditional')
  // and it is the last thing on the screen
  assert.match(main.slice(row), /^<Row to="\/settings">Backup &amp; data<\/Row>\s*<\/List>\s*<\/Screen>/)
})

test('History keeps its Back to "/" (not top-level: Emilio, mid-build — History stays on Home)', () => {
  const body = fnBody(list, 'History')
  assert.match(body, /<Screen>\n\s*<Back to="\/" \/>\n\s*<Title>History<\/Title>/)
})

test('first-run Home drops the Schedule and Settings rows; Import stays', () => {
  const start = today.indexOf('if (isFirstRun(store)) {')
  const end = today.indexOf('<Title>{greeting()}</Title>')
  const firstRun = today.slice(start, end)
  assert.doesNotMatch(firstRun, /<Row to="\/settings">/)
  assert.doesNotMatch(firstRun, /<Row to="\/schedule">/)
  assert.match(firstRun, /<Row to="\/routines">Routines<\/Row>/)
  assert.match(firstRun, /<Row to="\/history">History<\/Row>/)
  assert.match(firstRun, /<FileButton\s+label="Import"/)
})
