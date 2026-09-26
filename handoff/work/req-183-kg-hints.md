# req-183 — kg hints: last time when the routine is blank, a big-jump note

**Status: READY** (2026-09-26). **Lane: ui.** Source: DEC-102 (Emilio: "ill go with your recommandations"), Sam run prep §G 2–4.

## Today [read 2026-09-26, main `e6a1d30`]
- Set-log form `ui/index.jsx:466-490`: kg `NumberField` (`:468`); under it `No weight entered` when weighted and empty
  (`:486`, req-173); then `weightError`. The kg seed comes from the routine (req-178 chain, `workout-log.js`); a blank routine
  kg → blank box, nothing about history (Sam: chest press opened blank, "nothing about the 30/35/35 he lifted").
- Nothing checks size: Sam's 500 / 350 kg saved as-is (`{"weight":500}`).

## Change
1. **Last-time hint:** weighted work set, routine kg blank **at that index**, history has a kg for that set index (the same
   history lookup the seed chain used before req-178 — Builder names it) → a quiet note under the box: **"Last time: 30 kg"**.
   Box stays blank; no prefill. Routine kg set → no hint. Warm-ups: unchanged.
2. **Keep** "No weight entered" (DEC-102 §2). When both apply, show "No weight entered · last time 30 kg" as one line.
3. **Big-jump note:** weighted set, box has a kg > 0, reference = routine kg at that index, else last-time kg; if
   `|kg − ref| / ref > 0.5` → note **"That's a big change from 50 kg"**. Live while typing; no dialog, no block; Complete logs
   as today.

## Out of scope
Blocking Complete; bodyweight/assisted exercises (not `weighted`); warm-up sets; History set edit (`set-edit.jsx`); the
recommendation (`progress.js`).

## Steps
1. A pure helper (e.g. `src/kg-hints.js`): `kgHints({ weighted, kg, routineKg, lastKg })` → `{ lastTime, bigJumpFrom }`; unit
   tests incl. comma decimals (`readKg`, DEC-058).
2. Pass `routineKg` / `lastKg` for the set into the form from `workout/item.jsx` (it already computes the seed inputs).
3. Render the notes under the box (`ui-field-note`), after the existing one.
4. `src/req-183.test.js`; `./check --smoke`.

## Acceptance criteria
1. Routine kg blank, history 30 at set 1 → box empty, "Last time: 30 kg" shown; routine kg 30 → no hint (rendered).
2. Routine 50, typed 500 → "That's a big change from 50 kg"; typed 60 → none; typed "75" → exactly 50% → none; "76" → note.
   Routine blank, last 30, typed 50 → note "from 30 kg".
3. **Failure case:** Complete with the note showing logs the typed kg in one tap, no dialog (stored `weight: 500`).
4. Bodyweight exercise / warm-up set → no hints.
5. Browser (Planner, 390×844): both notes readable, the Complete button not pushed off-screen.
6. `./check --smoke` green.

## READY checks
DECs: DEC-102, DEC-096 §5 (amended), req-173, DEC-058 (comma decimal), DESIGN §1 (a named history value, not a prefill).
Siblings: none. Trigger files: `workout-log.js` only if the history lookup must be exported from it → reviewer runs; prefer
reading it via an existing export. No data change.
