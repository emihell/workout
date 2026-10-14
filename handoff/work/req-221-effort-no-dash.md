**Status: BUILT AND MERGED, 2026-10-14 — branch `req-221` (`346aca9`…`346aca9`, 1 commit).** **Lane: ui** — a shared control's look; writes nothing new.

# req-221 — effort picker: no "—" segment; tap the picked one again to clear

DEC-125 §1 (Emilio, batch 6 I6/I8: "What is effort ”-”?"; "ill go with your recommendations"). Effort stays once per exercise,
Easy · Medium · Hard (DEC-119 §1). Builder: throwaway agent (DEC-055).

## Facts (rescanned 2026-10-14, `main` 73cdf1e)

- `SegmentedControl({ clearable })` prepends `{ value: '', label: '—' }` (`ui/index.jsx:66`); selected = `String(optValue) ===
  String(value)` (`:72`) → with nothing picked the "—" segment is the selected one, so it reads as a 4th option.
- Three `clearable` call sites: exercise review effort (`views/workout/item.jsx:789`, `EFFORT_OPTIONS` = Easy/Medium/Hard,
  `ids.js:33`); History set edit effort (`views/set-edit.jsx:189-194`, **`RPE_OPTIONS` — still includes Failure**); History
  workout Feel (`views/history/edit.jsx:39-45`). Plus the Showcase block (`ui/Showcase.jsx:168-174`).
- Tests asserting the dash: `req-212.test.js:206-208, 468-470`, `req-167.test.js:125-127`.
- Seed Plank (`db.json:75-82`) has no `hasDuration`, so it gets no countdown (`DurationTimer` renders only when timed,
  `ui/index.jsx:730-731`; `timedSet = ex.hasDuration && …`, `item.jsx:400`). Old seed sets log it as `reps: "60 sec"`
  (`db.json:1004-1011`). 10+ tests read `db.json` (`grep -rln db.json src`).

## Scope

1. `SegmentedControl` `clearable`: **no extra segment**. Nothing picked → no segment selected. Tapping the **selected** segment
   fires `onChange('')` (cleared); tapping another picks it. Non-clearable controls unchanged.
2. History set edit: options Easy · Medium · Hard. A set already saved with Failure (rpe 5) still shows a selected **Failure**
   segment (appended only for that set), so opening and saving an old set never changes its effort.
3. Seed only: `db.json`'s `ex-plank` gets `hasDuration: true` and `durationSec: 60`. Old seed sets untouched.
4. Showcase block updated to match.

## Out of scope

Effort per set; Failure back on the review; any change to `progress.js`; the user's stored Plank (he fixes it in Exercises, DEC-125 §6);
a "link to the bank's exercise" offer (DEC-125 §6, not built).

## Acceptance criteria

1. Rendered: review screen of an exercise with a logged work set, no effort → three radios, **none** `aria-checked="true"`, no "—".
2. Rendered: tap Medium → Medium checked and the item's sets carry rpe 3; tap Medium again → none checked, sets rpe null.
3. Rendered: History set edit of a set with rpe 5 → four radios, Failure checked; save without touching → rpe stays 5.
   Of a set with rpe 3 → three radios, no Failure.
4. History workout Feel: none checked when unset; tap the picked one → cleared, saved `overallFeel` is `''`.
5. **Failure case — could it pass for the wrong reason?** Criterion 1 asserts the count of checked radios is 0 **and** that no radio
   has the text "—" (a test that only checks labels would pass with the dash still selected).
6. Seed: with the QA seed, Plank's log screen shows the Duration timer; every test reading `db.json` stays green.
7. Test edits to `req-212` / `req-167` are listed in the report with the reason (DEC-125 §1 replaces the dash).
8. `./check` green.

## Decisions made on Emilio's behalf

- **behaviour** `(unconfirmed)`: clear = tap the selected segment again (no visible "clear" control). Applies to Feel too (one control).
- **behaviour** `(unconfirmed)`: History set edit keeps an old Failure visible on that set only, so nothing is changed by opening it.
- implementation: the seed Plank fix rides here (one line in `db.json`, not a user record).

## READY checks

1. DECs: DEC-108 §1–2 (Failure, per-set) superseded by DEC-119 §1; DEC-125. 2. Siblings: req-222..225 don't touch `SegmentedControl`;
   req-223 edits `item.jsx`'s review (`:796-801`) — different lines, either order. 3. none. 4. counts from grep above.
5. No trigger file. 6. marked.
