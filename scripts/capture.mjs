// req-129 — the L-024 before/after capture, moved out of a scratchpad into the repo.
// Proves a "visual no-op" (or pins down what a change moved): builds two git refs,
// serves each build, and captures the same screens under the same seeded state
// with the clock frozen, then compares per screen the PNG bytes and `#root`
// innerHTML. Dev-only, like screenshot.mjs: nothing here is imported by src/.
//
//   npm run capture -- --base main --head req-129
//   npm run capture -- --base main --head main      # repeatability: must be all identical
//
// Flags:
//   --base <ref>    the "before" git ref (required)
//   --head <ref>    the "after" git ref (required)
//   --seed <file>   state doc for the idle screens (default src/db.json, repo-relative)
//   --out <dir>     where captures go (default screenshots/capture) — gitignored.
//                   <out>/base/ and <out>/head/ get <screen>.png + <screen>.html;
//                   <out>/active-seed.json is the active-workout seed it built.
//
// The active-workout seed is built, not stored: on the BASE build, from --seed,
// it starts "Upper Body" and completes one set through the UI, then saves that
// localStorage doc. Both sides then load the same two seeds, so any difference is
// the code's, not the data's.
//
// Exit: 0 all screens identical · 1 at least one differs · 2 error (including a
// run that compared 0 screens — a check that compares nothing must not pass, L-020).
// A PNG-only diff with identical DOM is usually sub-pixel anti-aliasing from a
// text-node split (L-024): explainable, but look at it.

import { execFileSync, execSync } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const STORAGE_KEY = 'workout-mvp-v9' // must match src/storage.js
const FROZEN_NOW = new Date('2026-09-23T10:00:00').getTime()
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2 }
const SETTLE_MS = 400

// [name, 'idle' | 'active' seed, route]. Ids are src/db.json's.
const SCREENS = [
  ['today', 'idle', '/'],
  ['settings', 'idle', '/settings'],
  ['library-exercises', 'idle', '/exercises'],
  ['library-routines', 'idle', '/routines'],
  ['routine-detail', 'idle', '/routines/sess-upper'],
  ['routine-item-editor', 'idle', '/routines/sess-upper/exercise/si-sess-upper-1-ex-chest-press'],
  ['routine-edit', 'idle', '/routines/sess-upper/edit'],
  ['routine-new', 'idle', '/routines/new'],
  ['history', 'idle', '/history'],
  ['history-detail', 'idle', '/history/wo-w42-sess-upper'],
  ['history-edit', 'idle', '/history/wo-w42-sess-upper/edit'],
  ['history-recalc', 'idle', '/history/wo-w42-sess-upper/recalculate'],
  ['schedule-loop', 'idle', '/schedule/loop'],
  ['exercise-new-manual', 'idle', '/exercises/new/manual'],
  ['exercise-detail', 'idle', '/exercises/ex-chest-press'],
  ['exercise-edit', 'idle', '/exercises/ex-chest-press/edit'],
  ['showcase', 'idle', '/components'],
  ['today-active', 'active', '/'],
  ['workout-overview', 'active', '/workout/sess-upper'],
  ['set-log', 'active', '/workout/sess-upper/item/si-sess-upper-1-ex-chest-press'],
  ['set-edit', 'active', '/workout/sess-upper/set/0'],
  ['replace', 'active', '/workout/sess-upper/item/si-sess-upper-1-ex-chest-press/replace'],
  ['finish', 'active', '/workout/sess-upper/finish'],
]

function parseArgs(argv) {
  const opts = { seed: 'src/db.json', out: 'screenshots/capture' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--base') opts.base = argv[++i]
    else if (a === '--head') opts.head = argv[++i]
    else if (a === '--seed') opts.seed = argv[++i]
    else if (a === '--out') opts.out = argv[++i]
    else throw new Error(`unknown argument: ${a}`)
  }
  if (!opts.base || !opts.head) throw new Error('usage: npm run capture -- --base <ref> --head <ref>')
  return opts
}

function resolveRef(ref) {
  return execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], { cwd: ROOT, encoding: 'utf8' }).trim()
}

// Build one commit's app into `dist`: export the tree (git archive — no worktree
// is registered, so `plan`'s find_worktrees never sees it), borrow this checkout's
// node_modules, run vite. The export is outside any git repo, so the dev-notes
// build stamp reads "unknown" on both sides instead of differing by sha.
function buildRef(sha, dist) {
  const src = mkdtempSync(join(tmpdir(), `capture-src-${sha.slice(0, 7)}-`))
  try {
    execSync(`git archive --format=tar ${sha} | tar -x -C "${src}"`, { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] })
    symlinkSync(join(ROOT, 'node_modules'), join(src, 'node_modules'), 'dir')
    execFileSync(process.execPath, [join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'error'], {
      cwd: src,
      stdio: 'inherit',
    })
  } finally {
    rmSync(src, { recursive: true, force: true })
  }
}

const CONTENT_TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon' }

