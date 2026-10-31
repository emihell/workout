// req-272 — the handoff hook names `./plan save`; the planning grants carry no git commit/reset
// (README §Setup step 5 and `plan doctor`'s list agree); the doc-size ratchet in
// scripts/check_handoff.py (scripts/doc_limits.json). Fixture repos in temp dirs only; the real
// repo is read (the table, README, plan, the hook), never written.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const ROOT = new URL('../', import.meta.url).pathname
const CHECK = join(ROOT, 'scripts/check_handoff.py')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

const git = (root, ...args) =>
  spawnSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { encoding: 'utf8' })
const write = (root, p, text) => {
  mkdirSync(dirname(join(root, p)), { recursive: true })
  writeFileSync(join(root, p), text)
}
const commitAll = (root, msg = 'fixture') => {
  if (!existsSync(join(root, '.git'))) assert.equal(git(root, 'init', '-q').status, 0)
  assert.equal(git(root, 'add', '-A').status, 0)
  const r = git(root, 'commit', '-qm', msg, '--allow-empty')
  assert.equal(r.status, 0, r.stderr)
}
const lines = (n) => Array.from({ length: n }, (_, i) => `line ${i + 1}\n`).join('')
const table = (docs) => JSON.stringify({ docs }, null, 2) + '\n'
const ratchet = (root, ...extra) =>
  spawnSync('python3', [CHECK, '--repo', root, '--only', 'doc-limits', ...extra], { encoding: 'utf8' })
const full = (root) => spawnSync('python3', [CHECK, '--repo', root], { encoding: 'utf8' })

// A repo with one rule doc of 10 lines at a ceiling of 10, committed.
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'req-272-'))
  write(root, 'handoff/rules/RULE.md', lines(10))
  write(root, 'scripts/doc_limits.json', table({ 'handoff/rules/RULE.md': { ceiling: 10, reason: 'baseline' } }))
  commitAll(root)
  return root
}

describe('req-272 the pre-commit hook names ./plan save', () => {
  it('no line in the hook suggests a hand-set HANDOFF=1 commit', () => {
    const hook = read('.githooks/pre-commit')
    assert.doesNotMatch(hook, /HANDOFF=1 git commit/)
    assert.doesNotMatch(hook, /echo .*HANDOFF=1/)
    assert.match(hook, /if \[ -n "\$HANDOFF" \]/, 'the bypass itself stays — plan save sets it')
  })

  it('staging a handoff/ file in a sandbox repo is refused, and the message names ./plan save', () => {
    const root = mkdtempSync(join(tmpdir(), 'req-272-hook-'))
    assert.equal(git(root, 'init', '-q').status, 0)
    mkdirSync(join(root, '.githooks'))
    copyFileSync(join(ROOT, '.githooks/pre-commit'), join(root, '.githooks/pre-commit'))
    assert.equal(git(root, 'config', 'core.hooksPath', '.githooks').status, 0)
    write(root, 'handoff/NOW.md', '# now\n')
    assert.equal(git(root, 'add', '-A').status, 0)
    const r = spawnSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@example.com',
      'commit', '-qm', 'touch handoff'], { encoding: 'utf8', env: { ...process.env, HANDOFF: '' } })
    assert.notEqual(r.status, 0)
    assert.match(r.stderr, /Refusing: this commit modifies handoff\//)
    assert.match(r.stderr, /\.\/plan save "message"/)
    assert.doesNotMatch(r.stderr, /HANDOFF=1/)
    assert.equal(git(root, 'rev-parse', '--verify', '--quiet', 'HEAD').stdout, '', 'nothing committed')
  })
})

