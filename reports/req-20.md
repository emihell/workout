# req-20 — link `Row` carries a right-aligned `value`

## Technical

`src/ui/index.jsx` — the `to` branch of `Row` now renders `value` between the
label and the chevron, laid out `children … value ›`, chevron last. Null `value`
renders nothing (same guard as the plain branch), so a value-less link emits no
stray element. The children span gained a class (`ui-row__label`) so the CSS can
target it; the plain branch is untouched.

Updated the doc comment above `Row` — it previously said only plain rows carry a
`value`.

`src/ui/ui.css` — added `.ui-row__link > .ui-row__label { flex: 1 1 auto; min-width: 0 }`.
The label fills the row, grouping `value` + chevron at the right with the existing
`gap`. Reused `.ui-row__value` (no new value styling). The ≥44px row height
(`--ui-tap`) is unchanged. `justify-content: space-between` is left in place —
harmless once the label grows to fill.

**Why value-less links stay pixel-identical:** with only label + chevron, `flex:1`
makes the label occupy the free space that `space-between` previously left empty —
the label still begins at the left edge, the chevron still sits at the right, text
stays left-aligned. `min-width: 0` only bites when `value` is present and the row
is under width pressure (lets the label ellipsis/wrap instead of pushing `value`
off); with no `value` there is no pressure, so nothing shifts.

`src/ui/Showcase.jsx` — added one demo row (`<Row to="/exercises" value="12">`)
beside the existing link and plain-value rows, so the three cases sit together.

The whole-row tap target is preserved: `value` is a `<span>` inside the same
`NavLink`, not a separate click target.

Implementation choices the spec left open: added the Showcase demo; did **not**
convert any real inlined-meta caller (overview/history rows) — those inline
`{name} — {role}` as free text, and moving the meta to `value=` would change
wording/wrapping, which the spec says to leave. Candidates for a later caller
sweep: `Workout.jsx` overview rows (`{exerciseName} — {role} · done`), History
month/day rows.

### Receipts

`./check`:

```
# tests 105 ... # pass 105 # fail 0
check: green — lint, 13 test file(s), and the build all passed.
```

Build passing confirms `Showcase.jsx` and every existing `Row` call still compile.

## Workflow

No deviation. Additive primitive fix only; no caller migration (correctly out of
scope per the spec, since every candidate would change wording). No test edits,
no persisted-data touch.

Could not verify myself (needs a browser — planning's eyeball gate): that
value-less link rows render byte-for-byte as before, and that a link row's `value`
sits right-aligned before the chevron with the whole row still tappable. The
reasoning above is why I expect both to hold; the Showcase page (`/__showcase` or
wherever it mounts) shows all three row variants for a direct compare.
