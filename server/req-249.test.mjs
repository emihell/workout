// req-249 — the wrong-machine guard on the server scripts (lib.sh require_server_machine) and the
// wrong-node guard at the top of ./check. Temp dirs only; `node` is a stub on PATH, so a script
// that gets past its guard records its arguments instead of touching anything (no launchctl,
// tailscale, curl or DB). Deploy is pointed at a ref that doesn't exist, so past the guard it
// stops at its ref check before any build or write.
import './test-helpers.mjs'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { NODE_FLOOR_TEXT } from './config.mjs'
import { tempDir } from './test-helpers.mjs'

const SERVER = fileURLToPath(new URL('.', import.meta.url))
const CHECK = fileURLToPath(new URL('../check', import.meta.url))
const BOGUS_REF = 'req-249-no-such-ref'

function sandbox() {
  const root = tempDir('workout-req249-')
  const bin = join(root, 'bin')
  mkdirSync(bin)
  const marker = join(root, 'node-was-run')
  writeFileSync(join(bin, 'node'), `#!/bin/sh\necho "$@" > '${marker}'\nexit 0\n`)
  chmodSync(join(bin, 'node'), 0o755)
  return {
    root,
    marker,
    data: join(root, 'data'),
    live: join(root, 'live'),
    run(script, args = [], extra = {}) {
      return spawnSync(join(SERVER, script), args, {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          WORKOUT_DATA_DIR: join(root, 'data'),
          WORKOUT_LIVE_DIR: join(root, 'live'),
          WORKOUT_DEPLOY_REF: BOGUS_REF,
          WORKOUT_FIRST_DEPLOY: '',
          ...extra,
        },
      })
    },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  }
}

const SCRIPTS = [
  ['deploy', []],
  ['doctor', []],
  ['ops', ['counts']],
  ['backup', ['manual']],
  ['restore', ['some-backup.db', '--to', 'elsewhere']],
]

for (const [script, args] of SCRIPTS) {
  test(`${script}: no data dir → "not the server machine", exit 1, nothing run or written`, () => {
    const s = sandbox()
    try {
      const r = s.run(script, args)
      assert.equal(r.status, 1, r.stdout + r.stderr)
      assert.equal(r.stderr.trim(), `${script}: not the server machine (no ${s.data}) — nothing done`)
      assert.equal(r.stdout, '')
      assert.equal(existsSync(s.marker), false, 'node ran past the guard')
      assert.equal(existsSync(s.data), false)
      assert.equal(existsSync(s.live), false)
      assert.equal(existsSync(`${s.live}.new`), false)
    } finally {
      s.cleanup()
    }
  })

  test(`${script}: the data dir exists → passes the guard`, () => {
    const s = sandbox()
    try {
      mkdirSync(s.data)
      const r = s.run(script, args)
      assert.doesNotMatch(r.stderr, /not the server machine/)
      if (script === 'deploy') {
        // Past the guard, deploy stops at its ref check — before any build or write.
        assert.equal(r.status, 1)
        assert.match(r.stderr, new RegExp(`no ${BOGUS_REF} in `))
        assert.equal(existsSync(`${s.live}.new`), false)
      } else {
        assert.equal(r.status, 0, r.stderr)
        assert.match(readFileSync(s.marker, 'utf8'), /server\/ops-cli\.mjs/)
      }
    } finally {
      s.cleanup()
    }
  })
}

test('WORKOUT_FIRST_DEPLOY=1 lets deploy (only) past a missing data dir', () => {
  const s = sandbox()
  try {
    const d = s.run('deploy', [], { WORKOUT_FIRST_DEPLOY: '1' })
    assert.match(d.stdout, /WORKOUT_FIRST_DEPLOY=1 — no .* yet; going on as a first setup/)
    assert.match(d.stderr, new RegExp(`no ${BOGUS_REF} in `))
    assert.equal(existsSync(`${s.live}.new`), false)
    for (const [script, args] of SCRIPTS.filter(([name]) => name !== 'deploy')) {
      const r = s.run(script, args, { WORKOUT_FIRST_DEPLOY: '1' })
      assert.equal(r.status, 1, script)
      assert.match(r.stderr, /not the server machine/, script)
    }
    assert.equal(existsSync(s.marker), false)
  } finally {
    s.cleanup()
  }
})

// ./check's first gate. WORKOUT_SKIP_CHECK=1 is set so that, were the node guard ever moved below
// the skip or lost, this run would print SKIPPED and fail here — never recurse into the full gate.
function checkWithNode(version) {
  const root = tempDir('workout-req249-node-')
  try {
    writeFileSync(join(root, 'node'), `#!/bin/sh\nif [ "$1" = --version ]; then echo ${version}; exit 0; fi\nexec '${process.execPath}' "$@"\n`)
    chmodSync(join(root, 'node'), 0o755)
    return spawnSync(CHECK, [], { encoding: 'utf8', env: { ...process.env, PATH: `${root}:${process.env.PATH}`, WORKOUT_SKIP_CHECK: '1' } })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('check: node below NODE_FLOOR → exit 1 naming both versions, before anything else', () => {
  const r = checkWithNode('v22.14.0')
  assert.equal(r.status, 1)
  assert.equal(r.stderr.trim(), `check: node v22.14.0 < floor v${NODE_FLOOR_TEXT} — run: nvm use`)
  assert.equal(r.stdout, '')
})

test('check: node at the floor passes the node gate', () => {
  const r = checkWithNode(`v${NODE_FLOOR_TEXT}`)
  assert.equal(r.status, 0)
  assert.match(r.stderr, /check: SKIPPED/)
})
