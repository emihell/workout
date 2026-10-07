// req-198 / DEC-110 §1, as changed mid-build by Planner (Emilio; DEC-112): the bottom bar is
// removed and Home is the hub. Settings becomes "Backup & data" at the bottom of History; the
// save-failed banner gets its own Export; deep screens get a "Today" link opposite Back.
//
// The whole App is rendered under happy-dom (test-support/render.js) for the dock / Today
// link criteria; a few render-only details are locked as source text (the approach of
// req-121/req-174), and exportBackup — the one Export both buttons call — is run for real
// with an injected download.
import { test, describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { act, importJsx, render } from './test-support/render.js'
import { exportBackup } from './import-backup.js'
import { applyBackup } from './exchange.js'
import { emptyState } from './persistence.js'
import { showsTodayLink } from './route.js'

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
  // req-203 test edit (§4): the buttons read "Back up now" (was "Export") and "Restore from
  // a backup" (was "Import"); the order check is unchanged.
  const exp = at('Back up now\n')
  const imp = at('label="Restore from a backup"')
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

test('History keeps its Back to "/" (not top-level, DEC-015)', () => {
  const body = fnBody(list, 'History')
  assert.match(body, /<Screen>\n\s*<Back to="\/" \/>\n\s*<Title>History<\/Title>/)
})

test('first-run Home drops the Schedule and Settings rows; Import stays', () => {
  const start = today.indexOf('if (isFirstRun(store)) {')
  // req-205 test edit: the normal Home's visible `<Title>Today</Title>` is gone (DEC-114), so
  // the end anchor is its hidden h1. Without this the anchor was -1 and the slice ran to the end
  // of the file. Assertions unchanged.
  const end = today.indexOf('<h1 className="ui-visually-hidden">Today</h1>')
  assert.ok(end > start)
  const firstRun = today.slice(start, end)
  assert.doesNotMatch(firstRun, /<Row to="\/settings">/)
  assert.doesNotMatch(firstRun, /<Row to="\/schedule">/)
  assert.match(firstRun, /<Row to="\/routines">Workouts<\/Row>/)
  assert.match(firstRun, /<Row to="\/history">History<\/Row>/)
  assert.match(firstRun, /<FileButton\s+label="Import"/)
})

describe('showsTodayLink — "Today" opposite Back only where Back does not already go home', () => {
  it('shows on a deep screen whose Back is not "/"', () => {
    assert.equal(showsTodayLink('/routines', 'routine'), true)
    assert.equal(showsTodayLink('/history', 'settings'), true)
    assert.equal(showsTodayLink('/history/month/2026-09', 'history-detail'), true)
    assert.equal(showsTodayLink('/schedule/0/1/slot-a?from=%2Fx', 'schedule-slot'), true)
  })
  it('failure case: hidden where Back already goes home (query ignored)', () => {
    assert.equal(showsTodayLink('/', 'routines'), false)
    assert.equal(showsTodayLink('/', 'history'), false)
    assert.equal(showsTodayLink('/?from=%2Fhistory', 'history-detail'), false)
    assert.equal(showsTodayLink(undefined, 'routines'), false) // Back's default target is "/"
  })
  it('failure case: never on Home or any in-workout screen (route name starts with workout)', () => {
    assert.equal(showsTodayLink('/routines', 'today'), false)
    for (const name of ['workout', 'workout-preview', 'workout-setup', 'workout-item', 'workout-item-log', 'workout-finish', 'workout-add']) {
      assert.equal(showsTodayLink('/workout/r', name), false, name)
    }
  })
})

// The real App, rendered: the dock is gone everywhere and the Today link follows the rule.
describe('rendered App — no dock; Today link on deep screens (DEC-112)', () => {
  const h = React.createElement
  const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
  let view = null
  afterEach(async () => {
    if (view) await view.unmount()
    view = null
  })
  const seed = JSON.parse(read('db.json'))
  async function open(hash) {
    localStorage.clear()
    localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
    localStorage.setItem('workout-mvp-v8', JSON.stringify(seed))
    window.location.hash = `#${hash}`
    const { default: App } = await importJsx('./App.jsx', import.meta.url)
    view = await render(h(App))
    await flush()
  }
  const todayLink = () => view.all('a').filter((a) => a.textContent.trim() === 'Today')
  const backLink = () => view.all('a').find((a) => a.textContent.trim() === '‹ Back') ?? null

  const SCREENS = [
    ['/', 'Home', 0],
    ['/routines', 'the Workouts list', 0],
    ['/history', 'History', 0],
    ['/routines/sess-upper', 'a routine detail', 1],
    ['/settings', 'Backup & data', 1],
  ]
  for (const [hash, label, todays] of SCREENS) {
    it(`${label} (${hash}): no .ui-dock; ${todays ? 'a' : 'no'} Today link`, async () => {
      await open(hash)
      assert.equal(document.querySelectorAll('.ui-dock, nav[aria-label="Primary"]').length, 0)
      assert.equal(todayLink().length, todays, view.text().slice(0, 200))
      if (todays) assert.equal(todayLink()[0].getAttribute('href'), '#/')
    })
  }

  it('the Workouts list and History have a Back to "/" (no longer top-level, DEC-015)', async () => {
    for (const hash of ['/routines', '/history']) {
      await open(hash)
      assert.equal(backLink()?.getAttribute('href'), '#/', hash)
      await view.unmount()
      view = null
    }
  })

  it('routine detail → Today lands on "/" (Home)', async () => {
    await open('/routines/sess-upper')
    const [today] = todayLink()
    await view.click(today)
    await flush()
    assert.equal(window.location.hash, '#/')
    assert.ok(view.all('a').some((a) => a.textContent.trim() === 'Workouts ›'), 'Home renders')
  })

  it("Home: a small \"Workouts ›\" link (link look) to /routines", async () => {
    await open('/')
    const link = view.all('a').find((a) => a.textContent.trim() === 'Workouts ›')
    assert.ok(link)
    assert.equal(link.getAttribute('href'), '#/routines')
    assert.equal(link.className, 'ui-navlink') // link look, not a button look
  })

  it('failure case: an in-workout screen shows no Today link and no dock', async () => {
    await open('/workout/sess-upper/slot-sess-upper/2026-09-21')
    assert.match(view.text(), /Upper Body/)
    assert.equal(todayLink().length, 0)
    assert.equal(document.querySelectorAll('.ui-dock').length, 0)
  })
})
