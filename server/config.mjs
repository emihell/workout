// req-229 — where the server's data lives, and the two path guards (BACKEND rules 1 and 8).
//
// Data (the SQLite file + the secret) lives OUTSIDE every worktree: by default
// ~/dev/workout/workout-data (BACKEND §Where things live). The server refuses a data path inside
// the repo tree (rule 1), and under `WORKOUT_SERVER_TEST=1` (set by the test suite) it refuses
// the live data path itself (rule 8) — both checked BEFORE anything is created or opened.
import { existsSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const HOST = '127.0.0.1'
export const DEFAULT_PORT = 8100
export const LIVE_DATA_DIR = join(homedir(), 'dev', 'workout', 'workout-data')
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const DB_FILE = 'workout.db'
export const SECRET_FILE = 'secret'

// req-235 — the one Node floor, read by start.mjs, accounts.mjs, ops-cli.mjs and ./server/start
// (through `node -e`), and checked against the launchd plist's node by the doctor. 22.16.0: the
// node:sqlite online `backup` (req-231) lands there; plain node:sqlite is unflagged from 22.13.
export const NODE_FLOOR = [22, 16, 0]
export const NODE_FLOOR_TEXT = NODE_FLOOR.join('.')

// `version` as process.versions.node gives it, or as `node --version` prints it (a leading v).
export function nodeVersionOk(version = process.versions.node) {
  const parts = String(version).trim().replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (parts[i] !== NODE_FLOOR[i]) return parts[i] > NODE_FLOOR[i]
  }
  return true
}

export function serverConfig(env = process.env) {
  const rawPort = env.WORKOUT_PORT
  const port = rawPort === undefined || rawPort === '' ? DEFAULT_PORT : Number(rawPort)
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`WORKOUT_PORT is not a port: ${rawPort}`)
  // req-230 — the built app the server serves on the same origin (`npm run build:server`).
  const appDir = resolve(env.WORKOUT_APP_DIR || join(REPO_ROOT, 'dist-server'))
  return { host: HOST, port, dataDir: resolve(env.WORKOUT_DATA_DIR || LIVE_DATA_DIR), appDir }
}

// The real path of `p`, resolving symlinks through its nearest existing ancestor, so a
// not-yet-created dir (or macOS /tmp → /private/tmp) compares like-for-like.
export function realish(p) {
  let current = resolve(p)
  const rest = []
  while (!existsSync(current)) {
    const parent = dirname(current)
    if (parent === current) break
    rest.unshift(current.slice(parent.length).replace(/^[/\\]/, ''))
    current = parent
  }
  return join(existsSync(current) ? realpathSync(current) : current, ...rest)
}

export function isInside(child, parent) {
  const c = realish(child)
  const p = realish(parent)
  return c === p || c.startsWith(p.endsWith(sep) ? p : p + sep)
}

// BACKEND rule 1: the data dir (which holds the secret and the DB) must not sit inside a git
// working tree — this repo's, or any other checkout/worktree. Any ancestor holding a `.git`
// (a dir for a main checkout, a file for a linked worktree) counts.
export function assertOutsideRepo(dataDir, repoRoot = REPO_ROOT) {
  if (isInside(dataDir, repoRoot)) {
    throw new Error(
      `Refusing to start: data path ${dataDir} is inside the repository (${repoRoot}). Keep data and secrets out of git.`,
    )
  }
  let current = realish(dataDir)
  for (;;) {
    if (existsSync(join(current, '.git'))) {
      throw new Error(
        `Refusing to start: data path ${dataDir} is inside a git working tree (${current}). Keep data and secrets out of git.`,
      )
    }
    const parent = dirname(current)
    if (parent === current) return
    current = parent
  }
}

// BACKEND rule 8: under the test suite, the live data path may never be opened or created.
export function assertNotLiveUnderTest(p, env = process.env) {
  if (env.WORKOUT_SERVER_TEST && isInside(p, LIVE_DATA_DIR)) {
    throw new Error(`Test guard: ${p} is the live data path (${LIVE_DATA_DIR}); tests use temp DBs only.`)
  }
}
