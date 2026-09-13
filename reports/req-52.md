# req-52 — Bottom menu: floating Workout-oval + icon-only circles

Branch `req-52` (off `main`). Not merged, not pushed.

## Technical

### What changed

**`src/ui/BottomMenu.jsx` (new)** — the extracted global bottom menu (DEC-036).
A floating dock (`<nav class="ui-dock" aria-label="Primary">`), inset from the
edges, solid (no `backdrop-filter`, no shadow), three controls left→right:

- **Library** — icon-only circle, 4-square grid SVG, `aria-label="Library"`, → `/routines`.
- **Workout** — wide text-only oval (`.ui-dock__oval`, `flex:1`), literal text
  "Workout", no icon, → `/`.
- **Settings** — icon-only circle, sliders SVG, `aria-label="Settings"`, → `/settings`.

All three are the shared `NavLink` primitive (`views/shared.jsx`), i.e. `<a>` not
`<button>` (DEC-016). Selection = **model A**: `activeTab(route.name)` (`route.js`)
picks the current group; that control gets `.is-current` (ink fill via CSS) plus
`aria-current="page"`; the other two keep the faint hairline border. The fill moves
with the active tab. Returns `null` when `route.name` starts with `workout` (hidden
in the in-gym flow) — unchanged from the old TabBar.

Icons are inline stroke SVG on a 24px grid, `stroke="currentColor"` so they flip to
`--ui-bg` on the ink-filled selected circle. Sliders uses the Feather "sliders"
idiom (three vertical tracks + handle marks) — stroke-only, so no fill/cut-out knob
is needed for the color flip.

**`src/App.jsx`** — imports `BottomMenu` from `./ui/BottomMenu.jsx` (was `TabBar`
from `./ui/index.jsx`); renders `<BottomMenu />` (was `<TabBar />`).

**`src/ui/index.jsx`** — removed the `TabBar` component and the `TABS` array
(superseded). Removed the now-unused `import { activeTab, useHashRoute }`. Updated
the two header/section comments that referenced the TabBar as the live shell.

**`src/ui/ui.css`**
- Tokens: removed `--ui-tabbar-h`; added the floating-dock tokens:
  ```
  --ui-dock-inset: 14px;   /* left/right float inset */
  --ui-dock-bottom: 22px;  /* gap above the safe area */
  --ui-dock-h: 56px;       /* circle diameter / oval min-height */
  --ui-dock-clear: calc(var(--ui-dock-h) + var(--ui-dock-bottom) + env(safe-area-inset-bottom, 0px));
  ```
- `.ui-main` bottom padding recomputed for the floating dock:
  `padding-bottom: calc(var(--ui-dock-clear) + var(--ui-s3))` (dock footprint + one
  spacing step so content never butts against it). Still `env()`-driven → no dead
  gap on a no-notch device.
- Removed `.ui-tabbar`, `.ui-tabbar__tab`, `.ui-tabbar__tab.is-active`.
- Added `.ui-dock`, `.ui-dock__btn`, `.ui-dock__circle`, `.ui-dock__oval`,
  `.ui-dock__btn.is-current`, `.ui-dock__icon`. The dock floats
  (`position:fixed; left/right: calc(inset + env(...)); bottom: calc(bottom + env(...))`),
  `max-width:560px; margin:0 auto` so it stays centered on wide viewports.
- `.ui-subbar` (Workout "Routines" strip) bottom offset moved from
  `var(--ui-tabbar-h)` to `var(--ui-dock-clear)` so it docks just above the floating
  dock's footprint.
- Kept the general `a.ui-btn--*` state-reset rule (it is not a `.ui-tabbar*` rule; it
  is a defensive reset for any anchor wearing `.ui-btn` — DEC-016 discourages that
  pattern but the reset is harmless and future-proof). Softened its comment, which
  had named the removed TabBar as its consumer.

**`src/ui/safe-area.test.js`** — the "bottom chrome clears the home indicator via
env()" test named the removed `.ui-tabbar` rule and `--ui-tabbar-h` token. Rewritten
(not weakened) to assert the same env()-driven guarantee on the new structure: the
`.ui-dock` `bottom` offset carries `env(safe-area-inset-bottom)`, `--ui-dock-clear`
carries it too, and `.ui-main` reserves `--ui-dock-clear`. Justified: it asserts a
property (bottom clearance is safe-area-driven) that still holds; only the names it
referenced changed.

**`src/ui/BottomMenu.test.js` (new)** — see below.

### How selection is derived

From `activeTab(route.name)` in `route.js` — the same shared, unit-tested helper the
old TabBar used. No new grouping was introduced. `route.test.js`'s `activeTab` suite
(three route groups → `library`/`workouts`/`settings`, plus `settings`, the `null`
showcase, and the fallthrough) is unchanged and green.