function serve(dir) {
  return new Promise((done) => {
    const server = createServer((req, res) => {
      let f = join(dir, decodeURIComponent(req.url.split('?')[0]))
      if (!existsSync(f) || statSync(f).isDirectory()) f = join(dir, 'index.html')
      res.writeHead(200, { 'content-type': CONTENT_TYPES[extname(f)] || 'application/octet-stream' })
      createReadStream(f).pipe(res)
    })
    server.listen(0, '127.0.0.1', () => done(server))
  })
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// A fresh page with the clock frozen and localStorage holding exactly `seed`
// (set once per tab via sessionStorage, so in-page navigation keeps app writes).
async function openPage(browser, base, seed, route) {
  const page = await browser.newPage()
  await page.setViewport(VIEWPORT)
  await page.evaluateOnNewDocument(
    (fixed, key, value) => {
      const RealDate = Date
      class FrozenDate extends RealDate {
        constructor(...a) {
          if (a.length) super(...a)
          else super(fixed)
        }
        static now() {
          return fixed
        }
      }
      window.Date = FrozenDate
      if (!sessionStorage.getItem('capture-seeded')) {
        localStorage.clear()
        localStorage.setItem(key, value)
        sessionStorage.setItem('capture-seeded', '1')
      }
    },
    FROZEN_NOW,
    STORAGE_KEY,
    seed,
  )
  await page.goto(`${base}#${route}`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#root > *', { timeout: 10000 })
  await wait(SETTLE_MS)
  return page
}

async function clickText(page, text, scope = 'button') {
  const ok = await page.evaluate(
    (t, sel) => {
      const el = [...document.querySelectorAll(sel)].find((b) => b.textContent.trim() === t)
      if (el) el.click()
      return Boolean(el)
    },
    text,
    scope,
  )
  if (!ok) throw new Error(`active seed: no "${text}" button on ${page.url()}`)
  await wait(SETTLE_MS)
}

async function buildActiveSeed(browser, base, idleSeed) {
  const page = await openPage(browser, base, idleSeed, '/routines')
  const started = await page.evaluate(() => {
    const row = [...document.querySelectorAll('li')].find((l) => l.textContent.includes('Upper Body'))
    const start = row && [...row.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Start')
    if (start) start.click()
    return Boolean(start)
  })
  if (!started) throw new Error('active seed: no "Start" on the Upper Body row at #/routines')
  await wait(SETTLE_MS)
  await page.evaluate(() => {
    location.hash = '#/workout/sess-upper/item/si-sess-upper-1-ex-chest-press'
  })
  await wait(SETTLE_MS)
  await clickText(page, 'Complete')
  const state = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)
  await page.close()
  const doc = JSON.parse(state)
  if (!doc.activeWorkout) throw new Error('active seed: no activeWorkout after Start + Complete')
  return state
}

async function captureSide(browser, dist, outDir, seeds) {
  const server = await serve(dist)
  const base = `http://127.0.0.1:${server.address().port}/`
  try {
    if (!seeds.active) seeds.active = await buildActiveSeed(browser, base, seeds.idle)
    mkdirSync(outDir, { recursive: true })
    for (const [name, which, route] of SCREENS) {
      const page = await openPage(browser, base, seeds[which], route)
      await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: true })
      writeFileSync(join(outDir, `${name}.html`), await page.evaluate(() => document.querySelector('#root').innerHTML))
      await page.close()
    }
  } finally {
    server.close()
  }
}

function compare(baseDir, headDir) {
  let differ = 0
  const rows = SCREENS.map(([name]) => {
    const pa = readFileSync(join(baseDir, `${name}.png`))
    const pb = readFileSync(join(headDir, `${name}.png`))
    const png = pa.equals(pb)
    const dom = readFileSync(join(baseDir, `${name}.html`), 'utf8') === readFileSync(join(headDir, `${name}.html`), 'utf8')
    if (!png || !dom) differ++
    const pngCell = png ? 'identical' : `DIFFERS (${pa.length} vs ${pb.length} bytes)`
    return `${name.padEnd(22)} png ${pngCell.padEnd(34)} dom ${dom ? 'identical' : 'DIFFERS'}`
  })
  return { rows, differ, compared: rows.length }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const baseSha = resolveRef(opts.base)
  const headSha = resolveRef(opts.head)
  const out = resolve(ROOT, opts.out)
  const idle = JSON.stringify(JSON.parse(readFileSync(resolve(ROOT, opts.seed), 'utf8')))

  const work = mkdtempSync(join(tmpdir(), 'capture-dist-'))
  try {
    const distFor = {}
    for (const sha of new Set([baseSha, headSha])) {
      console.log(`Building ${sha.slice(0, 7)}…`)
      distFor[sha] = join(work, sha)
      buildRef(sha, distFor[sha])
    }
    rmSync(out, { recursive: true, force: true })
    const seeds = { idle }
    const browser = await puppeteer.launch({ headless: true })
    try {
      await captureSide(browser, distFor[baseSha], join(out, 'base'), seeds)
      writeFileSync(join(out, 'active-seed.json'), seeds.active)
      await captureSide(browser, distFor[headSha], join(out, 'head'), seeds)
    } finally {
      await browser.close()
    }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }

  const { rows, differ, compared } = compare(join(out, 'base'), join(out, 'head'))
  console.log(`\nbase ${opts.base} (${baseSha.slice(0, 7)})  vs  head ${opts.head} (${headSha.slice(0, 7)})  —  captures in ${out}`)
  for (const r of rows) console.log(r)
  if (compared === 0) {
    console.error('capture: compared 0 screens — refusing to report a pass.')
    process.exit(2)
  }
  console.log(differ ? `${differ} of ${compared} screen(s) differ` : `all ${compared} screens identical (png bytes + DOM)`)
  process.exit(differ ? 1 : 0)
}

main().catch((err) => {
  console.error(`capture: ${err.message || err}`)
  process.exit(2)
})
