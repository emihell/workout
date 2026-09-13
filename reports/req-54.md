# req-54 — Bottom menu "Workout" oval uses the wrong font

## Technical

- `src/ui/ui.css`: added `font-family: var(--ui-font);` to the `.ui-dock__btn`
  rule (between `min-height` and `font-size`). The dock (`.ui-dock`) is a
  sibling `<nav>` of `.ui-screen`, so it does not inherit `--ui-font`; the button
  set `font-size`/`font-weight` but no family, leaving the "Workout" word in the
  browser default. Icons are SVG, so only that word was affected.
- One-line change, exactly as specced. No other dock styling touched.
- Verified: `./check` green — `check: green — lint, 17 test file(s), and the
  build all passed.` (194 tests pass, build succeeds.)

## Workflow

- No deviations. Scope, out-of-scope, and the single declaration all matched the
  requirement. No new decisions; the spec marked implementation as "none beyond
  adding the declaration."
- Visual confirmation (the "Workout" oval rendering in `--ui-font` by eye)
  requires a browser and is left for Emilio.
