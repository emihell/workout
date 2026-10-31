#!/usr/bin/env node
// req-231 — the command line behind ./server/backup, ./server/restore, ./server/doctor (ops.mjs).
//   backup <reason> | backup --weekly [--if-due]   (--if-due: only when the newest weekly is ≥ 7 days old)
//   restore <backup> --to <new dir>      the backup as a throwaway data dir (the drill)
//   restore <backup> [--yes]             into the data dir: server stopped, pre-restore backup, marker
//   counts [<db file>]                   record counts (default: the data dir's DB)
//   duplicates [<db file>]               req-268: duplicate workout ids in each user's latest revision (reads only)
//   doctor                               bind, funnel, tailscale mapping, data path, launchd, weekly backup
//   plan preview <file> [--user <u>]     req-245: the coach's plan file against the DB (reads only)
//   plan apply <file> --source <s> --note <t> [--yes --expect-rev <n>] [--user <u>]   backup, then one new revision
//   plan revert <rev> [--yes --expect-rev <n>] [--note <t>] [--user <u>]             that revision's setup, as a new one
//   plan build <changes.json> --out <file> [--user <u>]   req-254: Coach's change list → a checked plan file (reads only)
//   (WORKOUT_REPO_DIR: where the live DEPLOYED sha is looked up; default this checkout, then ~/dev/workout/workout-codebase)
// Environment, as the scripts set it: WORKOUT_DATA_DIR, WORKOUT_PORT, WORKOUT_HTTPS_PORT (8446),
// WORKOUT_LABEL (com.workout.server), WORKOUT_LIVE_DIR (~/dev/workout/workout-live),
// WORKOUT_AGENTS_DIR (~/Library/LaunchAgents — where the doctor reads <label>.plist; a test seam).
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { DB_FILE, LIVE_DATA_DIR, NODE_FLOOR_TEXT, REPO_ROOT, SECRET_FILE, isInside, nodeVersionOk, realish, serverConfig } from './config.mjs'

export const HTTPS_PORT = 8446
export const LABEL = 'com.workout.server'
export const LIVE_DIR = join(homedir(), 'dev', 'workout', 'workout-live')

if (!nodeVersionOk()) {
  console.error(`These scripts need Node ≥ ${NODE_FLOOR_TEXT}; this is ${process.versions.node}.`)
  process.exit(1)
}
const ops = await import('./ops.mjs')

const env = process.env
const config = serverConfig(env)
const httpsPort = Number(env.WORKOUT_HTTPS_PORT || HTTPS_PORT)
const label = env.WORKOUT_LABEL || LABEL
const liveDir = resolve(env.WORKOUT_LIVE_DIR || LIVE_DIR)
const agentsDir = resolve(env.WORKOUT_AGENTS_DIR || join(homedir(), 'Library', 'LaunchAgents'))

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

const launchdPrint = (name) => (process.platform === 'darwin' ? run('launchctl', ['print', `gui/${process.getuid()}/${name}`]) : { ok: false, out: '' })
const launchdLoaded = (name) => launchdPrint(name).ok

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

// req-268 — the read-only duplicate-id check. The last line is the total, e.g. `0 duplicate workout ids`.
function duplicates([file]) {
  const dbFile = resolve(file ?? join(config.dataDir, DB_FILE))
  const users = ops.duplicateWorkoutIds(dbFile)
  console.log(`${dbFile} (read-only)`)
  let total = 0
  for (const u of users) {
    total += u.duplicates.length
    const dupes = u.duplicates.map((d) => `${d.id} ×${d.count}`).join(', ') || 'none'
    const active = u.activeInHistory ? ` · workout in progress ${u.activeInHistory} is also in history` : ''
    console.log(`  ${u.username}: rev ${u.rev} · duplicate workout ids: ${dupes}${active}`)
  }
  console.log(`${total} duplicate workout id${total === 1 ? '' : 's'}`)
}

