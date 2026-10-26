// req-231 — the live server's housekeeping: backups, the weekly rotation (req-237, DEC-136), restores, record counts
// and the doctor's checks. The shell scripts beside this file (backup, restore, doctor …) call
// ops-cli.mjs, which calls these; the tests call them on temp dirs (BACKEND rule 8).
//
// Backups use SQLite's online backup API (node:sqlite `backup`), never a file copy: a `cp` misses
// rows still in the `-wal` file (BACKEND rule 6). Every backup is integrity-checked before it is kept.
import { execFileSync } from 'node:child_process'
import { accessSync, constants, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, sep } from 'node:path'
import { DatabaseSync, backup as sqliteBackup } from 'node:sqlite'
import { DB_FILE, NODE_FLOOR_TEXT, assertNotLiveUnderTest, assertOutsideRepo, nodeVersionOk } from './config.mjs'
import { openDb } from './db.mjs'
import { markRestore } from './store.mjs'

export const BACKUPS = 'backups'
// req-237 / DEC-136: the scheduled backup is weekly, keeps 4. `nightly` is the reason req-231's
// nightly agent used; those files count as scheduled backups (age, rotation) until they rotate out.
export const WEEKLY = 'weekly'
export const WEEKLY_KEEP = 4
export const WEEKLY_DUE_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000
const REASON = /^[a-z0-9][a-z0-9-]{0,39}$/
// `weekly`, `weekly-2` (a second one in the same second), and the legacy `nightly`, `nightly-3`.
const SCHEDULED = /^(weekly|nightly)(-\d+)?$/
export const isScheduled = (reason) => SCHEDULED.test(String(reason))
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
  } catch (error) {
    rmSync(partial, { force: true }) // review nit: no half-written .partial left behind
    throw error
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

// `./server/backup <reason>` → {file, bytes}. `weekly` is the scheduled run's reason only.
export async function backupDb(dataDir, reason, { at = new Date(), scheduled = false } = {}) {
  if (!REASON.test(String(reason))) throw new Error(`Backup reason: lower-case letters, digits and dashes (got "${reason}").`)
  // Review nit: `weekly-3` / `nightly-3` are rotated like `weekly`, so a hand-made backup may not
  // take those shapes either (the rotation would delete it).
  if (isScheduled(reason) && !scheduled) {
    throw new Error(`"${reason}" is reserved for the scheduled weekly backup (backup --weekly).`)
  }
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
      return { file, name, stamp: match[1], reason: match[2], mtimeMs: statSync(file).mtimeMs, takenMs: stampMs(match[1]) }
    })
    .sort((a, b) => b.stamp.localeCompare(a.stamp) || b.mtimeMs - a.mtimeMs)
}

// The name's stamp (local time, see stamp()) → epoch ms: when the backup was taken. The age checks
// use this, not mtime — a copied or touched file keeps the time it was taken.
export function stampMs(s) {
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(String(s))
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : NaN
}

// Newest first: the scheduled backups (weekly, and legacy nightly).
export const scheduledBackups = (dataDir) => listBackups(dataDir).filter((b) => isScheduled(b.reason))

