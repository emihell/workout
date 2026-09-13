// req-52 / DEC-036 — the floating bottom menu (BottomMenu.jsx).
//
// The menu is authored in JSX and reuses the shared NavLink primitive (DEC-016,
// views/shared.jsx — also JSX), so `node --test` cannot import and render it: the
// gate runs plain node with no JSX transform. Two things carry the coverage instead:
//   1. Selection (model A) is derived from activeTab(route.name); its three-group
//      mapping is asserted behaviourally in route.test.js — not re-asserted here, to
//      avoid holding the same fact in two places.
//   2. The render-only acceptance criteria that can't be run without a DOM — the
//      null-on-workout guard, the aria-labels on the icon circles, the unchanged
//      targets, the text-only oval — are locked here by reading the component source
//      as text. Same static-source approach as safe-area.test.js (which asserts the
//      CSS/HTML it can't execute). Emilio's browser look is the behavioural check.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url)) // src/ui
const src = readFileSync(join(here, 'BottomMenu.jsx'), 'utf8')

test('selection is derived from activeTab (route.js), not a private grouping', () => {
  assert.match(src, /import\s*\{[^}]*\bactiveTab\b[^}]*\}\s*from\s*'\.\.\/route'/)
  assert.match(src, /activeTab\(route\.name\)/)
  // model A: the current control is marked, the fill moves with it
  assert.match(src, /current === 'library' && 'is-current'/)
  assert.match(src, /current === 'workouts' && 'is-current'/)
  assert.match(src, /current === 'settings' && 'is-current'/)
})

test('failure/edge case: hidden during the in-workout flow (returns null on workout*)', () => {
  assert.match(src, /startsWith\('workout'\)\)\s*return null/)
})

test('a11y failure case: both icon-only circles expose an accessible name (aria-label)', () => {
  assert.match(src, /aria-label="Library"/)
  assert.match(src, /aria-label="Settings"/)
})

test('the current control is marked aria-current="page"', () => {
  const occurrences = src.match(/aria-current=\{current === '\w+' \? 'page' : undefined\}/g) || []
  assert.equal(occurrences.length, 3) // one per control; only the active one resolves to "page"
})

test('targets are unchanged: Workout → /, Library → /routines, Settings → /settings', () => {
  assert.match(src, /to="\/routines"/)
  assert.match(src, /to="\/settings"/)
  assert.match(src, /to="\/"/)
})

test('the Workout control is a text-only oval; the other two are icon circles', () => {
  // the oval carries the literal "Workout" text and the oval class
  assert.match(src, /ui-dock__oval/)
  assert.match(src, />\s*Workout\s*</)
  // the two circles render an icon component, no visible text
  assert.match(src, /ui-dock__circle/)
  assert.match(src, /<GridIcon \/>/)
  assert.match(src, /<SlidersIcon \/>/)
})

test('links, not buttons (DEC-016): the three controls are shared NavLinks', () => {
  assert.match(src, /import\s*\{\s*NavLink as BaseNavLink\s*\}\s*from\s*'\.\.\/views\/shared'/)
  const navlinks = src.match(/<BaseNavLink\b/g) || []
  assert.equal(navlinks.length, 3)
})
