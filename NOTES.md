# Dev workflow notes

Working notes for Claude Code in this repo (in-repo and shared — not machine-local
memory). `handoff/` and `CLAUDE.md` are read-only to Claude Code; this file is
where recurring build-side conventions live instead.

## Running the app

- **Dev** — `npm run dev` → single instance on **http://localhost:5173**.
- **Tests** — `node --test` (Node's built-in runner; no framework) — discovers every
  `*.test.js` under `src/`, nested folders included (`./check` uses the same recursive set).
- **Lint** — `npm run lint` (oxlint).
- **Build** — `npm run build` (vite; this is what Pages deploys).
- **Full gate** — `./check` runs lint + tests + build and refuses on any red.

## Data lives in the browser

State is `localStorage` under `workout-mvp-v8`; the seed in `src/db.json` is
first-run/provenance data, not the live store. To reset or inspect state, use the
app's own Settings/seed path or clear the key in devtools — don't hand-edit
`db.json` expecting it to change a running instance. Migrations live in
`src/storage.js`; a schema bump needs a migration test (older key → v8).

## Rails for changes

Repeated bugs come from **building or reusing without first checking what already
exists**. Before writing anything:

1. **Check it doesn't already exist.** `git ls-files`, `ls`, `grep` for the
   file / helper / view / model function first.
2. **Read the pattern before reusing it** — grep its other uses; there's usually a
   companion rule or established convention (a prefill helper, a valid-increment
   step, an id scheme). Match it; don't invent.
3. **Look at UI changes before handing them over.** Run the dev server and click
   the actual flow. A human shouldn't be the one who notices a broken prefill or a
   shifted layout.

## The prefill rule is load-bearing

`.cursor/rules/history-prefill.mdc` states it: prefill Reps from target and effort
Moderate on the live log screen; everywhere else, only from finished-workout
history for that same field. Do not invent warmup, rest, or notes. When touching
logging, the store, or recommendations, re-read that rule and
`handoff/rules/DESIGN.md` first — inventing data is the failure mode this app is
built to avoid.
