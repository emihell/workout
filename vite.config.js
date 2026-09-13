import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES === 'true' ? '/workout/' : '/',
  // The demo gate (`npm run demo`, DEMO.md) serves the preview build through
  // `tailscale serve` on a `*.ts.net` MagicDNS host. Vite rejects requests whose
  // Host header isn't allowlisted (a DNS-rebinding guard), so the tailnet host
  // 403s without this. The tailnet is private/trusted; allow any `*.ts.net`.
  // Applied to both servers so `npm run dev -- --host` behind Tailscale works too.
  server: { allowedHosts: ['.ts.net'] },
  preview: { allowedHosts: ['.ts.net'] },
})
