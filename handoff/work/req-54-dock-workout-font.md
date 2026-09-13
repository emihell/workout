# req-54 — Bottom menu: the "Workout" oval uses the wrong font

**Status: BUILT AND MERGED, 2026-09-13 — branch `req-54` (`885dff6`…`885dff6`, 1 commit).** From Emilio 2026-09-13 (req-52 after-look): *"workout has a
different font than rest of the system?"*

**Gate: ux-feel** — trivial CSS; planning builds + tests + merges on its own testing.

## Why — reproduction

The bottom menu's Workout oval renders "Workout" in the browser **default serif**, not
the app font. [measured] `.ui-dock__btn` (`src/ui/ui.css:375`) sets `font-size` and
`font-weight` but **no `font-family`**, and the dock (`.ui-dock`) is rendered outside
`.ui-screen` (it's a sibling `<nav>` in `App.jsx`, not inside a `.ui-screen`), so it
does not inherit `--ui-font`. Every other component that renders text sets
`font-family: var(--ui-font)` explicitly (grep: `.ui-btn`, `.ui-navlink`, `.ui-row`,
etc.); `.ui-dock__btn` is the one that was missed. The icons don't show it (SVG), so
only the "Workout" word looks off.

## The fix

Add `font-family: var(--ui-font)` to `.ui-dock__btn` (`ui.css`). One line.

## Scope

- `src/ui/ui.css`: `font-family: var(--ui-font)` on `.ui-dock__btn`.

## Out of scope

- Any other dock styling; the icons; sizes.

## Acceptance criteria

- **Font matches:** the "Workout" oval renders in `-apple-system`/`--ui-font`, same as
  the rest of the app — confirm in the diff (`.ui-dock__btn` now sets
  `font-family: var(--ui-font)`) and by eye.
- **No regression:** `./check` green — paste the line.

## Decisions

- **implementation (CC's call):** none beyond adding the declaration.