async function backup(args) {
  if (args[0] === '--weekly') {
    const rest = args.slice(1)
    if (rest.some((a) => a !== '--if-due')) throw new Error('usage: backup --weekly [--if-due]')
    const r = await ops.weekly(config.dataDir, { ifDue: rest.includes('--if-due') })
    // Not due: silent, exit 0 — the agent runs hourly and its log would fill with "not yet".
    if (!r.made) return
    console.log(`${new Date().toISOString()} weekly: ${r.file} (${r.bytes} bytes, integrity ok); kept ${r.kept}, deleted ${r.deleted.length ? r.deleted.join(', ') : 'none'}`)
    return
  }
  if (args[0] === '--nightly') throw new Error('backup --nightly is gone: the scheduled backup is weekly (backup --weekly, DEC-136).')
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
  if (existsSync(dbFile)) {
    try {
      printCounts(`now in ${dbFile}`, ops.counts(dbFile))
    } catch (error) {
      console.log(`now in ${dbFile}: UNREADABLE (${error.message}) — it will be copied as-is to backups/…-pre-restore-corrupt.db`)
    }
  }
  printCounts(`in ${backupFile}`, ops.counts(backupFile))
  if (!rest.includes('--yes')) {
    console.log('\nNothing changed. This replaces the data dir’s DB (backed up first as pre-restore). Re-run with --yes.')
    process.exitCode = 2
    return
  }
  const r = await ops.restoreInto(backupFile, config.dataDir)
  if (r.unreadable) console.log(`\nthe previous DB's counts were unreadable (${r.unreadable}); its files were copied as-is`)
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
  const info = (text) => lines.push(`info  ${text}`)
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
    const weekly = launchdPrint(`${label}.weekly`)
    check(weekly.ok, `launchd: ${label}.weekly ${weekly.ok ? 'loaded' : 'NOT loaded'}`)
    if (weekly.ok) {
      const w = ops.launchdRuns(weekly.out)
      info(`launchd: ${label}.weekly runs = ${w.runs ?? '?'} (since it was last loaded — every deploy reloads it)`)
      if (w.lastExit !== null) check(w.lastExit === 0, `launchd: ${label}.weekly last exit code = ${w.lastExit}${w.lastExit ? ` — see ${join(config.dataDir, 'logs', 'weekly.log')}` : ''}`)
    }
    // req-231's agent; server/start and server/stop remove it (req-237).
    const legacy = launchdLoaded(`${label}.nightly`)
    check(!legacy, `launchd: ${label}.nightly ${legacy ? 'STILL loaded (re-run server/stop, then server/start)' : 'not loaded'}`)
    const n = ops.launchdNode(join(agentsDir, `${label}.plist`))
    check(n.ok, n.text)
    if (n.note) lines.push(n.note)
  }

  // req-237: the scheduled backup is checked; the newest of any reason is information only.
  const backups = ops.listBackups(config.dataDir)
  const sched = ops.scheduledBackupCheck(backups)
  check(sched.ok, sched.text)
  info(backups[0] ? `newest backup (any reason): ${backups[0].name}, ${((Date.now() - backups[0].takenMs) / 3600000).toFixed(1)} h ago` : 'newest backup (any reason): none')

  console.log(`doctor — data ${config.dataDir}, port ${config.port}, label ${label}`)
  for (const line of lines) console.log(line)
  console.log(failed ? `doctor: ${failed} problem(s)` : 'doctor: all ok')
  if (failed) process.exitCode = 1
}

// ---- req-245: plan preview | apply | revert ----

// `--flag value` and bare `--flag` options after the positional arguments.
function parseArgs(args, valued, bare) {
  const positional = []
  const opts = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (valued.includes(a)) {
      if (args[i + 1] === undefined) throw new Error(`${a} needs a value.`)
      opts[a.slice(2)] = args[++i]
    } else if (bare.includes(a)) opts[a.slice(2)] = true
    else if (a.startsWith('--')) throw new Error(`unknown option ${a}`)
    else positional.push(a)
  }
  return { positional, opts }
}

const fileHash = (file) => (existsSync(file) ? createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16) : 'none')

// --user, or the only account.
function pickUser(db, name) {
  const users = db.prepare('SELECT id, username FROM users ORDER BY id').all()
  if (name) {
    const user = users.find((u) => u.username === name)
    if (!user) throw new Error(`No user "${name}". Users: ${users.map((u) => u.username).join(', ') || 'none'}.`)
    return user
  }
  if (users.length !== 1) throw new Error(`--user is needed: ${users.length} users (${users.map((u) => u.username).join(', ') || 'none'}).`)
  return users[0]
}

