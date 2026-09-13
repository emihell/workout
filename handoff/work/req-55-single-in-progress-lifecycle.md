# req-55 — One in-progress workout: hero-replacement, stale lifecycle, abandon-on-new

**Status: READY.** Model decided with Emilio 2026-09-13 (DEC-038). Supersedes req-53's
*display* (the standalone second hero) and removes the multi-draft feature.

**Gate: ux-feel + persisted-data.** Touches the store/model (`store.jsx`) and several
views → **independent reviewer subagent before merge** (DEC-035). It changes how the
user's saved in-progress/draft state is interpreted → **Emilio's eyes before merge**
(DEC-035 persisted-data carve-out); do NOT auto-merge. Add a migration test proving an
existing stored draft is surfaced, not dropped.

## Why

Two things from Emilio's req-53 after-look:

1. **No two heroes (correction to req-53).** req-53 shipped the in-progress workout as
   a *standalone hero above* today's block (`Today.jsx` `InProgressHero`). Emilio:
   *"no need to have two heroes, the one started should always take the place of the
   start … if i start tomorrow's workout today, only thing that should happen is that
   today's workout is the new one i started … when it's finished we can see today's
   routine again with the start button."* → the in-progress workout must **replace**
   today's Start hero, not sit above it.

2. **One in-progress, not a draft stack (DEC-038).** [measured] The app keeps multiple
   unfinished workouts as **drafts**: `startWorkout` pushes the current active into
   `draftWorkouts` (`store.jsx:221-228`); `resumeDraft` swaps one back
   (`store.jsx:251-261`); `Start.jsx:20-38` lists drafts to resume; the start-while-
   active confirm is *"Save draft?"* (`workout-actions.js:10`). Emilio wants exactly
   **one** in-progress workout: *"if you try to start a new workout while another one
   is in process, tell user that starting a new one will abandon the one in progress."*

## The model (decided — DEC-038)

**Exactly one in-progress workout** = `store.activeWorkout`. No draft stacking.

- **Start-while-active → abandon, with warning.** `startOrContinue`
  (`workout-actions.js:4-23`), when a *different* workout is active, confirms
  **"Starting a new workout will abandon the workout in progress. Continue?"** → on OK,
  **abandon** the current active (`store.abandonWorkout()`, `store.jsx:264`) then start
  the new one; on Cancel, nothing. Replaces the `"Save draft?"` path (`:9-11`).
- **Abandon = discard entirely** — `activeWorkout → null`, **no history record** (an
  unfinished workout is not completed history — DESIGN §1). *(Decided on Emilio's
  behalf; reversible.)*
- **Remove the draft mechanism:** `startWorkout` no longer writes `draftWorkouts`;
  remove `resumeDraft` and the `Start.jsx` draft list. (Legacy stored drafts: below.)

## Display lifecycle (keyed off the day it was STARTED — `dateKey(activeWorkout.startedAt)`, `store.jsx:237`)

- **Started today → the single HERO**, replacing today's scheduled Start block on the
  Workout page. Finish or abandon → today's scheduled block returns with **Start**.
  This holds whether the started workout is today's slot, tomorrow's-started-early, or
  an off-schedule routine — it is the one hero. **Removes req-53's `InProgressHero`
  standalone-above display** (no stale code).
- **Started on a prior day (stale, still unfinished):**
  - No longer the hero — today's scheduled block shows its normal Start.
  - Appears in the main-page **recent/History peek** as a row with a secondary
    **Continue** (mirroring `UpcomingRow`'s inline Start, `Today.jsx:100-124`), when it
    falls within the shown recent window.
  - Appears in the full **History view** as a row with **Continue + Abandon**.
  - Marked as unfinished/in-progress, visually distinct from finished rows; **never**
    counted as completed history and never feeds recommendations (`progress.js`).

## Legacy stored drafts (non-destructive — Emilio: "surfaced once, then the mechanism goes")

Do **not** bulk-delete `draftWorkouts`. On load, surface any existing draft(s) in the
**same stale-in-progress UI** (History, Continue + Abandon) so they resolve through the
normal UI: Continue makes one active (abandoning any current active via the warning
above); Abandon removes it from `draftWorkouts`. Stop writing new drafts. Once resolved
the field is empty/vestigial (a later cleanup can drop it). **A migration test must
prove a stored key carrying a `draftWorkouts` entry still loads and surfaces it — not
silently dropped.** This is the persisted-data touch that gets Emilio's eyes.

## Scope

- `store.jsx`: `startWorkout` abandons-instead-of-drafts; remove `resumeDraft`; keep
  `abandonWorkout`; one-active invariant.
- `workout-actions.js`: start-while-active confirm → abandon wording + discard.
- `Today.jsx`: in-progress-today **replaces** today's hero (remove `InProgressHero`
  standalone); stale in-progress row (Continue) in the recent peek.
