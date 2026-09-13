# Demo — the pre-merge staging check

A place to test a branch **on the phone, over Tailscale, before merging to `main`**.
It is a review gate, nothing more: no cloud host, no public exposure, not always-on.
Serve the branch you built, approve it on the phone, then merge.

```
build the branch  →  npm run demo  →  Tailscale HTTPS URL  →  test on the phone
                                                                     │ approved
                                                                     ▼
                                                       merge to main → GitHub Pages (production)
```

## Serve the checked-out branch

From this repo, on the Mac:

```bash
npm run demo        # vite build (base '/') + vite preview on 127.0.0.1:4173
```

`demo` builds the **production** bundle of whatever branch is checked out and serves
it on a fixed port (4173) — the honest "what ships if I merge" test, and a stable
target for Tailscale. (For live-reload while iterating instead, use `npm run dev --
--host` and point Tailscale at port 5173.)

Two things make it reachable through the Tailscale proxy (both already wired in):
- **`--host 127.0.0.1`** — `tailscale serve` proxies to IPv4 `127.0.0.1`, but Vite's
  default `localhost` binds IPv6 `::1` only, so without this the proxy 502s.
- **`allowedHosts: ['.ts.net']`** in `vite.config.js` — Vite rejects unknown `Host`
  headers (a DNS-rebinding guard), so the `*.ts.net` name 403s without it.

## Expose it over Tailscale (HTTPS)

In a second terminal:

```bash
tailscale serve --bg 4173          # https://<this-mac>.<tailnet>.ts.net  →  127.0.0.1:4173
tailscale serve status             # show what's being served
tailscale serve --https=443 off    # stop serving when done
```

Open `https://<this-mac>.<tailnet>.ts.net` on the phone (it must be on the tailnet).
Because it's real HTTPS, the secure-context features work here that a plain-LAN host
can't offer: **wake-lock, notifications, add-to-home-screen** (this was the L-003
blocker — Tailscale removes it).

**One-time setup (Tailscale admin console):** enable **MagicDNS** and **HTTPS
certificates** for the tailnet, or `tailscale serve` has no cert to use.

**Use `serve`, not `funnel`.** `tailscale serve` keeps the URL private to the tailnet
(what we want). `tailscale funnel` publishes it to the open internet — don't, unless
that's ever explicitly wanted.

The Mac must stay awake and running `npm run demo` while the phone is testing.

## Data is isolated automatically

localStorage is per-origin, and `…ts.net` is a different origin than `github.io` and
`localhost`. So the demo has its **own** storage — testing here can never touch real
training history, and it starts empty. Seed it with **Settings → Import** (a backup
JSON, e.g. `src/db.json`) when you want data to test against.

## Later: the same path runs the backend

When the app moves off `localStorage` to a database/backend, the same box runs the
real server and is exposed the same way (`tailscale serve` in front of the local
server). The demo-host today is the dev-backend host then.
