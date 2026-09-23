// req-122 — one NavLink with a `look` prop, and the Actions row primitive.
//
// The views are JSX (plain `node --test` can't import them), so the call sites are
// locked as source text — the static approach of req-121.test.js. The class mapping
// is plain JS (views/nav-look.js) and is unit-tested for the exact strings the
// hand-written classes used to be. The rendered check is the req-122 before/after
// screenshots (reports/req-122.md).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import { lookClass } from './views/nav-look.js'

const here = dirname(fileURLToPath(import.meta.url)) // src
const read = (p) => readFileSync(join(here, p), 'utf8')

function jsxUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return jsxUnder(p)
    return p.endsWith('.jsx') ? [p] : []
  })
}
const views = jsxUnder(join(here, 'views')).map((p) => ({ file: relative(here, p), src: readFileSync(p, 'utf8') }))

function hits(re) {
  return views.flatMap(({ file, src }) => (src.match(re) || []).map((m) => `${file}: ${m}`))
}

test('static: no view hand-writes ui-btn / ui-navlink / ui-actions classes', () => {
  assert.ok(views.length >= 15, `expected the view files, found ${views.length}`)
  assert.deepEqual(hits(/className="ui-btn[^"]*"/g), [])
  assert.deepEqual(hits(/className=\{`ui-btn [^`]*`\}/g), [])
  assert.deepEqual(hits(/className="ui-navlink"/g), [])
  assert.deepEqual(hits(/className="ui-actions[^"]*"/g), [])
})

test('views import the library NavLink (ui/index.jsx), not the shared base', () => {
  assert.deepEqual(hits(/import \{[^}]*\bNavLink\b[^}]*\} from '(\.\.\/)*\.?\/?shared'/g), [])
})

test('lookClass emits exactly the classes the call sites used to hand-write', () => {
  assert.equal(lookClass('link'), 'ui-navlink')
  assert.equal(lookClass('quiet'), 'ui-btn ui-btn--quiet')
  assert.equal(lookClass('secondary'), 'ui-btn ui-btn--secondary')
  assert.equal(lookClass('primary', true), 'ui-btn ui-btn--primary ui-btn--block')
  assert.equal(lookClass('secondary', true), 'ui-btn ui-btn--secondary ui-btn--block')
  // matches Button's class order: ui-btn, ui-btn--<variant>, ui-btn--block
  // no look / 'plain' → no library class (the bottom menu, the in-text title link)
  assert.equal(lookClass(undefined), '')
  assert.equal(lookClass('plain'), '')
  // block is a button-look modifier only
  assert.equal(lookClass('link', true), 'ui-navlink')
})

test('library NavLink defaults to the link look; the base keeps none', () => {
  const ui = read('ui/index.jsx')
  assert.match(ui, /export function NavLink\(\{ look = 'link', \.\.\.rest \}\) \{\n\s*return <BaseNavLink look=\{look\} \{\.\.\.rest\} \/>/)
  const shared = read('views/shared.jsx')
  assert.match(shared, /export function NavLink\(\{ to, children, className, chevron, look, block = false, \.\.\.rest \}\)/)
  // ExercisesLink's ‹ is the chevron prop now, not typed into the label
  assert.match(shared, /<NavLink to=\{`\/workout\/\$\{routineId\}`\} look="link" chevron="back">Exercises<\/NavLink>/)
  assert.doesNotMatch(shared, /‹ Exercises/)
})

test('failure case — order: Actions renders retreat, then lateral, then forward (DESIGN §4)', () => {
  const ui = read('ui/index.jsx')
  const start = ui.indexOf('export function Actions(')
  assert.ok(start >= 0, 'Actions not found')
  const body = ui.slice(start, ui.indexOf('\n}\n', start))
  assert.match(body, /<div className=\{cx\('ui-actions', className\)\}>/)
  const r = body.indexOf('{retreat}')
  const l = body.indexOf('{lateral}')
  const f = body.indexOf('{forward}')
  assert.ok(r > 0 && l > r && f > l, 'markup order must be retreat → lateral → forward')
  // order lives in markup only — the row is never visually reversed
  const css = read('ui/ui.css')
  assert.doesNotMatch(css, /row-reverse/)
})

test('call sites that pass both put the retreat link in retreat and the commit in forward', () => {
  // A forward={…NavLink…} or retreat={…variant="primary"…} would invert DESIGN §4.
  assert.deepEqual(hits(/forward=\{<NavLink/g), [])
  assert.deepEqual(hits(/retreat=\{<Button[^>]*variant="primary"/g), [])
  const count = views.reduce((n, { src }) => n + (src.match(/<Actions\b/g) || []).length, 0)
  assert.equal(count, 13) // the 13 hand-written .ui-actions rows (12 + item.jsx's ui-exercise-actions)
})
