# req-20 — let a link `Row` carry a right-aligned `value` beside its chevron

**Status: READY.** Small additive `ui/` primitive fix. Sourced from `reports/req-15-findings.md` #4
(DEC-021).

**Gate: code-only** (DEC-009, functional), but it touches `ui/Row` which many screens use — planning
browser-checks the affected lists and merges. Mind the domino rule: `Row` is shared.

## Why

[measured] `Row` (`src/ui/index.jsx:167`) ignores `value` when `to` is set:

```jsx
export function Row({ children, value, to }) {
  if (to) {
    return (<li className="ui-row"><NavLink to={to} className="ui-row__link">
      <span>{children}</span><span className="ui-row__chev">›</span></NavLink></li>)
  }
  return (<li className="ui-row"><span>{children}</span>
    {value != null ? <span className="ui-row__value">{value}</span> : null}</li>)
}
```

A **plain** row can show a right-aligned `value`; a **link** row (`to` set) renders only
`children + ›` and drops `value`. So overview / history / month rows that are links had to inline
their meta into the row text (e.g. `{name} — {role}`) instead of aligning it right like plain rows
do. The comment above `Row` even documents `value` as a general affordance — the link branch just
doesn't honour it.

## The change

Render `value` (right-aligned) in the link branch too, laid out as: `children … value ›`. Keep the
chevron last. When `value` is null the link row looks exactly as it does today (no empty span).

CSS: reuse `.ui-row__value`; adjust `.ui-row__link` layout if needed so `value` and `›` sit together
at the right (flex). Keep the ≥44px row height and existing look for value-less links unchanged.

## Scope

- `Row`'s `to` branch renders `value` when provided.
- `ui.css` tweak so a link row's `value` + chevron align right without breaking value-less rows.
- **Optional, only if trivially clean:** convert 1–2 existing link rows that inlined their meta into
  the text over to `value=` as a demonstration (e.g. workout-overview or history rows). If any such
  conversion changes wording or wrapping, leave it and just note the candidates — the primitive fix
  is the req; migrating callers is not required.

## Out of scope

- A sweep converting every inlined-meta link row — that's caller cleanup, follow it later.
- `ActionRow` / trailing-button rows (req-23) — different pattern (a `<Button>` in `value`).

## Acceptance criteria (written before implementation)

- **Value-less links unchanged:** existing link rows (Today, Schedule, etc.) look identical — same
  `children + ›`, no stray element. Planning eyeballs in-browser.
- **Value renders on links:** a link row given `value` shows it right-aligned before the chevron,
  tappable area still covers the whole row. Demonstrated on at least one real screen or in the
  `ui/Showcase.jsx`.
- **No regression:** `./check` green (paste the line); `ui/Showcase.jsx` still renders; every existing
  `Row` call still compiles.

## Decisions

- **behaviour:** none open — "link rows may also show `value`" is the fix. Whole-row tap target must
  stay (don't let `value` become a separate click target).
- **implementation (CC's call, note in report):** exact flex layout for `children / value / ›`;
  whether to add a Showcase example; which (if any) callers to convert as the demo.
