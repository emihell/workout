# req-95 — feedback note panel: stop iOS auto-zoom on the textarea (gym-flow batch 3, note n7)

**Status: BUILT AND MERGED, 2026-09-17 — branch `req-95` (`4ed421e`…`4ed421e`, 1 commit).** From Emilio's in-app note (2026-09-16, `/`):
*"When I write here, the iPhone zooms in — is there a way to turn that off or circumvent it?
Because I can't see the whole modal and I have to zoom out after save."*

**Gate: functional (bug).** iOS-specific; visible on a real iPhone.

## Why

[measured] "Here" is the **feedback note panel's textarea** — the note that carried this
report was captured in it. iOS Safari auto-zooms when a focused form control's font-size is
**< 16px**. The app's own inputs are safe (`.ui-input` uses `--ui-text-body: 17px`,
`src/ui/ui.css:47,252`), but the feedback panel is styled independently in
`src/dev/DevNotes.jsx`: the panel sets `font: '13px/1.4 system-ui…'` (line ~40) and the
textarea inherits it (`font: 'inherit'`, line ~143). **13px < 16px → iOS zooms on focus**,
and because the panel is `position: fixed` at a fixed width top-right, the zoom pushes part of
it off-screen — hence "can't see the whole modal, have to zoom out after save."

## The fix (decided with Emilio, 2026-09-17)

- **Give the textarea (and any other focusable input in this panel) a font-size ≥ 16px** so
  iOS does not auto-zoom on focus. The rest of the panel's compact styling can stay.
- **Do NOT disable page zoom app-wide.** The viewport is intentionally
  `initial-scale=1.0` with no `maximum-scale` (`index.html:6`) — adding `maximum-scale=1` /
  `user-scalable=no` would kill pinch-zoom everywhere, an accessibility regression. Fix the
  input font-size, not the viewport.

## Scope

- `src/dev/DevNotes.jsx` — the textarea's font-size (and the panel font if simplest), inline
  styles only. This component owns all its styling (no `ui.css` classes, by design — see its
  header comment).

## Out of scope

- `index.html` viewport meta (must not change).
- The app's own `.ui-input` (already 17px, not the cause).
- The feedback feature's behaviour / gating / storage (req-86/87/88).

## Watch-outs (CC)

- The textarea currently `font: inherit`s the 13px panel font — bumping just the textarea to
  16px is enough for the zoom; verify no other focusable control in the panel is still < 16px
  (the buttons don't focus-zoom, but check the text field is the only input).
- Keep the panel usable at the larger text — it's `maxHeight` + `overflowY: auto`, so slightly
  taller text should scroll, not clip.

## Acceptance criteria

- **No zoom (real iPhone — Emilio):** with the feedback toggle ON, tapping the note textarea on
  an iPhone does **not** trigger Safari's auto-zoom; the whole panel stays visible; no manual
  zoom-out needed after Save. *(Untestable in a desktop browser — flagged for Emilio.)*
- **Font ≥ 16px (browser/inspect):** the textarea's computed font-size is ≥ 16px.
- **Pinch-zoom intact:** `index.html` viewport unchanged; page can still be pinch-zoomed.
- **No regression:** `./check` green; feedback capture (type → Save → Copy JSON) still works.

## Decisions

- Fix via input font-size ≥ 16px, not viewport lockout (Emilio, 2026-09-17).
