# req-118 — routine editor reads numbers correctly (audit A, DEC-058 §1, §6, §7)

**Status: BUILT AND MERGED, 2026-09-23 — branch `req-118` (`cb98ced`…`cb98ced`, 1 commit).** Phase 1. **[ux-feel]** Setup input only; no stored-data rewrite.
**Depends on req-120** (otherwise a cleared Kg is refilled on reload, see Why). Revised 2026-09-23 after the spec
review.

## Why [measured, scratchpad/audit-setup + specrev2]

`Routine.jsx:305-322` splits Reps, Kg and Duration on `/[/,]/`, drops invalid tokens, and takes
`count = max(sets, targets, weights, durations, 1)`. Measured:
- `Kg "22,5"` → `[22,5]`, 2 sets;
- Sets 3 → 2 with Reps `8/8/8` → saved `sets: 3`;
- `abc/20/-5` → `[20,-5]`;
- `20kg/22kg` → `[]`;
- blank Kg or Duration → `[0]` (a 0 s target beats the exercise default via `??`, `workout-log.js:406`).

Reps pads a short list with its last value (`parseTargets`, `ids.js:111-113`); Kg is sliced (`Routine.jsx:328`) and
read with no fallback (`item.jsx:218,243`; `workout-log.js:74`). Also, `migrateRoutine` refills an empty
targets/weights list from `legacyRecommendations` on every load (`model.js:31-43`). A blank Kg stored as `[]`
would come back as `[40,40]` after a reload, unless req-120 lands first.

## The behaviour

1. **Separators:** in **Reps** and **Duration**, `/` and `,` both separate sets (DEC-058 §6). In **Kg**, `/`
   separates and `,` is a decimal point (§1): `22,5` → 22.5, `20/22,5` → `[20, 22.5]`.
2. **Parse by position.** An invalid or negative token is an **inline field error** that blocks Save, never dropped
   or shifted. `kg`/`s` suffixes are accepted and stripped **(unconfirmed)**.
3. **Sets is authoritative** **(unconfirmed)**. A list longer than Sets is an inline error ("3 sets, 4 reps
   given"). A shorter list **repeats its last value**, for Reps (as today) and now for Kg (§7) and Duration
   **(unconfirmed for Duration)**. Lowering Sets works.
4. An **empty** Kg or Duration field means "not set" (stored as `[]`), so the exercise default / history applies.
5. A pure parser in a `.js` module with tests; the view only shows its errors.

## Scope

`src/views/Routine.jsx` (item editor), a new pure parser module + tests, `ui.css` if needed.

## Out of scope

The per-set grid redesign (Phase 2); existing stored routines (not rewritten); the weight-step field.

## Order vs siblings

After **req-120** (the routine-baseline refill); before req-116.

## Acceptance criteria

- **Kg (unit):** `22,5` → `[22.5]`; `20/22,5/25` → `[20,22.5,25]`; `abc/20` → error at position 1; `-5` → error;
  `20kg/22` → `[20,22]`; `''` → `[]`.
- **Reps/Duration (unit):** Reps `8,8,8` → `['8','8','8']`; Duration `30,45` → `[30,45]`; `AMRAP`, `30s`, `8-12`
  are kept as text targets.
- **Sets (unit):** Sets 2 + Reps `8/8/8` → error; Sets 3 + Reps `8` → `[8,8,8]`; Sets 3 + Kg `40` → `[40,40,40]`.
- **Failure case — blank Duration (unit):** timed exercise, blank Duration → the target is the exercise default,
  not 0.
- **Failure case — cleared Kg survives reload (unit, needs req-120):** an item that has a `legacyRecommendations`
  baseline, Kg cleared → `migrateState` → still `[]`.
- **Browser:** the inline error shows and Save is blocked; after fixing, Save works.
- **No regression:** `./check` green. Receipt quoted.

## Decisions

- Comma = decimal in Kg only; comma separates in Reps and Duration; short Kg repeats (Emilio, DEC-058 §1, §6, §7).
- Sets authoritative with an inline error, suffix stripping, and short Duration repeating **(unconfirmed)**.
