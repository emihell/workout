# req-88 — make the feedback button a visible top-right floating button

**Status: BUILT AND MERGED, 2026-09-16 — branch `req-88` (`8118fca`…`8118fca`, 1 commit).** Follow-up to req-86/87. Emilio found the button but it's
mis-placed and near-invisible: *"found it! we need a better placement — maybe top right corner?"*

**Gate: ux-feel** (no data/logic change — placement + visibility only).

## Why

[measured] `src/dev/DevNotes.jsx` renders the ✎ button `position: fixed; left: 12; bottom: 12;
opacity: 0.45; 34×34` — a holdover from req-86 when this was a *dev-only, deliberately "unimposing"*
tool. It ships to prod now (req-87) as a real feature Emilio uses, so faint + small + bottom-left (right
where the floating bottom menu sits) makes it read as "nothing happens." He located it only with effort.

## The behaviour (decided, Emilio 2026-09-16)

- **Move the button to the top-right corner** (`position: fixed; top: …; right: …`), clear of the
  bottom menu.
- **Make it clearly visible** — full (or near-full) opacity, not 0.45; keep it compact but comfortably
  tappable. It should be *obviously there* when the toggle is on, not hidden.
- **The panel/modal opens sensibly from the button** — anchored top-right or centered, fully on-screen
  (not off the bottom-left as now). Same content: current route + note field + Save / Copy JSON / Clear.
- Everything else unchanged: still gated on the feedback toggle (req-87), still the separate
  `workout-dev-notes-v1` key, capture shape untouched, still on every screen incl. the in-workout flow.

## Scope

- `src/dev/DevNotes.jsx` inline styles (button + panel position/opacity/size). No other file need change.

## Out of scope

- The toggle/gating (req-87), the capture/storage (req-86), any data change.
- The modal's fields/behaviour (they already do what Emilio wants).

## Watch-outs (CC)

- Top-right can collide with page headers / a Back control on some screens — keep the fixed button
  above them (`z-index` is already max) and check it doesn't cover a header action visually.
- Keep it off the iOS safe-area/notch (respect `env(safe-area-inset-top/right)` as the app does
  elsewhere).

## Acceptance criteria

- **Visible (browser):** with the feedback toggle ON, the button is plainly visible in the top-right on
  every screen (Today, workout, history, settings), at full/near-full opacity.
- **Panel on-screen (browser):** tapping it opens the note panel fully within the viewport (not clipped
  off an edge); route + note field + Save/Copy/Clear all reachable; Save still works.
- **Off when toggled off:** feedback toggle OFF → no button (unchanged).
- **No regression:** `./check` green.

## Decisions

- Top-right placement, clearly visible (Emilio, 2026-09-16).
- Exact offsets / size / opacity / panel anchor — implementation (CC), within "obviously visible,
  fully on-screen, clear of the bottom menu and the notch."
