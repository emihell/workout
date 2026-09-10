# req-13 — a minimal, colorless, Apple-inspired component library (+ showcase)

**Status: READY** — direction settled (DEC-017). The first styling foundation. First iteration is
deliberately bare; expect iteration from the showcase.

**Gate: ux-feel** (DEC-009) — it defines the app's look. The planning session can verify the showcase
renders and each component works, but **Emilio judges the look and merges** — and this one will
iterate (build → look at the showcase → adjust → repeat) before it's right.

## Why

The app has **zero CSS** — raw HTML, tiny text links, no tap-friendly sizing. That is the biggest
friction in the mobile, one-handed, in-gym flow (DEC-010). Before styling each screen, extract the
app's UI into a small **component library** so the styling pass has consistent, tappable primitives
to build from. First iteration: as little code and CSS as possible, **no colors**, as raw as
possible, easy to press, Apple-inspired.

## Principles (DEC-017)

- **Colorless** — grayscale only (white / black / grays), no theme. Whitespace, type weight, and
  hairline (1px light-gray) dividers do the work.
- **System font** (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`); a **fixed
  named type scale** (DEC-020) — caption / body / section / title / display, defined as CSS custom
  properties in `ui.css`, and **every** component references only these (no ad-hoc `font-size`). The
  RestBar time number is **double** its earlier size (a large step above display).
- **Easy to press** — every interactive target **≥ 44px** tall; generous padding; 8px spacing rhythm.
- **Apple-inspired** — grouped lists with hairline dividers + a `›` chevron on navigable rows;
  segmented controls; large legible numbers; buttons as rounded rects set apart by weight/border.
- **Minimal code** — a small `src/ui/` of components + one minimal grayscale stylesheet (plain CSS
  imported once, or CSS Modules — CC's call, whichever is least machinery). No tokens beyond
  spacing/size, no build changes, no dependencies.

## The component inventory (extracted from the app)

Build each as a bare primitive. My design suggestion per component (starting point — refine at the
showcase):

**Controls**
- **`Button`** (action / submit) — rounded rect, ≥44px tall, generous horizontal padding, often
  full-width on mobile. Variants by weight, not color: **primary** (solid hairline border + bold
  label, or light-gray fill) / **secondary** (plain, lighter) / **quiet** (a **hairline border**, lightest weight — Emilio 2026-09-10: quiet needs a border, not text-only). Covers the 44
  `type="button"` + 11 `type="submit"` uses (Complete, Save, Skip, Add, Delete, Start, Abandon,
  Pause/Resume, +30s, Next, Import, Export…).
- **`NavLink`** — text navigation link; optional leading `‹` (back) or trailing `›` (forward)
  chevron; padded to a ≥44px hit area. This is req-12's `ExercisesLink` generalized. Covers the top
  nav, hub links, and the pure-nav "Cancel/Skip" (post-req-12).
- **`SegmentedControl`** (radio group) — equal-width segments in a bordered pill; the selected
  segment set apart by fill/weight (grayscale). Covers effort (Easy/Moderate/Hard/Failure) and feel
  (Easy/Good/Hard/Exhausting).
- **`Checkbox`** — large label + box, ≥44px row (the Settings "Assistant prompt").
- **`FileButton`** — the import file input styled to look like a `Button` (hide the raw
  `<input type=file>`, label it "Import").

**Inputs**
- **`Field`** — labeled text input: caption-size label above, large input, hairline underline or
  border, ≥44px tall. Covers names/equipment/notes text.
- **`NumberField`** — kg / reps: same as Field but **large legible digits** (gym-readable), numeric
  keypad (`inputMode="decimal"`).
- **`Textarea`** — the note field; same treatment, taller.

**Structure**
- **`Screen`** — the page container: mobile-first full-width with comfortable side padding, a
  max-width so it centers on wide screens, vertical rhythm. (Replaces the ad-hoc `<section>`.)
- **`Title`** (h1) / **`SectionHeader`** (h2) — the type scale's two heading sizes.
- **`List` + `Row`** — Apple grouped list: full-bleed rows, hairline dividers **between** rows,
  ≥44px row height, content left / optional value or `›` chevron right. Covers exercise lists,
  history, schedule, today's rows, the workout overview list.
- **`NavBar`** — **everything in the menu (DEC-019, supersedes DEC-018).** The bar is just a **`Menu`**
  trigger; the menu holds **all** nav items (Today, Schedule, Routines, Exercises, History, Settings).
  The menu **closes when an item is clicked and when the user clicks outside it**. (Bottom tab bar is
  the Apple-mobile idiom worth considering later; not now.)
- **`Banner`** — a full-width notice strip (grayscale), for the save-failed banner (req-01) and
  error-boundary fallback (req-05).

**Molecules (app-specific, compose the atoms)**
- **`RestBar`** (revised, Emilio 2026-09-10) — a **big remaining-time number on its own** (prominent,
  full-width), then **a row of 3 equal-width buttons** `[Pause/Resume] [+30s] [Next]` — each takes a
  third, **`Next` is the primary** and sits **at the right**.
- **`SetLogForm`** — kg + reps `NumberField`s, the effort `SegmentedControl`, note `Field`, and the
  Complete/Skip/Previous `Button`s — the single most important gym surface; make it big and thumb-reachable.

## Scope

- Create `src/ui/` (name CC's call) with the components above, plus **one minimal grayscale
  stylesheet**. No colors, no tokens beyond spacing/sizing/type, no dependencies.
- Add a **showcase route `#/components`** (a plain screen, reachable e.g. from Settings or by URL)
  that renders **one example of each component** (Emilio 2026-09-10: just one of each, not every
  state) so Emilio can see and iterate. This is the iteration surface.
- Keep it **tiny** — first iteration favours "too little" over "too much"; we add on looking at it.

## Out of scope (first iteration)

- **Migrating the app's screens** to use the library — that's the subsequent per-screen styling pass,
  one screen at a time. This req only *creates* the library + showcase. **One exception: the
  `NavBar`.** It is the global app shell, so its DEC-018 regroup (Today + Schedule primary; Routines
  / Exercises / History / Settings behind a `Menu`) is **wired into `App.jsx` now**, replacing the
  current flat six-item nav — otherwise the IA change wouldn't take effect. Expect a transient look
  mismatch (a tidier nav above still-unstyled screens); that's fine, it declutters regardless of
  styling.
- **Any color / theme / dark mode** — grayscale only.
- The bottom-tab-bar restructure (noted as a later suggestion).
- Replacing native `alert`/`confirm` (separate item).
- Animations, icons beyond simple chevrons, images.

## Ordered steps

1. Add the minimal grayscale stylesheet + `src/ui/` primitives (Button, NavLink, SegmentedControl,
   Checkbox, FileButton, Field, NumberField, Textarea, Screen, Title, SectionHeader, List, Row,
   NavBar, Banner) and the two molecules (RestBar, SetLogForm) — each as small as possible.
2. Add the `#/components` showcase route rendering every component in its states.
3. Do **not** change existing screens (the app keeps working unstyled; the library lives beside it
   until the styling pass migrates screens onto it).

## Acceptance criteria (written before implementation)

- **Every element type is represented:** the library covers button (primary/secondary/quiet), nav
  link, segmented control, checkbox, file button, text field, number field, textarea, screen
  container, title/section headers, grouped list + row, nav bar, banner, rest bar, set-log form.
  Show the inventory in the report.
- **Colorless + minimal:** the stylesheet defines **no colors** beyond black/white/grays; grep/paste
  the stylesheet's palette in the report to prove it. As little CSS as feasible.
- **Tap-friendly:** interactive components are ≥44px tall (spot-check in the showcase).
- **Showcase works:** `#/components` renders all components; nothing throws. `./check` green.
- **App unbroken:** existing screens are unchanged and still work (the library is additive). Diff
  shows new files + the route wiring only, not screen rewrites.
- `./check` green; paste the line.

## Notes

This is the seed of the styling pass, kept deliberately raw so Emilio shapes it from the showcase
rather than from prose. Follows DEC-010 (mobile-first) and DEC-016 (nav = links / buttons = actions —
the `Button` vs `NavLink` split mirrors it). Once the library feels right, subsequent reqs migrate the
screens onto it one at a time.