function printPlan(title, plan) {
  const c = plan.counts
  const d = (x) => `${x.added} added, ${x.changed} changed, ${x.removed} removed`
  console.log(title)
  for (const line of plan.lines) console.log(`  ${line}`)
  console.log('counts')
  console.log(`  routines: ${d(c.routines)}, ${c.routines.archived} archived`)
  console.log(`  exercises: ${d(c.exercises)}`)
  console.log(`  schedule slots: ${c.slots.before} → ${c.slots.after}`)
  console.log(`  logged workouts: ${c.workouts} · identical after: ${c.workoutsIdentical ? 'yes' : 'NO'}`)
  console.log(`  workout in progress: ${c.activeWorkout ? 'YES' : 'no'}`)
  if (plan.unchanged) console.log('Nothing to change: the result equals the current state.')
  for (const r of plan.refusals) console.log(`REFUSED: ${r}`)
}

function readJson(file) {
  const path = resolve(file)
  if (!existsSync(path)) throw new Error(`No such file: ${path}`)
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(`${path} is not JSON: ${error.message}`)
  }
}

function dbFileOf() {
  const dbFile = join(config.dataDir, DB_FILE)
  if (!existsSync(dbFile)) throw new Error(`No database at ${dbFile}.`)
  return dbFile
}

