# req-150 — stop the three wrong load recommendations: hold instead of guessing

**Status: BUILT AND MERGED, 2026-09-24 — branch `req-150` (`9c75c7e`…`9c75c7e`, 1 commit).** — Phase 1, a small fix. **Gate: functional**; it touches `src/progress.js`, so DEC-057 §1 **fires**: an
independent reviewer before merge, no backup needed (no stored-data change). Emilio 2026-09-24 (DEC-075): "i dont want the
app to change anything yet… a separate req where we set the rules… for now do not touch them — but if there is an issue
fix it." So this req **adds no new progression rules**. It only stops three known-wrong answers by **holding** (no change)
where the app can't judge correctly. The real rules come in **req-149**.

## Why [measured, req-144 prep §A, `work/req-144-creation-design/prep.md`]

`recommendNextPrescription` (`progress.js:~74-149`) judges each set: a miss or Failure → one step down, Easy → one step
up, otherwise hold.
1. **Rep range** ("8-12"): the target parses to NaN, so a set is never "missed". 5 reps on 8–12 holds, but "Easy" still
   steps **up**, judged against a target the app can't read.
2. **AMRAP:** the reps done are ignored, and only effort decides.
3. **Assisted machines** (kg = assistance, more kg = easier): a miss steps the kg **down** = less help = harder.

## The behaviour

For a set whose target the app **can't read as a plain number** (a range, AMRAP, or any non-numeric text), or for an
exercise that is **assisted**, the recommendation for that set is **hold**: same kg, same target, whatever the effort. The
visible reason says so ("target isn't a single number — kept as is" / "assisted: kept as is"). Everything else is
unchanged, byte for byte.

**How "assisted" is known:** library entries `own-assisted-pull-up`, `own-assisted-dip`, `Band_Assisted_Pull-Up`, via the
exercise's `libraryId`, **or** an exercise name containing "assisted" (case-insensitive). This is interim; req-149
defines a proper flag.

## Scope

`src/progress.js` (+ tests), and wherever the reason string is built. Nothing else. No new fields, no stored-data change.

## Out of scope

New progression rules for ranges, AMRAP or assisted machines (req-149). Any routine write (DEC-056 stands: the
recommendation is never auto-applied).

## Acceptance criteria (written before implementation)

- **Holds (tests, each failing on `main`):** a range target "8-12" with 5 reps + Easy → hold; with 12 reps + Easy → hold;
  "AMRAP" target with any reps/effort → hold; an assisted exercise (by libraryId and by name) with a missed set → hold
  (kg unchanged), and with Easy → hold.
- **Unchanged otherwise:** every existing `progress.test.js` case passes **unedited**, plus a property test: for numeric
  targets and non-assisted exercises, the output equals `main`'s output over a generated set of inputs.
- The reason text for a held set is visible and says why.
- The independent reviewer's verdict is in the report. `./check` green; paste the line.
