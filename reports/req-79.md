# req-79 — done/not-done contrast in the active exercise list

Branch: `req-79`. `./check` green (lint + 218 tests / 19 files + build).

## Technical

**Problem:** in the active-workout overview (`views/workout/overview.jsx`), done and
not-done exercises looked nearly identical — the only difference was a `· done` text
suffix, so the eye couldn't find remaining work mid-workout.

**Change:**
- `src/ui/index.jsx` — `Row` gained an optional `className` prop (default `''`),
  appended to the row's own `ui-row` class. Additive and backward-compatible: every
  existing caller renders exactly `ui-row` as before. This is the one shared-code touch;
  it's the idiomatic way to let a caller add a row modifier without duplicating the
  component.
- `src/views/workout/overview.jsx:108` — the active-workout item row passes
  `className={completed ? 'ui-row--done' : ''}` (`completed` unchanged:
  `itemIsMarkedDone(active, item) || itemLoggingState(active, item).plannedDone`). The
  `· done` suffix is kept — this adds visual contrast, it doesn't change meaning or text.
- `src/ui/ui.css` — `.ui-row--done { opacity: 0.45 }`. Opacity dims the whole row
  uniformly (label, value, chevron) and works in both light/dark themes without
  per-token overrides.

**Scope respected:** overview row styling only — no reorder, no data change, "done"
keeps its meaning.

**Domino check (shared `Row`):** callers across the app render `<Row>` without a
`className`; with the default `''`, `rowClass` is exactly `ui-row`, so nothing else
changes. `.ui-row--done` is a new class used only by the overview.

**Acceptance criteria:**
- *Contrast (browser)* — done rows carry `ui-row--done` (opacity 0.45); not-done rows
  are full-emphasis `ui-row`. Verify in browser.
- *Edge: all done* → every row muted (each gets the class); *none done* → no row gets
  the class, all full emphasis. Follows directly from the per-row `completed` flag.
- *No regression* — `./check` green.

## Workflow

- Implementation choices (spec left the visual open): (1) de-emphasis via `opacity: 0.45`
  on the whole row rather than a color-token swap — uniform, theme-safe, and dims the
  chevron too; (2) kept the `· done` suffix rather than replacing it, since the req said
  "done keeps its meaning" and removing text wasn't asked for.
- One shared-component touch (`Row` gained optional `className`). Minimal and additive;
  flagging it because CLAUDE.md's domino rule covers shared view helpers. No `DEC-`/`L-`
  warranted; no data/schema change.
