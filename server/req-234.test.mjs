// req-234 — `accounts.mjs passwd <u>` as a real subprocess against a throwaway server's data dir.
import { client, startTestServer } from './test-helpers.mjs'
import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { bootstrapUser, createInvite, disableUser, findUser } from './auth.mjs'

const ACCOUNTS = fileURLToPath(new URL('./accounts.mjs', import.meta.url))
const OLD = 'correct horse battery'
const NEW = 'a brand new password'

let srv
before(async () => {
  srv = await startTestServer()
  await bootstrapUser(srv.db, { username: 'emilio', password: OLD })
})
after(() => srv.close())

const passwd = (username, input) =>
  spawnSync(process.execPath, [ACCOUNTS, 'passwd', username], {
    env: { ...process.env, WORKOUT_SERVER_TEST: '1', WORKOUT_DATA_DIR: srv.dataDir },
    input,
    encoding: 'utf8',
  })

async function login(username, password) {
  const c = client(srv.base)
  return { c, status: (await c.post('/api/login', { username, password })).status }
}

test('2. unknown user, mismatch, too short, disabled → exit 1 and the stored hash unchanged', async () => {
  const before = findUser(srv.db, 'emilio').password
  const { c } = await login('emilio', OLD)
  const cases = [
    ['nobody', `${NEW}\n${NEW}\n`, /No such user: nobody/],
    ['emilio', `${NEW}\nsomething else\n`, /do not match\. Nothing changed\./],
    ['emilio', 'short\nshort\n', /at least 6 characters/],
    ['emilio', '', /at least 6 characters/],
  ]
  for (const [username, input, message] of cases) {
    const res = passwd(username, input)
    assert.equal(res.status, 1, `${username} ${JSON.stringify(input)}`)
    assert.match(res.stderr, message)
    assert.equal(res.stdout, '')
  }
  assert.equal(findUser(srv.db, 'emilio').password, before)
  assert.equal((await c.get('/api/state')).status, 200, 'a refused change ends no session')
  assert.equal((await login('emilio', OLD)).status, 200)

  const reg = client(srv.base)
  await reg.post('/api/register', { code: createInvite(srv.db, srv.secret), username: 'gone', password: OLD })
  disableUser(srv.db, 'gone')
  const hash = findUser(srv.db, 'gone').password
  const res = passwd('gone', `${NEW}\n${NEW}\n`)
  assert.equal(res.status, 1)
  assert.match(res.stderr, /gone is disabled\./)
  assert.equal(findUser(srv.db, 'gone').password, hash)
})

test('1. passwd → old password refused, new one logs in, every old session gets 401', async () => {
  const sessions = [(await login('emilio', OLD)).c, (await login('emilio', OLD)).c]
  const ended = srv.db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').get(findUser(srv.db, 'emilio').id).n
  for (const c of sessions) assert.equal((await c.get('/api/state')).status, 200)

  const res = passwd('Emilio', `${NEW}\n${NEW}\n`)
  assert.equal(res.status, 0, res.stderr)
  assert.equal(res.stdout.trim(), `Password changed for emilio; ${ended} session(s) ended.`)
  assert.match(findUser(srv.db, 'emilio').password, /^scrypt\$16384\$8\$1\$/)

  for (const c of sessions) assert.equal((await c.get('/api/state')).status, 401)
  assert.equal((await login('emilio', OLD)).status, 401)
  const fresh = await login('emilio', NEW)
  assert.equal(fresh.status, 200)
  assert.equal((await fresh.c.get('/api/state')).status, 200)
})
