# req-30 — no invented warmup reps (audit F1) + README wording (audit F2)

**Status: BUILT AND MERGED, 2026-09-11 — branch `req-30` (`cd26172`…`cd26172`, 1 commit).**
Source: audit 2026-09-11 (findings F1, F2). Decision: DEC-022.
Type: Trust-rule fix (setup UI) + doc. Gate: ux-feel → Emilio's hands before merge
(it changes what a warmup shows in the gym).

## Why

DESIGN §1 (Trust, priority #1): *"the app never invents data it doesn't have… Never
invent warmup (e.g. 50% / 12 reps)."* The routine editor violates this: ticking the
**"WU set"** checkbox stores `{ reps: 12 }` — a rep target the user never entered
(`Routine.jsx:278`; the checkbox has no reps field, `Routine.jsx:292`). That 12 then
surfaces as the warmup target in the live workout (`item.jsx:179`) and on skipped
warmups (`workout-log.js:60`). Emilio: *"it should not invent anything — we do not know
if 12 is good."*

## Scope

**In:**
1. **Routine editor — add a warmup-reps input.** When "WU set" is checked, show a reps
   field (a `NumberField`/`Field`, label e.g. "Warmup reps") beside/under the checkbox.
   - New warmup: the field starts **blank** — no default, nothing pre-filled.
   - Editing an existing warmup: the field shows the **saved** `item.warmup.reps` (that's
     the user's own saved value — allowed to display, per DESIGN §1's "editing an existing
     record may show that record's saved values").
   - On submit: `warmup: warmup ? { reps: <entered> } : null`. **Remove the `|| { reps: 12 }`
     fallback** (`Routine.jsx:278`). A blank entry stores a warmup with no reps
     (`{ reps: '' }` or `{}` — CC's call, but nothing downstream may substitute a number).
   - Hide/ignore the reps field when "WU set" is unchecked.
2. **Live workout target — drop the `?? 12`.** `item.jsx:179`:
   `String(item.warmup?.reps ?? 12)` → show the saved reps, or **blank** when there is none
   (`String(item.warmup?.reps ?? '')` or equivalent). A warmup with no reps shows no rep
   target; the set-log Reps field then starts blank (consistent with the prefill rule —
   Reps prefills from the target, and an absent target means an empty field, not 12).
3. **Skipped warmup target — drop the `?? 12`.** `workout-log.js:60` (`skippedSet`):
   the `setType === 'wu'` branch must not substitute 12. A skipped warmup with no reps
   records `targetReps: ''`, not `12`.
4. **README wording (audit F2).** `README.md:31` calls `src/db.json` "first-run data",
   but first run is empty — `emptyState()` returns empty arrays and nothing imports
   `db.json` at runtime. Reword to say db.json is **provenance/reference only, not loaded
   at runtime** (first run starts from an empty state). One sentence; it is the product
   contract, so Emilio approves it via the branch.

**Out of scope (do NOT do):**
- **No migration / no rewrite of existing stored routines.** Routines already saved with
  `{ reps: 12 }` keep that value until the user next edits that exercise. Rewriting them
  would be an invisible bulk edit to the user's real setup data (CLAUDE.md ask-gate) and
  we cannot tell which saved 12s a user might have accepted. Go-forward behaviour only.
  This is **not** a schema change — `warmup` already holds `reps`; no version bump.
- The other `{ reps: 12 }` mentions in `exchange.js` (AI-import contract *example* text,
  `:39`, `:101`) — those document the field's shape, they don't inject a default. Leave
  them, or at most change the illustrative number to `N`; not required.
- Audit F3 (exported-but-internal helpers) — explicitly **not** in scope (skipped).
- Any styling beyond placing the new field consistently with the existing editor fields.

## Ordered steps

1. `Routine.jsx` — add `warmupReps` state seeded from `item.warmup?.reps` (blank for new);
   render the reps field gated on the `warmup` checkbox; change the submit to
   `warmup ? { reps: warmupReps } : null` with no `|| { reps: 12 }`.
2. `item.jsx:179` — remove the `?? 12`.
3. `workout-log.js:60` — remove the `?? 12` in the `wu` branch.
4. Update/extend a `workout-log.test.js` case so a warmup item **without** `reps` yields
   an empty `targetReps` on skip (not 12) — the failing-before/passing-after receipt for
   step 3. (Existing `warmup: { reps: 12 }` tests should still pass unchanged — that's a
   user-entered 12, still honoured.)
5. `README.md:31` — reword per F2.
6. `./check`; browser-walk the routine editor (toggle WU, type reps, leave blank) and a
   live workout with a warmup (blank target shows nothing; a set-log with a blank warmup
   target starts the Reps field empty).

## Acceptance criteria (write before implementing)

- [ ] Ticking "WU set" in the routine editor reveals a warmup-reps field that starts
      **blank** for a new warmup and shows the saved value when editing one.
- [ ] Saving a WU set with the reps field **blank** stores a warmup with **no** rep number
      (no 12 anywhere). `grep -n "?? 12\|{ reps: 12 }" src` shows no remaining *invented*
      default (the `exchange.js` example text may remain).
- [ ] In a live workout, a warmup whose saved reps is absent shows **no** rep target (blank),
      and the set-log Reps field for that warmup starts empty.
- [ ] A warmup whose reps the user **did** enter (or an existing routine's saved 12) still
      shows that number — nothing was rewritten on disk.
- [ ] A skipped warmup with no reps records `targetReps: ''` (new/adjusted test passes).
- [ ] `README.md` no longer calls `db.json` "first-run data".
- [ ] `./check` green; report `reports/req-30.md` with the test output and a browser-walk note.

## Notes for the builder

- Trust is DESIGN priority #1, so this is a real correctness fix, not polish — but it is
  small and touches setup (the routine editor), not the in-gym logging path.
- The visible change to call out at the merge gate: a brand-new warmup with no reps typed
  now shows a **blank** rep target in the gym instead of "12". That is the intended
  behaviour (invent nothing); Emilio will judge whether a blank warmup target feels right.
