import { execSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// req-86 — a short git sha stamped into the dev-notes context so a captured note
// can be tied to the exact code state. A plain string constant. req-165 (F-DRIFT-6): since
// req-87 the dev-notes feature ships in the production bundle and is switched on at
// runtime, so this stamp is read there too.
function gitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
}

// req-197 — the build id analytics counts screen events by: the short sha on `vite build`,
// "dev" under `vite` (npm run dev) or when the sha can't be read.
function buildId(command) {
  if (command !== 'build') return 'dev'
  const sha = gitSha()
  return sha === 'unknown' ? 'dev' : sha
}

// req-230 — the build switch. Sync (login, server sync, the offline service worker) is ON only
// in the server build: `npm run build:server` (WORKOUT_SYNC=true). Every other build — the Pages
// deploy (GITHUB_PAGES=true, which always wins), `npm run build`, `npm run dev`, `plan qa` — has
// it OFF, and main.jsx's sync branch is dropped from the bundle.
export function syncEnabled(env = process.env) {
  return env.WORKOUT_SYNC === 'true' && env.GITHUB_PAGES !== 'true'
}

function filesUnder(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort()
}

// req-230 — writes sw.js (from src/sync/sw.js) into the SERVER build, after everything else is
// written: the build's id, and every built file to cache for opening offline.
function serviceWorker(version) {
  let outDir = null
  return {
    name: 'workout-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const files = filesUnder(outDir).filter((file) => file !== 'sw.js')
      const source = readFileSync(new URL('./src/sync/sw.js', import.meta.url), 'utf8')
        .replace('__SW_VERSION__', JSON.stringify(version))
        .replace('__SW_FILES__', JSON.stringify(files))
      writeFileSync(join(outDir, 'sw.js'), source)
    },
  }
}

export default defineConfig(({ command }) => ({
  plugins: [react(), ...(syncEnabled() ? [serviceWorker(`${buildId(command)}-${Date.now()}`)] : [])],
  define: {
    __APP_VERSION__: JSON.stringify(gitSha()),
    __BUILD_ID__: JSON.stringify(buildId(command)),
    __SYNC__: JSON.stringify(syncEnabled()),
  },
  base: process.env.GITHUB_PAGES === 'true' ? '/workout/' : '/',
  // req-165 (F-BUNDLE-1) — the one chunk over Vite's 500 kB default is the LAZY exercise
  // library (exerciseLibrary.js loadExerciseLibrary → library/exercises.json), measured
  // 1,538.3 kB (263.6 kB gzip) on 2026-09-25; only the Library's search screen loads it.
  // The main chunk is 349.0 kB. Vite's limit is global, so this sits just above the
  // library: a main chunk that grows past 1.6 MB still warns, but 500 kB–1.6 MB won't.
  build: { chunkSizeWarningLimit: 1600 },
  // The demo gate (`npm run demo`, DEMO.md) serves the preview build through
  // `tailscale serve` on a `*.ts.net` MagicDNS host. Vite rejects requests whose
  // Host header isn't allowlisted (a DNS-rebinding guard), so the tailnet host
  // 403s without this. The tailnet is private/trusted; allow any `*.ts.net`.
  // Applied to both servers so `npm run dev -- --host` behind Tailscale works too.
  server: { allowedHosts: ['.ts.net'] },
  preview: { allowedHosts: ['.ts.net'] },
}))
