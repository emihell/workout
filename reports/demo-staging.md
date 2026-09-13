# demo-staging — a pre-merge phone-test gate over Tailscale

Branch `demo-staging` (off `main`). Tooling only — no app-code, no data-model change.
Not a planning-specced req; **for planning to record** (a tooling req like req-33/34/35),
and the two `DEC-`s below if agreed.

## Technical

Purpose (Emilio): a place to test a built branch **on the phone before merging to
`main`** — a review gate, not a public demo, not always-on.

- **`package.json`:** added `"demo": "vite build && vite preview --port 4173 --strictPort"`.
  Builds the production bundle of the checked-out branch (base `/`, since `GITHUB_PAGES`
  is unset — `vite.config.js`) and serves it on a pinned port so the Tailscale target is
  stable. `--strictPort` fails loudly rather than drifting to another port.
- **`DEMO.md`:** the runbook — `npm run demo` + `tailscale serve --bg 4173`, the one-time
  MagicDNS/HTTPS-certs admin toggle, `serve` (private) not `funnel` (public), the
  data-origin isolation note (seed via Settings → Import), and that the same host runs the
  future backend.

Why Tailscale local-host over a cloud demo: `tailscale serve` gives the local app a real
HTTPS URL on the tailnet, so secure-context features (**wake-lock / notifications /
add-to-home-screen**) work on the phone — the L-003 blocker that a plain-LAN host had.

## Verification (receipts)

- `./check` → **green**: `check: green — lint, 19 test file(s), and the build all passed.`
- **[measured] `npm run demo` serves correctly:** `vite preview --port 4173 --strictPort`
  → `curl http://localhost:4173/` returns **200**, `<title>Workout MVP</title>`, and assets
  resolve at base `/` (`src="/assets/index-*.js"`, `href="/favicon.svg"`) — **not**
  `/workout/`, confirming it serves at a URL root as the Tailscale endpoint needs.
- The Tailscale half (`tailscale serve`, admin cert toggle) is Emilio's to run — account/
  interactive, not runnable/verifiable from a build session; commands are in `DEMO.md`.

## Workflow

- Scope: presentation/tooling only; nothing touches `src/` behaviour or the data model.
- **Note for planning:** the deploy workflow (`.github/workflows/deploy.yml`) triggers on
  `main` pushes touching `package.json`; merging this will trigger one (harmless) Pages
  redeploy of the same site.
- **Two things to record if agreed:** (1) the demo = local `vite preview` exposed via
  `tailscale serve` is the standard **pre-merge phone-test gate**; (2) it supersedes the
  backlog's "per-branch preview deploy (cloud)" tooling item for Emilio's own testing
  (planning still can't use it — it runs on Emilio's Mac, not the cloud planning session).
