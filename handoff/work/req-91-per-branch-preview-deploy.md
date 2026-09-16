# req-91 — a preview deploy per branch (an HTTPS URL to see a change before merge)

**Status: NEEDS DECISION (infra approach) — from the 2026-09-16 session retro; "the last one" (Emilio).**
The durable fix for the session's biggest systemic risk: shipping UI blind. req-89 (a headless
screenshot) is the cheap interim; this is the structural version — a real URL a human can open.

**Gate: infra** (CI/hosting decision; no app runtime or persisted-data change).

## Why

[measured] neither Builder nor Planner can drive a browser (Chrome extension unconnected in both
sessions), so ~12 UI reqs shipped this session with no browser check; req-88 shipped an invisible button.
The app already deploys to GitHub Pages on push to `main` (`.github/workflows/deploy.yml`) — but only
*after* merge. A **per-branch (or per-PR) preview URL** would let a UI change be seen **before** it lands,
on a real device, over HTTPS — which also unblocks the secure-context device features (wake-lock,
notifications) that the LAN dev server can't serve (**L-003**, and the BACKLOG "per-branch preview
deploy" item, partly superseded by DEC-041's Tailscale `vite preview` but not for the pre-merge-review
motivation).

## Open decision (Emilio) — the approach

- **(a) GitHub Pages preview per branch** — extend the existing Pages workflow to publish `req-*`
  branches to a preview path/subdomain. Cheapest to reason about (same infra as prod), but Pages
  multi-target/preview is awkward.
- **(b) A preview host (Netlify / Cloudflare Pages / GitHub Actions artifact + a static host)** — first
  such dependency for a deliberately infra-light, browser-only project; a real add to the stack.
- **(c) Formalize the existing Tailscale `vite preview` (DEC-041)** into a one-command "serve this branch
  for me to open on my phone" — least new infra, but it's Emilio's device serving, not a shareable/CI URL.

Nothing is specced until the approach is picked. Note this **crosses the planning/code worktree boundary**
if Planning is to serve/verify branches itself (DEC-005) — part of the decision is *who* opens the URL
(Emilio, or Planning gaining a browser path).

## Scope / acceptance (written once the approach is picked)

Must include:
- A URL produced for a `req-*` branch (or PR) without merging to `main`.
- The prod deploy path (push→Pages) unchanged.
- No secret/token committed; no app runtime change.
- A note on how it plugs into the DEC-047 visibility gate (does it *replace* req-89's screenshot for UI
  reqs, or complement it?).

## Decisions

- Approach (a)/(b)/(c) (Emilio) — blocks READY. This is a stack/infra decision for an intentionally
  infra-light project, so it's Emilio's call, not an implementation choice.
- Relationship to req-89: interim screenshot now, this as the durable version — retire or keep req-89's
  tool once this lands (decide when specced).
