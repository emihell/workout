# req-123 — type tokens, Showcase gaps, dead CSS, tap targets, long names (audit Tier 2)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[ux-feel]** CSS and Showcase only. No stored data.

## Why [measured, re-verified on main 4172e3d]

- `ui.css:625` `.ui-timer__count` uses `var(--ui-fs-lg, 1.25rem)`. `--ui-fs-lg` is never defined, so it's always 20px,
  off the scale. `ui.css:592` `.ui-restpill__time` hardcodes `28px`. Both contradict `ui.css:45` ("no ad-hoc font-size").
- `.ui-showcase__row` (`ui.css:724`) is used nowhere.
- Showcase renders only the primary Button. It doesn't show secondary/quiet/block, NavLink looks, the Actions row,
  `ui-row--done` or a standalone SectionHeader.
- `.ui-addnote` (`ui.css:674`: `min-height:auto`, 4/8px padding, 13px) is about 22px tall on the in-gym screens,
  below the 44px floor promised at `ui/index.jsx:3`.
- Long unbroken names overflow at 390px (measured `scrollWidth` 714 and 1074; there is no `overflow-wrap` in ui.css).

## The behaviour

1. Add a scale token for the rest-pill number (`--ui-text-emphasis: 28px`) and use it. The timer count uses an existing
   token (`--ui-text-section`, 22px) **(unconfirmed: the countdown gets 2px bigger)**. Fix the `ui.css:45` comment
   if needed.
2. Delete `.ui-showcase__row`.
3. Showcase: every Button variant plus `block`, the NavLink looks with back/forward chevrons, an Actions row,
   `ui-row--done`, SectionHeader.
4. **"Add note" gets a ≥44px tap area** while looking the same size (invisible padding or `min-height` with the text
   centred) **(unconfirmed)**. The same applies to any other in-gym control under 44px the builder measures.
5. `overflow-wrap: anywhere` on titles, row labels and names, so a 60-character unbroken name wraps at 390px.

## Scope

`ui/ui.css`, `ui/Showcase.jsx`, tests (a CSS/static test in the `safe-area.test.js` pattern).

## Order vs siblings

Last of Tier 2 (after req-122's Showcase additions).

## Acceptance criteria

- **Static:** no `--ui-fs-lg`, no raw `px` font-size in ui.css outside the token block; `.ui-showcase__row` gone.
- **Measured (puppeteer):** "Add note" `getBoundingClientRect().height >= 44` on the log screen and the overview.
  A 60-character unbroken exercise name → `scrollWidth <= 390` on the routine detail and exercise detail.
- **Failure case — no visual jump:** screenshots of the log screen before/after show Add note the same visual size.
- **Showcase screenshot** shows every item in behaviour 3.
- **No regression:** `./check` green (receipt quoted).

## Decisions

- Token names are implementation. The timer count size and the invisible tap area are **(unconfirmed)**.
