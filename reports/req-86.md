# req-86 — dev-only "note on this page" capture button (N8)

Branch: `req-86`. Status: **READY** (planning session to merge; browser render/save is an Emilio item — extension not connectable from this session).

## Technical

**What it does.** In the dev build only, a small unimposing "✎" button sits bottom-left
on every screen (including the in-workout flow, where the bottom menu is hidden). Tapping
it opens a minimal panel: it shows the current route, takes a note, and Save appends a
record to a **separate** `localStorage` key. Copy JSON puts all captured notes on the
clipboard (pretty-printed) to hand to the planning session; Clear empties the store.

**Files**
- `src/dev/dev-notes.js` — the store. Pure, storage-injected core (`buildNote`,
  `captureContext`, `readNotes`/`writeNotes`/`appendNote`/`clearNotes`, `notesJson`) +
  thin browser wrappers bound to `window.localStorage`. Key: `workout-dev-notes-v1`.
- `src/dev/dev-notes.test.js` — 10 unit tests over the pure core (fake storage).
- `src/dev/DevNotes.jsx` — the button + panel. Inline styles only (no ui.css classes).
- `src/App.jsx` — single render site: `{import.meta.env.DEV ? <DevNotes /> : null}`.
- `vite.config.js` — `define: { __APP_VERSION__: <git short sha> }`, stamped into note
  context so a note ties to the exact code state.

**Captured per note:** `{route, timestamp, text, context}` where `context =
{routeName, params, hash, appVersion}`. `params` is the parsed route's ids (routineId /
workoutId / exerciseId / itemId / week / weekday …) — enough to make a req from, no real
history copied.

**Data-trust guard (verified).** The store only ever touches `workout-dev-notes-v1`. Test
`append/read round-trips through the dev key only` asserts the written key set is exactly
`[DEV_NOTES_KEY]` — never `workout-mvp-v8`.

**Dev-only gating — the failure-case criterion (verified).** `import.meta.env.DEV` is a
build-time literal (`false` for any `vite build`), so the render site collapses to `null`,
`DevNotes` becomes unreferenced, and Rollup drops the whole module chain (component +
store) from `dist/`.

Receipts:

```
# ./check
# tests 225 / pass 225 / fail 0
check: green — lint, 20 test file(s), and the build all passed.

# GITHUB_PAGES=true npm run build, then grep dist/ for feature markers
#   pattern: workout-dev-notes|note on this page|Copy JSON|dev-notes|__APP_VERSION__
matches in src/:  14      <- pattern is valid
matches in dist/:  0      <- feature entirely absent from the prod bundle
grep -c APP_VERSION dist/assets/*.js -> 0   (define left no stray global)
```

## Workflow

- **Choices left open by the spec, decided here:**
  - Separate key name: `workout-dev-notes-v1`.
  - Gating mechanism: `import.meta.env.DEV` + a single ternary render site, relying on
    Vite/Rollup DCE (proven by the dist grep, not just asserted).
  - Context fields: `{routeName, params, hash, appVersion}`. `appVersion` = git short sha
    via a new `vite.config.js` `define` (`__APP_VERSION__`) — cheap, and the constant is
    harmless in prod since the only reader is DCE'd out.
  - No dev listing screen — Copy-JSON-to-clipboard suffices (spec allowed a listing only
    if cheaper; it isn't). Clipboard failure (insecure context) falls back to a
    `console.log` of the JSON so notes are never stranded.
  - Styling is inline in `DevNotes.jsx` (no additions to the shared `ui.css`), so the prod
    stylesheet carries nothing from this feature either.
- **No scope added or dropped** beyond the above. No change to `workout-mvp-v8`, no
  migration, no schema bump — ask-gate #2 does not apply.
- **Nothing for a DEC/L** that I can see; the gating approach could be worth noting as the
  house pattern for future dev-only surfaces if more appear.

## What I could not verify myself
- Live render/save in the browser (button appears, panel opens, Save persists, Copy JSON
  reaches the clipboard) — the Chrome extension wasn't connectable from this session. The
  JSX compiles (dev-mode `vite build` succeeded) and the store logic is unit-tested; what
  remains is the visual/interaction check on a real page.
