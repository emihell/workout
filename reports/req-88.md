# req-88 — feedback button to visible top-right

Branch `req-88`, off `main@d4acbb7`.

## Technical

Single file, inline styles only: `src/dev/DevNotes.jsx`.

- **Button** moved from `left:12; bottom:12; opacity:0.45; 34×34` →
  `top:<safe>; right:<safe>; opacity:1; 40×40`, plus a soft `boxShadow`
  (`0 2px 8px rgba(0,0,0,0.2)`) so the white circle stands off any background.
  Glyph bumped `15px → 18px` to match the larger button.
- **Panel** moved from `left:12; bottom:12` → `top:<safe>; right:<safe>` so it
  opens under the button, fully on-screen. Added
  `maxHeight: calc(100vh - insets - 24px)` + `overflowY:auto` so a short viewport
  (landscape phone) scrolls the panel instead of clipping Save/Copy/Clear off the
  bottom.
- **Safe-area:** both controls share
  `TOP = calc(env(safe-area-inset-top, 0px) + 12px)` and
  `RIGHT = calc(env(safe-area-inset-right, 0px) + 12px)`, matching the pattern
  ui.css already uses (`ui.css:494`). No-notch devices fall back to a plain 12px gap.
- `Z` (2147483000, above the dock) unchanged. Gating (req-87 toggle,
  `workout-feedback-enabled-v1`), storage (`workout-dev-notes-v1`), and capture
  shape untouched — no other file changed.

**Choices left open by the spec (mine):** 40×40 size, full opacity + drop shadow,
18px glyph, top-right panel anchor with scroll-on-overflow. All inside the req's
"obviously visible, fully on-screen, clear of the bottom menu and the notch" latitude.

## Verification

- `./check` — **green**: lint, 261 tests / 20 files, build all pass.
- Visual placement **not verified by me** — the Chrome extension wasn't connected
  this session. Left for the reviewer (below).

## Workflow

No deviations. Scope stayed exactly the one file the req named. Note for the
planner: the `d4acbb7` commit title reads "req-88 READY …" but that commit only
added the req file (planning merge) — the code change lands here on branch `req-88`.
