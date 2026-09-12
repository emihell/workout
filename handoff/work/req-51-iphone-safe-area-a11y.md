# req-51 — iPhone safe areas + accessibility: the menu clips in full-screen

**Status: READY** (root cause measured; final on-device tuning iterated per WORKFLOW
"a UI requirement is not finished when written"). From Emilio 2026-09-12: *"Menu needs
to go up a bit, when I use the app in full screen the menu is too far down on the
phone, it clips a bit, check standard iPhone margin rules - make sure our application
works on all iPhones and is fully accessible."*

**Gate: ux-feel** — planning builds + tests what it can (build/lint, computed CSS in a
headless check); the **real-device look on a notch/Dynamic-Island iPhone is Emilio's
after-check** and is the one part planning cannot fully verify.

## Why — root cause (measured)

The bottom `TabBar` already tries to clear the home indicator with
`env(safe-area-inset-bottom)` (`ui.css:33` `--ui-tabbar-h: calc(61px +
env(safe-area-inset-bottom))`; `:347` tab padding-bottom). **But**
[measured] `index.html:6` is:

```
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

with **no `viewport-fit=cover`**. Without `viewport-fit=cover`, iOS Safari resolves
**every `env(safe-area-inset-*)` to `0`** — so the safe-area calc adds nothing and the
tab bar sits flush at the physical bottom edge, clipping against the home
indicator/rounded corner in full-screen (added-to-home-screen / standalone). That is
the reported bug.

Adding `viewport-fit=cover` makes the existing bottom calc start working, but it also
lets content extend under the **top** inset (status bar / notch / Dynamic Island),
which the app currently doesn't pad for (`ui.css` has no `safe-area-inset-top`) — so
the top needs handling too, or the title will sit under the status bar in standalone.

## The behaviour (decided)

1. **Add `viewport-fit=cover`** to the viewport meta so `env(safe-area-inset-*)`
   resolve to real values on notch/Dynamic-Island devices.
2. **Honour the top inset:** the screen/`main` reserves `env(safe-area-inset-top)`
   (and left/right for landscape/rounded corners) so no content — title, banners,
   first row — hides under the status bar or notch.
3. **Keep the bottom clear:** confirm the tab bar (and the Workout Routines sub-strip,
   `ui.css:97-99,347,375`) still clear the home indicator once insets are non-zero.
4. **Accessibility pass (in scope, targeted):** grayscale contrast of text tokens
   meets WCAG AA for their sizes (`--ui-ink-2`/`--ui-ink-3` on `--ui-bg`); interactive
   targets stay ≥44px (already the library floor); the active tab keeps a non-color
   affordance (it does — `aria-current` + underline, `ui/index.jsx:245`). Fix what
   fails; don't repaint the app.

## Scope

- `index.html`: `viewport-fit=cover`.
- `ui.css`: top (and side) safe-area padding on the screen/`main`; verify bottom
  chrome still clears the indicator; any contrast fix on the gray tokens that fails AA.
- Optional: `apple-mobile-web-app-*` / `theme-color` meta only if needed for the
  standalone look (flag before adding — it changes standalone chrome).

## Out of scope

- The bottom-menu redesign (req-52) — this is the *positioning/insets* fix, not a
  redesign. Coordinate: if req-52 lands first, this still applies to whatever bar
  exists.
- A full visual-design pass / new palette (DESIGN §5 defers it).
- A PWA manifest / installability work (no manifest today; not this req).

## Ordered steps

1. `index.html`: add `viewport-fit=cover` to the viewport meta.
2. `ui.css`: add `env(safe-area-inset-top)` (and left/right) padding to the screen
   container / `main`; re-check `--ui-tabbar-h` and `.ui-subbar` bottom clearance.
3. Contrast/target audit on the tokens; fix only what fails AA.
4. `./check`; where possible, a headless/computed-style assertion that the meta is
   present and the insets are wired.

## Acceptance criteria (written before implementation)

- **Meta present:** `index.html` viewport includes `viewport-fit=cover` — grep/diff.
- **Bottom clears the indicator (the bug):** in standalone full-screen on a
  Dynamic-Island/notch iPhone, the tab bar sits above the home indicator with no clip
  — **Emilio device check** (the part planning can't verify).
- **Top not obscured:** the title/first content is not under the status bar/notch in
  standalone — Emilio device check + the CSS reserves `safe-area-inset-top` (diff).
- **Insets actually apply (failure case):** confirm the fix is `viewport-fit=cover`
  making `env()` non-zero — **not** a hardcoded pixel bump that would be wrong on a
  no-notch device or in landscape. Assert the spacing is `env()`-driven, not a magic
  number (a device with no inset must not get extra dead space).
- **Contrast:** the gray text tokens meet AA for their size on white — state the
  measured ratios; fix any that don't.
- **No regression:** `./check` green — paste the line.

## Decisions

- **behaviour (Emilio):** app must work on all iPhones and be fully accessible; the
  menu must not clip in full-screen.
- **implementation (CC's call):** exact padding structure (on `.ui-screen` vs
  `.ui-main`); whether to add `apple-mobile-web-app`/`theme-color` (flag first if so);
  which tokens need a contrast nudge.
