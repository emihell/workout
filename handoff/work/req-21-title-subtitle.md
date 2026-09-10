# req-21 — a first-class subtitle: `subtitle` prop on `Title`

**Status: BUILT AND MERGED, 2026-09-10 — branch `req-21` (`658f498`…`658f498`, 1 commit).** Small additive `ui/` primitive. The finding left "component vs prop" open;
**decided here: a `subtitle` prop on `Title`** (rationale below). Sourced from
`reports/req-15-findings.md` #6 (DEC-021).

**Gate: code-only** (DEC-009, functional) — additive; planning verifies a couple of screens and
merges.

## Why

[measured] the `.ui-sub` line — a muted caption under the screen title — appears **50 times** across
`src/views/*.jsx` (`grep -rn "ui-sub" src/views | wc -l`), almost always as `<Title>…</Title>` then
`<p className="ui-sub">…</p>`. `.ui-sub` was added as a raw utility class during req-15; the frequency
(nearly every screen) now shows it wants a named element so screens stop hand-writing the class and
the markup stays consistent.

**Decision — `subtitle` prop on `Title`, not a separate `Subtitle` component.** The subtitle is
almost always bound to the title (title + one caption line, as a header unit); a prop keeps the pair
in one element and one place to restyle, and avoids a second component callers must remember to pair.
A standalone `Subtitle` would also be legitimate; the prop is the lighter call and matches how the
pair is actually used. (If CC finds real cases where a subtitle appears **without** a title directly
above it, note them — those stay as `.ui-sub` and argue for keeping the utility class too.)

## The change

`Title` gains an optional `subtitle`:

```jsx
export function Title({ children, subtitle }) {
  return (<>
    <h1 className="ui-title">{children}</h1>
    {subtitle != null && subtitle !== '' ? <p className="ui-sub">{subtitle}</p> : null}
  </>)
}
```

Keep `.ui-sub` as-is (the prop renders the same class, so nothing that still uses the raw class
breaks). Migrating callers is **optional** — see scope.

## Scope

- Add the `subtitle` prop to `Title` (`ui/index.jsx`), rendering the existing `.ui-sub` markup.
- Keep the `.ui-sub` utility class defined and working for standalone/multi-line uses.
- **Optional demo migration:** convert a handful of the simplest `Title` + single-`.ui-sub`-line
  screens to the prop, to prove it and set the pattern. Do **not** attempt all 50 here — a caller
  sweep is its own follow-up, and multi-line or conditional subtitles should stay as-is.

## Out of scope

- A full sweep replacing every `.ui-sub`. Note the count converted vs remaining in the report.
- Any visual restyle of the subtitle — same look as today's `.ui-sub`.

## Acceptance criteria (written before implementation)

- **Prop works:** `<Title subtitle="x">T</Title>` renders the title then one `.ui-sub` line; with no
  `subtitle` (or empty) it renders just the `<h1>`, byte-identical to today. Shown in `ui/Showcase.jsx`.
- **No visual change:** a screen migrated to the prop looks pixel-identical to its `.ui-sub` version
  (planning eyeballs one migrated screen in-browser).
- **Raw class still valid:** screens still using `<p className="ui-sub">` render unchanged.
- **No regression:** `./check` green (paste the line); Showcase renders.

## Decisions

- **behaviour/design:** the prop-vs-component call is made above (prop). If CC disagrees on evidence
  (many title-less subtitles), report it rather than switching unilaterally.
- **implementation (CC's call, note in report):** which demo screens to migrate; whether to also add
  a Showcase entry.
