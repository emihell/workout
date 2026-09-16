# req-91 — `./plan preview` : DEC-041's phone-test gate as one verb

Branch `req-91`. Tooling only (`plan` + `DEMO.md`); no app runtime or persisted-data change.

## Technical

**What changed**

- `plan` — a new `preview` verb (`cmd_preview` + helpers `preview_resolve_branch`,
  `preview_wait_ready`, `preview_url`, `preview_tailscale_off`, `preview_stop`), a usage
  entry, and a dispatch case with the same re-exec-from-temp-copy guard `closeout` uses.
- `DEMO.md` — a "One step: `./plan preview`" section at the top; the manual sections kept
  below as the "why each piece" reference / debugging fallback.

**Behaviour (matches the req)**

- `./plan preview` — build the checked-out branch (`vite build`, base `/`, `GITHUB_PAGES`
  unset) → `vite preview --port 4173 --strictPort --host 127.0.0.1` in the background →
  `tailscale serve --bg 4173` → print the `*.ts.net` HTTPS URL.
- `./plan preview req-NN` — check that branch out **first, only on a clean tree**, then the
  same. Branch resolution mirrors `closeout` (bare `req-N`, else the single `req-N-*`; zero
  or many matches refused).
- `./plan preview stop` — kill the tracked preview server, free `:4173` even if the pidfile
  was lost, and turn off `tailscale serve`.

**Choices I made (spec left open)**

- **Reused `demo`'s vite flags, but split build from preview.** `npm run demo` is one
  foreground `vite build && vite preview …`; to background the server (so it outlives the
  command), track it by pid, and build with base `/`, I run the two halves separately with
  the *identical* preview flags. Same DEC-041 wiring, just decomposed.
- **Direct `./node_modules/.bin/vite` via `exec` in the background subshell**, so the tracked
  pid *is* vite (not an npm wrapper) and a single `kill` tears it down cleanly.
- **`env -u GITHUB_PAGES npm run build`** — guarantees base `/` regardless of the caller's
  env (the req's "GITHUB_PAGES unset, as demo").
- **Re-exec guard for `preview`** (like `closeout`): `preview req-NN` checks out a branch
  mid-run, which can rewrite `plan` itself (req-91 does exactly that). Without the guard,
  bash reading the script incrementally would corrupt. The backgrounded server is a child of
  the re-exec'd shell and survives its exit (no `huponexit` in scripts) — verified.
- **Teardown form:** `tailscale serve --https=443 off` first (surgical, the DEMO.md form),
  falling back to `tailscale serve reset` if that fails (e.g. a build without that flag).
  Both are no-ops when the daemon is down.
- **Ready-poll** (`curl` to `:4173`, ≤15s, bail if the process dies) so a port clash fails
  fast with the log tail instead of a dangling half-start.
- **Fail-fast** if `tailscale` isn't on PATH (before building, to not waste a build). If the
  daemon is down at serve time, the local build is left serving and the fix (`tailscale
  status` → re-serve) is printed — a transient daemon-down doesn't throw the build away;
  `stop` cleans it.
- No `status` subcommand — kept to exactly the req's start + `stop` surface.

**Verified locally** (receipts)

- `bash -n plan` → SYNTAX OK. Adjacency scan `grep -nP '\$\{?[A-Za-z_]\w*[^\x00-\x7F]' plan`
  → none.
- Guards: unknown arg, non-numeric id, no-such-branch, and dirty-tree-refuses-`req-NN`
  checkout (tree unchanged after) — all refuse with recovery, exit 1.
- **Live build+serve:** `./plan preview` built req-91 and served `:4173` → `curl` returned
  **HTTP 200**. Daemon being stopped, `tailscale serve` failed → printed the fix, exit 1,
  server left running (as designed).
- **Clean replace:** a second `./plan preview` left **exactly one** process on `:4173` (pid
  1847 → 1947), not two.
- **Stop:** `./plan preview stop` killed the server, reset tailscale, freed `:4173`
  (connection refused after), removed the pidfile; idempotent on a second call. No leftover
  `plan-preview.*` temp copies.
- **`./check` green** — oxlint, 261 tests (20 files), production build all pass.

**What needs Emilio's live run** (I could not verify — the tailscale daemon is *stopped* on
this machine right now):

1. `./plan preview` with tailscaled up prints a real `https://<mac>.<tailnet>.ts.net` URL
   (derived from `tailscale status --json` `.Self.DNSName`).
2. That URL opens the branch's build on the phone over HTTPS (secure-context features work).
3. `./plan preview stop` clears the `serve` config on a machine that actually had one
   (here `--https=443 off` returned non-zero with the daemon down, so the `reset` fallback
   fired — confirm the surgical form on a live daemon, or the fallback is fine).

## Workflow

- **In scope, no deviation.** Behaviour, watch-outs (serve-not-funnel, dirty-tree guard,
  clean re-run), and the `DEMO.md` pointer are all implemented as specified.
- **One bug found and fixed mid-build** (worth an `L-`): `$PREVIEW_PORT` sat directly before
  a multibyte `…` in an echo, so `set -u` parsed them as one undefined variable name and the
  command died right after the build. Fixed by bracing `${PREVIEW_PORT}`. Lesson: under
  `set -u`, brace any `$var` immediately followed by a non-ASCII byte — no whitespace
  delimiter means bash swallows the high bytes into the name. (Two commits: impl, then fix.)
- **Nothing taken to Emilio mid-build** — all choices above were within the req's watch-outs
  (implementation is CC's per the Decisions section). Surfacing them here so they can become
  `DEC-`/`L-` if wanted; the `set -u`/multibyte one is the candidate `L-`.
