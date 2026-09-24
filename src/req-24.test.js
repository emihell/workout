// req-24 / DEC-079 — native confirm/alert/prompt replaced by the in-app confirm sheet.
// (1) the guard: no native dialog call anywhere in src/ outside tests — they block the
// page, look foreign on a phone, and freeze automated browser tests (L-033); (2) the
// confirm store's semantics; (3) the dead "Pick effort." guard really was unreachable.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { answerConfirm, askConfirm, getPendingConfirm } from './ui/confirm.js'
import { formFieldsWithDraft, initialSetFields, setDraftFromLoggedSet } from './workout-log.js'

const SRC = fileURLToPath(new URL('.', import.meta.url))

// `window.confirm(`, `globalThis.alert`, `self.prompt` …; `window['confirm']`; a
// destructure off the global (`const { alert } = window`); or a bare global `confirm(` /
// `alert(` / `prompt(` (not a method like `store.confirm(` or a name like `askConfirm(`).
const DIALOG = '(?:confirm|alert|prompt)'
const GLOBAL = '(?:window|globalThis|self)'
export const NATIVE_DIALOG = new RegExp(
  [
    `\\b${GLOBAL}\\s*(?:\\?\\.|\\.)\\s*${DIALOG}\\b`,
    `\\b${GLOBAL}\\s*\\[\\s*['"\`]${DIALOG}['"\`]\\s*\\]`,
    `\\{[^}]*\\b${DIALOG}\\b[^}]*\\}\\s*=\\s*${GLOBAL}\\b`,
    `(?<![.\\w$])${DIALOG}\\s*\\(`,
  ].join('|'),
)

// req-153 — comments are blanked (newlines kept, so line numbers hold) by a small
// tokenizer instead of skipping every line that starts with `//`, `/*` or `*`: a code
// line such as `  * confirm(x)` (a continued expression) is no longer exempt. Strings
// and template literals are tracked only so a `//` inside one isn't read as a comment;
// their contents, and `${…}` code, are still scanned.
export function stripComments(src) {
  let out = ''
  let i = 0
  const stack = [] // open quotes: "'", '"', '`', or '{' for a `${…}` inside a template
  while (i < src.length) {
    const c = src[i]
    const top = stack.at(-1)
    if (top === "'" || top === '"') {
      if (c === '\\') { out += src.slice(i, i + 2); i += 2; continue }
      if (c === top || c === '\n') stack.pop()
      out += c; i += 1; continue
    }
    if (top === '`') {
      if (c === '\\') { out += src.slice(i, i + 2); i += 2; continue }
      if (c === '`') stack.pop()
      else if (c === '$' && src[i + 1] === '{') { stack.push('{'); out += '${'; i += 2; continue }
      out += c; i += 1; continue
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') { out += ' '; i += 1 }
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      const close = src.indexOf('*/', i + 2)
      const stop = close === -1 ? src.length : close + 2
      out += src.slice(i, stop).replace(/[^\n]/g, ' ')
      i = stop
      continue
    }
    if (c === '"' || c === "'" || c === '`') stack.push(c)
    else if (c === '{' && top === '{') stack.push('{')
    else if (c === '}' && top === '{') stack.pop()
    out += c
    i += 1
  }
  return out
}

export function nativeDialogHitsIn(source, name = '') {
  const code = stripComments(source).split('\n')
  const raw = source.split('\n')
  return code.flatMap((line, i) => (NATIVE_DIALOG.test(line) ? [`${name}:${i + 1}: ${raw[i].trim()}`] : []))
}

// Every source file under src/ except tests: .js .mjs .cjs .jsx (and .ts/.tsx, should
// they ever appear).
export const SOURCE_FILE = /\.(?:[mc]?js|jsx|tsx?)$/
export const TEST_FILE = /\.test\.[mc]?[jt]sx?$/

export function nativeDialogHits(dir = SRC) {
  const hits = []
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const path = join(d, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name)) {
        hits.push(...nativeDialogHitsIn(readFileSync(path, 'utf8'), relative(dir, path)))
      }
    }
  }
  walk(dir)
  return hits
}

