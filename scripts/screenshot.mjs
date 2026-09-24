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
//   --wait <ms>        extra settle delay after render (default 250), and after
//                      each --click
//   --click "<text>"   req-129: after load, click the button/link whose visible
//                      text is <text> (exact, trimmed; else the only one that
//                      contains it). Repeatable, applied in order, so a state
//                      behind two taps is `--click "Start" --click "Complete"`.
//                      Exits non-zero, with no PNG, when the text isn't found.
//   --type "<text>"    req-139: type <text> into the first visible text field.
//                      --type and --click run in the order given, so a state
//                      behind a search is `--type "press" --click "more from"`.
//   --scroll-bottom    req-129: scroll the page and every scrollable container to
//                      the bottom before the shot (content below the fold)
//
//   npm run shot -- /workout/sess-upper --seed active.json --click "Cancel"

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
  const opts = { route: '/', viewport: '390x844', wait: 250, full: false, build: false, actions: [], scrollBottom: false }
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out') opts.out = argv[++i]
    else if (a === '--viewport') opts.viewport = argv[++i]
    else if (a === '--seed') opts.seed = argv[++i]
    else if (a === '--wait') opts.wait = Number(argv[++i])
    else if (a === '--build') opts.build = true
    else if (a === '--full') opts.full = true
    else if (a === '--click') {
      const text = argv[++i]
      if (text == null || text.trim() === '') throw new Error('--click needs the text to click')
      opts.actions.push({ kind: 'click', text })
    } else if (a === '--type') {
      const text = argv[++i]
      if (text == null || text === '') throw new Error('--type needs the text to type')
      opts.actions.push({ kind: 'type', text })
    } else if (a === '--scroll-bottom') opts.scrollBottom = true
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

// req-129: click the clickable element showing `text`. An exact (trimmed) match
// wins; otherwise a single element that contains the text. None, or more than one
// containing match with no exact one, is an error — never a guess.
async function clickByText(page, text) {
  const result = await page.evaluate((wanted) => {
    const norm = (s) => s.replace(/\s+/g, ' ').trim()
    const els = [...document.querySelectorAll('button, a, [role="button"], summary, label')]
      .filter((el) => !el.disabled && el.getClientRects().length > 0)
    const exact = els.filter((el) => norm(el.textContent) === wanted)
    const partial = els.filter((el) => norm(el.textContent).includes(wanted))
    const pick = exact.length ? exact : partial
    if (pick.length === 0) return { error: `no button or link with text "${wanted}"` }
    if (!exact.length && pick.length > 1) {
      return { error: `"${wanted}" is ambiguous: ${pick.map((el) => `"${norm(el.textContent)}"`).join(', ')}` }
    }
    pick[0].scrollIntoView({ block: 'center' })
    pick[0].click()
    return { clicked: norm(pick[0].textContent), tag: pick[0].tagName.toLowerCase() }
  }, text.trim())
  if (result.error) throw new Error(`--click: ${result.error}`)
  return result
}

// req-139: type into the first visible, enabled text field (input or textarea).
async function typeText(page, text) {
  const handle = await page.evaluateHandle(() =>
    [...document.querySelectorAll('input, textarea')].find((el) =>
      !el.disabled && el.getClientRects().length > 0 && !['checkbox', 'radio', 'button', 'submit', 'hidden'].includes(el.type)),
  )
  const field = handle.asElement()
  if (!field) throw new Error('--type: no visible text field')
  await field.click()
  await field.type(text)
}

async function scrollToBottom(page) {
  await page.evaluate(() => {
    window.scrollTo(0, document.scrollingElement.scrollHeight)
    for (const el of document.querySelectorAll('*')) {
      const oy = getComputedStyle(el).overflowY
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight
    }
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
    const settle = () => (opts.wait > 0 ? new Promise((r) => setTimeout(r, opts.wait)) : null)
    await settle()
    for (const action of opts.actions) {
      if (action.kind === 'type') {
        await typeText(page, action.text)
        await settle()
        console.log(`Typed "${action.text}"`)
        continue
      }
      const { clicked, tag } = await clickByText(page, action.text)
      await settle()
      console.log(`Clicked <${tag}> "${clicked}"  → now at ${new URL(page.url()).hash || '#/'}`)
    }
    if (opts.scrollBottom) {
      await scrollToBottom(page)
      await settle()
    }
    await page.screenshot({ path: outPath, fullPage: opts.full })
    const extras = [seedValue ? 'seeded' : '', opts.actions.length ? `${opts.actions.length} action(s)` : '', opts.scrollBottom ? 'scrolled to bottom' : '']
      .filter(Boolean)
    console.log(`Wrote ${outPath}  (route ${route}, ${w}x${h}${extras.map((e) => `, ${e}`).join('')})`)
  } finally {
    await browser.close()
    server.close()
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
