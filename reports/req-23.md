# req-23 — `action` prop on `Row` (trailing-action pattern)

## Technical

`src/ui/index.jsx` — `Row` gains an optional `action` prop. In the plain (non-link)
branch it renders a trailing `<span className="ui-row__action">` after `children`
(and after `value` if present). Off by default, so `value`-only and plain rows are
unchanged. Link rows do **not** accept `action` — no current caller needs a trailing
button on a `to` row (out of scope; noted below that none wants it).

`src/ui/ui.css` — added `.ui-row__action { display:flex; align-items:center; gap: var(--ui-s2) }`.
The slot is pushed right by the row's existing `justify-content: space-between`
(same mechanism that positioned the old `value={<Button>}`), so a single-button row
sits pixel-identically where it did. The `gap` only matters when the slot holds
more than one control (Routine Up/Down) — see the one deliberate visual change below.

### `value` + `action` interaction rule (my call, per spec)

Both may be passed; they render in order **`children … value action`** (value, the
informational slot, before action, the control slot). They are not mutually
exclusive in the primitive — `Today` passes both props, though its two values are
mutually exclusive by its own logic (a row is either done *or* startable). Callers
that only need one pass only one.

### Migrated sites (5)

All were `value={<control>}` faking a trailing action; now `action=`:

- `Start.jsx:25` — drafts **Resume** button.
- `Schedule.jsx:121` — day-slot **Remove** button.
- `Routine.jsx:132` — **Up**/**Down** pair (a fragment of two buttons).
- `Exercises.jsx:234` — **Add** button / **Add to routine**·**Already added** NavLink.
- `Today.jsx:43` — split: the polymorphic `value={action}` there was a union of a
  `Done …` **string** (informational) | `null` | a `<Button>`. Migrated as
  `value={doneLabel}` (the string stays informational) + `action={startAction}`
  (the button). Behaviour identical: done shows the muted `Done …` in the value
  slot, startable shows the button in the action slot, in-progress shows neither.

### Not migrated (reported, per spec — "whether any caller is left on `value`")

- `Schedule.jsx:176` (the "assign" row) — the `<Button>{routine.name}</Button>` is
  the row's **children** (the primary tappable label), with `value={routine.focus}`
  as the informational meta. It is *not* a trailing-action row, so `action=` doesn't
  fit — moving the button right would empty the label. Left as-is. The finding
  listed it as an assign site, but on inspection the button is the row content, not
  a trailing control.
- `Start.jsx:53`, `Today` done case — `value="Done …"` informational strings, stay
  `value` (not controls). Correct as-is.

No caller wants a trailing action on a **link** row, so I did not build that.

`src/ui/Showcase.jsx` — added two trailing-action rows to the "Grouped list + row"
block: a single-button `action={<Button>Start</Button>}` and a two-button Up/Down
row, so the alignment and multi-control gap are both visible.

### One deliberate visual change (flag for browser check)

Routine's **Up/Down** buttons previously sat in a bare `<span className="ui-row__value">`
with no gap between them (adjacent inline buttons). In `.ui-row__action` they now
have `gap: var(--ui-s2)` between them — the consistency the req is *for*. The four
single-button rows (Resume/Remove/Add/Start) are pixel-identical; only Up/Down gains
inter-button spacing. Calling it out since acceptance says "exactly as today" but the
req's stated point is consistent spacing.

### Receipts

`./check`:

```
# tests 105 ... # pass 105 # fail 0
check: green — lint, 13 test file(s), and the build all passed.
```

`grep` confirming no trailing-action `value={<Button>}` remains (only Today's new
`value={doneLabel} action={startAction}` shows, plus Schedule:176's children-button
which is correctly left):

```
Today.jsx:45:    <Row value={doneLabel} action={startAction}>
Schedule.jsx:176:  <Row key={routine.id} value={routine.focus}>   (button is children — left)
```

Build passing confirms Showcase and all five migrated screens compile.

## Workflow

Followed the spec's decision (prop on `Row`, not a new `ActionRow`) — the prop reads
cleanly, no reason to propose the component alternative.

Deviations worth surfacing:
- **Schedule "assign" (176) not migrated** — the finding listed it, but its button is
  the row's children, not a trailing action. Left it; noted above. Not a gap, a
  correction to the finding's site list (like req-21's #6 correction).
- **Today's `value` was polymorphic** (string | null | Button) — split into `value` +
  `action` rather than shoving a string through `action`. This is the concrete case
  that justifies the "both props, `value` then `action`" interaction rule.
- **Up/Down now has an inter-button gap** — a real (small) visual change, the
  intended consistency win; flagged for the browser gate.

No test edits, no persisted-data touch, no behaviour/handler/label changes to any
button.

Could not verify myself (needs a browser — planning's eyeball gate): that Today's
Start/Resume/Done/Continue, Start drafts, Schedule Remove, Routine Up/Down, and
Exercises Add all render and work as before; that the trailing control aligns
consistently across those screens; and that value-only rows are unchanged. The
Showcase "Grouped list + row" block now shows single- and multi-control action rows
for direct comparison.
