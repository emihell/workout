// req-52 / DEC-036 — the floating bottom menu (BottomMenu.jsx).
//
// The menu is authored in JSX and reuses the shared NavLink primitive (DEC-016,
// views/shared.jsx — also JSX), so `node --test` cannot import and render it: the
// gate runs plain node with no JSX transform. Two things carry the coverage instead:
//   1. Selection (model A) is derived from activeTab(route.name); its grouping is asserted behaviourally in route.test.js — not re-asserted here, to
//      avoid holding the same fact in two places.
//   2. The render-only acceptance criteria that can't be run without a DOM — the
//      null-on-workout guard, the visible label on the circle (req-198), the
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
  // req-198 — the Settings circle left the bar
  assert.doesNotMatch(src, /current === 'settings'/)
})

test('failure/edge case: hidden during the in-workout flow (returns null on workout*)', () => {
  assert.match(src, /startsWith\('workout'\)\)\s*return null/)
})

// req-198 (review F10) — was "both icon-only circles expose an aria-label". The Library
// circle now carries a visible text label, which is its accessible name; Settings is gone.
test('a11y failure case: the Library circle has a visible label (its accessible name)', () => {
  assert.match(src, /<GridIcon \/>\s*<span className="ui-dock__label">Library<\/span>/)
  assert.doesNotMatch(src, /aria-label="Settings"/)
})

test('the current control is marked aria-current="page"', () => {
  const occurrences = src.match(/aria-current=\{current === '\w+' \? 'page' : undefined\}/g) || []
  assert.equal(occurrences.length, 2) // one per control (req-198: two); only the active one resolves to "page"
})

// req-198 — Settings → /settings left the bar (it is "Backup & data" under History).
test('targets: Workout → /, Library → /routines; no /settings in the bar', () => {
  assert.match(src, /to="\/routines"/)
  assert.doesNotMatch(src, /to="\/settings"/)
  assert.doesNotMatch(src, /to="\/history"/) // Emilio, mid-build: History stays on Home
  assert.match(src, /to="\/"/)
})

test('the Workout control is a text-only oval; Library is an icon circle', () => {
  // the oval carries the literal "Workout" text and the oval class
  assert.match(src, /ui-dock__oval/)
  assert.match(src, />\s*Workout\s*</)
  // req-198 — one circle (Library), icon + visible label; the sliders icon is gone
  assert.match(src, /ui-dock__circle/)
  assert.match(src, /<GridIcon \/>/)
  assert.doesNotMatch(src, /SlidersIcon/)
})

test('links, not buttons (DEC-016): the two controls are shared NavLinks', () => {
  assert.match(src, /import\s*\{\s*NavLink as BaseNavLink\s*\}\s*from\s*'\.\.\/views\/shared'/)
  const navlinks = src.match(/<BaseNavLink\b/g) || []
  assert.equal(navlinks.length, 2) // req-198: was 3 (Settings left)
})
