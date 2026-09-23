// req-123 — the static half of the audit Tier 2 fixes: every font-size is a named
// type-scale token (DEC-020), the dead showcase class is gone, the Showcase shows
// every Button/NavLink/Actions/Row/SectionHeader form, "Add note" keeps a ≥44px tap
// area, and long unbroken names wrap. The measured half (heights, scrollWidth at
// 390px) is in reports/req-123.md. Same readFileSync pattern as safe-area.test.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url)) // src/ui
const rawCss = readFileSync(join(here, 'ui.css'), 'utf8')
const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '') // declarations only, no comments
const showcase = readFileSync(join(here, 'Showcase.jsx'), 'utf8')

// The token block is the first `:root { … }` rule.
const rootStart = css.indexOf(':root {')
const rootEnd = css.indexOf('}', rootStart)
const tokenBlock = css.slice(rootStart, rootEnd)
const outsideTokens = css.slice(0, rootStart) + css.slice(rootEnd)

function ruleBody(selector) {
  const start = css.indexOf(selector + ' {')
  assert.ok(start >= 0, `selector ${selector} not found`)
  const open = css.indexOf('{', start)
  return css.slice(open + 1, css.indexOf('}', open))
}

test('no --ui-fs-lg anywhere in ui.css (it was never defined)', () => {
  assert.doesNotMatch(rawCss, /--ui-fs-lg/)
})

test('every font-size outside the token block is a bare var(--ui-text-*) — no raw px/rem', () => {
  const decls = [...outsideTokens.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1].trim())
  assert.ok(decls.length > 20, `found ${decls.length} font-size declarations`)
  const bad = decls.filter((v) => !/^var\(--ui-text-[a-z]+\)$/.test(v))
  assert.deepEqual(bad, [])
})

test('failure case: every --ui-text-* referenced is defined in the token block', () => {
  const defined = new Set([...tokenBlock.matchAll(/(--ui-text-[a-z]+):/g)].map((m) => m[1]))
  const used = new Set([...css.matchAll(/var\((--ui-text-[a-z]+)\)/g)].map((m) => m[1]))
  for (const t of used) assert.ok(defined.has(t), `${t} used but not defined`)
})

test('the rest-pill time and the timer count use scale tokens', () => {
  assert.match(tokenBlock, /--ui-text-emphasis:\s*28px/)
  assert.match(ruleBody('.ui-restpill__time'), /font-size:\s*var\(--ui-text-emphasis\)/)
  assert.match(ruleBody('.ui-timer__count'), /font-size:\s*var\(--ui-text-section\)/)
})

test('.ui-showcase__row is gone (it was used nowhere)', () => {
  assert.doesNotMatch(rawCss, /ui-showcase__row/)
  assert.doesNotMatch(showcase, /ui-showcase__row/)
})

test('"Add note" has a --ui-tap tall box, a transparent own border, and a hairline ::before at the old size', () => {
  const body = ruleBody('.ui-addnote')
  assert.match(body, /min-height:\s*var\(--ui-tap\)/)
  assert.doesNotMatch(body, /min-height:\s*auto/)
  assert.match(body, /border-color:\s*transparent/)
  // negative block margins return the extra height, so nothing around it moves
  assert.match(body, /margin-block:\s*calc\(\(var\(--ui-addnote-h\) - var\(--ui-tap\)\) \/ 2\)/)
  assert.match(body, /--ui-addnote-h:\s*calc\(var\(--ui-text-caption\) \+ 2 \* var\(--ui-s1\) \+ 2px\)/)
  const pill = ruleBody('.ui-addnote::before')
  assert.match(pill, /height:\s*var\(--ui-addnote-h\)/)
  assert.match(pill, /border:\s*1px solid var\(--ui-line\)/)
  assert.match(pill, /pointer-events:\s*none/)
})

test('long unbroken names wrap: titles, rows and subtitles get overflow-wrap: anywhere', () => {
  const block = css.match(/\.ui-title,\s*\.ui-section,\s*\.ui-sub,\s*\.ui-row\s*\{([^}]*)\}/)
  assert.ok(block, 'grouped overflow-wrap rule present')
  assert.match(block[1], /overflow-wrap:\s*anywhere/)
  // failure case: controls/values in a row must not break mid-word
  const optOut = css.match(/\.ui-row__value,\s*\.ui-row__action,\s*\.ui-row__chev\s*\{([^}]*)\}/)
  assert.ok(optOut, 'row value/action/chevron opt-out present')
  assert.match(optOut[1], /overflow-wrap:\s*normal/)
})

test('Showcase shows every Button variant + block, NavLink looks + both chevrons, Actions, ui-row--done, SectionHeader', () => {
  for (const v of ['primary', 'secondary', 'quiet']) {
    assert.match(showcase, new RegExp(`<Button variant="${v}"`), `Button ${v}`)
    assert.match(showcase, new RegExp(`look="${v}"`), `NavLink look ${v}`)
  }
  assert.match(showcase, /<Button variant="[a-z]+" block>/)
  assert.match(showcase, /chevron="back"/)
  assert.match(showcase, /chevron="forward"/)
  assert.match(showcase, /<Actions/)
  assert.match(showcase, /className="ui-row--done"/)
  assert.match(showcase, /<SectionHeader>/)
})
