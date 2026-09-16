# req-87 — feedback notes: ship to the live site, gated by a Settings toggle (default off)

Branch: `req-87`. Status: **READY** (planning session to merge; live toggle/render/persist is an Emilio browser item — Chrome extension not connectable from this session).

## Technical

**What changed from req-86.** The "note on this page" capture (req-86) was gated at
**build-time** (`import.meta.env.DEV`, DCE'd out of prod). req-87 flips it to **runtime**: the
button/panel now ship in the production build and render **only when a feedback toggle is ON**,
default **OFF**, toggleable in Settings and persisted across reloads.

**Files**
- `src/dev/dev-notes.js` — added the enabled flag under its own key
  `workout-feedback-enabled-v1`:
  - pure, storage-injected `readEnabled` / `writeEnabled` (default OFF = key absent; turning
    OFF **removes** the key so "off" is byte-for-byte the fresh state, not a stored `'false'`).
  - a subscribable browser layer (`getFeedbackEnabled` / `subscribeFeedbackEnabled` /
    `setFeedbackEnabled`) mirroring storage.js's signal trio, so App's gate and the Settings
    toggle track it via `useSyncExternalStore` and a flip shows/hides the button live.
- `src/App.jsx` — replaced `{import.meta.env.DEV ? <DevNotes /> : null}` with
  `<FeedbackNotesGate />`, which subscribes to the flag and renders `<DevNotes />` only when ON.
- `src/views/Settings.jsx` — added a **"Feedback notes"** checkbox bound to the flag store.
- `src/dev/DevNotes.jsx` — header/comment updated (ships to prod, runtime-gated); button label
  "Dev: note on this page" → "Note on this page". Notes key, capture shape, Copy-JSON, Clear —
  all unchanged from req-86.
- `vite.config.js` — `__APP_VERSION__` define kept (still used in note context), as the spec said.

**Naming.** Kept the directory `src/dev/` and the notes key `workout-dev-notes-v1` (rename was
optional). The key literally contains `-dev-` and renaming it would strand any notes already
captured; keeping the module name consistent with the key avoids churn. It's cosmetic now, not
a build mechanism — noted so it isn't mistaken for leftover dev-only gating.

**Data-trust guard.** Both keys (`workout-feedback-enabled-v1`, `workout-dev-notes-v1`) are
distinct from `workout-mvp-v8` and share no code path with it. Default OFF = absence of the flag
key, so a fresh/production visitor renders nothing and writes nothing until the toggle is turned on.

## Receipts

```
# ./check
# tests 248 / pass 248 / fail 0   (+5 over the base)
check: green — lint, 20 test file(s), and the build all passed.

# GITHUB_PAGES=true npm run build — prod now INCLUDES the feature (inverse of req-86)
grep dist/ for the feature markers -> 7 matches (was 0 in req-86)
keys present in dist/assets/*.js: workout-dev-notes-v1, workout-feedback-enabled-v1
grep -rn 'import.meta.env.DEV' src/ -> only a comment line in dev-notes.js (no code gate)
```

Acceptance criteria:
- **Default off:** `getFeedbackEnabled()` reads false on absent key; gate renders nothing; no key
  written on load. ✓ (unit-tested; live render is the Emilio item)
- **Toggle on:** Settings checkbox → `setFeedbackEnabled(true)` → gate renders `<DevNotes/>`. ✓
  (wired; live click is the Emilio item)
- **Persists:** flag stored in localStorage, module re-reads it at load → survives reload; off
  removes the key. ✓ (unit-tested)
- **Ships to prod (inversion of req-86):** prod build includes the feature, inert until toggled. ✓
  (dist grep: 7 matches)
- **History untouched:** unit test asserts the only keys touched are the flag + notes key, never
  `workout-mvp-v8`. ✓
- **No regression:** `./check` green. ✓

## Workflow

- **Implementation choices (spec left open):** flag key `workout-feedback-enabled-v1`; label
  "Feedback notes"; "off" removes the key (keeps default==absence invariant true); kept `src/dev/*`
  unrenamed (reasoning above). Used the `useSyncExternalStore` signal-store idiom already in
  storage.js so the toggle is reactive app-wide with no reload.
- **No scope added/dropped;** no change to `workout-mvp-v8`, the notes' capture/export/storage, or
  a general settings framework. `__APP_VERSION__` kept.
- **Nothing new for a DEC/L** — this is a clean revision of req-86's gating; the default-off /
  separate-key / never-touch-history guarantees carry over and are re-tested.

## What I could not verify myself
- The live browser flow — toggle appears in Settings, flipping it shows/hides the ✎ on every
  screen, state survives reload, capture/Copy-JSON/Clear still work in prod — the Chrome extension
  wasn't connectable from this session. The flag logic and key-isolation are unit-tested and the
  React wiring uses the same `useSyncExternalStore` pattern as the existing banners; what remains
  is the on-screen confirmation.
