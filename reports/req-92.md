# req-92 — rest pill bigger / more legible

Branch: `req-92` (off `main`). CSS-only, no data/logic change.

## Technical

- `src/ui/ui.css` `.ui-restpill` and `.ui-restpill__time`:
  - Time font-size **28px** (was inherited ~17px body), `line-height: 1`, keeping
    `font-weight: 700` + `font-variant-numeric: tabular-nums` (countdown doesn't
    jitter). 28px sits between body (17px) and title (32px) — clearly larger,
    readable at arm's length.
  - Pill padding **`var(--ui-s2) var(--ui-s4)`** (8px / 24px; was `s1 s3` = 4px /
    16px) so the pill grows with the larger digits.
  - `.ui-restpill__skip` unchanged (caption 13px, 0.75 opacity) — the "rest · skip"
    hint stays secondary.
- Position, `align-items: baseline`, `z-index`, top-centre placement, the
  tap-to-skip behaviour (req-78) are all unchanged. No ±30s / pause added — DEC-048
  stands.

## Verified

- `./check` green — lint, 261 tests, build all passed.
- Sizes are static CSS; behaviour untouched.

## Could not verify from here (browser / real device — for Emilio)

- That the larger pill does **not** overlap the next-set fields or Complete on a
  narrow phone during rest (the spec's key watch-out). It's `position: fixed`
  top-centre and Complete is pinned to the bottom, so overlap is unlikely, but it
  needs eyes on a real rest countdown at phone width.
- Whether 28px is the right "clearly bigger" — easy to nudge; the value is isolated
  in `.ui-restpill__time`.

## Workflow

- No scope change. Exact sizes were left to me by the spec ("within clearly bigger,
  still doesn't overlap"); chose 28px + roomier padding. If Emilio wants it bigger
  still, it's a one-line change.
