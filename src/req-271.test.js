// req-271 — the DEC log split: scripts/dec_split.py (a proven move), scripts/dec_index.py (the
// generated index) and check_handoff.py's three DEC checks, on fixture repos in temp dirs.
// Nothing under the real handoff/ is read or written. Dangling ids are built at runtime
// ('DEC-' + n) so this file cites none itself (check a scans src/).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const scripts = new URL('../scripts/', import.meta.url).pathname
const py = (name, args) => spawnSync('python3', [join(scripts, name), ...args], { encoding: 'utf8' })
const dangling = (n) => `DEC-${n}`

const HEADER = `# Decisions

Append-only. Format:

\`\`\`
## DEC-001 — short title  (YYYY-MM-DD)
What was decided.
\`\`\`

---

## Current rules digest

- **Banner** — a failed save shows a banner. → **DEC-002**

---

`
const ENTRIES = `## DEC-001 — first rule  (Emilio, 2026-09-07)

> **SUPERSEDED by DEC-003** — replaced.

Body of one.

## DEC-002 — second rule, mentions 2026-01-01  (2026-09-08)

> AMENDED by DEC-003 §2

Body of two.

## DEC-003 — third rule with no date in the heading

Decided 2026-09-13 (Emilio). Body of three.

## DEC-003 follow-up (2026-09-14): an addendum

More about three.

## DEC-052 — a later rule  (Emilio, 2026-09-20)

Body of fifty-two.
`

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'req-271-'))
  mkdirSync(join(root, 'handoff/log'), { recursive: true })
  writeFileSync(join(root, 'handoff/log/DECISIONS.md'), HEADER + ENTRIES)
  return root
}
const read = (root, p) => readFileSync(join(root, p), 'utf8')
const write = (root, p, text) => {
  mkdirSync(dirname(join(root, p)), { recursive: true })
  writeFileSync(join(root, p), text)
}
const split = (root) => {
  const r = py('dec_split.py', ['--root', root])
  assert.equal(r.status, 0, r.stdout + r.stderr)
  return r
}
const git = (root, ...args) => {
  const r = spawnSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  return r.stdout
}
const commitAll = (root) => {
  if (!existsSync(join(root, '.git'))) git(root, 'init', '-q')
  git(root, 'add', '-A')
  git(root, 'commit', '-qm', 'fixture', '--allow-empty')
}
const checkHandoff = (root) => py('check_handoff.py', ['--repo', root])

describe('req-271 dec_split.py — a move, proven', () => {
  it('range files concatenate byte-equal to the entry text; header kept; each heading in one file', () => {
    const root = fixture()
    const r = split(root)
    assert.match(r.stdout, /→ byte-equal/)
    assert.match(r.stdout, /dec_split: proven/)
    const files = readdirSync(join(root, 'handoff/log/decisions')).sort()
    assert.deepEqual(files, ['DEC-001-050.md', 'DEC-051-100.md'])
    const concat = files.map((f) => read(root, `handoff/log/decisions/${f}`)).join('')
    assert.equal(concat, ENTRIES)
    const md = read(root, 'handoff/log/DECISIONS.md')
    assert.ok(md.startsWith(HEADER), 'the header (format example + digest) is kept byte for byte')
    // The addendum moved with DEC-003; the format example stayed in the header.
    assert.match(read(root, 'handoff/log/decisions/DEC-001-050.md'), /^## DEC-003 follow-up/m)
    assert.equal(md.split('\n').filter((l) => l.startsWith('## DEC-001 — short title')).length, 1)
    const all = [md, ...files.map((f) => read(root, `handoff/log/decisions/${f}`))].join('\n')
    for (const h of (HEADER + ENTRIES).split('\n').filter((l) => l.startsWith('## '))) {
      assert.equal(all.split('\n').filter((l) => l === h).length, 1, h)
    }
  })

  it('refuses a second split (decisions/ already holds range files), writing nothing', () => {
    const root = fixture()
    split(root)
    const before = read(root, 'handoff/log/DECISIONS.md')
    const r = py('dec_split.py', ['--root', root])
    assert.equal(r.status, 2)
    assert.match(r.stderr, /already holds range files/)
    assert.equal(read(root, 'handoff/log/DECISIONS.md'), before)
  })

  it('--dry-run proves the same and writes nothing', () => {
    const root = fixture()
    const r = py('dec_split.py', ['--root', root, '--dry-run'])
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /proven/)
    assert.equal(existsSync(join(root, 'handoff/log/decisions')), false)
    assert.equal(read(root, 'handoff/log/DECISIONS.md'), HEADER + ENTRIES)
  })
})

