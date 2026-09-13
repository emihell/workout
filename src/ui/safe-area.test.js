// req-51 — iPhone safe areas + a11y. These lock the acceptance criteria that can
// be checked statically: the viewport meta opts into safe areas, the top/side
// insets are env()-driven (NOT a hardcoded pixel bump that would waste space on a
// no-notch device), and the "in progress" status text uses an AA-passing token.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url)) // src/ui
const repoRoot = join(here, '..', '..')
const html = readFileSync(join(repoRoot, 'index.html'), 'utf8')
const css = readFileSync(join(here, 'ui.css'), 'utf8')

// Pull the body of a CSS rule by selector, e.g. ".ui-main {".
function ruleBody(selector) {
  const start = css.indexOf(selector + ' {')
  assert.ok(start >= 0, `selector ${selector} not found`)
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}

test('viewport meta opts into safe areas (viewport-fit=cover)', () => {
  const meta = html.match(/<meta name="viewport"[^>]*>/)
  assert.ok(meta, 'viewport meta present')
  assert.match(meta[0], /viewport-fit=cover/)
})

test('top + side insets are reserved on .ui-main and are env()-driven', () => {
  const body = ruleBody('.ui-main')
  assert.match(body, /padding-top:\s*env\(safe-area-inset-top/)
  assert.match(body, /padding-left:\s*env\(safe-area-inset-left/)
  assert.match(body, /padding-right:\s*env\(safe-area-inset-right/)
})

test('failure case: no hardcoded pixel bump for the top inset', () => {
  // The top spacing must come only from env(); a device with no inset gets none.
  const body = ruleBody('.ui-main')
  const top = body.match(/padding-top:\s*([^;]+);/)
  assert.ok(top, 'padding-top declared')
  assert.match(top[1].trim(), /^env\(safe-area-inset-top(,\s*0px)?\)$/)
})

test('bottom chrome still clears the home indicator via env()', () => {
  // req-52 / DEC-036 — the flush --ui-tabbar-h bar became a floating dock. The
  // dock itself sits above the home indicator (its `bottom` offset carries the
  // safe-area term), and content clears the dock via --ui-dock-clear, which also
  // carries the safe-area term. Same env()-driven guarantee, new names.
  assert.match(ruleBody('.ui-dock'), /bottom:[^;]*env\(safe-area-inset-bottom/)
  assert.match(css, /--ui-dock-clear:\s*calc\([^;]*env\(safe-area-inset-bottom/)
  // <main> reserves that clearance so no screen hides behind the dock.
  assert.match(ruleBody('.ui-main'), /padding-bottom:[^;]*var\(--ui-dock-clear\)/)
})

test('a11y: "in progress" status text uses an AA-passing token (ink-2, not ink-3)', () => {
  const body = ruleBody('.ui-inprogress')
  assert.match(body, /color:\s*var\(--ui-ink-2\)/)
  assert.doesNotMatch(body, /var\(--ui-ink-3\)/)
})