async function plan(args) {
  const [sub, ...rest] = args
  const { DatabaseSync } = await import('node:sqlite')
  const { openDb } = await import('./db.mjs')
  const p = await import('./plan.mjs')
  const { getRevision } = await import('./store.mjs')
  const report = (refusedOrPlan) => {
    if (refusedOrPlan instanceof p.PlanRefused) {
      printPlan('', refusedOrPlan.plan)
      console.log('Nothing written, no backup taken.')
      process.exitCode = 1
      return true
    }
    return false
  }

  if (sub === 'preview') {
    const { positional, opts } = parseArgs(rest, ['--user'], [])
    if (positional.length !== 1) throw new Error('usage: plan preview <file> [--user <name>]')
    const incoming = p.readPlanFile(readJson(positional[0]))
    // Read-only: preview never writes the DB, not even a schema addition.
    const db = new DatabaseSync(dbFileOf(), { readOnly: true })
    try {
      const user = pickUser(db, opts.user)
      const out = p.previewPlan(db, user.id, incoming)
      printPlan(`plan preview: ${resolve(positional[0])} for ${user.username}, against rev ${out.rev}`, out)
      console.log('Nothing written (preview).')
      if (out.refusals.length) process.exitCode = 1
    } finally {
      db.close()
    }
    return
  }

  if (sub === 'build') {
    // req-254: the newest revision, opened read-only exactly as preview opens it; --out only without refusals.
    const { positional, opts } = parseArgs(rest, ['--user', '--out'], [])
    if (positional.length !== 1 || !opts.out) throw new Error('usage: plan build <changes.json> --out <file> [--user <name>]')
    const out = resolve(opts.out)
    if (existsSync(out)) throw new Error(`Refused, nothing written: --out ${out} already exists (build never overwrites).`)
    const changes = readJson(positional[0])
    const { buildPlan } = await import('./plan-build.mjs')
    const library = JSON.parse(readFileSync(new URL('../src/library/exercises.json', import.meta.url), 'utf8'))
    const db = new DatabaseSync(dbFileOf(), { readOnly: true })
    try {
      const user = pickUser(db, opts.user)
      const { getState } = await import('./store.mjs')
      const current = getState(db, user.id)
      const built = buildPlan(current.state, changes, { library })
      console.log(`built on rev ${current.rev} for ${user.username}`)
      for (const line of built.lines) console.log(`  ${line}`)
      for (const w of built.warnings) console.log(`warning: ${w}`)
      if (built.plan) printPlan(`plan preview of the result (Keep my history), against rev ${current.rev}`, built.plan)
      if (built.refusals.length) {
        for (const r of built.refusals) if (!built.plan?.refusals.some((p) => r.endsWith(p))) console.log(`REFUSED: ${r}`)
        console.log(`Nothing written: no ${out}.`)
        process.exitCode = 1
        return
      }
      writeFileSync(out, JSON.stringify(built.file, null, 2) + '\n', { flag: 'wx' })
      console.log(`wrote ${out} (sha256 ${fileHash(out)})`)
      console.log(`next: ./server/ops plan preview ${out}${opts.user ? ` --user ${opts.user}` : ''}`)
    } finally {
      db.close()
    }
    return
  }

  if (sub === 'apply' || sub === 'revert') {
    const apply = sub === 'apply'
    const { positional, opts } = parseArgs(rest, apply ? ['--user', '--source', '--note', '--expect-rev'] : ['--user', '--note', '--expect-rev'], ['--yes'])
    if (positional.length !== 1) {
      throw new Error(
        apply
          ? 'usage: plan apply <file> --source <name> --note "<text>" [--yes --expect-rev <n>] [--user <name>]'
          : 'usage: plan revert <rev> [--yes --expect-rev <n>] [--note "<text>"] [--user <name>]',
      )
    }
    // Review nit: the dry run checks the flags too, so the approved command line is the one that runs.
    if (apply) p.checkMeta(opts.source, opts.note)
    let expectRev
    if (opts.yes) {
      // Review: --yes is tied to the approved preview — the rev it was computed against.
      expectRev = Number(opts['expect-rev'])
      if (opts['expect-rev'] === undefined || !Number.isInteger(expectRev) || expectRev < 0) {
        throw new Error('--yes needs --expect-rev <n>: the rev the approved preview printed ("against rev n").')
      }
      // Review (deploy order): on the live data dir, only once the live server runs a req-245+ build.
      if (isInside(config.dataDir, LIVE_DATA_DIR)) {
        const repos = [env.WORKOUT_REPO_DIR, REPO_ROOT, join(homedir(), 'dev', 'workout', 'workout-codebase')].filter((d) => d && existsSync(d))
        const live = ops.liveBuildCheck(liveDir, [...new Set(repos)])
        if (!live.ok) throw new Error(`Refusing, nothing written: ${live.text}. The old server's pruning would drop plan revisions.`)
      }
    }
    let incoming
    let rev
    if (apply) incoming = p.readPlanFile(readJson(positional[0]))
    else {
      rev = Number(positional[0])
      if (!Number.isInteger(rev) || rev < 1) throw new Error(`plan revert: <rev> is a revision number (got "${positional[0]}").`)
    }
    const dbFile = dbFileOf()
    if (!opts.yes) {
      // The preview of what --yes would write; still reads only.
      let previewedRev
      const db = new DatabaseSync(dbFile, { readOnly: true })
      try {
        const user = pickUser(db, opts.user)
        if (!apply) {
          const row = getRevision(db, user.id, rev)
          if (!row) throw new Error(`Revision ${rev} is not kept (pruned, or never written).`)
          incoming = row.state
        }
        const out = p.previewPlan(db, user.id, incoming, { checkFileHistory: apply })
        previewedRev = out.rev
        printPlan(`plan ${sub}: ${apply ? resolve(positional[0]) : `rev ${rev}’s setup`} for ${user.username}, against rev ${out.rev}`, out)
        if (out.refusals.length) process.exitCode = 1
      } finally {
        db.close()
      }
      if (!process.exitCode) {
        const rerun = apply ? `plan apply ${positional[0]} --source ${opts.source} --note "…"` : `plan revert ${rev}`
        console.log(`\nNothing written. With --yes: a backup (before-plan-${apply ? opts.source : 'revert'}), then one new revision.`)
        console.log(`To write it: ${rerun} --yes --expect-rev ${previewedRev}`)
        process.exitCode = 2
      }
      return
    }
    const db = openDb(dbFile)
    try {
      const user = pickUser(db, opts.user)
      const at = new Date()
      let out
      try {
        out = apply
          ? await p.applyPlan(db, config.dataDir, user.id, incoming, { source: opts.source, note: opts.note, at, expectRev })
          : await p.revertPlan(db, config.dataDir, user.id, rev, { note: opts.note, at, expectRev })
      } catch (error) {
        if (report(error)) return
        throw error
      }
      printPlan(`plan ${sub} for ${user.username}, against rev ${out.fromRev}`, out)
      if (!out.written) {
        console.log('Nothing written, no backup taken.')
        return
      }
      console.log(`backup: ${out.backup} (sha256 ${fileHash(out.backup)})`)
      console.log(`wrote rev ${out.rev} (source ${apply ? opts.source : 'revert'}); the phone picks it up on its next sync.`)
    } finally {
      db.close()
    }
    return
  }
  throw new Error('usage: plan preview|apply|revert|build …')
}

const [command, ...args] = process.argv.slice(2)
const commands = {
  backup,
  restore,
  doctor,
  plan,
  duplicates,
  counts: async ([file]) => printCounts(file ?? join(config.dataDir, DB_FILE), ops.counts(resolve(file ?? join(config.dataDir, DB_FILE)))),
}
if (!commands[command]) {
  console.error('usage: ops-cli.mjs backup|restore|counts|duplicates|doctor|plan …')
  process.exit(1)
}
try {
  await commands[command](args)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
