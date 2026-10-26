**Status: BUILT, NOT merged — branch `req-247` (`36f7e09`)** · **Lane: tooling** · comments + test names only (stage-1 fallout, DEC-143; follow-up to req-238).

# req-247 — no comment or test name says "the Pages build" any more

req-238 removed the GitHub Pages build mode, but its AC grepped `GITHUB_PAGES` only. The build it described still exists:
it is the plain build (`npm run build`, `npm run dev`, `plan qa` — no `WORKOUT_SYNC`, `vite.config.js:29-35`). Comments
that call it "the Pages build" now point a reader at something that's gone.

## Facts (rescanned 2026-10-26, main `7735912`)

`grep -rn "Pages" src server scripts check plan vite.config.js`, the stale hits:
`src/persistence.js:344`, `src/store.jsx:57`, `src/main.jsx:10`, `src/App.jsx:259`, `src/sync/boot.jsx:2`,
`src/sync/settings.jsx:2`, `src/sync/status.js:5`, `src/sync/sw.js:2`, `src/views/Settings.jsx:131`,
`src/dev/dev-notes.js:113`, `src/sync/ui.test.js:1,38,43,67` (a `describe` title, an error string, an assert message).
**Correct, keep:** `src/sync/builds.test.js:3` and `vite.config.js:32` (they record that the Pages mode was removed).

## Scope

1. Each stale hit says "the plain build" (or "a build without sync") instead. Wording only; the meaning stays the same.
2. `src/sync/ui.test.js`: same rename in the title, error string and message. The assertions don't change.

## Out of scope

- Any code change. Any handoff/ or reports/ text (history).

## Acceptance criteria

1. `grep -rn "Pages" src server scripts check plan vite.config.js` → only `builds.test.js:3` and `vite.config.js:32`. Paste.
2. **Failure case, comments only:** `git diff main..req-247 -w | grep '^[+-]' | grep -v '^[+-]\s*//\|^[+-]\s*{/\*\|^+++\|^---'`
   → only the three `ui.test.js` string lines. Paste.
3. `./check` green.

## Decisions made on Emilio's behalf

- implementation: "plain build" as the name. Nothing he sees changes.
