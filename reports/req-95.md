# req-95 — feedback textarea iOS auto-zoom fix

Branch: `req-95` (off `main`).

## Technical

- **Cause (confirmed from spec, [measured]):** the feedback note panel
  (`src/dev/DevNotes.jsx`) styles itself independently of `ui.css`; the panel font
  is `13px/1.4 system-ui` and the textarea was `font: 'inherit'` → 13px. iOS Safari
  auto-zooms a focused form control whose font-size is < 16px, and because the panel
  is `position: fixed` at a fixed top-right width, that zoom pushed part of it
  off-screen.
- **Fix:** gave the textarea an explicit `font: '16px/1.4 system-ui, sans-serif'`
  (was `font: 'inherit'`). 16px is the iOS threshold; the rest of the panel keeps its
  compact 13px styling. One line, inline style only — this component owns all its
  styling by design.
- **Scope confirmed:** the textarea is the only focusable text input in the panel.
  The buttons (Save / Copy JSON / Clear / Close) are `<button>`s and do not trigger
  focus-zoom; the panel is `maxHeight` + `overflowY: auto`, so the slightly taller
  16px text scrolls rather than clips.
- **Not touched:** `index.html` viewport meta (stays `initial-scale=1.0`, no
  `maximum-scale`) — pinch-zoom app-wide is intact. `.ui-input` (already 17px) is not
  the cause and is untouched.

## Verified

- `./check` green — lint, 261 tests across 20 files, and the build all passed.
- Textarea computed font-size is now 16px (from the literal `16px` in the style).

## Workflow

- No deviation from spec. Straight bug fix, exactly as specified.
- The one acceptance criterion that can't be verified from here — "no auto-zoom on a
  real iPhone, whole panel stays visible" — needs Emilio on an actual device; flagged
  in the ready-to-look-at handoff.
