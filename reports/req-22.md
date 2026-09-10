# req-22 — `clearable` prop on `SegmentedControl`

## Technical

`src/ui/index.jsx` — `SegmentedControl` gains a `clearable` prop. When set, it
prepends the leading "none" segment (`{ value: '', label: '—' }`) to `options`
before mapping; off by default, so every non-clearable control is untouched. The
existing `options`/`value`/`onChange`/`ariaLabel` API and the map/selection logic
are unchanged — the prepended segment goes through the exact same code path the
callers' hand-rolled option did, so behaviour is byte-equivalent:

```js
const segments = clearable ? [{ value: '', label: '—' }, ...options] : options
```

Selection of the `—` segment uses the existing `String(optValue) === String(value)`
test, identical to before (value `''` selects it; picking it fires `onChange('')`).

Converted the three hand-rolled sites to `clearable` + plain options:

- `History.jsx:432` — "Feel" toggle, inline `['Easy','Good','Hard','Exhausting']`
- `History.jsx:573` — "Effort" (`RPE_OPTIONS`)
- `Workout.jsx:739` — "Effort" (`RPE_OPTIONS`)

Added a Showcase block "Segmented control (clearable)" beside the existing one.

Implementation choices the spec left open: kept the `—` label fixed (not a prop) —
it's the single convention and no site needs a different one; prop name `clearable`
had no collision. No site used a different empty sentinel — all three used `''`,
so nothing to normalise or report.

### Receipts

`grep -rn "label: '—'\|label:'—'" src/views`:

```
(none — idiom gone)
```

`./check`:

```
# tests 105 ... # pass 105 # fail 0
check: green — lint, 13 test file(s), and the build all passed.
```

Build passing confirms Showcase and all three converted sites compile.

## Workflow

No deviation. Additive primitive + three-site conversion + Showcase, exactly as
specced. No behaviour change (the prepended segment is the callers' former option,
same code path), no test edits, no persisted-data touch.

Could not verify myself (needs a browser — planning's eyeball gate): that the Feel
toggle and the two Effort controls still show a leading `—`, still clear to empty,
and still select correctly; and that non-clearable controls show no stray `—`. The
Showcase page shows the clearable and non-clearable variants side by side.
