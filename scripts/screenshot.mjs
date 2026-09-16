// req-89 — headless screenshot of one app screen, for a pre-merge UI visibility
// check (DEC-047). Boots the *built* app (dist/) behind a tiny static server and
// captures a PNG of a hash route at a phone viewport, so a control hidden behind
// the bottom dock / notch shows up as hidden. Dev-only: puppeteer is a
// devDependency and nothing here is imported by src/, so the prod bundle carries
// none of it. See reports/req-89.md.
//
//   npm run shot -- /                     # Today (default route)
//   npm run shot -- /history --out screenshots/history.png
//   npm run shot -- / --seed src/db.json  # seed localStorage before load
//   npm run shot -- /settings --viewport 414x896 --build
//
// Flags:
//   --out <file>       output PNG path (default screenshots/<route-slug>.png)
//   --viewport WxH     CSS px (default 390x844, iPhone-ish, phone-first)
//   --seed <file>      JSON state doc written to localStorage before the app loads
//                      (the app's own migrateState runs on it — pass any schema).
//   --build            force `npm run build` even if dist/ already exists
//   --full             full-page screenshot (default: just the viewport)
//   --wait <ms>        extra settle delay after render (default 250)

import { execSync } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const DIST = join(ROOT, 'dist')
const STORAGE_KEY = 'workout-mvp-v9' // must match src/storage.js

function parseArgs(argv) {
  const opts = { route: '/', viewport: '390x844', wait: 250, full: false, build: false }
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out') opts.out = argv[++i]
    else if (a === '--viewport') opts.viewport = argv[++i]
    else if (a === '--seed') opts.seed = argv[++i]
    else if (a === '--wait') opts.wait = Number(argv[++i])
    else if (a === '--build') opts.build = true
    else if (a === '--full') opts.full = true
    else if (a.startsWith('--')) throw new Error(`unknown flag: ${a}`)
    else rest.push(a)
  }
  if (rest[0]) opts.route = rest[0]
  return opts
}

function routeSlug(route) {
  const slug = String(route)
    .replace(/[#?].*$/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'root'
}

const CONTENT_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

// Serve dist/ for the screenshot. The app uses hash routing, so every real
// request is for `/` or a fingerprinted `/assets/*` file; anything else falls back
// to index.html (SPA), matching how Pages would serve it.
function serveDist() {
  return new Promise((resolveServer) => {
    const server = createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0])
      let filePath = join(DIST, urlPath)
      if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
        filePath = join(DIST, 'index.html')
      }
      res.writeHead(200, { 'content-type': CONTENT_TYPES[extname(filePath)] || 'application/octet-stream' })
      createReadStream(filePath).pipe(res)
    })
    server.listen(0, '127.0.0.1', () => resolveServer(server))
  })
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))

  const [w, h] = opts.viewport.split('x').map(Number)
  if (!w || !h) throw new Error(`bad --viewport (expected WxH): ${opts.viewport}`)

  if (opts.build || !existsSync(join(DIST, 'index.html'))) {
    console.log('Building app (vite build)…')
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' })
  }

  let seedValue = null
  if (opts.seed) {
    // Parse the seed to fail fast on bad JSON, then re-serialize a canonical string.
    seedValue = JSON.stringify(JSON.parse(readFileSync(resolve(opts.seed), 'utf8')))
  }

  const route = opts.route.startsWith('/') ? opts.route : `/${opts.route}`
  const outPath = resolve(opts.out || join('screenshots', `${routeSlug(route)}.png`))
  mkdirSync(resolve(outPath, '..'), { recursive: true })

  const server = await serveDist()
  const { port } = server.address()
  const browser = await puppeteer.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 })
    if (seedValue != null) {
      // Runs before any app script on every navigation, so loadState() sees the
      // seed. This is a throwaway browser profile — never a real workout history.
      await page.evaluateOnNewDocument(
        (key, value) => window.localStorage.setItem(key, value),
        STORAGE_KEY,
        seedValue,
      )
    }
    const url = `http://127.0.0.1:${port}/#${route}`
    await page.goto(url, { waitUntil: 'networkidle0' })
    await page.waitForSelector('#root > *', { timeout: 10000 })
    if (opts.wait > 0) await new Promise((r) => setTimeout(r, opts.wait))
    await page.screenshot({ path: outPath, fullPage: opts.full })
    console.log(`Wrote ${outPath}  (route ${route}, ${w}x${h}${seedValue ? ', seeded' : ''})`)
  } finally {
    await browser.close()
    server.close()
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
