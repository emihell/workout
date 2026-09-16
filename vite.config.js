import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// req-86 — a short git sha stamped into the dev-notes context so a captured note
// can be tied to the exact code state. A plain string constant; harmless in the
// production bundle (the dev-notes feature that reads it is dead-code-eliminated).
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
  // The demo gate (`npm run demo`, DEMO.md) serves the preview build through
  // `tailscale serve` on a `*.ts.net` MagicDNS host. Vite rejects requests whose
  // Host header isn't allowlisted (a DNS-rebinding guard), so the tailnet host
  // 403s without this. The tailnet is private/trusted; allow any `*.ts.net`.
  // Applied to both servers so `npm run dev -- --host` behind Tailscale works too.
  server: { allowedHosts: ['.ts.net'] },
  preview: { allowedHosts: ['.ts.net'] },
})
