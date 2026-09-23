# req-118 — routine editor reads numbers correctly: comma decimal, per-position, Sets authoritative (audit A, DEC-058 §1)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[ux-feel]** Setup input only; no stored-data rewrite
(existing routines keep what they have).

## Why [measured, scratchpad/audit-setup]

`Routine.jsx:305-322` splits Reps, Kg and Duration on `/[/,]/`, drops invalid tokens, and takes
`count = max(sets, targets, weights, durations, 1)`. Measured:
- `Kg "22,5"` → `[22,5]`, 2 sets;
- Sets 3 → 2 with Reps `8/8/8` → saved `sets: 3`;
- `abc/20/-5` → `[20,-5]` (set 1 gets 20 kg; negative stored);
- `20kg/22kg` → `[]`;
- a blank Duration → `[0]` → a 0 s target (beats the exercise default via `??`, `workout-log.js:406`).

## The behaviour

1. **`/` is the only separator. In Kg and Duration, `,` is a decimal point** (DEC-058 §1): `22,5` → 22.5,
   `20/22,5` → `[20, 22.5]`.
2. **Parse by position.** An invalid or negative token is an **inline field error** that blocks Save, never
   silently dropped or shifted. `kg`/`s` suffixes are accepted and stripped **(unconfirmed)**.
3. **Sets is authoritative** **(unconfirmed)**. A list longer than Sets is an inline error ("3 sets, 4 reps
   given"). A shorter list is fine (the last value repeats, as today). Lowering Sets works.
4. An **empty** Kg or Duration field means "not set" (no `[0]`), so the exercise default applies.
5. Pure parser in a `.js` module with tests; the view only shows its errors.

## Scope

`src/views/Routine.jsx` (item editor), a new pure parser module + tests, `ui.css` if needed.

## Out of scope

The per-set grid redesign (Phase 2); existing stored routines (not rewritten); the weight-step field (BACKLOG
setup data quality).

## Acceptance criteria

- **Unit:** `22,5` → `[22.5]`; `20/22,5/25` → `[20,22.5,25]`; `abc/20` → error at position 1; `-5` → error;
  `20kg/22` → `[20,22]`; `''` → absent.
- **Sets (unit):** Sets 2 + Reps `8/8/8` → error; Sets 2 + Reps `8` → 2 sets, targets `[8,8]`.
- **Failure case — blank Duration (unit):** timed exercise, blank Duration → the target comes from the exercise
  default, not 0.
- **Browser:** the inline error shows and Save is blocked; after fixing, Save works.
- **No regression:** `./check` green; `AMRAP`, `30s` and `8-12` targets still kept as text. Receipt quoted.

## Decisions

- Comma = decimal point (Emilio, DEC-058 §1).
- Sets authoritative with an inline error, and suffix stripping **(unconfirmed)**.
