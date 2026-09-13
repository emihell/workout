# req-51 — iPhone safe areas + accessibility

Branch `req-51` (off `main`). Not merged, not pushed.

## Technical

### What changed

**`index.html`** — added `viewport-fit=cover` to the viewport meta:
```
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```
This is the root cause of the reported clip: without it iOS resolves every
`env(safe-area-inset-*)` to `0`, so the pre-existing bottom safe-area math did
nothing and the tab bar sat flush against the home indicator in standalone.

**`src/ui/ui.css`**
- `.ui-main` now reserves the top and side insets so no content hides under the
  status bar / notch / Dynamic Island or a rounded corner:
  ```
  padding-top: env(safe-area-inset-top, 0px);
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
  padding-bottom: var(--ui-tabbar-h);   /* unchanged — carries the bottom inset */
  ```
- `.ui-tabbar` — added `padding-left/right: calc(var(--ui-s2) + env(safe-area-inset-left/right, 0px))`
  so the tabs stay out of the notch/rounded corner in landscape. Bottom clearance
  (`env(safe-area-inset-bottom)`) was already present and is unchanged.
- `.ui-subbar__link` (Workout "Routines" strip) — side padding now adds the
  left/right insets for landscape. Its bottom clearance is unchanged: it docks at
  `bottom: var(--ui-tabbar-h)`, which already includes the bottom inset.
- `.ui-inprogress` — a11y fix: the "in progress" status text (13px, meaningful)
  moved from `--ui-ink-3` to `--ui-ink-2` to meet WCAG AA for normal text.

### Contrast audit (measured)

Relative-luminance / WCAG contrast against `--ui-bg #ffffff`
([measured] `node scratchpad/contrast.mjs`):

| token | hex | ratio | AA normal (4.5) | AA large (3.0) |
|-------|-----|-------|-----------------|----------------|
| `--ui-ink-2` | `#6b6b6b` | **5.33:1** | pass | pass |
| `--ui-ink-3` | `#8e8e8e` | **3.28:1** | fail | pass |
| `--ui-line`  | `#d1d1d1` | 1.53:1 | n/a (hairline, not text) | n/a |

`--ui-ink-2` passes at every size — no change. `--ui-ink-3` fails AA for normal
text. Its three uses were triaged rather than repainting the token:
- `.ui-btn:disabled` — disabled control text, **exempt** under WCAG 1.4.3.
- `.ui-row__chev` (the `›` glyph) — a graphical affordance; 3.28:1 clears the
  1.4.11 non-text threshold (3:1). Left as-is.
- `.ui-inprogress` — the only **meaningful small text** on `ink-3`; moved to
  `ink-2` (5.33:1, passes). This is the one fix.

So `ink-3` stays the tertiary/disabled tier (correctly lighter for disabled
state); no failing meaningful text remains.

### env()-driven, not a magic number (the failure case)

All added spacing is `calc(... + env(safe-area-inset-*, 0px))` or bare `env(...)`.
The fallback is `0px`, so a device with **no** inset (older iPhone, non-notch, or
a browser that ignores the variable) gets **zero** extra space — no dead band.
Locked by a static test.

### What I verified

`./check` — full gate:
```
check: green — lint, 16 test file(s), and the build all passed.
```

New test `src/ui/safe-area.test.js` (5 assertions, all pass) locks the criteria
checkable without a device: `viewport-fit=cover` present; `.ui-main` top/left/right
are env()-driven; the top inset is `env(...)` only (no hardcoded px); the bottom
chrome still uses `env(safe-area-inset-bottom)`; `.ui-inprogress` uses `ink-2` not
`ink-3`.
```
# tests 5  # pass 5  # fail 0
```

### What only a real device can verify (Emilio's after-check)

- Standalone / added-to-home-screen on a Dynamic-Island/notch iPhone: the tab bar
  sits **above** the home indicator with no clip (the reported bug).
- The screen title / first content is **not** under the status bar or notch.
- Landscape on a notch iPhone: tabs and the Routines strip clear the side notch.
- A no-notch device / portrait shows **no** extra top or side gap (the failure case).

## Workflow

- **No spec deviation.** Built exactly to `req-51`. All open implementation
  choices the spec left to CC are noted below.
- **Choice — top/side insets on `.ui-main` (not `.ui-screen`).** `.ui-main` is
  the single shell wrapper (`App.jsx:219`) every screen renders into; `.ui-screen`
  is per-screen and centered with `max-width`. Putting insets on `.ui-main` fixes
  every screen in one place. Consistent with how the bottom inset already lives on
  `.ui-main`.
- **Choice — did NOT add `apple-mobile-web-app-*` / `theme-color`.** The spec made
  these optional and "flag first". They change standalone chrome appearance and
  aren't needed for the insets/clip fix, so I left them out. Flagging: if Emilio
  wants the standalone status bar styled (e.g. a matching white/translucent bar),
  that's a small follow-up.
- **Choice — fixed only `.ui-inprogress` for contrast, not the `ink-3` token
  globally.** Darkening the token would wrongly darken disabled-button text (which
  should read as disabled and is contrast-exempt). See the audit above.
- **Edge case surfaced (not fixed — flagging).** The three error banners
  (`SaveFailedBanner`, `LoadUnreadableBanner`, `ExternalChangeBanner`,
  `App.jsx:27-73`) render as **siblings before** `<main>`, so they are outside the
  `.ui-main` top-inset padding and would sit under the status bar in standalone
  when they appear. They are rare error states and are unstyled plain `role="alert"`
  divs (no `ui-` classes) — styling them belongs with the bottom-menu/redesign work
  (req-52), not this insets fix. Worth a note so it isn't a surprise.
