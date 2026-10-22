// req-231 — the live server's housekeeping: backups, the nightly rotation, restores, record counts
// and the doctor's checks. The shell scripts beside this file (backup, restore, doctor …) call
// ops-cli.mjs, which calls these; the tests call them on temp dirs (BACKEND rule 8).
//
// Backups use SQLite's online backup API (node:sqlite `backup`), never a file copy: a `cp` misses
// rows still in the `-wal` file (BACKEND rule 6). Every backup is integrity-checked before it is kept.
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { DatabaseSync, backup as sqliteBackup } from 'node:sqlite'
import { DB_FILE, assertNotLiveUnderTest, assertOutsideRepo } from './config.mjs'
import { openDb } from './db.mjs'
import { markRestore } from './store.mjs'

export const BACKUPS = 'backups'
export const NIGHTLY = 'nightly'
export const NIGHTLY_KEEP = 7
const REASON = /^[a-z0-9][a-z0-9-]{0,39}$/
const NAME = /^workout-(\d{8}-\d{6})-([a-z0-9][a-z0-9-]*)\.db$/

const pad = (n) => String(n).padStart(2, '0')
// Local time, like White Sleeve's backup names: sorts by name within one machine's clock.
export function stamp(at = new Date()) {
  return `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`
}

export function integrity(file) {
  const db = new DatabaseSync(file, { readOnly: true })
  try {
    return db
      .prepare('PRAGMA integrity_check')
      .all()
      .map((row) => Object.values(row)[0])
  } finally {
    db.close()
  }
}

function assertIntegrity(file) {
  const result = integrity(file)
  if (result.length !== 1 || result[0] !== 'ok') throw new Error(`integrity_check failed for ${file}: ${result.slice(0, 5).join('; ')}`)
}

// The online backup of `source` into `dest` (written as `dest.partial`, checked, then renamed).
async function copyDb(source, dest) {
  assertNotLiveUnderTest(dest)
  const partial = `${dest}.partial`
  rmSync(partial, { force: true })
  const db = new DatabaseSync(source, { readOnly: true })
  // [measured, Node 26.8.2] backup()'s promise settles only when something else wakes the event
  // loop: with a pending 3 s timer a 2-page backup took 3.08 s, and the test runner (open sockets,
  // no timers) waited forever. A short interval while it runs keeps the loop turning.
  const poke = setInterval(() => {}, 10)
  try {
    await sqliteBackup(db, partial)
  } finally {
    clearInterval(poke)
    db.close()
  }
  try {
    // The copy keeps the source's WAL mode; reading it would leave `.partial-wal/-shm` beside it
    // [measured]. As one self-contained file it is safe to move and copy (the server sets WAL again
    // when it opens a restored DB).
    const copy = new DatabaseSync(partial)
    try {
      copy.exec('PRAGMA journal_mode = DELETE')
    } finally {
      copy.close()
    }
    assertIntegrity(partial)
  } catch (error) {
    for (const f of [partial, `${partial}-wal`, `${partial}-shm`]) rmSync(f, { force: true })
    throw error
  }
  renameSync(partial, dest)
  return dest
}

// `./server/backup <reason>` → {file, bytes}. `nightly` is the nightly run's reason only.
export async function backupDb(dataDir, reason, { at = new Date(), nightly = false } = {}) {
  if (!REASON.test(String(reason))) throw new Error(`Backup reason: lower-case letters, digits and dashes (got "${reason}").`)
  if (reason === NIGHTLY && !nightly) throw new Error(`"${NIGHTLY}" is reserved for the nightly backup (backup --nightly).`)
  assertNotLiveUnderTest(dataDir)
  const dbFile = join(dataDir, DB_FILE)
  if (!existsSync(dbFile)) throw new Error(`No database at ${dbFile}.`)
  const dir = join(dataDir, BACKUPS)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  let file = join(dir, `workout-${stamp(at)}-${reason}.db`)
  for (let n = 2; existsSync(file); n++) file = join(dir, `workout-${stamp(at)}-${reason}-${n}.db`)
  await copyDb(dbFile, file)
  return { file, bytes: statSync(file).size }
}

// Newest first (by the name's stamp, then mtime).
export function listBackups(dataDir) {
  const dir = join(dataDir, BACKUPS)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .map((name) => ({ name, match: NAME.exec(name) }))
    .filter(({ match }) => match)
    .map(({ name, match }) => {
      const file = join(dir, name)
      return { file, name, stamp: match[1], reason: match[2], mtimeMs: statSync(file).mtimeMs }
    })
    .sort((a, b) => b.stamp.localeCompare(a.stamp) || b.mtimeMs - a.mtimeMs)
}