// The weekly backup, then the rotation: the newest `keep` scheduled backups (weekly and legacy
// nightly together) stay; other backups (deploy, pre-restore, by hand) are never deleted here.
// `ifDue`: only when the newest scheduled backup is ≥ WEEKLY_DUE_DAYS old, or there is none — the
// hourly agent's catch-up (req-237). Not due → {made: false, newest}, nothing written.
export async function weekly(dataDir, { at = new Date(), keep = WEEKLY_KEEP, ifDue = false } = {}) {
  if (ifDue) {
    const newest = scheduledBackups(dataDir)[0]
    if (newest && at.getTime() - newest.takenMs < WEEKLY_DUE_DAYS * DAY_MS) return { made: false, newest: newest.name }
  }
  const made = await backupDb(dataDir, WEEKLY, { at, scheduled: true })
  const scheduled = scheduledBackups(dataDir)
  const deleted = []
  for (const old of scheduled.slice(keep)) {
    rmSync(old.file)
    deleted.push(old.name)
  }
  return { made: true, ...made, kept: Math.min(scheduled.length, keep), deleted }
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
// Review: a CORRUPT current DB is when a restore is needed most, so one that can't be read or
// fails integrity_check is not a refusal — its files (db, -wal, -shm) are copied as they are to
// `pre-restore-corrupt` (the online backup can't read it) and `before` is null with the reason.
export async function restoreInto(backupFile, dataDir, { at = new Date() } = {}) {
  assertIntegrity(backupFile)
  assertOutsideRepo(dataDir)
  assertNotLiveUnderTest(dataDir)
  const dbFile = join(dataDir, DB_FILE)
  let before = null
  let unreadable = null
  let safety = null
  if (existsSync(dbFile)) {
    try {
      assertIntegrity(dbFile)
      before = counts(dbFile)
    } catch (error) {
      unreadable = error.message
    }
    safety = unreadable ? rawCopy(dataDir, dbFile, at) : (await backupDb(dataDir, 'pre-restore', { at })).file
  }
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
  // Review nit: the old db is replaced by the rename itself (atomic), never deleted first, so a crash
  // here leaves one DB or the other — never none. Its -wal/-shm must go first: they belong to it.
  for (const f of [`${dbFile}-wal`, `${dbFile}-shm`]) rmSync(f, { force: true })
  renameSync(incoming, dbFile)
  return { dbFile, from: basename(backupFile), safety, before, unreadable, after: counts(dbFile), marked }
}

// The files of a DB that SQLite can't read, copied byte for byte (db, then any -wal/-shm beside it).
function rawCopy(dataDir, dbFile, at) {
  const dir = join(dataDir, BACKUPS)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  let file = join(dir, `workout-${stamp(at)}-pre-restore-corrupt.db`)
  for (let n = 2; existsSync(file); n++) file = join(dir, `workout-${stamp(at)}-pre-restore-corrupt-${n}.db`)
  assertNotLiveUnderTest(file)
  copyFileSync(dbFile, file)
  for (const side of ['-wal', '-shm']) if (existsSync(dbFile + side)) copyFileSync(dbFile + side, file + side)
  return file
}

// req-245 review (deploy order) — does the LIVE server run a req-245+ build? A server from before it
// prunes without the `source IS NULL` rule and would drop the plan revisions. Read from the live
// copy's DEPLOYED (`<ref> <sha> <date>`, server/deploy): that sha must hold server/plan.mjs in one of
// `repoDirs` (`git cat-file -e <sha>:server/plan.mjs`). Anything it can't confirm is a no.
export function liveBuildCheck(liveDir, repoDirs) {
  const file = join(liveDir, 'DEPLOYED')
  if (!existsSync(file)) return { ok: false, text: `no ${file} — is the server deployed?` }
  const sha = readFileSync(file, 'utf8').trim().split(/\s+/)[1]
  if (!/^[0-9a-f]{4,40}$/.test(sha ?? '')) return { ok: false, text: `${file} names no commit` }
  for (const repo of repoDirs) {
    try {
      execFileSync('git', ['-C', repo, 'cat-file', '-e', `${sha}:server/plan.mjs`], { stdio: 'ignore' })
      return { ok: true, sha, text: `the live build ${sha} has server/plan.mjs` }
    } catch {
      // not in this repo, or the commit lacks the file — try the next
    }
  }
  return { ok: false, sha, text: `the live build ${sha} has no server/plan.mjs (checked ${repoDirs.join(', ') || 'no repo'}) — deploy a req-245+ main first` }
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

// req-237 — the doctor's scheduled-backup line: the newest weekly-or-legacy-nightly exists and is
// ≤ maxDays old (7 days + 1 day slack). Deploy and by-hand backups don't count: a fresh deploy
// backup hid the missed 2026-10-26 nightly (req-237 §The failure).
export const SCHEDULED_MAX_DAYS = WEEKLY_DUE_DAYS + 1
export function scheduledBackupCheck(backups, now = Date.now(), maxDays = SCHEDULED_MAX_DAYS) {
  const newest = backups.find((b) => isScheduled(b.reason))
  if (!newest) return { ok: false, text: `scheduled backup: none (weekly or nightly) — want one ≤ ${maxDays} days old` }
  const days = (now - newest.takenMs) / DAY_MS
  return { ok: days <= maxDays, text: `scheduled backup: ${newest.name}, ${days.toFixed(1)} days ago (want ≤ ${maxDays})` }
}

// req-237 — `launchctl print gui/<uid>/<label>` → {runs, lastExit}: `runs` (since the agent was last
// loaded — every deploy reloads it, so information only) and `last exit code` as a number, or null
// when absent or "(never exited)".
export function launchdRuns(printText) {
  const text = String(printText ?? '')
  const runs = /^\truns = (\d+)\s*$/m.exec(text)
  const exit = /^\tlast exit code = (-?\d+)/m.exec(text)
  return { runs: runs ? Number(runs[1]) : null, lastExit: exit ? Number(exit[1]) : null }
}

// `lsof -nP -iTCP:<port> -sTCP:LISTEN` output → the listening addresses.
export function listenAddresses(lsofText) {
  return String(lsofText ?? '')
    .split('\n')
    .slice(1)
    .map((line) => /\s(\S+:\d+) \(LISTEN\)/.exec(line)?.[1])
    .filter(Boolean)
}

// req-235 — the node a launchd plist runs (ProgramArguments[0], as ./server/start writes it).
export function plistNode(plistText) {
  const m = /<key>ProgramArguments<\/key>\s*<array>\s*<string>([^<]*)<\/string>/.exec(String(plistText ?? ''))
  if (!m) return null
  return m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

// req-235 — does the plist's node exist, run, and meet NODE_FLOOR? launchd has no PATH of ours and
// KeepAlive can't bring back a binary that's gone (an nvm uninstall), so the doctor FAILs on it.
// → {ok, text, note}: `note` is set for a path under ~/.nvm.
export function launchdNode(plistFile, home = homedir()) {
  const note = (node) =>
    node && (node + sep).startsWith(join(home, '.nvm') + sep)
      ? `      note: ${node} is an nvm node — if that version is uninstalled, re-run server/start`
      : null
  if (!existsSync(plistFile)) return { ok: false, text: `launchd node: no plist at ${plistFile}`, note: null }
  const node = plistNode(readFileSync(plistFile, 'utf8'))
  if (!node) return { ok: false, text: `launchd node: no ProgramArguments node in ${plistFile}`, note: null }
  const fail = (why) => ({ ok: false, text: `launchd node: ${node} — ${why}`, note: note(node) })
  if (!existsSync(node)) return fail('MISSING')
  try {
    accessSync(node, constants.X_OK)
  } catch {
    return fail('not executable')
  }
  let version
  try {
    version = execFileSync(node, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim()
  } catch (error) {
    return fail(`\`--version\` failed (${error.message.split('\n')[0]})`)
  }
  if (!nodeVersionOk(version)) return fail(`${version}, below the floor ${NODE_FLOOR_TEXT}`)
  return { ok: true, text: `launchd node: ${node} ${version} (floor ${NODE_FLOOR_TEXT})`, note: note(node) }
}
