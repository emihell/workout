# req-21 — `subtitle` prop on `Title`

## Technical

`src/ui/index.jsx` — `Title` gains an optional `subtitle`. It renders the existing
`.ui-sub` markup after the `<h1>`; the guard `subtitle != null && subtitle !== ''`
means empty/null renders just the `<h1>`, byte-identical to a bare `Title`. Wrapped
in a fragment so the pair is one header unit. `.ui-sub` (in `ui.css`) is unchanged
and still valid for standalone uses.

Added a Showcase entry ("Title + subtitle") showing both the with- and without-
subtitle cases.

### Demo migrations (2)

Converted two provably byte-identical `Title` + single-`.ui-sub` sites:

- `Workout.jsx:130` — `{previewMeta ? <p className="ui-sub">{previewMeta}</p> : null}`
  → `<Title subtitle={previewMeta}>{plan.routineName}</Title>`. `previewMeta` is a
  `.filter(Boolean).join(' · ')` string; its truthy guard maps exactly onto the
  prop's null/empty guard (empty string → nothing in both).
- `Today.jsx:66` — a literal-string caption under `<Title>Today</Title>` → the prop.
  Unconditional string, identical render.

### Not migrated, and why

Of the `.ui-sub` occurrences in `src/views` (48 after this change; started at 50):

- **Most are not title subtitles.** The bulk are standalone empty-state captions
  bound to list length (`{list.length === 0 ? <p className="ui-sub">None.</p> : null}`,
  "No matches.", "Loading…") or multi-line meta blocks — logically list/section
  captions, not a caption bound to the screen title. These correctly stay raw
  `.ui-sub`, and they are the evidence that keeping the utility class matters
  (the finding's "almost always Title then p.ui-sub" overstated it).
- **10 sites still have a `<Title>` immediately followed by a `.ui-sub`**, but I
  left them: several of those are the empty-state pattern that just happens to sit
  under a title (`History.jsx:226/249/506`, conditional on `length === 0` — not a
  title caption), and the rest are multi-line `<p>` blocks (`History.jsx:388/611`,
  `Workout.jsx:808`) or an always-rendered caption over a possibly-empty value
  (`Workout.jsx:554`, `<p>{ex.equipment}</p>` — empty equipment renders an empty
  `<p>` today, which the prop's guard would drop, so **not** byte-identical). A
  full caller sweep is a separate follow-up per the spec.

Implementation choices the spec left open: migrated 2 screens (the two provably
identical ones); added the Showcase entry.

### Receipts

`./check`:

```
# tests 105 ... # pass 105 # fail 0
check: green — lint, 13 test file(s), and the build all passed.
```

Build passing confirms `Showcase.jsx` and both migrated screens compile.

## Workflow

No deviation. The prop-vs-component decision was already made in the spec (prop) —
I agree on the evidence and did not switch. One thing worth surfacing for the
planning session: the finding #6 framing ("`.ui-sub` almost always appears as
`Title` then `p.ui-sub`") does not match the code — most of the 50 are empty-state
list captions, not title subtitles. So the eventual caller sweep is smaller than
"~50 → prop"; realistically only a handful of screens have a true title-bound
caption. The utility class earns its keep. Might be worth a `DEC-`/note.

Could not verify myself (needs a browser — planning's eyeball gate): that the two
migrated screens (routine preview header, empty Today) look pixel-identical to
their pre-migration `.ui-sub` version, and the Showcase "Title + subtitle" block
renders as expected. No test edits, no persisted-data touch.
