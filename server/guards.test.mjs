// req-229 — BACKEND rules 1 and 8 (secrets out of the repo; tests never reach the live DB),
// plus the start script and the accounts script, run as real subprocesses on temp dirs.
import { tempDir } from './test-helpers.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LIVE_DATA_DIR, REPO_ROOT, assertOutsideRepo, nodeVersionOk, serverConfig } from './config.mjs'
import { openDb, openDataDir, prepareDataDir } from './db.mjs'
import { checkLogin, disableUser, findUser, userCount } from './auth.mjs'

const START = fileURLToPath(new URL('./start.mjs', import.meta.url))
const ACCOUNTS = fileURLToPath(new URL('./accounts.mjs', import.meta.url))
const env = (extra) => ({ ...process.env, WORKOUT_SERVER_TEST: '1', ...extra })

test('9. the server refuses to start when its data/secret path is inside the repo tree', () => {
  const inside = join(REPO_ROOT, 'server', 'not-a-real-data-dir')
  const res = spawnSync(process.execPath, [START], { env: env({ WORKOUT_DATA_DIR: inside, WORKOUT_PORT: '0' }), encoding: 'utf8' })
  assert.equal(res.status, 1)
  assert.match(res.stderr, /Refusing to start: data path .* is inside the repository/)
  assert.equal(existsSync(inside), false, 'nothing created inside the repo')
  assert.throws(() => assertOutsideRepo(REPO_ROOT), /inside the repository/)
  assert.throws(() => prepareDataDir(join(REPO_ROOT, 'x')), /inside the repository/)
})

test('9. …or inside any other git working tree', () => {
  const tree = tempDir()
  mkdirSync(join(tree, '.git'))
  try {
    assert.throws(() => assertOutsideRepo(join(tree, 'deep', 'data')), /inside a git working tree/)
    assert.doesNotThrow(() => assertOutsideRepo(tempDir()))
  } finally {
    rmSync(tree, { recursive: true, force: true })
  }
})

test('BACKEND rule 8 — under the suite, the live data path is refused before anything is opened', () => {
  const existed = existsSync(LIVE_DATA_DIR)
  assert.throws(() => openDb(join(LIVE_DATA_DIR, 'workout.db')), /Test guard/)
  assert.throws(() => prepareDataDir(LIVE_DATA_DIR), /Test guard/)
  assert.throws(() => openDataDir(join(LIVE_DATA_DIR, 'sub')), /Test guard/)
  assert.equal(existsSync(LIVE_DATA_DIR), existed, 'the guard created nothing')
  // The server's default data dir IS the live one — so a test that forgot WORKOUT_DATA_DIR fails.
  assert.equal(serverConfig({}).dataDir, LIVE_DATA_DIR)
  const res = spawnSync(process.execPath, [START], { env: env({ WORKOUT_DATA_DIR: '', WORKOUT_PORT: '0' }), encoding: 'utf8' })
  assert.equal(res.status, 1)
  assert.match(res.stderr, /Test guard/)
  assert.equal(existsSync(LIVE_DATA_DIR), existed)
})

test('config — port from env, default 8100; host is always 127.0.0.1', () => {
  assert.deepEqual(serverConfig({ WORKOUT_DATA_DIR: '/tmp/x' }).port, 8100)
  assert.equal(serverConfig({ WORKOUT_PORT: '9001', WORKOUT_DATA_DIR: '/tmp/x' }).port, 9001)
  assert.equal(serverConfig({}).host, '127.0.0.1')
  assert.throws(() => serverConfig({ WORKOUT_PORT: 'abc' }), /not a port/)
})

test('Node floor — node:sqlite needs ≥ 22.13.0', () => {
  assert.equal(nodeVersionOk('22.12.9'), false)
  assert.equal(nodeVersionOk('22.13.0'), true)
  assert.equal(nodeVersionOk('22.23.3'), true)
  assert.equal(nodeVersionOk('21.99.0'), false)
  assert.equal(nodeVersionOk('26.8.2'), true)
  assert.equal(nodeVersionOk(), true, `this Node (${process.versions.node}) meets the floor`)
})

test('start.mjs — a throwaway instance binds 127.0.0.1, answers health, makes a mode-600 secret', async () => {
  const dataDir = tempDir()
  const child = spawn(process.execPath, [START], { env: env({ WORKOUT_DATA_DIR: dataDir, WORKOUT_PORT: '0' }) })
  try {
    const line = await new Promise((resolve, reject) => {
      let out = ''
      child.stdout.on('data', (d) => {
        out += d
        if (out.includes('\n')) resolve(out)
      })
      child.on('exit', (code) => reject(new Error(`exited ${code}`)))
    })
    const [, address, port] = /listening on http:\/\/([\d.]+):(\d+)/.exec(line)
    assert.equal(address, '127.0.0.1')
    const health = await (await fetch(`http://127.0.0.1:${port}/api/health`)).json()
    assert.deepEqual(health, { ok: true, revisions: 0 })
    assert.equal(statSync(join(dataDir, 'secret')).mode & 0o777, 0o600)
    assert.equal(statSync(dataDir).mode & 0o777, 0o700)
  } finally {
    child.kill('SIGTERM')
    await new Promise((resolve) => child.once('exit', resolve))
    rmSync(dataDir, { recursive: true, force: true })
  }
})

test('accounts.mjs — bootstrap (password from stdin), refuse a second bootstrap, invite, disable', async () => {
  const dataDir = tempDir()
  const run = (args, input) =>
    spawnSync(process.execPath, [ACCOUNTS, ...args], { env: env({ WORKOUT_DATA_DIR: dataDir }), input, encoding: 'utf8' })
  try {
    const boot = run(['bootstrap', '--username', 'Emilio'], 'a long password\n')
    assert.equal(boot.status, 0, boot.stderr)
    assert.match(boot.stdout, /Created emilio\./)
    const again = run(['bootstrap', '--username', 'other'], 'a long password\n')
    assert.equal(again.status, 1)
    assert.match(again.stderr, /Bootstrap refused/)
    const invite = run(['invite'])
    assert.equal(invite.status, 0)
    assert.match(invite.stdout.trim(), /^[A-Za-z0-9_-]{16}$/)
    assert.equal(run(['bogus']).status, 1)

    const { db } = openDataDir(dataDir)
    try {
      assert.equal(userCount(db), 1)
      const stored = findUser(db, 'emilio').password
      assert.match(stored, /^scrypt\$16384\$8\$1\$/)
      assert.ok(!stored.includes('a long password'))
      assert.ok(await checkLogin(db, { username: 'emilio', password: 'a long password' }))
      assert.equal(await checkLogin(db, { username: 'emilio', password: 'wrong password' }), null)
      // The invite code itself is never stored.
      const codes = db.prepare('SELECT code_hash FROM invites').all()
      assert.equal(codes.length, 1)
      assert.notEqual(codes[0].code_hash, invite.stdout.trim())
    } finally {
      db.close()
    }

    const disable = run(['disable', 'emilio'])
    assert.equal(disable.status, 0, disable.stderr)
    const { db: db2 } = openDataDir(dataDir)
    try {
      assert.equal(await checkLogin(db2, { username: 'emilio', password: 'a long password' }), null)
      assert.throws(() => disableUser(db2, 'nobody'), /No such user/)
    } finally {
      db2.close()
    }
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})
