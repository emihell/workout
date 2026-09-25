import { execSync } from 'node:child_process'
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

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(gitSha()) },
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
})
