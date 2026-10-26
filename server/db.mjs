// req-229 — the SQLite file (node:sqlite, built in) and its schema.
//
// One DB per server. Every table that holds user data carries `user_id`, and every query in
// store.mjs filters on it — no query reads another user's rows (req-229 §3).
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { DB_FILE, SECRET_FILE, assertNotLiveUnderTest, assertOutsideRepo } from './config.mjs'

export const DB_SCHEMA_VERSION = 1

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invites (
  code_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_by INTEGER REFERENCES users(id),
  used_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS revisions (
  user_id INTEGER NOT NULL REFERENCES users(id),
  rev INTEGER NOT NULL,
  state TEXT NOT NULL,
  base_rev INTEGER NOT NULL,
  merged INTEGER NOT NULL DEFAULT 0,
  conflicts TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  source TEXT,
  note TEXT,
  PRIMARY KEY (user_id, rev)
);
-- req-230 review round 4 (#2): one row per revision removed by pruning (store.mjs pruneRevisions) —
-- its number and id, so a missing base can be told apart: pruned (a row here) or replaced by a
-- restore (none: a backup never holds a revision made after it). Additive; v1 DBs gain it on open.
CREATE TABLE IF NOT EXISTS pruned_revisions (
  user_id INTEGER NOT NULL REFERENCES users(id),
  rev INTEGER NOT NULL,
  rev_id TEXT NOT NULL,
  PRIMARY KEY (user_id, rev, rev_id)
);
-- req-231 (DEC-133 round 5, option a): one row per user each time ./server/restore puts a backup
-- back into the data dir — the rev the restored copy ended at. A no-base push lets the device's
-- workout win only while the server's activeWorkout is still that revision's (store.mjs). Additive
-- like pruned_revisions; v1 DBs gain it on open.
CREATE TABLE IF NOT EXISTS restores (
  user_id INTEGER NOT NULL REFERENCES users(id),
  rev INTEGER NOT NULL,
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  route TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  text TEXT NOT NULL,
  context TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, timestamp, text)
);
`

// Open (creating if needed) the DB at `file`. `:memory:` is allowed for pure unit tests.
export function openDb(file) {
  if (file !== ':memory:') assertNotLiveUnderTest(file)
  const db = new DatabaseSync(file)
  db.exec('PRAGMA foreign_keys = ON')
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec(SCHEMA)
  addRevisionColumns(db)
  const { user_version: version } = db.prepare('PRAGMA user_version').get()
  if (version === 0) db.exec(`PRAGMA user_version = ${DB_SCHEMA_VERSION}`)
  else if (version !== DB_SCHEMA_VERSION) {
    db.close()
    throw new Error(`Database schema v${version} is not the v${DB_SCHEMA_VERSION} this server knows.`)
  }
  return db
}

// req-245 (DEC-141) — who wrote a revision and why: `source`/`note`, set by `./server/ops plan apply`
// and `plan revert`, null for a device push. Additive like pruned_revisions: a DB made before req-245
// (a backup restored later included) gains both columns when it is opened. No schema-version bump —
// an older server reading a newer DB ignores two nullable columns.
export const REVISION_COLUMNS = ['source', 'note']
function addRevisionColumns(db) {
  const have = new Set(db.prepare('PRAGMA table_info(revisions)').all().map((c) => c.name))
  for (const name of REVISION_COLUMNS) if (!have.has(name)) db.exec(`ALTER TABLE revisions ADD COLUMN ${name} TEXT`)
}

// Run `fn` in one write transaction (BEGIN IMMEDIATE), rolling back on a throw.
export function inTransaction(db, fn) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

// The data dir: both guards first, then created (mode 700) if absent.
export function prepareDataDir(dataDir) {
  assertNotLiveUnderTest(dataDir)
  assertOutsideRepo(dataDir)
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true, mode: 0o700 })
  return { dbFile: join(dataDir, DB_FILE), secretFile: join(dataDir, SECRET_FILE) }
}

// The session/invite HMAC key: made on first start, mode 600 (BACKEND §Where things live).
export function loadSecret(secretFile) {
  assertNotLiveUnderTest(secretFile)
  if (!existsSync(secretFile)) {
    writeFileSync(secretFile, randomBytes(32).toString('base64url') + '\n', { mode: 0o600, flag: 'wx' })
  }
  chmodSync(secretFile, 0o600)
  const secret = readFileSync(secretFile, 'utf8').trim()
  if (secret.length < 32) throw new Error(`Secret in ${secretFile} is too short.`)
  return secret
}

// Everything a running server or the accounts script needs from a data dir.
export function openDataDir(dataDir) {
  const { dbFile, secretFile } = prepareDataDir(dataDir)
  const secret = loadSecret(secretFile)
  return { db: openDb(dbFile), secret }
}
