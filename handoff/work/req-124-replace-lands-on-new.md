# req-124 — Replace exercise lands on the new exercise (audit Tier 3, DEC-059 §1)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[ux-feel]** Navigation only. No trigger files.

## Why [measured, audit gym reviewer]

After picking a replacement, `replace.jsx:43` goes to the overview (`go('/workout/:r', {replace:true})`), costing one
extra tap before logging it. The replacement stays 1 blank set (DEC-059 §1).

## The behaviour

After a successful Replace, go straight to the new exercise's log screen (`itemLogPath`), replacing the picker in
history (as now). Cancel on the picker is unchanged.

## Scope

`src/views/workout/replace.jsx`; a static test.

## Acceptance criteria

- **Browser (puppeteer):** Replace → pick → the log screen of the new exercise, set 1/1.
- **Failure case:** Cancel → back to the original's log screen, nothing changed.
- `./check` green (receipt quoted).