describe('req-272 grants: README §Setup step 5 = plan doctor\'s canonical list', () => {
  const readmeGrants = () => {
    const line = read('README.md').split('\n').find((l) => l.startsWith("printf '%s\\n' '{ \"permissions\""))
    assert.ok(line, 'README has the printf grant line')
    return JSON.parse(line.match(/'(\{.*\})'/)[1]).permissions.allow
  }
  const doctorGrants = () => {
    const block = read('plan').match(/local canonical_grants=\(\n([\s\S]*?)\n\s*\)/)[1]
    return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1])
  }

  it('the two lists are the same set, in the same order', () => {
    assert.deepEqual(readmeGrants(), doctorGrants())
  })

  it('no git commit / git reset grant; the ./plan and ../workout-codebase/plan forms both present', () => {
    const g = readmeGrants()
    assert.ok(!g.includes('Bash(git commit:*)'))
    assert.ok(!g.includes('Bash(git reset:*)'))
    for (const verb of ['save', 'status', 'publish', 'closeout']) {
      assert.ok(g.includes(`Bash(./plan ${verb}:*)`), `./plan ${verb}`)
      assert.ok(g.includes(`Bash(../workout-codebase/plan ${verb}:*)`), `../workout-codebase/plan ${verb}`)
    }
    assert.equal(g.length, 12)
  })
})