### Testing note (spec-open choice: how the component is tested)

The gate is `node --test` on `*.test.js` with **no JSX transform**, so a JSX
component that reuses the JSX `NavLink` primitive cannot be imported/rendered in
node. I kept DEC-016 reuse (the shared `NavLink`) and covered the criteria two ways:

1. **Selection (model A)** is `activeTab`, already asserted behaviourally over the
   three groups in `route.test.js` — not re-asserted, to avoid holding one fact in
   two places.
2. **The render-only criteria** (null-on-`workout*`, the two `aria-label`s,
   `aria-current="page"` per control, unchanged targets, text-only oval vs icon
   circles, three shared NavLinks) are locked by a **static-source test**
   (`BottomMenu.test.js`) that reads `BottomMenu.jsx` as text — the same approach
   `safe-area.test.js` already uses for CSS/HTML it can't execute. Emilio's browser
   look is the behavioural check for how it renders.

This is the one spec-open implementation choice worth recording (the spec left "how
the bottom clearance is expressed" and file layout to CC; this test strategy is the
notable call). Alternative considered and rejected: author the component in plain
`.js` with `React.createElement` (like `error-boundary.js`) to make it
node-renderable — rejected because it would have to drop the shared `NavLink`
(itself JSX) and hand-roll `<a href={toHash(to)}>`, duplicating the one nav-link
primitive DEC-016 exists to prevent.

### Chosen pixel values (spec left exact px to CC)

Circle 56px; oval `min-height:56px`, `border-radius:28px` (`calc(--ui-dock-h/2)`);
dock `left/right` inset 14px (+ side safe-area), `gap` 8px (`--ui-s2`), bottom 22px
(+ bottom safe-area); border 1px `--ui-line`; `max-width:560px` centered. Content
clearance = `--ui-dock-clear + --ui-s3`.

### Verification

- Full gate:
  ```
  check: green — lint, 17 test file(s), and the build all passed.
  ```
  (`node --test`: 194 tests, 49 suites, 0 fail.)
- `route.test.js` (`activeTab` unchanged/green):
  ```
  ok 3 - activeTab maps every route name to its bottom tab (req-14 / DEC-024)
  # pass 13
  # fail 0
  ```
- `BottomMenu.test.js`: 7 tests, 0 fail.
- No stale code: `grep -rn "TabBar|ui-tabbar|--ui-tabbar-h|\bTABS\b" src/` returns
  **only comments** (historical req-14 attribution in `BottomMenu.jsx`,
  `index.jsx`, `ui.css`, `shared.jsx`, and the migration note in
  `safe-area.test.js`) — no live `TabBar` export, no `TABS` array, no `.ui-tabbar*`
  rule, no `--ui-tabbar-h` token.

### Aria labels used

`aria-label="Library"` and `aria-label="Settings"` on the two icon-only circles;
`aria-current="page"` on whichever control is the current screen; `aria-label="Primary"`
on the dock `<nav>`; `aria-hidden="true"` `focusable="false"` on the two SVGs.

### What only a real device/browser can verify (Emilio's after-check)

- The floating dock **feels** right on a real iPhone — the bottom inset (22px + safe
  area) sits comfortably above the home indicator, no clip, no dead gap.
- Content on every screen clears the dock with no gap and nothing hidden behind it.
- The ink-fill / faint-border selection reads correctly and the fill visibly moves
  between `/`, `/routines`, `/settings`.
- The grid and sliders icons read as Library / Settings at 56px.

## Workflow

- **Scope:** built exactly to req-52 + DEC-036. No scope added or dropped.
- **Deviation — test strategy (surface for a possible `L-`):** the `node --test`
  gate can't render JSX, and the component must reuse the JSX `NavLink` (DEC-016), so
  the acceptance criteria that read as "assert the component renders X" are covered by
  a static-source test plus the existing `activeTab` behavioural test, not by a
  DOM/render test. The criteria were written expecting component-level asserts; this
  is the closest honest equivalent under the repo's constraints (matches the
  `safe-area.test.js` precedent). Worth a lesson if future UI reqs keep asking for
  render-level asserts: either accept static-source coverage for JSX shells, or add a
  jsdom/transform test lane.
- **Kept `a.ui-btn` reset:** judgment call — it is not `.ui-tabbar*` stale code but a
  general anchor reset with no current consumer (the TabBar was its origin). Left in
  as defensive/future-proof; comment de-referenced from the removed TabBar. Flagged
  here in case Emilio would rather delete it.
- No decisions needed from Emilio mid-build; nothing contradicted the code.
