# req-13 — minimal, colorless, Apple-inspired component library (+ showcase)

Branch: `req-13-component-library`. Gate: ux-feel (DEC-017/018) — Emilio judges the
look at `#/components` and merges; expect iteration.

## Iteration 2 (Emilio review, 2026-09-10)

Emilio reviewed the showcase; four changes, all on this branch. `./check` green;
re-verified each in Chrome (no console errors).

1. **NavBar — all six items in the menu (supersedes DEC-018).** The bar is now just a
   `Menu` trigger; nothing is shown outside the menu. The menu holds Today, Schedule,
   Routines, Exercises, History, Settings. It closes on item click (`<ul onClick>`) and
   on click-outside (a `document` mousedown outside the `<nav>`, via a ref + effect).
   `[measured]` in Chrome: Menu opens all six; clicking the page body closes it.
2. **Quiet button** — `.ui-btn--quiet` given a hairline border (`--ui-line`); still the
   lightest weight, grayscale, but reads as a button (visible on set-log "Previous").
3. **Showcase** — trimmed to **one example of each** component (was multiple states):
   one primary Button (+ a variants note), one nav link, one segmented control, one
   RestBar, etc. The grouped list keeps one navigable row + one value row to show `Row`'s
   two forms.
4. **RestBar redesign** — a big remaining-time number (56px) on its own full-width line,
   then a row of exactly three equal-width buttons `[Pause/Resume] [+30s] [Next]`
   (`flex: 1 1 0` thirds), with `Next` the primary button, rightmost. `[measured]`:
   renders as specified.

The sections below describe the original build; the four points above override where they
conflict (NavBar layout, quiet border, showcase breadth, RestBar layout).

## Technical

### What was added

- **`src/ui/ui.css`** — one grayscale stylesheet. Plain CSS imported once at the app
  root (`main.jsx`). **Every selector is scoped to a `.ui-` class — no bare-element
  selectors** (no `button`/`a`/`section`/`input`), so screens that don't use these
  classes are visually untouched. Tokens are grays + an 8px spacing rhythm + radius/size
  only (DEC-017).
- **`src/ui/index.jsx`** — the primitives + two molecules (all small, presentational).
- **`src/ui/Showcase.jsx`** — the `#/components` page rendering every component in its
  states.

### Wiring (the minimal, intended diff)

- `main.jsx` — `import './ui/ui.css'` (once).
- `route.js` — `if (parts[0] === 'components') return { name: 'components' }`.
- `App.jsx` — replaced the flat 6-item `<Nav>` with `<NavBar/>` (the DEC-018 regroup, the
  one component wired into the app now); added the `components` → `<Showcase/>` dispatch.
- `views/shared.jsx` — extended req-12's `NavLink` with optional `className` + `chevron`
  props (both default off, so every existing `<NavLink to>label</NavLink>` call is
  unchanged). Still the single nav-link primitive; the library's `NavLink` wraps it with
  the `ui-navlink` class.
