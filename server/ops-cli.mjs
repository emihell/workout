#!/usr/bin/env node
// req-231 — the command line behind ./server/backup, ./server/restore, ./server/doctor (ops.mjs).
//   backup <reason> | backup --nightly
//   restore <backup> --to <new dir>      the backup as a throwaway data dir (the drill)
//   restore <backup> [--yes]             into the data dir: server stopped, pre-restore backup, marker
//   counts [<db file>]                   record counts (default: the data dir's DB)
//   doctor                               bind, funnel, tailscale mapping, data path, launchd, last backup
// Environment, as the scripts set it: WORKOUT_DATA_DIR, WORKOUT_PORT, WORKOUT_HTTPS_PORT (8446),
// WORKOUT_LABEL (com.workout.server), WORKOUT_LIVE_DIR (~/dev/workout/workout-live).
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { DB_FILE, SECRET_FILE, isInside, realish, serverConfig } from './config.mjs'

export const HTTPS_PORT = 8446
export const LABEL = 'com.workout.server'
export const LIVE_DIR = join(homedir(), 'dev', 'workout', 'workout-live')
const BACKUP_MAX_HOURS = 26

const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 22 || (major === 22 && minor < 16)) {
  console.error(`These scripts need Node ≥ 22.16 (node:sqlite backup); this is ${process.versions.node}.`)
  process.exit(1)
}
const ops = await import('./ops.mjs')

const env = process.env
const config = serverConfig(env)
const httpsPort = Number(env.WORKOUT_HTTPS_PORT || HTTPS_PORT)
const label = env.WORKOUT_LABEL || LABEL
const liveDir = resolve(env.WORKOUT_LIVE_DIR || LIVE_DIR)

const run = (cmd, args) => {
  try {
    return { ok: true, out: execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }
  } catch (error) {
    return { ok: false, out: String(error.stdout ?? ''), err: String(error.stderr ?? error.message) }
  }
}

function tailscaleBin() {
  for (const bin of ['tailscale', '/Applications/Tailscale.app/Contents/MacOS/Tailscale']) {
    if (run(bin, ['version']).ok) return bin
  }
  return null
}

const launchdLoaded = (name) => process.platform === 'darwin' && run('launchctl', ['print', `gui/${process.getuid()}/${name}`]).ok

async function health(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(2000) })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

function printCounts(title, c) {
  console.log(`${title} (schema v${c.version})`)
  console.log(`  tables: ${Object.entries(c.tables).map(([t, n]) => `${t}=${n}`).join(' ')}`)
  for (const u of c.users) {
    console.log(
      `  ${u.username}: rev ${u.rev} · exercises ${u.exercises} · routines ${u.routines} · workouts ${u.workouts}` +
        ` · workout in progress ${u.activeWorkout ? 'yes' : 'no'} · notes ${u.notes}`,
    )
  }
}

async function backup(args) {
  if (args[0] === '--nightly') {
    const r = await ops.nightly(config.dataDir)
    console.log(`${new Date().toISOString()} nightly: ${r.file} (${r.bytes} bytes, integrity ok); kept ${r.kept}, deleted ${r.deleted.length ? r.deleted.join(', ') : 'none'}`)
    return
  }
  if (args.length !== 1) throw new Error('usage: backup <reason>   (e.g. backup before-import)')
  const r = await ops.backupDb(config.dataDir, args[0])
  console.log(`backup: ${r.file} (${r.bytes} bytes, integrity ok)`)
}

async function restore(args) {
  const [file, ...rest] = args
  if (!file) throw new Error('usage: restore <backup> --to <new dir>   |   restore <backup> [--yes]')
  const backupFile = resolve(file)
  if (!existsSync(backupFile)) throw new Error(`No such backup: ${backupFile}`)
  const to = rest.indexOf('--to')
  if (to > -1) {
    if (!rest[to + 1]) throw new Error('restore: --to needs a directory.')
    const r = await ops.restoreTo(backupFile, resolve(rest[to + 1]))
    printCounts(`restored ${backupFile} → ${r.dbFile}`, r.counts)
    return
  }
  // Into the data dir: the server must be down (its open DB would be replaced under it).
  if (launchdLoaded(label)) throw new Error(`Refusing: the server (${label}) is loaded. ./server/stop first.`)
  if (await health(config.port)) throw new Error(`Refusing: something answers on 127.0.0.1:${config.port}. Stop it first.`)
  const dbFile = join(config.dataDir, DB_FILE)
  if (existsSync(dbFile)) printCounts(`now in ${dbFile}`, ops.counts(dbFile))
  printCounts(`in ${backupFile}`, ops.counts(backupFile))
  if (!rest.includes('--yes')) {
    console.log('\nNothing changed. This replaces the data dir’s DB (backed up first as pre-restore). Re-run with --yes.')
    process.exitCode = 2
    return
  }
  const r = await ops.restoreInto(backupFile, config.dataDir)
  console.log(`\nrestored ${r.from} → ${r.dbFile}; previous DB kept as ${r.safety ?? '(none — there was no DB)'}`)
  console.log(`restore markers written: ${r.marked} user(s)`)
  printCounts('now', r.after)
}