// The nightly backup, then the rotation: the newest NIGHTLY_KEEP nightlies stay; other backups
// (deploy, pre-restore, by hand) are never deleted here.
export async function nightly(dataDir, { at = new Date(), keep = NIGHTLY_KEEP } = {}) {
  const made = await backupDb(dataDir, NIGHTLY, { at, nightly: true })
  const nightlies = listBackups(dataDir).filter((b) => b.reason === NIGHTLY || /^nightly-\d+$/.test(b.reason))
  const deleted = []
  for (const old of nightlies.slice(keep)) {
    rmSync(old.file)
    deleted.push(old.name)
  }
  return { ...made, kept: Math.min(nightlies.length, keep), deleted }
}

// What a DB holds: every table's row count, and per user the current revision's record counts —
// the restore drill's receipt (BACKEND rule 7). Read-only.
export function counts(dbFile) {
  const db = new DatabaseSync(dbFile, { readOnly: true })
  try {
    const tables = {}
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((r) => r.name)
    for (const name of names) tables[name] = db.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).get().n
    const users = db
      .prepare('SELECT id, username FROM users ORDER BY id')
      .all()
      .map(({ id, username }) => {
        const row = db.prepare('SELECT rev, state FROM revisions WHERE user_id = ? ORDER BY rev DESC LIMIT 1').get(id)
        const state = row ? JSON.parse(row.state) : {}
        const len = (v) => (Array.isArray(v) ? v.length : 0)
        return {
          username,
          rev: row ? row.rev : 0,
          exercises: len(state.exercises),
          routines: len(state.routines),
          workouts: len(state.workouts),
          activeWorkout: Boolean(state.activeWorkout),
          notes: db.prepare('SELECT COUNT(*) AS n FROM notes WHERE user_id = ?').get(id).n,
        }
      })
    return { tables, users, version: db.prepare('PRAGMA user_version').get().user_version }
  } finally {
    db.close()
  }
}

// `./server/restore <backup> --to <dir>`: the backup as a throwaway instance's data dir (a new
// secret is made when that instance first starts; passwords don't depend on it). Nothing else is
// touched. The dir must be new or empty, and outside every git working tree.
export async function restoreTo(backupFile, dir) {
  assertIntegrity(backupFile)
  assertOutsideRepo(dir)
  assertNotLiveUnderTest(dir)
  if (existsSync(dir) && readdirSync(dir).length > 0) throw new Error(`${dir} is not empty.`)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  const dbFile = join(dir, DB_FILE)
  await copyDb(backupFile, dbFile)
  return { dbFile, counts: counts(dbFile) }
}

// `./server/restore <backup>` (into the data dir; the server is stopped first — the CLI checks).
// The current DB is backed up first (`pre-restore`); the restored copy gets a `restores` marker
// per user (DEC-133 round 5, option a) before it replaces workout.db.
export async function restoreInto(backupFile, dataDir, { at = new Date() } = {}) {
  assertIntegrity(backupFile)
  assertOutsideRepo(dataDir)
  assertNotLiveUnderTest(dataDir)
  const dbFile = join(dataDir, DB_FILE)
  const before = existsSync(dbFile) ? counts(dbFile) : null
  const safety = before ? await backupDb(dataDir, 'pre-restore', { at }) : null
  const incoming = `${dbFile}.restoring`
  rmSync(incoming, { force: true })
  await copyDb(backupFile, incoming)
  const db = openDb(incoming) // adds any table the backup predates (CREATE TABLE IF NOT EXISTS)
  let marked
  try {
    marked = markRestore(db, at)
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  } finally {
    db.close()
  }
  for (const f of [`${incoming}-wal`, `${incoming}-shm`]) rmSync(f, { force: true })
  assertIntegrity(incoming)
  for (const f of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) rmSync(f, { force: true })
  renameSync(incoming, dbFile)
  return { dbFile, from: basename(backupFile), safety: safety?.file ?? null, before, after: counts(dbFile), marked }
}

// ---- doctor: the pure checks (the CLI gathers the inputs) ----

// `tailscale serve status --json` → {mapped, funnel}: is :httpsPort a tailnet-only proxy to
// `want`, and every port with funnel on (BACKEND rule 3: none).
export function serveState(statusJson, httpsPort, want) {
  const d = JSON.parse(statusJson || '{}') ?? {}
  const port = String(httpsPort)
  const funnel = Object.keys(d.AllowFunnel ?? {})
  for (const cfg of Object.values(d.Foreground ?? {})) funnel.push(...Object.keys(cfg?.AllowFunnel ?? {}))
  const web = Object.entries(d.Web ?? {}).find(([hp]) => hp.split(':').pop() === port)
  const handlers = web?.[1]?.Handlers ?? null
  const proxy = handlers?.['/']?.Proxy ?? null
  return { mapped: proxy === want && Object.keys(handlers).length === 1, proxy, host: web ? web[0].replace(/:\d+$/, '') : null, funnel }
}

// `lsof -nP -iTCP:<port> -sTCP:LISTEN` output → the listening addresses.
export function listenAddresses(lsofText) {
  return String(lsofText ?? '')
    .split('\n')
    .slice(1)
    .map((line) => /\s(\S+:\d+) \(LISTEN\)/.exec(line)?.[1])
    .filter(Boolean)
}
