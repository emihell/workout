# req-91 — `./plan preview` : one command to open a branch on your phone before merge

**Status: BUILT AND MERGED, 2026-09-16 — branch `req-91` (`5a23104`…`eaa49b5`, 3 commits).** Formalize DEC-041's Tailscale `vite preview`
into a single `plan` verb, so a UI change can be opened on a real device over HTTPS **before** merge.

**Gate: tooling** (the `plan` script + DEMO.md; no app runtime or persisted-data change). Builder req
(edits `plan`, like req-90).

## Why

[measured] DEC-041 (req-63) already set up the pre-merge phone test: `npm run demo` (`vite build && vite
preview --port 4173 --strictPort`, base `/`) exposed via `tailscale serve --bg 4173` → a real HTTPS
`.ts.net` URL that unblocks secure-context features (wake-lock / notifications / add-to-home-screen);
runbook `DEMO.md`; `vite.config.js` has `allowedHosts: ['.ts.net']`. But it's manual and previews
**whatever is checked out**, not a named branch — to preview `req-NN` you must hand-checkout the branch
first. Emilio picked (c): wrap it into `./plan preview` so it's one step. (req-89's headless screenshot
already covers Planner's automated pre-merge visibility check; this is the human, on-device, interactive
half — and the only path to HTTPS-only device features.)

## The behaviour (approach (c), Emilio 2026-09-16)

`./plan preview [req-NN]` (run **in the code worktree** — it builds code; Emilio or the code session runs
it, NOT the planning session, per the DEC-041 caveat):
- **No arg** → preview the branch currently checked out (the common case: right after Builder reports a
  UI req, the code worktree is already on it).
- **`req-NN` arg** → check that branch out first, but **only if the code tree is clean** (refuse on a
  dirty tree with the recovery, so it never clobbers in-progress work).
- Then: `vite build` (base `/`, `GITHUB_PAGES` unset, as `demo`) → `vite preview --port 4173
  --strictPort` → `tailscale serve --bg 4173` → **print the `.ts.net` HTTPS URL** to open on the phone.
- **Stop:** a clear way to end it — `./plan preview stop` (or print the `tailscale serve --bg off` +
  kill-preview lines) so the tailnet serve and the preview server are torn down, never left running.

Reuse the existing `demo` script / DEC-041 wiring under the hood rather than reinventing the build+serve.

## Scope

- A `preview` verb in the `plan` script (build + serve + print URL + stop), wrapping DEC-041's demo/
  tailscale flow and adding the branch-checkout convenience.
- Update `DEMO.md` to point at `./plan preview` as the one-step path.

## Out of scope

- The production deploy (push→Pages) — unchanged.
- Any app runtime / persisted-data change.
- A cloud/shareable/CI URL — (c) is explicitly the local-machine-over-Tailscale path; the planning
  session still can't use it to browser-verify (DEC-041 caveat stands; req-89's screenshot is Planner's
  path).

## Watch-outs (CC)

- **Boundary:** this runs in the code worktree and builds a code branch; it must not be a planning-only
  command. A dirty-tree guard before any checkout is mandatory (never disrupt Builder mid-task).
- **No secrets:** `tailscale serve` is `serve` (tailnet-only), **never `funnel`** (public) — per DEC-041.
- **Port reuse / re-run:** a second `plan preview` while one is serving should replace cleanly, not
  stack two servers on :4173 (`--strictPort` will otherwise error).

## Acceptance criteria

- **One command serves a branch (device):** `./plan preview req-NN` on the Mac builds that branch and
  prints an HTTPS `.ts.net` URL that opens the branch's build on the phone.
- **Current-branch default:** `./plan preview` with no arg previews the checked-out branch.
- **Dirty-tree guard (failure case):** `./plan preview req-NN` on a dirty code tree refuses and prints
  the recovery, changing nothing.
- **Stop tears down:** the stop path ends the preview server and `tailscale serve`, leaving nothing
  listening.
- **Prod untouched / no secret:** production deploy path unchanged; `funnel` never used; no token committed.
- **No app regression:** `./check` green.

## Decisions

- Approach (c) — local `vite preview` over Tailscale, wrapped in `./plan preview` (Emilio, 2026-09-16).
  Not (a) Pages-preview, not (b) an external host.
- Current-branch default + `req-NN` checkout with a dirty-tree guard; stop path — implementation (CC),
  within the watch-outs.
- Relationship to req-89: req-89 = Planner's automated screenshot gate; req-91 = Emilio's on-device
  interactive preview. Both kept; they cover different halves.
