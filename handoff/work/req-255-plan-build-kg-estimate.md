**Status: READY** · **Lane: tooling** · DEC-153, DEC-096, DEC-141/142, req-254 (C5). After req-254 (merged).

# req-255 — `plan build`: a Coach-estimate kg, opted in per item

## Why (observed)

Coach run 5 (2026-10-31) had to give Emilio starting weights for Back Squat 50 / Row 40 as text to type in, because C5
refuses any kg > 0 on an exercise with no history (`server/plan-build.mjs:134-138`) [measured, read 2026-10-31]. Emilio
(DEC-153): a routine's kg may also be "recommended by you", "label it in the backend, dont expose it to the user in app".
Source: `workout-data/coach/run-5/for-planner.md` items 23, 30.

## Scope

1. **A new optional item field in the change list: `kgEstimate`** — a non-empty string, Coach's reasoning (e.g.
   `"from Deadlift 75×8, Goblet 20×10, Leg Press 80×10"`). Accepted wherever item fields are (`item.set`, `routine.items`
   item, `routine.add` item): add it to what `onlyKeys` allows in `itemFields` (`server/plan-build.mjs:93-98`), **not** to
   `ITEM_FIELDS` (`:28`) — `itemFields` copies only `ITEM_FIELDS` into the item (`:96`), so the label never reaches the
   stored routine item or the plan file (DEC-153 §3).
2. **C5 with the opt-in** (`:134-138`): a changed kg > 0 on an exercise with no history is allowed **only** when that
   item carries a valid `kgEstimate`. Without it → refused exactly as today.
3. **Refusals for a wrong opt-in:**
   - `kgEstimate` empty, whitespace-only, or not a string → refused.
   - `kgEstimate` on an item whose exercise **has** history → refused ("history exists: a kg comes from it, DEC-153 §1";
     drop the label). Keeps the label true.
   - `kgEstimate` with no kg > 0 changed on that item → refused (a label with nothing to label).
4. **Printed:** the item's build line ends with `(coach estimate: <kgEstimate>)` — for a new item in place of
   `starting plan, no kg` (`newItem`, `:245-252`), for a changed item after its `kg a → b` diff (`:355`, and the
   `routine.items` diff at `:266-267`). Plus one summary line before the counts: `coach estimates: N item(s)` (0 → omitted).
5. Tests: `server/req-255.test.mjs`, temp data dirs only (BACKEND rule 8), reusing req-254's fixtures
   (`server/req-254.test.mjs`). Usage line in `ops-cli.mjs:1-11` names the field.
6. `CAPABILITIES.md`/`COACH.md` are Planner's — don't edit `handoff/`; list in the report what they should now say.

## Out of scope

- Any field on the stored routine item, `model.js`, sync, or anything the app shows (DEC-153 §3) — no app change at all.
- Kg for exercises **with** history (unchanged: C5 allows it today).
- `plan preview` / `plan apply` changes: the output file has no new field, so C7 (`readPlanFile` + `planChange`) runs as is.
- In-app "estimate" labels for other users (DEC-153 §5, later).

## Acceptance criteria

1. **Opt-in passes:** a change list adding Back Squat (no history) to a routine with `suggestedWeights: [50,50,50]` and
   `kgEstimate: "from Deadlift 75×8"` → exit 0; the line reads `… + item Back Squat (coach estimate: from Deadlift 75×8)…`;
   `coach estimates: 1 item(s)` printed; C7 passes.
2. **The label doesn't leak (right mechanism):** in that `--out` file, the item has `suggestedWeights [50,50,50]` and **no**
   `kgEstimate` key anywhere (`JSON.stringify(file).includes('kgEstimate') === false`).
3. **Failure — no label, same input:** without `kgEstimate` → exit 1, req-254's C5 refusal text unchanged, no `--out` file.
   req-254's AC4/AC5 C5 cases still pass unedited (`server/req-254.test.mjs:157-183, 203`).
4. **Failure — wrong opt-ins** (each exit 1, refusal on screen, no file): `kgEstimate: ""`; `kgEstimate: "  "`;
   `kgEstimate: 50`; `kgEstimate` on an exercise with history; `kgEstimate` with `suggestedWeights: []`.
5. **`item.set` path:** setting kg on an existing no-history item with `kgEstimate` → `kg — → 40/40/40 (coach estimate: …)`.
6. `./check` green; `node --test server/` green.

## Checks run (WORKFLOW §Before READY)

1. DECs grepped (kg, estimate, coach, C5, invent): DEC-096, DEC-141/142, DEC-146, DEC-151, DEC-152, DEC-153.
2. Siblings: req-254 (merged, same file). The "12 reps" bug req (not yet written) touches `isDurationTarget` → C6, not
   C5; either order works, both touch `itemProblems` (`:102-150`) — a rebase at most.
3. Deferral: storing the label on the item is deferred to DEC-153 §5 (other users); then it is a model + sync change.
4. Numbers: line refs read from `main` `10a3d96`, 2026-10-31.
5. Trigger files: none (server ops only; no store/model/storage/progress/workout-log). No reviewer required, no backup.
6. `(unconfirmed)`: none user-visible in the app. Field name `kgEstimate` (one string, not Coach's suggested
   `kgSource` + `why`) — implementation, Planner's.

## Decisions made on Emilio's behalf

- **implementation:** one field `kgEstimate` instead of two; label lives in Coach's files + build lines, not the DB (DEC-153 §3,
  marked `(unconfirmed)` there); a label on a history exercise is refused rather than ignored.
