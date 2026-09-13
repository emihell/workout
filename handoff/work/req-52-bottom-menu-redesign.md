# req-52 — Bottom menu: floating Workout-oval + icon-only circles

**Status: BUILT AND MERGED, 2026-09-13 — branch `req-52` (`57c84f2`…`57c84f2`, 1 commit).** Design decided with Emilio via the `/design` mockups (DEC-036).
From Emilio 2026-09-12: *"Bottom menu should be its own component in the library -
design it together with me"*; direction chosen 2026-09-13: *"use 1 — but not
translucent, no icon on workout button, no shadow, give non-selected a faint border
instead"* and selection *"a"* (fill moves to the current screen).

**Gate: ux-feel** — planning builds + tests + merges on its own testing (DEC-035);
the floating-bar feel on a real iPhone (with the safe area) is Emilio's non-blocking
after-check. Touches the global shell (`App.jsx`, `route.js` `activeTab`) → run an
independent reviewer subagent before merge (DEC-035, shared-shell blast radius).

## Why

The bottom menu today is `TabBar` **inside** `ui/index.jsx:227-254` (req-14/DEC-024):
three equal text tabs — Workout / Library / Settings — as `NavLink`s wearing `ui-btn`
variant classes, with a static emphasis + an `.is-active` underline. Emilio wants it
(1) **extracted into its own library component**, and (2) **redesigned** to focus on
Workout: one wide Workout button that takes the space, flanked by two small icon-only
circles.

## The design (decided — DEC-036)

Three controls, floating near the bottom (inset from the edges — not a flush
full-width bar), left→right **Library · Workout · Settings**. **Solid: no
translucency (no `backdrop-filter`), no shadow.**

- **Workout** — a wide **oval/capsule** (`flex: 1`, takes all remaining width),
  **text only, no icon**. It is the focus.
- **Library / Settings** — **icon-only circles** (~56px). Icons: Library = a 4-square
  grid; Settings = sliders (both inline stroke SVG on a 24px grid, grayscale — this
  reverses req-14's no-icons stance for these two). Each needs an accessible name
  (`aria-label`), since there is no visible text.
- **Selection = model A:** the control for the **current screen** is **ink-filled**
  (`--ui-ink` bg, `--ui-bg` text/icon); the other two carry a **faint hairline
  border** (`--ui-line`, `--ui-bg` fill, `--ui-ink` icon). The fill moves with the
  active tab. Reuse **`activeTab(route.name)`** (`route.js:113-121`) — the existing
  helper already maps any route to one of `workouts`/`library`/`settings`. No new
  grouping.
- **Targets unchanged:** Workout → `/`, Library → `/routines`, Settings → `/settings`
  (same as the current `TABS`, `ui/index.jsx:227-231`). Still `NavLink`/`<a>` nav
  (DEC-016), with `aria-current="page"` on the selected one.
- **Hidden during the in-workout flow** — keep the current rule (`TabBar` returns
  `null` when `route.name` starts with `workout`).

Reference mock (grayscale, real tokens): the `/design` canvas "Workout screen" +
"Selection states" artboards. Approximate values there: circle 56px, oval
`min-height:56px` `border-radius:28px`, dock inset `left/right:14px`, `gap:10px`. Exact
px are CC's to finalize on the feel gate; the shapes, solidity, and selection model
are fixed.

## Floating bar → content clearance (couples with req-51)

The bar floats, so content must clear it: the scroll container reserves
**dock height + its bottom inset + `env(safe-area-inset-bottom)`**. This needs
`viewport-fit=cover` to make `env()` non-zero (that's req-51's root-cause fix).
**Order: build req-51 first**; if req-52 lands first, it must add `viewport-fit=cover`
itself and own its clearance. The current `--ui-tabbar-h` / `.ui-main` padding
(`ui.css:33,335-336`) and the Workout `.ui-subbar` strip
(`ui.css:97-99,371-379`, bottom offset `--ui-tabbar-h`) are sized for the old flush
bar — recompute both for the floating dock so nothing hides behind it or leaves a gap.

## Extract into the library

Move the menu out of `ui/index.jsx` into **its own component** (e.g.
`src/ui/TabBar.jsx` or a renamed `BottomMenu.jsx`), imported by `App.jsx:23,224`.
Keep `activeTab` in `route.js` (shared, tested). Add its styles to `ui.css` under a
new block; **no stale code** — the old `.ui-tabbar*` rules and the `TABS` array go if
superseded (WORKFLOW: replaced code is removed, justified in the diff).

## Scope

- New component file for the bottom menu; `App.jsx` imports it; remove the old
  `TabBar` from `ui/index.jsx`.
- `ui.css`: floating-dock styles (circles, oval, selected/faint-border states);
  recompute content bottom-clearance and the `.ui-subbar` offset.
- Two inline SVG icons (grid, sliders).
- `route.test.js`: `activeTab` mapping is unchanged — keep it green (the selection
  reads from it).

## Out of scope

- Re-IA of the tabs (no Schedule/History top-level, no 4-tab, no center-Start FAB —
  those `/design` options were rejected, DEC-036).
- The in-workout flow chrome.
- A broader visual pass elsewhere in the app.
- Persisted data / model — none.

## Ordered steps

1. Extract the menu into its own component; wire `App.jsx`.
2. Build the three controls: Library circle, Workout oval (text only), Settings
   circle; order Library · Workout · Settings.
3. Selection from `activeTab`: current → ink fill; others → faint border. `aria-current`
   on selected; `aria-label` on the two icon circles.
4. `ui.css`: floating-dock styles (solid, no shadow, no translucency) + recompute the
   content bottom-clearance and `.ui-subbar` offset for a floating bar; ensure
   `viewport-fit=cover` is present (req-51, or add here if it lands first).
5. Remove the superseded `TabBar`/`TABS`/`.ui-tabbar*`.
6. `./check`.

## Acceptance criteria (written before implementation)

- **Layout:** Workout is a wide text-only oval taking the remaining width; Library and
  Settings are icon-only circles either side — confirm in the running app + markup.
- **Selection moves (model A):** on `/` the Workout oval is ink-filled and the circles
  are bordered; on `/routines` the Library circle is ink-filled and the Workout oval is
  a bordered outline; on `/settings` the Settings circle is ink-filled — driven by
  `activeTab`, asserted with a unit test over the three route groups.
- **Hidden in-workout (failure/edge case):** on a `workout*` route the menu does not
  render (returns `null`) — assert, so it can't reappear mid-set.
- **Icon buttons are labelled (a11y failure case):** the two icon-only circles expose
  an accessible name (`aria-label`) — without it a screen reader reads an unlabeled
  link; assert the attribute is present.
- **Content clears the floating bar:** no screen's content hides behind the dock, and a
  no-notch device gets no dead gap (the clearance is `env()`-driven, not a magic
  number) — Emilio device look + the CSS in the diff.
- **No stale code:** the old `.ui-tabbar*` rules / `TABS` array are gone if superseded
  — grep in the report.
- **No regression:** `./check` green — paste the line; `route.test.js` output pasted.

## Decisions

- **behaviour (Emilio, DEC-036):** the design above — solid floating Workout-oval +
  icon circles, selection model A, targets/grouping unchanged, hidden in-workout.
- **implementation (CC's call):** the component's file name/location; exact px
  (sizes, insets, radii, border width); the two SVG icon paths; how the bottom
  clearance is expressed in CSS.
