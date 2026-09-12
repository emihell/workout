# req-52 — Bottom menu as its own designed library component

**Status: NEEDS DECISIONS.** From Emilio 2026-09-12: *"Bottom menu should be its own
component in the library - design it together with me."* Emilio chose **"mock a few
variants first"** — a design canvas of options precedes any spec.

**Gate: ux-feel** (once specced). Do not build until this is `READY`.

## Open decision (blocks READY)

**Which bottom-nav direction?** Planning produces a design canvas with 2–3 variants
(e.g. icon+label tabs, a prominent center Start/Workout action, refined text-only).
Emilio picks/steers; then this doc gets the chosen behaviour and becomes `READY`.

## Current state (measured)

The bottom menu today is `TabBar` **inside** `ui/index.jsx:227-254` (not its own
file): three equal tabs — **Workout / Library / Settings** — as `NavLink`s wearing
`ui-btn` variant classes (primary/secondary/quiet), no icons (a prior Emilio review
rejected custom icons — see the `ui/index.jsx:208-226` comment). `activeTab`
(`route.js:113-121`) maps any route to its tab; the current tab gets `aria-current` +
an `.is-active` underline. It's hidden during the in-workout flow
(`route.name` starts with `workout`). Styling: `ui.css:33` (`--ui-tabbar-h`),
`:338-372` (`.ui-tabbar*`), safe-area at `:347`.

Emilio's ask has two parts:
1. **Extract** it to its own component in the library (its own file / clearly its own
   unit), not buried in `ui/index.jsx`.
2. **Redesign** the look — the "design it together" part.

## Coordination

- **req-48** renames the Workout-tab *section links* (Future→Schedule, Past→History);
  the **tab-bar labels** (Workout/Library/Settings) are this req's, not req-48's.
- **req-51** fixes safe-area/insets for whatever bar exists — order-independent, but
  if req-52 lands first, req-51 applies to the new bar.
- **req-50** (no bare clickables) excludes the TabBar — it's redesigned here.

## Next action (planning)

Produce the variant mockups (design canvas), review with Emilio, record the pick as a
`DEC-`, then fill in behaviour + acceptance criteria and flip to `READY`.