- `views/history/`: stale in-progress row(s) with Continue + Abandon; legacy drafts too.
- `Start.jsx`: remove the draft list + `resumeDraft` usage.
- Tests: abandon-on-new confirm+discard; hero replacement; stale placement; **legacy-
  draft migration** (surfaced, not dropped); an abandoned/stale in-progress never
  appears as finished history.

## Out of scope

- The bottom-menu Workout font (req-54).
- Finished-workout history display, recommendations (`progress.js`) — unchanged except
  that unfinished workouts must never enter them.
- The in-workout screens' own Abandon button (`workout/overview.jsx:89,116`) — keep.

## Ordered steps

1. `store.jsx`: stop drafting in `startWorkout` (abandon current active first); remove
   `resumeDraft`; keep `abandonWorkout`.
2. `workout-actions.js`: replace the `"Save draft?"` confirm with the abandon warning +
   discard-then-start.
3. `Today.jsx`: replace the standalone `InProgressHero` with hero-replacement (the
   in-progress-today occupies the today block; today's scheduled returns on
   finish/abandon); add the stale in-progress Continue row to the recent peek.
4. `views/history/`: render stale in-progress + legacy drafts as rows with
   Continue + Abandon; mark them unfinished.
5. `Start.jsx`: remove the draft list + `resumeDraft`.
6. Tests incl. the legacy-draft migration; `./check`.

## Acceptance criteria (written before implementation)

- **Hero replaces, not adds:** start a workout today (today's slot, tomorrow-early, or
  off-schedule) → it is the single hero in the today block, no second hero; finish or
  abandon → today's scheduled block returns with Start.
- **Abandon-on-new:** with one in progress, starting a different workout shows
  "Starting a new workout will abandon the workout in progress" — OK discards the first
  (it is gone, not a resumable draft; assert `draftWorkouts` did not grow), Cancel keeps
  it and does not start the new one.
- **Stale on main:** an in-progress started yesterday shows in the recent peek with a
  **Continue**, is NOT the hero, and today's Start hero shows normally.
- **Stale in History:** an in-progress started several days ago shows in History with
  **Continue + Abandon**; Abandon removes it and creates **no** finished record;
  Continue resumes it.
- **Legacy drafts (migration/failure case):** a store loaded with an existing
  `draftWorkouts` entry surfaces it in History (Continue/Abandon) and does not drop it
  — command: the migration test, output pasted.
- **Never completed (failure case):** a stale or abandoned in-progress workout never
  appears in finished history and never changes a recommendation — assert against
  `store.workouts` / `progress.js`.
- **No stale code:** req-53's `InProgressHero` standalone display and the `Start.jsx`
  draft list / `resumeDraft` are removed — grep in the report.
- **No regression:** `./check` green — paste the line; the migration test output pasted.

## Decisions

- **behaviour (Emilio, DEC-038):** one in-progress workout; start-while-active abandons
  it (with warning); in-progress-today replaces today's Start hero and today's returns
  on finish; stale in-progress → recent-row Continue / History Continue+Abandon; legacy
  drafts surfaced once (Continue/Abandon) then gone.
- **behaviour (decided on Emilio's behalf, reversible):** abandon = discard entirely,
  no history record; the stale-window cutoff for showing the Continue row on the main
  page mirrors the existing recent-peek window.
- **implementation (CC's call):** the in-progress row's visual marker; exactly how
  legacy drafts fold into the History list; the store shape after removing drafts.
