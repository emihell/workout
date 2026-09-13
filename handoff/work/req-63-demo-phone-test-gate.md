# req-63 — Pre-merge phone-test gate (demo over Tailscale)

**Status: BUILT AND MERGED, 2026-09-13 — branch `demo-staging` (`8542c46`, 1 commit).**

**Gate: infra/tooling** (like req-33/34/35). No app-code, no data-model change. Built
ad-hoc on Emilio's direction (branch `demo-staging`), recorded here on close-out and given
the number req-63.

## Why

Emilio needs to test a built branch **on the phone before merging to main** — a review
gate, not a public demo, not always-on. A plain-LAN host can't serve a secure context, so
wake-lock / notifications / add-to-home-screen (the L-003 blocker) don't work there.

## What

- **`package.json`:** `"demo": "vite build && vite preview --port 4173 --strictPort"` —
  builds the production bundle of the checked-out branch (base `/`, since `GITHUB_PAGES`
  is unset) on a pinned port so the Tailscale target is stable; `--strictPort` fails loudly
  rather than drifting.
- **`vite.config.js`:** `allowedHosts: ['.ts.net']` on server + preview.
- **`DEMO.md`:** the runbook — `npm run demo` + `tailscale serve --bg 4173`, the one-time
  MagicDNS/HTTPS-certs admin toggle, `serve` (private) **not** `funnel` (public), the
  data-origin isolation note (seed via Settings → Import).

`tailscale serve` gives the local app a real **HTTPS** URL on the tailnet → secure-context
features work on the phone. See DEC-041.

## Acceptance criteria

- **`npm run demo` serves at root:** `curl http://localhost:4173/` → 200, `<title>Workout
  MVP</title>`, assets at base `/` (not `/workout/`). [measured green in
  reports/demo-staging.md]
- **`./check` green.** [measured]
- The Tailscale half (serve, cert toggle) is Emilio's to run — account/interactive, not
  verifiable from a build session; commands in `DEMO.md`.

## Decisions

- **DEC-041** — the demo (local `vite preview` over `tailscale serve`) is the standard
  pre-merge phone-test gate; supersedes the backlog "per-branch preview deploy (cloud)"
  item **for Emilio's testing** (planning still can't use it — runs on Emilio's Mac).

## Note

Merging touched `package.json`, so the `main`-push triggers one harmless Pages redeploy of
the same site.