async function doctor() {
  const lines = []
  let failed = 0
  const check = (ok, text) => {
    lines.push(`${ok ? 'ok  ' : 'FAIL'}  ${text}`)
    if (!ok) failed++
  }
  const want = `http://127.0.0.1:${config.port}`

  const lsof = run('lsof', ['-nP', `-iTCP:${config.port}`, '-sTCP:LISTEN'])
  const addrs = ops.listenAddresses(lsof.out)
  check(addrs.length > 0 && addrs.every((a) => a === `127.0.0.1:${config.port}`), `bind: ${addrs.join(', ') || 'nothing listening on :' + config.port}`)
  const h = await health(config.port)
  check(Boolean(h?.ok), `health: ${h ? JSON.stringify(h) : 'no answer'}`)

  const ts = tailscaleBin()
  if (!ts) check(false, 'tailscale: not found')
  else {
    const status = run(ts, ['serve', 'status', '--json'])
    if (!status.ok) check(false, `tailscale serve status failed: ${status.err.trim()}`)
    else {
      const s = ops.serveState(status.out, httpsPort, want)
      check(s.mapped, `tailscale serve :${httpsPort} → ${s.proxy ?? 'not mapped'}${s.host ? ` (https://${s.host}:${httpsPort})` : ''}`)
      check(s.funnel.length === 0, `funnel: ${s.funnel.length ? 'ON for ' + s.funnel.join(', ') : 'off'}`)
    }
  }

  const dataReal = realish(config.dataDir)
  let inTree = null
  for (let dir = dataReal; ; dir = resolve(dir, '..')) {
    if (existsSync(join(dir, '.git'))) inTree = dir
    if (dir === resolve(dir, '..')) break
  }
  check(!inTree, `data dir: ${dataReal} — ${inTree ? 'INSIDE the git working tree ' + inTree : 'outside every git working tree'}`)
  const mode = (p) => (existsSync(p) ? (statSync(p).mode & 0o777).toString(8) : 'missing')
  check(mode(config.dataDir) === '700', `data dir mode ${mode(config.dataDir)}`)
  check(mode(join(config.dataDir, SECRET_FILE)) === '600', `secret mode ${mode(join(config.dataDir, SECRET_FILE))}`)

  const liveReal = realish(liveDir)
  const deployed = existsSync(join(liveDir, 'DEPLOYED')) ? readFileSync(join(liveDir, 'DEPLOYED'), 'utf8').trim() : 'no DEPLOYED file'
  check(existsSync(liveDir) && !existsSync(join(liveDir, '.git')) && !isInside(dataReal, liveReal), `live copy: ${liveReal} (${deployed})`)

  if (process.platform === 'darwin') {
    check(launchdLoaded(label), `launchd: ${label} ${launchdLoaded(label) ? 'loaded' : 'NOT loaded'}`)
    check(launchdLoaded(`${label}.nightly`), `launchd: ${label}.nightly ${launchdLoaded(`${label}.nightly`) ? 'loaded' : 'NOT loaded'}`)
  }

  const newest = ops.listBackups(config.dataDir)[0]
  if (!newest) check(false, 'last backup: none')
  else {
    const hours = (Date.now() - newest.mtimeMs) / 3600000
    check(hours <= BACKUP_MAX_HOURS, `last backup: ${newest.name}, ${hours.toFixed(1)} h ago`)
  }

  console.log(`doctor — data ${config.dataDir}, port ${config.port}, label ${label}`)
  for (const line of lines) console.log(line)
  console.log(failed ? `doctor: ${failed} problem(s)` : 'doctor: all ok')
  if (failed) process.exitCode = 1
}

const [command, ...args] = process.argv.slice(2)
const commands = {
  backup,
  restore,
  doctor,
  counts: async ([file]) => printCounts(file ?? join(config.dataDir, DB_FILE), ops.counts(resolve(file ?? join(config.dataDir, DB_FILE)))),
}
if (!commands[command]) {
  console.error('usage: ops-cli.mjs backup|restore|counts|doctor …')
  process.exit(1)
}
try {
  await commands[command](args)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