describe('req-272 the doc-size ratchet (check_handoff --only doc-limits)', () => {
  it('a doc at its ceiling passes with no output', () => {
    const r = ratchet(fixture())
    assert.equal(r.stdout, '')
    assert.equal(r.status, 0)
  })

  it('AC3: a doc grown 1 line past its ceiling fails, naming file, count, ceiling and how to raise', () => {
    const root = fixture()
    write(root, 'handoff/rules/RULE.md', lines(11))
    commitAll(root)
    const r = ratchet(root)
    assert.equal(r.status, 1)
    assert.match(r.stdout, /\[fail\] doc-size: handoff\/rules\/RULE\.md — is 11 lines, over its ceiling of 10 — trim it, or raise it in scripts\/doc_limits\.json in the same commit, with a new non-empty "reason"/)
    // The full run (status, publish's warning, save's post-commit report) carries it too.
    const f = full(root)
    assert.equal(f.status, 1)
    assert.match(f.stdout, /doc-size: handoff\/rules\/RULE\.md — is 11 lines/)
  })

  it('AC3: the working-tree mode (plan save, before staging) sees an uncommitted growth', () => {
    const root = fixture()
    write(root, 'handoff/rules/RULE.md', lines(11))
    const r = ratchet(root, '--worktree')
    assert.equal(r.status, 1)
    assert.match(r.stdout, /RULE\.md — is 11 lines, over its ceiling of 10/)
    assert.equal(ratchet(root).status, 0, 'HEAD is still within its ceiling')
  })

  it('AC4: a raise with an empty reason fails; with a new reason it passes', () => {
    const root = fixture()
    write(root, 'handoff/rules/RULE.md', lines(11))
    write(root, 'scripts/doc_limits.json', table({ 'handoff/rules/RULE.md': { ceiling: 11, reason: '' } }))
    commitAll(root)
    let r = ratchet(root)
    assert.equal(r.status, 1)
    assert.match(r.stdout, /\[fail\] doc-limits: scripts\/doc_limits\.json \[handoff\/rules\/RULE\.md\] — empty "reason"/)

    write(root, 'scripts/doc_limits.json', table({ 'handoff/rules/RULE.md': { ceiling: 11, reason: '   ' } }))
    commitAll(root)
    assert.equal(ratchet(root, '--base', 'HEAD~2').status, 1, 'whitespace is empty')

    write(root, 'scripts/doc_limits.json', table({ 'handoff/rules/RULE.md': { ceiling: 11, reason: 'a new rule section' } }))
    commitAll(root)
    r = ratchet(root, '--base', 'HEAD~3')
    assert.equal(r.stdout, '')
    assert.equal(r.status, 0)
  })

  it('AC4: a raise that keeps the base\'s reason fails (a raise with no reason of its own)', () => {
    const root = fixture()
    write(root, 'handoff/rules/RULE.md', lines(11))
    write(root, 'scripts/doc_limits.json', table({ 'handoff/rules/RULE.md': { ceiling: 11, reason: 'baseline' } }))
    commitAll(root)
    const r = ratchet(root)
    assert.equal(r.status, 1)
    assert.match(r.stdout, /ceiling raised 10 → 11 with the old "reason"/)
  })

  it('AC5: the table missing fails clearly', () => {
    const root = fixture()
    assert.equal(git(root, 'rm', '-q', 'scripts/doc_limits.json').status, 0)
    commitAll(root)
    const r = ratchet(root)
    assert.equal(r.status, 1)
    assert.match(r.stdout, /\[fail\] doc-limits: scripts\/doc_limits\.json — the ratchet's limits table is missing/)
  })

  it('AC5: a listed doc that is gone fails, naming it', () => {
    const root = fixture()
    assert.equal(git(root, 'rm', '-q', 'handoff/rules/RULE.md').status, 0)
    commitAll(root)
    const r = ratchet(root)
    assert.equal(r.status, 1)
    assert.match(r.stdout, /\[fail\] doc-size: handoff\/rules\/RULE\.md — listed in scripts\/doc_limits\.json but not found/)
  })

  it('AC5: an unreadable or empty table, a bad ceiling, or an excluded path fails', () => {
    const cases = [
      ['{ not json', /unreadable limits table/],
      [table({}), /unreadable limits table: no "docs" object with at least one entry/],
      [table({ 'handoff/rules/RULE.md': { ceiling: '10', reason: 'x' } }), /ceiling must be a positive integer/],
      [table({ 'handoff/rules/RULE.md': { ceiling: 10, reason: 'x' }, 'handoff/log/LESSONS.md': { ceiling: 5, reason: 'x' } }),
        /\[handoff\/log\/LESSONS\.md\] — this path is excluded from the ratchet/],
    ]
    for (const [text, re] of cases) {
      const root = fixture()
      write(root, 'scripts/doc_limits.json', text)
      commitAll(root)
      const r = ratchet(root)
      assert.equal(r.status, 1, text)
      assert.match(r.stdout, re)
    }
  })

  it('AC6: a doc ≥10% under its ceiling warns "tighten to N" and exits 0; 1 line under is quiet', () => {
    const root = fixture()
    write(root, 'handoff/rules/RULE.md', lines(9))
    commitAll(root)
    let r = ratchet(root)
    assert.equal(r.status, 0)
    assert.match(r.stdout, /\[warn\] doc-size: handoff\/rules\/RULE\.md — is 9 lines, ≥10% under its ceiling of 10 — tighten to 9 in scripts\/doc_limits\.json/)
    assert.match(read('scripts/check_handoff.py'), /TIGHTEN_FRACTION = 0\.10/)
    // never auto-edited
    assert.match(readFileSync(join(root, 'scripts/doc_limits.json'), 'utf8'), /"ceiling": 10/)

    const quiet = fixture()
    write(quiet, 'scripts/doc_limits.json', table({ 'handoff/rules/RULE.md': { ceiling: 11, reason: 'baseline' } }))
    commitAll(quiet)
    r = ratchet(quiet, '--base', 'HEAD')
    assert.equal(r.stdout, '', '10 of 11 is 9% under — no warning')
    assert.equal(r.status, 0)
  })
})

describe('req-272 the real table', () => {
  const docs = JSON.parse(read('scripts/doc_limits.json')).docs

  it('covers the seventeen rule docs, excludes log/, work/req-*, reports/ and NOW.md', () => {
    const want = ['handoff/PLANNING.md', 'handoff/rules/WORKFLOW.md', 'handoff/work/BACKLOG.md',
      'handoff/reference/PAGES.md', 'handoff/reference/schema.md', 'handoff/rules/DESIGN.md', 'README.md',
      'handoff/rules/AUDIT.md', 'handoff/CLAUDE.md', 'handoff/coach/CAPABILITIES.md', 'handoff/coach/EVIDENCE.md',
      'handoff/coach/COACH.md', 'handoff/BUILDER.md', 'handoff/rules/CLOSEOUT.md', 'handoff/coach/GOALS.md',
      'handoff/rules/BACKEND.md', 'handoff/coach/LESSONS.md']
    assert.deepEqual(Object.keys(docs).sort(), want.sort())
    for (const p of Object.keys(docs)) {
      assert.doesNotMatch(p, /^handoff\/log\/|^handoff\/work\/req-|^reports\/|^handoff\/NOW\.md$/)
      assert.ok(docs[p].reason.trim(), `${p} has a reason`)
    }
  })

  it('this checkout\'s working tree is within every ceiling (no fail line)', () => {
    const r = ratchet(ROOT, '--worktree')
    assert.doesNotMatch(r.stdout, /\[fail\]/)
    assert.equal(r.status, 0, r.stdout)
  })
})
