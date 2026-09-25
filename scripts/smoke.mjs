// req-159 — the scripted smoke test: the app's core loop by real clicks in headless
// Chrome, against an isolated build on its own origin. It gates the Pages deploy
// (.github/workflows/deploy.yml) and runs locally behind `./check --smoke`.
//
//   node scripts/smoke.mjs                 build HEAD in a temp dir (scripts/qa.mjs), serve, test
//   node scripts/smoke.mjs --ref <ref>     same, for another ref
//   node scripts/smoke.mjs --url <url>     test a server already up (e.g. `./plan qa <ref>`)
//
// The loop: Start today's routine → log a set typed "22,5" → skip an exercise →
// Finish → Save → the stored workout has 22.5 kg and the skipped sets → Back never
// renders "Not found." → History shows the workout → Back, Back unwinds to its month
// (req-171). Exit 0 green, 1 on the first failed
// step (the step, the reason and the screen's text are printed), 2 on a setup error.
//
// Deterministic by construction:
// - A fresh browser context per run, so localStorage starts empty and the page's
//   seed script (qa.mjs injectSeed, src/db.json under the v8 key) runs.
// - The clock is SHIFTED (not frozen) to Mon 2026-09-21 10:00 local, db.json's Upper
//   Body day, so "today's routine" doesn't depend on the day it runs; time still
//   advances, so the rest timer and the auto-complete countdown behave normally.
// - Native confirm/alert/prompt are replaced to RECORD and return a refusal; any
//   call fails the run (the app must never use one, DESIGN).
// - Headless Chrome doesn't throttle timers (a background tab would — L-033), and
//   there is one page in the foreground. The loop is chosen so no countdown screen
//   appears: exercises remain undone, so the req-84 auto-complete never mounts.
// - One step per await: each step acts, then waits for the screen it expects.
// - req-162: a "Not found." render at ANY point — even a one-render flash, caught by the
//   page's MutationObserver tripwire — fails the step it happened in.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { buildRef, injectSeed, resolveRef, serveDir } from './qa.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const STORAGE_KEY = 'workout-mvp-v9'
const TODAY = '2026-09-21T10:00:00' // a Monday: db.json's slot-sess-upper
const ROUTINE = 'Upper Body'
const LOG_EXERCISE = 'Chest Press'
const SKIP_EXERCISE = 'Lat Pulldown'
const TYPED_WEIGHT = '22,5'
const STEP_TIMEOUT = 5000

function parseArgs(argv) {
  const opts = { ref: 'HEAD', url: null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ref') opts.ref = argv[++i]
    else if (argv[i] === '--url') opts.url = argv[++i]
    else throw new Error(`unknown argument: ${argv[i]}`)
  }
  return opts
}

