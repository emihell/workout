# req-89 — headless screenshot script for pre-merge UI visibility checks

Branch `req-89`. Interim tooling for the DEC-047 gate: capture a PNG of a changed
screen so the Planner can Read it before merge and confirm a control renders /
isn't occluded — without a driveable browser. No app or persisted-data change.

## Technical

**What changed**
- `scripts/screenshot.mjs` — boots the *built* app (`dist/`) behind a tiny inline
  static server and screenshots one hash route with headless Chrome (Puppeteer).
- `package.json` — added `"shot": "node scripts/screenshot.mjs"`; added
  `puppeteer` to **devDependencies** (auto-downloads a Chrome-for-Testing binary
  on install; nothing imported by `src/`).
- `.gitignore` — ignore `screenshots/` (the output dir).

**Usage**
```
npm run shot -- /                        # Today (default route)
npm run shot -- /history --seed src/db.json --out screenshots/history.png
npm run shot -- /settings --viewport 414x896 --build
```
Flags: `--out`, `--viewport WxH` (default `390x844`, phone-first), `--seed <file>`
(JSON state doc written to `localStorage` before load — the app's own
`migrateState` runs on it, so any schema works), `--build` (force rebuild),
`--full`, `--wait <ms>`.

**How it works** — dist is auto-built if missing (or with `--build`), reused
otherwise for fast iteration. The app uses hash routing, so the server only ever
serves `/` + fingerprinted `/assets/*`; the route lives in the `#…` fragment.
Seeding uses `page.evaluateOnNewDocument` to set `workout-mvp-v9` before any app
script runs — against a throwaway headless profile, never a real history. Waits
for `#root > *` plus a settle delay before capturing.

**Choices left open by the spec**
- *Puppeteer over Playwright* — one devDependency that self-provisions its browser
  on `npm install`, vs Playwright's separate `playwright install` step. Simpler
  for a local pre-merge check.
- *Seed mechanism* — a raw JSON state doc into `localStorage`, migrated by the
  app's own `loadState`, rather than importing store helpers into the script. No
  new seed code in `src/`; `src/db.json` doubles as a ready fixture.
- *Default viewport* `390x844` (iPhone-ish), `deviceScaleFactor: 2`.

**Acceptance criteria — receipts**
- **Captures a screen:** `npm run shot -- /` → `screenshots/root.png`, a readable
  Today screen at 390x844. [measured]
- **Occlusion visible:** the Today shot shows the bottom dock (Library / Workout
  pill / Settings) — a control behind it would read as hidden. [measured, image
  in report path]
- **Seed works:** `--seed src/db.json` (schema v8) → History shows migrated data
  (Oct 2025: 6, Sep 2025: 7), proving seed → migrate(v8→v9) → render. [measured]
- **Prod-clean:** `grep -rli puppeteer dist/` → `0`; `dependencies` is only
  react/react-dom; `puppeteer` is in `devDependencies`. [measured]
- **No app change:** `./check` → green (lint, 20 test files / 261 tests, build).
  No `src/` runtime file changed. [measured]

## Workflow

- No scope deviation; built exactly the tool the spec describes, nothing app-side.
- Tooling req, so it did not itself need the new screenshot gate (per Planner).
- Surfacing for a possible `DEC-`: **Puppeteer chosen as the project's headless-
  browser dev dep** (over Playwright), and the **seed convention** = a raw state
  JSON into `localStorage` under `workout-mvp-v9`, migrated on load (`src/db.json`
  is a usable fixture). If req-91's preview deploy later supersedes this, the whole
  tool + its dep can be dropped in one commit.
- Two example PNGs were generated to verify; `screenshots/` is gitignored, so they
  don't travel with the diff.
