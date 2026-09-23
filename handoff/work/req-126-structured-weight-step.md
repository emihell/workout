# req-126 — weight step: a number plus an alternating option; catalog doesn't invent one (audit Tier 3, DEC-059 §2)

**Status: BUILT AND MERGED, 2026-09-23 — branch `req-126` (`aeaa830`…`2cb2be2`, 2 commits).** Phase 1. **[P]**: touches `progress.js` (DEC-057: reviewer +
backup reminder). No stored-data rewrite: the field keeps its string form.

## Why [measured, audit setup reviewer]

`weightStep` is free text (`Exercises.jsx:298`, `workout/setup.jsx:60`). `validWeights` (`progress.js:3-24`) only
understands a plain number or the exact string `"Alt 4/5"`; `"2,5"`, `"4/5"`, `"5 kg"` → `[]` (a silent hold).
`exerciseCatalog.js:131` invents `'5'` for machines and `'2'` for free weights on import (manual add already saves
`n/a`, `Exercises.jsx:160`; `'2.5'` at `:255` is only ExerciseEdit's fallback for a missing field).

## The behaviour

1. The exercise editor (and the in-workout setup screen) shows **"Increment (kg)"**, a decimal field (comma or dot,
   as req-118), plus an **"Alternating (4/5)"** checkbox that disables the number. Saved as the same strings as today:
   `"2.5"`, `"Alt 4/5"`, or `"n/a"` when empty.
2. **One single-value parser** (comma → dot, optional `kg` suffix, must be > 0; a `/` is an error), used by both
   editors and by `validWeights`. It is **not** req-118's `parseKg`, which splits on `/`. `validWeights` then also
   reads stored `"2,5"`, `"2.5 kg"`, `"5 kg"`. Nothing on disk is rewritten. **(unconfirmed)** Those values now move the
   recommendation (and, via recalc Apply, routine weights) instead of silently holding.
2b. **An unparseable stored value** (e.g. `"4/5"`, `"abc"`) opens in the editor with an inline note ("Can't read
   'abc' — enter an increment") and is **left unchanged** on Save unless the user edits the field. `"4/5"` is offered
   as "Alternating (4/5)?" **(unconfirmed)**.
3. Catalog import and new exercises default to **empty** (`"n/a"`), not a guess. The editor defaults to empty too
   **(unconfirmed)**.
4. The exercise detail line shows "Increment 2.5 kg" / "Alternating 4/5" instead of the raw string **(unconfirmed)**.

## Scope

`src/progress.js` (`validWeights`), `src/exerciseCatalog.js`, `src/views/Exercises.jsx`, `src/views/workout/setup.jsx`,
a new single-value parser + tests. **Named test edit:** `exerciseCatalog.test.js:68` asserts `'5'` and changes to `'n/a'`.

## Order vs siblings

After req-125. Before req-127 (both edit `Exercises.jsx`).

## Acceptance criteria

- **Unit:** `validWeights({weightStep:'2,5'})` = the 2.5 series; `'2.5 kg'` the same; `'Alt 4/5'` unchanged; `'n/a'`,
  `''`, `'abc'` → `[]`.
- **Failure case — hand-written list (unit; db.json only holds canonical values, so it can't fail):** `2,5`, `2.5 kg`,
  `2,5 kg`, `5 kg` → newly parse; `4/5`, `0`, `-2.5`, `alt 4/5`, `abc`, `''` → `[]`; the canonical `n/a`, `5`, `2`,
  `10`, `Alt 4/5` → identical to main.
- **No silent overwrite (unit/browser):** open an exercise with `"abc"`, Save without touching the field → still `"abc"`.
- **Catalog (unit):** an imported machine/free exercise has `weightStep: 'n/a'`.
- **Browser:** enter "2,5" → saved `"2.5"`; tick Alternating → saved `"Alt 4/5"`.
- `./check` green (receipt quoted).

## Decisions

- Number + Alternating (Emilio, DEC-059 §2). Editor default empty, and the display wording **(unconfirmed)**.
