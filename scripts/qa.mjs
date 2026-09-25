// req-159 — an isolated browser build of any git ref, on its own origin. The recipe
// planning and build have both been running by hand (L-033), as one command:
//
//   node scripts/qa.mjs start <ref> [--seed <file>] [--node-modules <dir>]
//   node scripts/qa.mjs stop
//   node scripts/qa.mjs status
//
// `./plan qa <ref>` / `./plan qa --stop` call this. Read-only to every worktree: the
// ref is exported with `git archive` into a temp dir (no worktree registered, no
// checkout, so it is safe from the planning worktree), node_modules is borrowed by
// symlink, vite builds into the temp dir, and a detached static server serves it on a
// free 127.0.0.1 port — its own origin, so its localStorage is neither the dev
// server's (:5173) nor the live site's. Node builtins only (vite is run from the
// borrowed node_modules), so it runs from a checkout without its own node_modules.
//
// The seed: the served index.html gets an inline script that, when the origin holds
// no v9 and no v8 doc, writes the seed under the v8 key — so the first load migrates
// it through the real legacy path, and later loads keep whatever the app saved.
// Default seed src/db.json (of the invoking checkout); --seed <file> replaces it.
//
// scripts/smoke.mjs imports buildRef/serveDir to run the same build in-process.

import { execFileSync, execSync, spawn } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const LEGACY_KEY = 'workout-mvp-v8' // storage.js LEGACY_KEYS[0]
const CURRENT_KEY = 'workout-mvp-v9' // storage.js STORAGE_KEY
const STATE_DIR = join(tmpdir(), 'workout-plan-qa')
const STATE_FILE = join(STATE_DIR, 'state.json')

export function resolveRef(ref, cwd = ROOT) {
  return execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], { cwd, encoding: 'utf8' }).trim()
}

// Export `sha` and build it into `dist` (base '/', GITHUB_PAGES unset). Nothing is
// written to a worktree: the export and the build are both under tmpdir.
export function buildRef(sha, dist, { cwd = ROOT, nodeModules = join(ROOT, 'node_modules') } = {}) {
  if (!existsSync(join(nodeModules, 'vite/bin/vite.js'))) throw new Error(`no vite under ${nodeModules} — run npm ci there, or pass --node-modules`)
  const src = mkdtempSync(join(tmpdir(), `qa-src-${sha.slice(0, 7)}-`))
  try {
    execSync(`git archive --format=tar ${sha} | tar -x -C "${src}"`, { cwd, stdio: ['ignore', 'ignore', 'inherit'] })
    symlinkSync(nodeModules, join(src, 'node_modules'), 'dir')
    const env = { ...process.env }
    delete env.GITHUB_PAGES
    execFileSync(process.execPath, [join(nodeModules, 'vite/bin/vite.js'), 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'error'], {
      cwd: src,
      env,
      stdio: ['ignore', 'ignore', 'inherit'],
    })
  } finally {
    rmSync(src, { recursive: true, force: true })
  }
}

// Inline the seed into index.html, ahead of the app's module script. `<` is escaped
// so the JSON can't close the script tag.
export function injectSeed(dist, seedJson) {
  const file = join(dist, 'index.html')
  const literal = JSON.stringify(JSON.stringify(JSON.parse(seedJson))).replace(/</g, '\\u003c')
  const script =
    `<script>try{if(!localStorage.getItem(${JSON.stringify(CURRENT_KEY)})&&!localStorage.getItem(${JSON.stringify(LEGACY_KEY)}))` +
    `localStorage.setItem(${JSON.stringify(LEGACY_KEY)},${literal})}catch(e){}</script>`
  const html = readFileSync(file, 'utf8')
  if (!html.includes('<head>')) throw new Error('index.html has no <head> to seed into')
  writeFileSync(file, html.replace('<head>', `<head>${script}`))
}

const CONTENT_TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' }

// A static server for `dir`; unknown paths fall back to index.html. Port 0 = a free one.
export function serveDir(dir, port = 0) {
  return new Promise((done, fail) => {
    const server = createServer((req, res) => {
      let f = join(dir, decodeURIComponent(req.url.split('?')[0]))
      if (!f.startsWith(dir) || !existsSync(f) || statSync(f).isDirectory()) f = join(dir, 'index.html')
      res.writeHead(200, { 'content-type': CONTENT_TYPES[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' })
      createReadStream(f).pipe(res)
    })
    server.on('error', fail)
    server.listen(port, '127.0.0.1', () => done(server))
  })
}

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  } catch {
    return null
  }
}

const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function stop({ quiet = false } = {}) {
  const state = readState()
  if (!state) {
    if (!quiet) console.log('plan qa: nothing running')
    return
  }
  if (alive(state.pid)) process.kill(state.pid)
  rmSync(state.dir, { recursive: true, force: true })
  rmSync(STATE_FILE, { force: true })
  if (!quiet) console.log(`plan qa: stopped ${state.ref} (${state.sha.slice(0, 7)}) — pid ${state.pid}, port ${state.port} freed, ${state.dir} removed`)
}

async function start(args) {
  let ref = null
  let seed = join(ROOT, 'src/db.json')
  let nodeModules = join(ROOT, 'node_modules')
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seed') seed = resolve(args[++i])
    else if (args[i] === '--node-modules') nodeModules = resolve(args[++i])
    else if (!ref && !args[i].startsWith('-')) ref = args[i]
    else throw new Error(`unknown argument: ${args[i]}`)
  }
  if (!ref) throw new Error('usage: plan qa <ref> [--seed <file>] | plan qa --stop')
  const seedJson = readFileSync(seed, 'utf8')
  JSON.parse(seedJson) // refuse a broken seed before building
  const sha = resolveRef(ref)
  stop({ quiet: true }) // one qa server at a time; a re-run replaces it
  mkdirSync(STATE_DIR, { recursive: true })
  const dir = mkdtempSync(join(tmpdir(), `qa-dist-${sha.slice(0, 7)}-`))
  console.log(`plan qa: building ${ref} (${sha.slice(0, 7)}) in ${dir}…`)
  buildRef(sha, dir, { nodeModules })
  injectSeed(dir, seedJson)
  // Find a free port here, then hand it to a detached server that outlives us.
  const probe = await serveDir(dir)
  const port = probe.address().port
  await new Promise((r) => probe.close(r))
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'serve', dir, String(port)], { detached: true, stdio: 'ignore' })
  child.unref()
  const url = `http://127.0.0.1:${port}/`
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) break
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100))
    if (i === 39) throw new Error(`server did not come up on ${url}`)
  }
  writeFileSync(STATE_FILE, JSON.stringify({ ref, sha, pid: child.pid, port, dir, seed }, null, 2))
  console.log(`plan qa: ${ref} (${sha.slice(0, 7)}) serving, seeded from ${seed} under ${LEGACY_KEY}:`)
  console.log(`    ${url}`)
  console.log('  stop when done:  ./plan qa --stop')
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  if (cmd === 'start') return start(rest)
  if (cmd === 'stop') return stop()
  if (cmd === 'status') {
    const s = readState()
    return console.log(s && alive(s.pid) ? `plan qa: ${s.ref} (${s.sha.slice(0, 7)}) on http://127.0.0.1:${s.port}/ (pid ${s.pid})` : 'plan qa: nothing running')
  }
  if (cmd === 'serve') return serveDir(rest[0], Number(rest[1])) // the detached child
  throw new Error('usage: qa.mjs start <ref> [--seed <file>] | stop | status')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`plan qa: ${err.message || err}`)
    process.exit(1)
  })
}
