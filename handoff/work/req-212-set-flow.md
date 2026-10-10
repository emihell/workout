**Status: READY** **Lane: ui** — with the **data gate**: it changes what a logged set stores (`rpe` source, new `loggedAt`) and
touches `workout-log.js` → independent reviewer, backup reminder (DEC-046), **Emilio's eyes before merge** (he asked to check it).
No schema bump, no migration, no rewrite of stored records.

# req-212 — set flow: one Done per set, an edit sheet, an exercise review with one effort

DEC-119 §1 (Emilio, 2026-10-10, BACKLOG §batch 5 H5–H8, H11, H12). Supersedes DEC-108 §1–2. Builder: **Builder session**
(ux-feel, DEC-055). **Build first of req-212..217**; req-217 (rest notes) builds on this screen after it.

## Facts (rescanned 2026-10-10, `main` 25d366a)

- Bottom bar `ui/index.jsx:813-857`: Previous (`canGoBack`) · Skip set · Next/Save when viewing; caption "Log set — how did it
  feel?" + Easy/Medium/Hard/Failure, each `submit(value)` → `completeSet` (`views/workout/item.jsx:232-279`). Warm-up/cardio:
  one Done (`index.jsx:853-856`).
- Set record built at `item.jsx:258-274`; `rpe: rpe ? Number(rpe) : null`. No timestamp on sets. `withLoggedSet` appends
  (`workout-log.js:765-771`).
- `RPE_OPTIONS` Easy 2 · Medium 3 · Hard 4 · Failure 5 (`ids.js:23-28`).
- `recommendNextPrescription` reads each set's own rpe by index (`progress.js:164-203`): missed reps or rpe ≥ 5 → down; rpe ≤ 2
  and not missed → up; else keep. Only caller chain ends at History recalc (`store.jsx:225`).
- Viewing a logged set is `viewIndex` state on the same form (`item.jsx:316-368`); a done row in the set list calls
  `openLoggedSet` (`item.jsx:328-333`); future rows inert (`item.jsx:555-559`).
- Last set → `markDoneAndGoToOverview` (`item.jsx:283-287`), then the routine-kg confirm (`askRoutineUpdate`, `item.jsx:111-122`).
- Re-entering a done exercise renders `WorkoutItemDone` (`item.jsx:678-733`): "Today" set lines + Add set.
- Set list is ad-hoc `ui-setpreview` markup (`item.jsx:540-564`), not a library component; `ui-item-note` has no CSS rule; the
  head is an ad-hoc div (`item.jsx:66-85`).
- Stored sets pass migration with unknown fields kept (`model.js:171-183`, `242-254`: `...rest`); `exchange.js` /
  `import-backup.js` don't name `rpe` → a new optional set field survives load, export and import [measured: grep, 2026-10-10].
- History edits a set's rpe per set (`views/history/edit.jsx`, `views/set-edit.jsx`) — untouched here.

## Scope — ordered

1. **Set screen.** A work set's bottom bar is **Skip set** (quiet) + **Done** (primary). Done logs the set with `rpe: null`.
   The effort caption and the four buttons go. Warm-up / cardio keep their Done (unchanged).
2. **Previous and Next go.** A done row in the set list opens an **edit sheet** (new library component, in Showcase) over the
   screen: that set's own fields (kg + reps, or duration, or the cardio fields), **Save** and **Cancel**. Save writes through
   the existing `store.updateActiveSet` path; the rest timer is untouched (as `saveViewedSet` today). No effort in the sheet.
   Future rows stay inert.
3. **`loggedAt`.** Every set logged from now on (Done and Skip set) stores `loggedAt` (ISO string, `new Date().toISOString()`).
   Editing a set never changes it. Nothing displays it yet.
