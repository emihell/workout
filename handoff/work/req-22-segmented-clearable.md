# req-22 — a `clearable` affordance on `SegmentedControl`

**Status: BUILT AND MERGED, 2026-09-10 — branch `req-22` (`4303905`…`4303905`, 1 commit).** Small additive `ui/` primitive. Sourced from `reports/req-15-findings.md` #7
(DEC-021).

**Gate: code-only** (DEC-009, functional) — additive; planning verifies the three call sites and
merges.

## Why

[measured] the "clearable segmented control" is hand-rolled by prepending a `—` option in **three**
places:

- `src/views/History.jsx:434` — `{ value: '', label: '—' }`
- `src/views/History.jsx:574` — `options={[{ value: '', label: '—' }, ...RPE_OPTIONS]}`
- `src/views/Workout.jsx:747` — `options={[{ value: '', label: '—' }, ...RPE_OPTIONS]}`

(`History.jsx:432/560/573` and `Workout.jsx:746/839` are the surrounding `SegmentedControl` uses.)

Each spells out the same `[{value:'',label:'—'}, ...opts]` idiom to mean "this control can be set back
to nothing". [measured] `SegmentedControl` (`src/ui/index.jsx:38`) has no first-class notion of
clearable — it just maps `options`, so callers fake the empty choice.

## The change

Add a `clearable` prop to `SegmentedControl` (`ui/index.jsx`). When `clearable` is set, the control
itself renders the leading "none" segment (`—`, `value: ''`) ahead of `options`, selected when the
current `value` is `''`/null; picking it fires `onChange('')`. Callers then pass plain `options` +
`clearable` instead of hand-prepending.

Keep the existing `options`/`value`/`onChange`/`ariaLabel` API and current styling; `clearable`
defaults to off so every existing non-clearable use is untouched. The `—` label and empty-string
"none" value stay the convention (match today's behaviour exactly).

## Scope

- `clearable` prop on `SegmentedControl` that renders/handles the leading `—` (`value:''`) segment.
- Convert the **three** call sites above to `clearable` + plain `options`.
- A Showcase entry demonstrating a clearable control.

## Out of scope

- Any change to how a cleared value is stored or what `''` means downstream — the emitted value for
  "none" stays `''`, identical to today.
- The set-edit-form merge (req-18); if it lands first, its shared form uses this `clearable` prop.

## Acceptance criteria (written before implementation)

- **Parity at the three sites (planning, in-browser):** the History set-type toggle and the two
  effort/RPE controls still show a leading `—`, still clear to empty, and still select correctly —
  identical behaviour, now via `clearable`.
- **Non-clearable unchanged:** every other `SegmentedControl` (no `clearable`) renders exactly as
  today — no stray `—` segment.
- **Idiom gone:** `grep -rn "label: '—'\|label:'—'" src/views` returns nothing (the hand-rolled
  option is gone) — paste it.
- **No regression:** `./check` green (paste the line); Showcase renders.

## Decisions

- **behaviour:** none — "none" stays `value:''` with a `—` label. If any of the three sites relies on
  a different empty sentinel, report it rather than normalising silently.
- **implementation (CC's call, note in report):** prop name if `clearable` collides; whether the
  "none" label is fixed `—` or itself a prop (default `—`).