describe('req-271 dec_index.py — the generated index', () => {
  it('one line per DEC: id · date · title · status, from markers; the heading date, else the body\'s', () => {
    const root = fixture()
    split(root)
    const lines = read(root, 'handoff/log/DECISIONS.md').split('\n').filter((l) => l.startsWith('- DEC-'))
    assert.deepEqual(lines, [
      '- DEC-001 · 2026-09-07 · first rule · superseded by DEC-003',
      '- DEC-002 · 2026-09-08 · second rule, mentions 2026-01-01 · amended by DEC-003 §2',
      '- DEC-003 · 2026-09-13 · third rule with no date in the heading · live',
      '- DEC-052 · 2026-09-20 · a later rule · live',
    ])
  })

  it('is deterministic: two runs give identical bytes', () => {
    const root = fixture()
    split(root)
    const first = read(root, 'handoff/log/DECISIONS.md')
    const r1 = py('dec_index.py', ['--root', root])
    const r2 = py('dec_index.py', ['--root', root])
    assert.equal(r1.status, 0, r1.stderr)
    assert.equal(r2.status, 0, r2.stderr)
    assert.match(r2.stdout, /index up to date/)
    assert.equal(read(root, 'handoff/log/DECISIONS.md'), first)
    assert.equal(py('dec_index.py', ['--root', root, '--check']).status, 0)
  })

  for (const [name, bad, where] of [
    ['a malformed heading', '## DEC-53 a two-digit id  (2026-09-21)\n\nBody.\n', 'DEC-051-100.md:5'],
    ['an entry with no date', '## DEC-053 — no date anywhere\n\nBody with none.\n', 'DEC-051-100.md:5'],
  ]) {
    it(`refuses ${name}, naming file:line, and writes nothing (no partial index)`, () => {
      const root = fixture()
      split(root)
      const p = 'handoff/log/decisions/DEC-051-100.md'
      write(root, p, `${read(root, p)}\n${bad}`)
      const before = read(root, 'handoff/log/DECISIONS.md')
      const r = py('dec_index.py', ['--root', root])
      assert.equal(r.status, 2)
      assert.match(r.stderr, /refusing, nothing written/)
      assert.ok(r.stderr.includes(where), r.stderr)
      assert.equal(read(root, 'handoff/log/DECISIONS.md'), before)
    })
  }

  it('refuses an entry filed in the wrong range file', () => {
    const root = fixture()
    split(root)
    const p = 'handoff/log/decisions/DEC-001-050.md'
    write(root, p, `${read(root, p)}\n## DEC-060 — misfiled  (2026-09-22)\n\nBody.\n`)
    const r = py('dec_index.py', ['--root', root])
    assert.equal(r.status, 2)
    assert.match(r.stderr, /DEC-060 belongs in handoff\/log\/decisions\/DEC-051-100\.md/)
  })
})

describe('req-271 check_handoff.py — the DEC checks', () => {
  it('a clean split repo passes (no findings)', () => {
    const root = fixture()
    split(root)
    commitAll(root)
    const r = checkHandoff(root)
    assert.equal(r.stdout, '')
    assert.equal(r.status, 0)
  })

  it('a dangling ref fails naming file:line; the allowlisted planted fixture does not', () => {
    const root = fixture()
    split(root)
    write(root, 'src/x.js', `// ok DEC-002\n// bad ${dangling(777)}\n`)
    write(root, 'scripts/check-skills.test.sh', `plant "a dead DEC- id" "See ${dangling(999)}."\n`)
    commitAll(root)
    const r = checkHandoff(root)
    assert.equal(r.status, 1)
    assert.match(r.stdout, new RegExp(`\\[fail\\] dec-ref: src/x\\.js:2 — cites ${dangling(777)}`))
    assert.doesNotMatch(r.stdout, new RegExp(dangling(999)))
  })

  it('a stale index (a title edited without regenerating) fails and names the command', () => {
    const root = fixture()
    split(root)
    const p = 'handoff/log/decisions/DEC-051-100.md'
    write(root, p, read(root, p).replace('a later rule', 'a renamed rule'))
    commitAll(root)
    const r = checkHandoff(root)
    assert.equal(r.status, 1)
    assert.match(r.stdout, /\[fail\] dec-index: handoff\/log\/DECISIONS\.md — the generated index is stale/)
    assert.match(r.stdout, /run: python3 scripts\/dec_index\.py/)
  })

  it('the digest citing a superseded DEC fails at its line', () => {
    const root = fixture()
    split(root)
    const p = 'handoff/log/DECISIONS.md'
    write(root, p, read(root, p).replace('→ **DEC-002**', '→ **DEC-002**, **DEC-001**'))
    commitAll(root)
    const r = checkHandoff(root)
    assert.equal(r.status, 1)
    assert.match(r.stdout, /\[fail\] dec-digest: handoff\/log\/DECISIONS\.md:14 — the digest cites DEC-001, which is superseded by DEC-003/)
  })

  it('works before the split too: dangling + superseded-in-digest fire on the one-file layout', () => {
    const root = fixture()
    const p = 'handoff/log/DECISIONS.md'
    write(root, p, read(root, p).replace('→ **DEC-002**', `→ **DEC-001**, ${dangling(777)}`))
    commitAll(root)
    const r = checkHandoff(root)
    assert.equal(r.status, 1)
    assert.match(r.stdout, /dec-digest: handoff\/log\/DECISIONS\.md:14 — the digest cites DEC-001/)
    assert.match(r.stdout, new RegExp(`dec-ref: handoff/log/DECISIONS\\.md:14 — cites ${dangling(777)}`))
    assert.doesNotMatch(r.stdout, /dec-index/)
  })

  it('a malformed range file fails the check, naming file:line', () => {
    const root = fixture()
    split(root)
    const p = 'handoff/log/decisions/DEC-051-100.md'
    write(root, p, `${read(root, p)}\n## DEC-53 bad\n`)
    commitAll(root)
    const r = checkHandoff(root)
    assert.equal(r.status, 1)
    assert.match(r.stdout, /\[fail\] dec-log: handoff\/log\/decisions\/DEC-051-100\.md:5 — malformed heading/)
  })
})
