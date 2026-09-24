// req-24 / DEC-079 — native confirm/alert/prompt replaced by the in-app confirm sheet.
// (1) the guard: no native dialog call anywhere in src/ outside tests — they block the
// page, look foreign on a phone, and freeze automated browser tests (L-033); (2) the
// confirm store's semantics; (3) the dead "Pick effort." guard really was unreachable.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { answerConfirm, askConfirm, getPendingConfirm } from './ui/confirm.js'
import { formFieldsWithDraft, initialSetFields, setDraftFromLoggedSet } from './workout-log.js'

const SRC = fileURLToPath(new URL('.', import.meta.url))

// `window.confirm(`, `globalThis.alert`, `self.prompt` … or a bare global `confirm(` /
// `alert(` / `prompt(` (not a method like `store.confirm(` or a name like `askConfirm(`).
export const NATIVE_DIALOG = /\b(?:window|globalThis|self)\.(?:confirm|alert|prompt)\b|(?<![.\w$])(?:confirm|alert|prompt)\s*\(/

export function nativeDialogHits(dir = SRC) {
  const hits = []
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const path = join(d, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (/\.(js|jsx)$/.test(entry.name) && !entry.name.endsWith('.test.js')) {
        readFileSync(path, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            // Code only: a comment line may say "the delete confirm (…)" in prose.
            if (/^\s*(\/\/|\/\*|\*)/.test(line)) return
            if (NATIVE_DIALOG.test(line)) hits.push(`${relative(SRC, path)}:${i + 1}: ${line.trim()}`)
          })
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
      "await ask('Replace?')", 'confirmLabel: "Delete"']) {
      assert.ok(!NATIVE_DIALOG.test(ok), ok)
    }
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