class StepFailure extends Error {}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const t0 = Date.now()
  let server = null
  let dist = null
  let url = opts.url
  if (!url) {
    const sha = resolveRef(opts.ref)
    dist = mkdtempSync(join(tmpdir(), `smoke-dist-${sha.slice(0, 7)}-`))
    console.log(`smoke: building ${opts.ref} (${sha.slice(0, 7)})…`)
    buildRef(sha, dist)
    injectSeed(dist, readFileSync(join(ROOT, 'src/db.json'), 'utf8'))
    server = await serveDir(dist)
    url = `http://127.0.0.1:${server.address().port}/`
  }
  const tBuilt = Date.now()
  console.log(`smoke: testing ${url}`)

  const browser = await puppeteer.launch({ headless: true, args: process.env.CI ? ['--no-sandbox'] : [] })
  let page = null
  let current = 'launch'
  let passed = 0
  try {
    const context = await browser.createBrowserContext()
    page = await context.newPage()
    await page.setViewport({ width: 390, height: 844 })
    // A real native dialog would block the page; count one as a failure too.
    page.on('dialog', (d) => {
      nativeDialogs.push(`${d.type()}: ${d.message()}`)
      d.dismiss().catch(() => {})
    })
    const pageErrors = []
    page.on('pageerror', (err) => pageErrors.push(String(err.message || err)))
    await page.evaluateOnNewDocument((today) => {
      const Real = Date
      const offset = new Real(today).getTime() - Real.now()
      class Shifted extends Real {
        constructor(...a) {
          if (a.length) super(...a)
          else super(Real.now() + offset)
        }
        static now() {
          return Real.now() + offset
        }
      }
      window.Date = Shifted
      const record = (kind, value) => (...args) => {
        const list = JSON.parse(sessionStorage.getItem('smoke-dialogs') || '[]')
        list.push(`${kind}: ${String(args[0] ?? '')}`)
        sessionStorage.setItem('smoke-dialogs', JSON.stringify(list))
        return value
      }
      // A tripwire for the whole run: every moment #root reads "Not found.", with its route.
      new MutationObserver(() => {
        const root = document.querySelector('#root')
        if (root && root.innerText.includes('Not found.')) {
          const seen = JSON.parse(sessionStorage.getItem('smoke-notfound') || '[]')
          if (seen.at(-1) !== location.hash) sessionStorage.setItem('smoke-notfound', JSON.stringify([...seen, location.hash]))
        }
      }).observe(document, { childList: true, subtree: true, characterData: true })
      window.confirm = record('confirm', false)
      window.alert = record('alert', undefined)
      window.prompt = record('prompt', null)
    }, TODAY)

    const step = async (name, fn) => {
      current = name
      await fn()
      const dialogs = await page.evaluate(() => JSON.parse(sessionStorage.getItem('smoke-dialogs') || '[]'))
      const all = [...dialogs, ...nativeDialogs]
      if (all.length) throw new StepFailure(`native dialog(s) called: ${all.join('; ')}`)
      if (pageErrors.length) throw new StepFailure(`page error: ${pageErrors.join('; ')}`)
      const notFound = await takeNotFound(page)
      if (notFound.length) throw new StepFailure(`"Not found." rendered (even one render counts) at ${notFound.join(', ')}`)

      passed++
      console.log(`  ok ${passed} — ${name}`)
    }

    await step('open the seeded app on Today', async () => {
      await page.goto(url, { waitUntil: 'networkidle0' })
      await waitText(page, ROUTINE)
    })
    await step(`Start today's routine (${ROUTINE})`, async () => {
      await clickButton(page, 'Start', { className: 'ui-btn--primary' })
      await waitHash(page, /^#\/workout\/[^/]+$/)
      await waitText(page, LOG_EXERCISE)
    })
    await step(`open ${LOG_EXERCISE}`, async () => {
      await clickLink(page, LOG_EXERCISE)
      await waitText(page, 'Complete')
    })
    await step(`type "${TYPED_WEIGHT}" kg and Complete the set`, async () => {
      const kg = await page.waitForSelector('input[inputmode="decimal"]', { timeout: STEP_TIMEOUT })
      await kg.click({ clickCount: 3 })
      await page.keyboard.press('Backspace')
      await kg.type(TYPED_WEIGHT)
      await clickButton(page, 'Complete')
      await page.waitForFunction(
        (key) => (JSON.parse(localStorage.getItem(key) || '{}').activeWorkout?.sets || []).some((s) => s.reps !== 'skipped'),
        { timeout: STEP_TIMEOUT },
        STORAGE_KEY,
      )
    })
    await step('back to the exercise list (‹ Exercises)', async () => {
      await clickLink(page, '‹ Exercises')
      await waitHash(page, /^#\/workout\/[^/]+$/)
      await waitText(page, SKIP_EXERCISE)
    })
    await step(`open ${SKIP_EXERCISE} and Skip exercise`, async () => {
      await clickLink(page, SKIP_EXERCISE)
      await waitText(page, 'Skip exercise')
      // Skip is a two-tap in-app confirm (never a native one): arm, then confirm.
      await clickButton(page, 'Skip exercise')
      await waitText(page, 'Tap again to skip')
      await clickButton(page, 'Tap again to skip')
      await waitHash(page, /^#\/workout\/[^/]+$/)
      await page.waitForFunction(
        (key) => (JSON.parse(localStorage.getItem(key) || '{}').activeWorkout?.sets || []).filter((s) => s.reps === 'skipped').length > 0,
        { timeout: STEP_TIMEOUT },
        STORAGE_KEY,
      )
    })
    await step('Finish (from the exercise list)', async () => {
      await clickLink(page, 'Finish')
      await waitHash(page, /\/finish$/)
      await waitText(page, 'Save')
    })
    let saved = null
    await step('Save', async () => {
      await clickButton(page, 'Save')
      await page.waitForFunction((key) => !JSON.parse(localStorage.getItem(key) || '{}').activeWorkout, { timeout: STEP_TIMEOUT }, STORAGE_KEY)
      saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY)
    })
    let workout = null
    let logKey = null
    await step('the stored workout has 22.5 kg and the skipped sets', async () => {
      workout = [...saved.workouts].filter((w) => w.finishedAt).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))[0]
      if (!workout || workout.routineId !== 'sess-upper') throw new StepFailure(`no finished ${ROUTINE} workout stored (newest: ${workout?.id})`)
      const itemFor = (name) => workout.snapshot.items.find((i) => i.exerciseName === name)
      const key = (item) => item.routineItemId || item.id // workout-log.itemKey
      const logItem = itemFor(LOG_EXERCISE)
      logKey = key(logItem)
      const skipItem = itemFor(SKIP_EXERCISE)
      const setsOf = (item) => workout.sets.filter((s) => s.routineItemId === key(item))
      const logged = setsOf(logItem).filter((s) => s.reps !== 'skipped')
      if (logged.length !== 1 || logged[0].weight !== 22.5) {
        throw new StepFailure(`${LOG_EXERCISE}: expected one logged set at weight 22.5, got ${JSON.stringify(logged.map((s) => s.weight))}`)
      }
      const skipped = setsOf(skipItem)
      // Every unlogged set reads skipped after Finish; the explicit Skip is the item marked done.
      if (!skipped.length || !skipped.every((s) => s.reps === 'skipped') || !workout.completedItemIds?.includes(key(skipItem))) {
        throw new StepFailure(`${SKIP_EXERCISE}: expected only skipped sets, got ${JSON.stringify(skipped.map((s) => s.reps))}`)
      }
      console.log(`       ${workout.id}: ${LOG_EXERCISE} ${logged[0].weight} kg × ${logged[0].reps}; ${SKIP_EXERCISE} ${skipped.length} skipped set(s)`)
    })
    await step('Back (browser) never renders "Not found."', async () => {
      for (let i = 0; i < 4; i++) {
        const before = page.url()
        await page.goBack()
        await sleep(300)
        const text = await rootText(page)
        const flashed = await takeNotFound(page)
        if (text.includes('Not found.') || flashed.length) throw new StepFailure(`Back #${i + 1} (${before} → ${page.url()}) rendered "Not found."`)
      }
    })
    await step('History shows the workout (reopen the app → History → the row)', async () => {
      // In-workout screens hide the dock, and where the Backs land varies; reopening the
      // app (a fresh load of the same origin, storage kept) is the user's way back to Today.
      await page.goto(url, { waitUntil: 'networkidle0' })
      await waitHash(page, /^#\/$/)
      await clickLink(page, 'History')
      await waitHash(page, /^#\/history$/)
      // History lists months; the workout is under its own (performedOn's YYYY-MM).
      const month = `/history/month/${workout.performedOn.slice(0, 7)}`
      await clickSelector(page, `a[href="#${month}"]`)
      // req-171 — the row carries its month list as `from`, and the detail's links pass
      // the detail (with that from) down, so Back unwinds to the month.
      const detail = `/history/${workout.id}?from=${encodeURIComponent(month)}`
      await clickSelector(page, `a[href="#${detail}"]`)
      await waitHash(page, new RegExp(`^#/history/${workout.id}\\?`))
      await waitText(page, `${LOG_EXERCISE} — WU set · 1 set`)
      await waitText(page, `${SKIP_EXERCISE} — WU set · skipped`)
      // The per-exercise sets screen shows the logged value as the app displays it.
      await clickSelector(page, `a[href="#/history/${workout.id}/exercise/${logKey}?from=${encodeURIComponent(detail)}"]`)
      await waitText(page, '22.5')
    })
    await step('Back → Back from the exercise returns to the month list (req-171)', async () => {
      await clickLink(page, '‹ Back')
      await waitText(page, `${LOG_EXERCISE} — WU set · 1 set`)
      await clickLink(page, '‹ Back')
      await waitHash(page, new RegExp(`^#/history/month/${workout.performedOn.slice(0, 7)}$`))
    })
  } catch (err) {
    const failed = err instanceof StepFailure || err?.name === 'TimeoutError'
    console.error(`\nsmoke: RED at step "${current}" — ${err.message || err}`)
    if (page) {
      console.error(`smoke: at ${page.url()}, the screen reads:`)
      console.error(
        (await rootText(page).catch(() => '(page unavailable)'))
          .split('\n')
          .filter(Boolean)
          .map((l) => `  | ${l}`)
          .join('\n'),
      )
    }
    process.exitCode = failed ? 1 : 2
  } finally {
    await browser.close()
    if (server) await new Promise((r) => server.close(r))
    if (dist) rmSync(dist, { recursive: true, force: true })
  }
  if (!process.exitCode) {
    if (passed === 0) {
      console.error('smoke: 0 steps ran — refusing to pass (L-020).')
      process.exit(2)
    }
    const s = (ms) => `${(ms / 1000).toFixed(1)}s`
    console.log(`smoke: green — ${passed} steps (build ${s(tBuilt - t0)}, browser ${s(Date.now() - tBuilt)})`)
  }
}

const nativeDialogs = []
// The "Not found." renders the page's tripwire recorded since the last call, then clears them.
const takeNotFound = (page) =>
  page.evaluate(() => {
    const seen = JSON.parse(sessionStorage.getItem('smoke-notfound') || '[]')
    sessionStorage.removeItem('smoke-notfound')
    return seen
  })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const rootText = (page) => page.evaluate(() => document.querySelector('#root')?.innerText || '(no #root)')

function waitText(page, text) {
  return page.waitForFunction((t) => document.querySelector('#root')?.innerText.includes(t), { timeout: STEP_TIMEOUT }, text).catch(() => {
    throw new StepFailure(`"${text}" never appeared`)
  })
}

function waitHash(page, re) {
  return page.waitForFunction((src) => new RegExp(src).test(location.hash), { timeout: STEP_TIMEOUT }, re.source).catch(async () => {
    throw new StepFailure(`expected a route matching ${re}, still at ${await page.evaluate(() => location.hash)}`)
  })
}

// A real mouse click (ElementHandle.click scrolls into view and clicks its centre) on
// the one visible control whose text matches. Waits for it to appear (up to
// STEP_TIMEOUT) rather than racing a render in flight.
async function clickWhenVisible(page, find, args, what) {
  const handle = await page
    .waitForFunction(find, { timeout: STEP_TIMEOUT }, ...args)
    .catch(() => {
      throw new StepFailure(`no visible ${what}`)
    })
  await handle.asElement().click()
}

const clickButton = (page, text, { className = '' } = {}) =>
  clickWhenVisible(
    page,
    (t, cls) => [...document.querySelectorAll('button')].find((el) => el.textContent.trim() === t && el.className.includes(cls) && el.offsetParent),
    [text, className],
    `button "${text}"${className ? ` (.${className})` : ''}`,
  )

const clickSelector = (page, selector) =>
  clickWhenVisible(page, (sel) => [...document.querySelectorAll(sel)].find((el) => el.offsetParent), [selector], selector)

// Row links carry a trailing chevron; match on the text before it.
const clickLink = (page, text) =>
  clickWhenVisible(
    page,
    (t) => [...document.querySelectorAll('a')].find((a) => a.textContent.replace('›', '').trim() === t && a.offsetParent),
    [text],
    `link "${text}"`,
  )

main().catch((err) => {
  console.error(`smoke: setup error — ${err.message || err}`)
  process.exit(2)
})