- `views/Settings.jsx` — one line: a `<a href="#/components">Components</a>` link, so
  Emilio has a tap-path to his iteration surface (the req suggests "reachable from
  Settings"). This is the only pre-existing screen touched, and only additively.

### Component inventory (acceptance: every element type represented)

| Component | Kind | Notes |
|---|---|---|
| `Button` | control | variants primary / secondary / quiet, `block`, `disabled`; by weight not color |
| `NavLink` | control | shared primitive (req-12) styled; optional ‹/› chevron |
| `SegmentedControl` | control | radio group, equal segments, selected = ink fill (effort + feel) |
| `Checkbox` | control | ≥44px row; `accent-color` set to ink (grayscale, not OS blue) |
| `FileButton` | control | hidden `<input type=file>` styled as a Button |
| `Field` | input | caption label + text input |
| `NumberField` | input | 34px tabular digits, `inputMode="decimal"` |
| `Textarea` | input | taller note field |
| `Screen` | structure | centered max-width page container, system font |
| `Title` / `SectionHeader` | structure | the two heading sizes |
| `List` + `Row` | structure | Apple grouped list; hairline dividers; `to` → navigable row w/ › |
| `NavBar` | structure | Today + Schedule primary; Menu toggles Routines/Exercises/History/Settings (DEC-018) |
| `Banner` | structure | grayscale notice strip (`role` prop for status/alert) |
| `RestBar` | molecule | large time; Pause/Resume + +30s left; Next right (req-11 layout) |
| `SetLogForm` | molecule | kg+reps NumberFields, effort SegmentedControl, note, Complete/Skip/Previous |

The molecules are **presentational** (props / local state), so the showcase renders them
standalone. The real `Workout.jsx` RestBar/set-log keep their own store-wired versions —
migrating screens onto the library is the later per-screen pass (out of scope here).

## Verification (receipts)

**Colorless — the stylesheet's entire palette (grep of every color literal in `ui.css`):**

```
--ui-bg: #ffffff; /* white */
--ui-fill: #f2f2f2; /* light-gray grouped-list / secondary fill */
--ui-line: #d1d1d1; /* hairline divider */
--ui-ink-3: #8e8e8e; /* tertiary / disabled */
--ui-ink-2: #6b6b6b; /* secondary / caption */
--ui-ink: #1c1c1c; /* primary text / near-black */
```

Pure grays (r=g=b) + black/white only — no hues, no rgb/hsl, no named colors. (I snapped
Apple's system grays, which carry a faint blue tint like `#f2f2f7`, to pure gray so
"grayscale only" is unambiguous — negligible visual difference.)

**Tap-friendly (≥44px):** `min-height: var(--ui-tap)` where `--ui-tap: 44px` on `.ui-btn`,
`.ui-navlink`, `.ui-seg__item`, `.ui-check`, `.ui-input`, `.ui-row`. Confirmed visually in
the showcase (buttons, segments, rows all comfortably tappable).

**Showcase renders, nothing throws** `[measured]` — loaded `#/components` in Chrome:
every component rendered; `read_console_messages(onlyErrors)` → "No console errors or
exceptions found." NavBar Menu toggle opens the four-item list; a normal screen (Today)
below it still renders in its raw unstyled form (proves the library is additive / screens
unchanged).

**Diff scope** — new files + the wiring only, no screen rewrites:

```
 src/App.jsx            |  23 +---   (Nav → NavBar swap + components dispatch; net -21)
 src/main.jsx           |   1 +      (css import)
 src/route.js           |   1 +      (components route)
 src/ui/Showcase.jsx    | 130 +++    (new)
 src/ui/index.jsx       | 273 +++    (new)
 src/ui/ui.css          | 309 +++    (new)
 src/views/Settings.jsx |   4 +      (showcase link)
 src/views/shared.jsx   |  14 ++-    (NavLink: optional className + chevron)
```

**`./check`:**

```
check: green — lint, 13 test file(s), and the build all passed.
# tests 99  # pass 99  # fail 0
```

## What I could not verify myself

- **The look/feel** — this is the ux-feel gate. The showcase renders and is grayscale +
  tappable, but whether the type scale, spacing, and Apple idiom *feel* right is Emilio's
  call from `#/components` (branch `req-13-component-library`, dev server → open `#/components`,
  or Settings → Components).
- **On a real phone** — sizing is mobile-first (44px targets, ≤560px column) but I checked
  it in a desktop Chrome window, not a device.

## Workflow

- **Scope held**: only the NavBar is wired into the app; no other screen was migrated onto
  the library. The Settings link and the NavLink `className`/`chevron` extension are the
  only edits to pre-existing screen/shared code, both additive and backward-compatible.
- **One judgement call surfaced**: I snapped the grayscale palette to pure r=g=b (away from
  Apple's slightly-blue system grays) to satisfy "colorless" unambiguously. If Emilio wants
  the warmer Apple grays back, it's a 6-value swap in `:root`.
- **Checkbox accent**: native checkboxes render OS-blue by default; I set `accent-color` to
  ink to keep the checked state grayscale. Worth a `DEC`/note if "colorless" should formally
  cover native form controls.
- **NavLink as one primitive**: rather than a second nav component, I extended the req-12
  primitive with optional presentational props and had the library wrap it. Keeps DEC-016's
  "one nav-link primitive" true. No behaviour change to existing links.
- Nothing needed a blocking decision; the design is deliberately raw per DEC-017 and is now
  Emilio's to shape from the showcase.