describe('no native dialogs in src/ (req-24 guard)', () => {
  it('no window.confirm / alert / prompt, or bare confirm( / alert( / prompt(, outside tests', () => {
    assert.deepEqual(nativeDialogHits(), [])
  })

  it('the pattern catches every native form and spares look-alikes', () => {
    for (const bad of ['window.confirm("x")', 'if (!confirm(msg)) return', 'window.alert(e)', 'alert("x")',
      'prompt("name?")', 'globalThis.confirm(m)', 'const c = window.prompt']) {
      assert.ok(NATIVE_DIALOG.test(bad), bad)
    }
    for (const ok of ['askConfirm(m)', 'answerConfirm(true)', 'store.confirm(x)', 'role="alert"',
      "await ask('Replace?')", 'confirmLabel: "Delete"', "const { confirmLabel } = opts", 'window.confirmed']) {
      assert.ok(!NATIVE_DIALOG.test(ok), ok)
    }
  })

  // req-153 — the forms the req-24 guard missed, one test each.
  it("catches window['confirm'] / globalThis[\"alert\"] / self[`prompt`]", () => {
    for (const bad of ["window['confirm']('x')", 'globalThis["alert"](e)', 'const p = self[`prompt`]', 'window?.confirm(m)']) {
      assert.equal(nativeDialogHitsIn(bad).length, 1, bad)
    }
  })

  it('catches a destructure off the global: const { alert } = window', () => {
    for (const bad of ['const { alert } = window', 'const { confirm: ask } = globalThis', 'let { prompt, x } = self']) {
      assert.equal(nativeDialogHitsIn(bad).length, 1, bad)
    }
  })

  it('scans .mjs / .cjs files (and still skips *.test.* files)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'req153-guard-'))
    try {
      mkdirSync(join(dir, 'lib'))
      writeFileSync(join(dir, 'lib', 'util.mjs'), "export const ask = (m) => window.confirm(m)\n")
      writeFileSync(join(dir, 'old.cjs'), "module.exports = () => alert('x')\n")
      writeFileSync(join(dir, 'fine.test.mjs'), "window.confirm('in a test')\n")
      assert.deepEqual(nativeDialogHits(dir).sort(), [
        "lib/util.mjs:1: export const ask = (m) => window.confirm(m)",
        "old.cjs:1: module.exports = () => alert('x')",
      ])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('a code line starting with `*` is scanned; real comments are not', () => {
    const src = [
      'const n = 2',
      '  * confirm(x) // a continued expression, not a comment',
      '/* the delete confirm (prose)',
      ' * alert( in a block comment',
      ' */',
      '// window.confirm in a line comment',
      "const url = 'http://example.com' ; alert(1)",
      'const t = `${window.prompt()}`',
    ].join('\n')
    assert.deepEqual(nativeDialogHitsIn(src, 'f.js'), [
      'f.js:2: * confirm(x) // a continued expression, not a comment',
      "f.js:7: const url = 'http://example.com' ; alert(1)",
      'f.js:8: const t = `${window.prompt()}`',
    ])
  })
})

describe('askConfirm — the confirm store', () => {
  it('opens with the message + label; answering resolves and closes', async () => {
    const p = askConfirm('Remove set?', { confirmLabel: 'Remove' })
    assert.deepEqual(
      { message: getPendingConfirm().message, confirmLabel: getPendingConfirm().confirmLabel },
      { message: 'Remove set?', confirmLabel: 'Remove' },
    )
    answerConfirm(true)
    assert.equal(await p, true)
    assert.equal(getPendingConfirm(), null)
  })

  it('a second ask cancels the first (only one sheet open)', async () => {
    const first = askConfirm('A?')
    const second = askConfirm('B?')
    assert.equal(await first, false)
    assert.equal(getPendingConfirm().message, 'B?')
    answerConfirm(false)
    assert.equal(await second, false)
  })

  it('answering with nothing open is a no-op', () => {
    answerConfirm(true)
    assert.equal(getPendingConfirm(), null)
  })
})

// item.jsx's `if (work && !cardio && !rpe) alert('Pick effort.')` was deleted, not ported:
// the effort the form submits is the SegmentedControl's value (non-clearable, values
// 2–5) started from formFieldsWithDraft().effort. That start is never falsy:
describe('"Pick effort." was unreachable', () => {
  const seedFor = (restore) =>
    initialSetFields({ weighted: true, fromRestore: !!restore, restore, hasHistory: true, history: { weight: '' }, carry: null, target: null })
  const cases = {
    'fresh set': seedFor(null),
    'Previous onto a set logged with no rpe': seedFor({ weight: '', reps: '', rpe: '', note: '' }),
    'Previous onto rpe 0 (imported/odd data)': seedFor({ weight: '', reps: '', rpe: '0', note: '' }),
  }
  const drafts = {
    'no draft': null,
    'draft with empty effort': { effort: '' },
    'draft from a skipped (rpe-less) logged set': setDraftFromLoggedSet('k', { setType: 'work', rpe: null, skipped: true }),
    'draft from a logged rpe-0 set': setDraftFromLoggedSet('k', { setType: 'work', rpe: 0, reps: 5 }),
  }
  for (const [seedName, seed] of Object.entries(cases)) {
    for (const [draftName, draft] of Object.entries(drafts)) {
      it(`${seedName} + ${draftName} → effort is set`, () => {
        const { effort } = formFieldsWithDraft({ seed, draft, weighted: true, durationTarget: 0 })
        assert.ok(effort, `effort was ${JSON.stringify(effort)}`)
      })
    }
  }
})
