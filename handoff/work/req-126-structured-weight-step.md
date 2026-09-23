# req-126 — weight step: a number plus an alternating option; catalog doesn't invent one (audit Tier 3, DEC-059 §2)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[P]**: touches `progress.js` (DEC-057: reviewer +
backup reminder). No stored-data rewrite: the field keeps its string form.

## Why [measured, audit setup reviewer]

`weightStep` is free text (`Exercises.jsx:298`, `workout/setup.jsx:60`). `validWeights` (`progress.js:3-24`) only
understands a plain number or the exact string `"Alt 4/5"`; `"2,5"`, `"4/5"`, `"5 kg"` → `[]` (a silent hold).
`exerciseCatalog.js:131` invents `'5'` for machines and `'2'` for free weights on import. The new-exercise editor
defaults to `'2.5'` (`Exercises.jsx:255`).

## The behaviour

1. The exercise editor (and the in-workout setup screen) shows **"Increment (kg)"**, a decimal field (comma or dot,
   as req-118), plus an **"Alternating (4/5)"** checkbox that disables the number. Saved as the same strings as today:
   `"2.5"`, `"Alt 4/5"`, or `"n/a"` when empty.
2. `validWeights` also reads an existing stored `"2,5"` (comma decimal) and `"2.5 kg"`, so stored free-text values
   already on devices work. Nothing on disk is rewritten.
3. Catalog import and new exercises default to **empty** (`"n/a"`), not a guess. The editor defaults to empty too
   **(unconfirmed)**.
4. The exercise detail line shows "Increment 2.5 kg" / "Alternating 4/5" instead of the raw string **(unconfirmed)**.

## Scope

`src/progress.js` (`validWeights`), `src/exerciseCatalog.js`, `src/views/Exercises.jsx`, `src/views/workout/setup.jsx`,
a shared pure parser (reuse req-118's decimal parsing), tests.

## Order vs siblings

After req-125. Before req-127 (both edit `Exercises.jsx`).

## Acceptance criteria

- **Unit:** `validWeights({weightStep:'2,5'})` = the 2.5 series; `'2.5 kg'` the same; `'Alt 4/5'` unchanged; `'n/a'`,
  `''`, `'abc'` → `[]`.
- **Failure case — existing data (unit):** every weightStep value in `src/db.json` gives the same `validWeights` as on
  main, except those that newly parse (list them in the report).
- **Catalog (unit):** an imported machine/free exercise has `weightStep: 'n/a'`.
- **Browser:** enter "2,5" → saved `"2.5"`; tick Alternating → saved `"Alt 4/5"`.
- `./check` green (receipt quoted).

## Decisions

- Number + Alternating (Emilio, DEC-059 §2). Editor default empty, and the display wording **(unconfirmed)**.