4. **Exercise review** replaces `WorkoutItemDone` and is where the last Done lands (instead of the overview):
   - the exercise name, each set line (tap → the same edit sheet), the ↑ N% line when there is one (DEC-117 §1, same helper);
   - **Effort: Easy · Medium · Hard** (`SegmentedControl`, nothing preselected). Hidden when the exercise has no work sets
     (warm-up-only / cardio);
   - primary **"Next: {next not-done exercise}"**, secondary **"Choose exercise"** (→ the overview), quiet **Add set** (kept).
     When no exercise is left, the primary is **Finish** (→ the existing finish / auto-complete path);
   - picking an effort writes that value to `rpe` on **every logged, non-skipped work set of this item** in the active workout.
     Changing it rewrites them. Effort stays optional: leaving without one keeps `rpe: null`.
   - The routine-kg confirm (DEC-103 §1) opens over the review instead of the overview, same text and buttons.
5. **Effort values.** Easy 2 · Medium 3 · Hard 4 (existing numbers). Failure is no longer offered anywhere new. `RPE_OPTIONS`
   keeps 5 for reading and labelling old sets (History still shows "Failure" on an old set). `progress.js` is **not changed**.
6. **Layout cleanup (H5).** The set list becomes a library component (in Showcase); the head uses library parts; no ad-hoc
   classes without CSS. Note under the title stays until req-217 moves it.

## Out of scope

- The rest timer learned from set gaps (H8) → BACKLOG. Showing `loggedAt` anywhere.
- History's per-set effort editing and display (stays per set). A History-level "exercise effort" → BACKLOG if wanted.
- Any change to `recommendNextPrescription`. Notes during rest (req-217). Auto-advance without a tap.
- Rewriting old stored sets' rpe (old Failure values stay).

## Acceptance criteria

1. Logging a work set takes one tap (Done); the stored set has `rpe: null` and a parseable `loggedAt`. (unit + browser)
2. The set screen has no Previous / Next button; tapping a done set opens the sheet; Save changes only that set's kg/reps; the
   rest countdown is the same before and after. (browser, stored-value receipt)
3. Last Done → the review, not the overview. Picking Medium sets `rpe: 3` on each logged work set of that item and **not** on its
   warm-up, a skipped set, or another exercise's sets. (unit on the store action)
4. **Failure case — no effort picked:** Next from the review stores `rpe: null` on that item's sets, and History recalc on that
   workout returns **Same load** for it (`recommendNextPrescription` with null rpe → keep). (unit)
5. **Is the right mechanism answering?** A unit test asserts Easy on the review → recalc moves that exercise's kg one valid step
   up, through the real `progressionForItem`, not a stubbed rpe.
6. An old workout with per-set rpe 5 still loads, shows "Failure" in History, and recalc still moves it down. (fixture test)
7. Export → Import round-trip keeps `loggedAt` and the review-written rpe. (unit)
8. The routine-kg confirm still appears when the logged kg differs from the routine, now over the review. (browser)
9. `./check` green.

## Decisions made on Emilio's behalf

- **behaviour** `(unconfirmed)`: effort is optional — leaving the review without one stores none (= Same load next time).
- **behaviour** `(unconfirmed)`: the one exercise effort is written to every work set's `rpe`, so the existing per-set rule reads
  it; a set with missed reps still goes down on its own index even when the exercise is Easy (Planner told Emilio "missed reps
  on any set → down"; the per-set rule is kept to avoid touching `progress.js` — **flag on his list**).
- **behaviour** `(unconfirmed)`: the review's primary is "Next: {exercise}" in list order; "Choose exercise" returns to the list.
- **behaviour** `(unconfirmed)`: Skip set also records `loggedAt`.
- **implementation:** no schema bump — `loggedAt` is an optional additive field (survives `migrateState`, `model.js:171-183`);
  the edit sheet is a new component, not a `ConfirmSheet` variant.

## READY checks

1. DECs grepped: effort / rpe / Previous / review → DEC-012, DEC-052, DEC-103 §4, DEC-108 §1–2 (superseded), DEC-117 §1.
2. Siblings: req-217 edits the same screen (after this). req-10 (first-time calibration) reads per-set effort in its DEC-012
   design → **req-10 must be rescanned after this merges** (its "effort on the set" step no longer exists).
3. Deferral re-priced: the auto-timer needs `loggedAt` on history; recording it now is the cheap part.
4. Numbers: rpe values from `ids.js:23-28`.
5. Trigger files: `workout-log.js`, likely `store.jsx` → reviewer + backup reminder.
6. Visible calls marked above.
