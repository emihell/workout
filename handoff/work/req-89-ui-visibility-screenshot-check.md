# req-89 — a headless screenshot script for pre-merge UI visibility checks

**Status: BUILT AND MERGED, 2026-09-16 — branch `req-89` (`9c9160a`…`9c9160a`, 1 commit).** Enacts the DEC-047 refinement (visibility of a UI
control is a pre-merge gate, not deferrable feel). Root cause it addresses: req-88 shipped an *invisible*
feedback button because neither Builder nor Planner can drive a browser (Chrome extension unconnected in
both sessions), so "does it render / is it visible" went unchecked until Emilio hunted for it.

**Gate: infra / tooling** (dev-only; no app behaviour or persisted-data change).

## Why

[measured] this session shipped ~12 UI reqs with **zero** browser verification. The one objective,
automatable check — *did the control render on-screen* — has no mechanism today. A headless screenshot the
Builder attaches to a UI req's report, and the Planner **Reads before merge**, closes that gap without the
Chrome extension and without waiting on a preview deploy (that's req-91, the durable version).

## The behaviour

- A script (e.g. `npm run shot` / `scripts/screenshot.mjs`) that boots the built app headlessly and
  writes a **PNG of one or more named screens** to a gitignored dir (e.g. `screenshots/`).
- Takes a screen/route argument (a hash route, e.g. `/`, `/workout/:id`, `/settings`) so a UI req can
  screenshot exactly the screen it changed. Optionally a viewport size (default a phone width, since the
  app is phone-first) so occlusion by the bottom dock / notch is visible.
- Deterministic enough to eyeball: if seeding state is needed to reach a screen, allow a small
  `localStorage` seed (a JSON arg or fixture) — reuse the app's own store/seed helpers; **never** touch a
  real profile.
- Headless browser via a dev-only dependency (Playwright or Puppeteer) — `devDependencies`, so the
  production build carries nothing.

## How it plugs into the workflow (for the report, not this req's code)

A **UI req's Builder report includes the screenshot path(s)** of the changed screen; the Planner Reads the
PNG(s) before merge to confirm the control renders, is on-screen, and isn't occluded (the DEC-047 gate).
This req only builds the *tool*; the workflow rule already lives in WORKFLOW §"Batch mode".

## Scope

- The screenshot script + its dev dependency + an npm script entry + `.gitignore` for the output dir.

## Out of scope

- Any app/behaviour/persisted-data change; CI wiring; visual-diff/regression baselines (just capture).
- The preview deploy (req-91) — the durable, human-URL version of the same goal.

## Acceptance criteria

- **Captures a screen:** running the script for a given route writes a readable PNG of that screen at a
  phone viewport; the file opens and shows the app.
- **Occlusion visible:** a screen with the bottom dock (e.g. Today) shows the dock in the shot, so a
  control hidden behind it would be visibly hidden.
- **Prod-clean (failure case):** the headless-browser dep is a `devDependency`; `npm run build` (prod)
  carries none of it (grep `dist/` for the dep name → 0).
- **No app change:** `./check` green; no `src/` runtime file changed except any tiny seed hook, justified.

## Decisions

- Build the interim screenshot tool now; the preview deploy (req-91) is the durable version — both, in
  sequence (session retro, 2026-09-16).
- Playwright vs Puppeteer, exact CLI shape, seed mechanism — implementation (CC).
